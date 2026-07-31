/**
 * FlowSign (VideoWall) — duvar tanımı CRUD. Online: Firestore `videowalls/{id}`.
 * Self-host'ta bu dosya veri katmanının takas noktası (bkz. docs/VIDEOWALL.md).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { ScreenBeat, Videowall, VideowallPlayMode, Zone, ZoneItem } from "./types";

/**
 * Öğe şu an takvimde mi? (gün + saat penceresi; boşsa hep). Gece yarısını aşan
 * pencere desteklenir (22:00–06:00). Perde OYNATIRKEN ve editör "takvim dışı"
 * rozetini gösterirken aynı fonksiyon kullanılır — asla ayrışmasınlar.
 */
export function itemInWindow(item: ZoneItem, now: Date): boolean {
  if (item.days?.length && !item.days.includes(now.getDay())) return false;
  if (!item.from && !item.to) return true;
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const from = item.from || "00:00";
  const to = item.to || "23:59";
  if (from > to) return hm >= from || hm <= to;
  return hm >= from && hm <= to;
}

const zid = () => `z-${Math.random().toString(36).slice(2, 8)}`;

/** İnsan-dostu URL parçası: "Giriş Holü" → "giris-holu" (Türkçe karakter map). */
export function slugify(s: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
  return (
    s
      .replace(/[çğıöşüİÇĞÖŞÜ]/g, (m) => map[m] || m)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "duvar"
  );
}

/** Çakışmayan slug üret: "giris" doluysa "giris-2", "giris-3"… (kendi id'si hariç). */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const cand = i === 0 ? base : `${base}-${i + 1}`;
    const snap = await getDocs(query(collection(db(), "videowalls"), where("slug", "==", cand)));
    if (!snap.docs.some((d) => d.id !== excludeId)) return cand;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Bir alanın kapladığı hücre kutusu (ızgara koordinatı, dahil). */
export interface CellBox {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

/** Oransal alandan hücre kutusunu geri çöz (alanlar hep hücreye hizalı). */
export function zoneCells(z: Zone, cols: number, rows: number): CellBox {
  return {
    c0: Math.round(z.x * cols),
    r0: Math.round(z.y * rows),
    c1: Math.round((z.x + z.w) * cols) - 1,
    r1: Math.round((z.y + z.h) * rows) - 1,
  };
}

/** Hücre kutusundan oransal (0–1) dikdörtgen. */
function rectFromCells(b: CellBox, cols: number, rows: number) {
  return {
    x: b.c0 / cols,
    y: b.r0 / rows,
    w: (b.c1 - b.c0 + 1) / cols,
    h: (b.r1 - b.r0 + 1) / rows,
  };
}

/** Tek hücrelik alan. */
function unitZone(c: number, r: number, cols: number, rows: number): Zone {
  return { id: zid(), ...rectFromCells({ c0: c, r0: r, c1: c, r1: r }, cols, rows), items: [] };
}

/** Ekran sayısı üst sınırı — devasa ızgara tarayıcıyı ve 1MB doküman limitini patlatır. */
export const MAX_SCREENS_PER_AXIS = 24;
export const clampScreens = (n: number) => Math.min(MAX_SCREENS_PER_AXIS, Math.max(1, Math.round(n) || 1));

/** cols×rows tam ızgara (başlangıç yerleşimi; kullanıcı böler/birleştirir). */
export function gridZones(cols: number, rows: number): Zone[] {
  const zones: Zone[] = [];
  const cc = clampScreens(cols);
  const rr = clampScreens(rows);
  for (let r = 0; r < rr; r++) for (let c = 0; c < cc; c++) zones.push(unitZone(c, r, cc, rr));
  return zones;
}

function overlaps(a: CellBox, b: CellBox): boolean {
  return a.c0 <= b.c1 && a.c1 >= b.c0 && a.r0 <= b.r1 && a.r1 >= b.r0;
}

/**
 * Kutuyla kesişen İÇERİKLİ alanlar, büyükten küçüğe. [0] = birleşmede içeriğini
 * devralacak "bağışçı" alan (LayoutEditor onay mesajı da aynı sırayı kullanır).
 */
export function contentZonesIn(zones: Zone[], cols: number, rows: number, box: CellBox): Zone[] {
  return zones
    .filter((z) => (z.items?.length ?? 0) > 0 && overlaps(zoneCells(z, cols, rows), box))
    .sort((a, b) => b.w * b.h - a.w * a.h);
}

/**
 * Hücre kutusunu tek alana birleştir. Kutuyla kesişen alanlar sökülür; kutunun
 * DIŞINDA kalan hücreleri tekrar tek-hücre alanlara döner (kısmi çakışma temiz
 * çözülür). Yeni alan, kesişen EN BÜYÜK içerikli alanın içeriğini/ayarlarını
 * DEVRALIR (içerik kaybolmaz); diğer içerikliler onay sorusuyla korunur (UI).
 */
export function mergeCells(zones: Zone[], cols: number, rows: number, box: CellBox): Zone[] {
  const kept: Zone[] = [];
  const leftovers: Zone[] = [];
  for (const z of zones) {
    const cb = zoneCells(z, cols, rows);
    if (!overlaps(cb, box)) {
      kept.push(z);
      continue;
    }
    for (let r = cb.r0; r <= cb.r1; r++)
      for (let c = cb.c0; c <= cb.c1; c++)
        if (c < box.c0 || c > box.c1 || r < box.r0 || r > box.r1) leftovers.push(unitZone(c, r, cols, rows));
  }
  const donor = contentZonesIn(zones, cols, rows, box)[0];
  const merged: Zone = { id: zid(), ...rectFromCells(box, cols, rows), items: donor?.items ?? [] };
  if (donor?.name) merged.name = donor.name;
  if (donor?.transition) merged.transition = donor.transition;
  if (donor?.bg) merged.bg = donor.bg;
  return [...kept, ...leftovers, merged];
}

/** Bir alanı hücrelere böl. İçerik/ayarlar İLK (sol-üst) hücrede kalır — kaybolmaz. */
export function splitZone(zones: Zone[], cols: number, rows: number, zoneId: string): Zone[] {
  const out: Zone[] = [];
  for (const z of zones) {
    if (z.id !== zoneId) {
      out.push(z);
      continue;
    }
    const cb = zoneCells(z, cols, rows);
    let first = true;
    for (let r = cb.r0; r <= cb.r1; r++)
      for (let c = cb.c0; c <= cb.c1; c++) {
        const u = unitZone(c, r, cols, rows);
        if (first) {
          u.items = z.items ?? [];
          if (z.name) u.name = z.name;
          if (z.transition) u.transition = z.transition;
          if (z.bg) u.bg = z.bg;
          first = false;
        }
        out.push(u);
      }
  }
  return out;
}

export async function createVideowall(
  ownerId: string,
  name: string,
  width: number,
  height: number,
  cols: number,
  rows: number,
  ownerName?: string
): Promise<string> {
  const nm = name.trim() || "Yeni duvar";
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const cc = clampScreens(cols);
  const rr = clampScreens(rows);
  const zones = gridZones(cc, rr);
  const ref = await addDoc(collection(db(), "videowalls"), {
    ownerId,
    ownerName: ownerName ?? "",
    name: nm,
    slug: await uniqueSlug(nm),
    width: w,
    height: h,
    cols: cc,
    rows: rr,
    zones,
    // Yayın linki ilk andan ölü olmasın: boş ızgara yayına da yazılır.
    live: { zones, cols: cc, rows: rr, width: w, height: h, publishedAt: serverTimestamp() },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

const byUpdated = (a: Videowall, b: Videowall) =>
  (b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0);

export async function listVideowalls(ownerId: string): Promise<Videowall[]> {
  const snap = await getDocs(query(collection(db(), "videowalls"), where("ownerId", "==", ownerId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Videowall).sort(byUpdated);
}

/**
 * TÜM duvarlar (yetki görünümü): listede senin duvarların PARLAK (tam yetki),
 * diğer kullanıcılarınki SÖNÜK bilgi kartı (yalnız izleme — yayın zaten public).
 * Self-host'ta bu, fabrika rolleriyle eşlenecek (bkz. docs/VIDEOWALL.md).
 */
export async function listAllVideowalls(): Promise<Videowall[]> {
  const snap = await getDocs(collection(db(), "videowalls"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Videowall).sort(byUpdated);
}

export async function getVideowall(id: string): Promise<Videowall | null> {
  const snap = await getDoc(doc(db(), "videowalls", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Videowall) : null;
}

/** 7/24 BEKÇİ: abonelik kurtarılamaz hatayla ölürse (ör. rules yayını anı,
 *  uzun kesinti) perde SESSİZCE güncelleme alamaz duruma düşüyordu. Hata
 *  anında mevcut içerik KORUNUR (cb çağrılmaz) ve artan aralıkla (2sn→60sn)
 *  yeniden abone olunur. */
export function watchVideowall(id: string, cb: (v: Videowall | null) => void): () => void {
  let stopped = false;
  let unsub: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  const start = () => {
    if (stopped) return;
    unsub = onSnapshot(
      doc(db(), "videowalls", id),
      (snap) => {
        attempt = 0;
        cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Videowall) : null);
      },
      () => {
        unsub?.();
        unsub = null;
        attempt += 1;
        timer = setTimeout(start, Math.min(60_000, 2000 * 2 ** Math.min(attempt - 1, 5)));
      }
    );
  };
  start();
  return () => {
    stopped = true;
    unsub?.();
    if (timer) clearTimeout(timer);
  };
}

export async function updateVideowall(id: string, patch: Partial<Videowall>): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * Yeniden adlandır. SLUG DEĞİŞMEZ: /flowsign/{slug} linki sahada 7/24 açık
 * ekranlarda — isim değişikliği yayını asla karartmamalı (link/QR sabit kalır).
 */
export async function renameVideowall(id: string, name: string): Promise<void> {
  const nm = name.trim().slice(0, 80);
  await updateDoc(doc(db(), "videowalls", id), { name: nm, updatedAt: serverTimestamp() });
}

/** Eski (slug'sız) duvarlara isimden slug doldur (edit sayfası açılınca bir kez). */
export async function ensureSlug(v: Videowall): Promise<void> {
  if (v.slug) return;
  await updateDoc(doc(db(), "videowalls", v.id), { slug: await uniqueSlug(v.name, v.id) });
}

/** Slug ile duvar izle (public yayın linki /flowsign/[slug]).
 *  7/24 BEKÇİ: hata OYNAYAN EKRANI "Ekran bulunamadı"ya düşürmez — mevcut
 *  içerik korunur, artan aralıkla yeniden abone olunur. cb(null) yalnız
 *  slug GERÇEKTEN yokken çağrılır (id fallback'i sayfada). */
export function watchVideowallBySlug(slug: string, cb: (v: Videowall | null) => void): () => void {
  let stopped = false;
  let unsub: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  const start = () => {
    if (stopped) return;
    unsub = onSnapshot(
      query(collection(db(), "videowalls"), where("slug", "==", slug)),
      (snap) => {
        attempt = 0;
        if (snap.empty) return cb(null);
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Videowall);
        docs.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
        cb(docs[0]);
      },
      () => {
        unsub?.();
        unsub = null;
        attempt += 1;
        timer = setTimeout(start, Math.min(60_000, 2000 * 2 ** Math.min(attempt - 1, 5)));
      }
    );
  };
  start();
  return () => {
    stopped = true;
    unsub?.();
    if (timer) clearTimeout(timer);
  };
}

/** Firestore `undefined` kabul etmez — opsiyonel alan temizlerken (name/from/to…) düşür. */
const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** TASLAK yerleşim/içerik yazımı (birleştir/böl/öğe ekle). Yayına dokunmaz. */
export async function updateZones(id: string, zones: Zone[]): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), { zones: stripUndefined(zones), updatedAt: serverTimestamp() });
}

/** Oynatma modu (tabela/sunum) — yayından bağımsız, perde anında uyar. */
export async function setPlayMode(id: string, playMode: VideowallPlayMode): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), { playMode, updatedAt: serverTimestamp() });
}

// ── Ekran sağlığı (heartbeat) ────────────────────────────────────────────────
// Perde ~2dk'da bir "canlıyım" yazar → alt koleksiyon (ana doküman TETİKLENMEZ;
// heartbeat tüm perdelere snapshot indirmesin). Kokpit 5dk eşiğiyle çevrimiçi der.
const SCREEN_ID_KEY = "flowsign-screen-id";

/** Bu cihazın kalıcı ekran kimliği (localStorage). */
export function getScreenId(): string {
  if (typeof localStorage === "undefined") return "anon";
  let id = localStorage.getItem(SCREEN_ID_KEY);
  if (!id) {
    id = `scr-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(SCREEN_ID_KEY, id);
    } catch {}
  }
  return id;
}

/** "Canlıyım" yaz (perde). includeStart: sayfa oturumu başlangıcında true. */
export async function sendScreenBeat(vwId: string, includeStart = false): Promise<void> {
  const data: Record<string, unknown> = {
    ua: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 140),
    vwPx: typeof window !== "undefined" ? window.innerWidth : 0,
    vhPx: typeof window !== "undefined" ? window.innerHeight : 0,
    lastSeenAt: serverTimestamp(),
  };
  if (includeStart) data.startedAt = serverTimestamp();
  await setDoc(doc(db(), "videowalls", vwId, "screens", getScreenId()), data, { merge: true });
}

/** Ekran kayıtlarını canlı izle (kokpit). */
export function watchScreens(vwId: string, cb: (s: ScreenBeat[]) => void): () => void {
  return onSnapshot(collection(db(), "videowalls", vwId, "screens"), (snap) => {
    const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ScreenBeat);
    arr.sort((a, b) => (b.lastSeenAt?.toMillis() ?? 0) - (a.lastSeenAt?.toMillis() ?? 0));
    cb(arr);
  });
}

/** Bayat ekran kaydını sil (kokpit temizliği). */
export async function deleteScreenBeat(vwId: string, screenId: string): Promise<void> {
  await deleteDoc(doc(db(), "videowalls", vwId, "screens", screenId));
}

/** Liste kartları için canlılık özeti (tek seferlik okuma — polling yok). */
export async function fetchScreenSummaries(
  ids: string[]
): Promise<Record<string, { online: number; lastSeen: number }>> {
  const ONLINE_MS = 5 * 60_000;
  const now = Date.now();
  const out: Record<string, { online: number; lastSeen: number }> = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        const snap = await getDocs(collection(db(), "videowalls", id, "screens"));
        let online = 0;
        let lastSeen = 0;
        snap.docs.forEach((d) => {
          const t = (d.data().lastSeenAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
          if (t > lastSeen) lastSeen = t;
          if (now - t < ONLINE_MS) online += 1;
        });
        out[id] = { online, lastSeen };
      } catch {
        /* rules henüz yayınlanmadıysa sessiz geç */
      }
    })
  );
  return out;
}

/** Taslağı YAYINA al ("Kaydet & Yayınla") — perde bundan sonra bu hâli oynatır. */
export async function publishVideowall(v: Videowall): Promise<void> {
  const snap = stripUndefined({ zones: v.zones ?? [], cols: v.cols, rows: v.rows, width: v.width, height: v.height });
  await updateDoc(doc(db(), "videowalls", v.id), { live: { ...snap, publishedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
}

/** Çözünürlük/ızgara değişince TASLAK yerleşimi taze ızgaraya sıfırlar.
 *  İÇERİK KAYBOLMAZ: eski alanlardaki tüm öğeler ilk alana taşınır —
 *  kullanıcı oradan dağıtır. (Eskiden hepsi silinir, yayınlanmamış medya
 *  kütüphaneden bile düşerdi.) */
export async function resetGrid(id: string, cols: number, rows: number, oldZones: Zone[] = []): Promise<void> {
  const cc = clampScreens(cols);
  const rr = clampScreens(rows);
  const zones = gridZones(cc, rr);
  const carried = oldZones.flatMap((z) => z.items ?? []);
  if (carried.length && zones.length) zones[0] = { ...zones[0], items: carried };
  await updateDoc(doc(db(), "videowalls", id), { cols: cc, rows: rr, zones: stripUndefined(zones), updatedAt: serverTimestamp() });
}

/** Duvarı kopyala (yeni id + taze zone/öğe id'leri; içerik referansları korunur). */
export async function duplicateVideowall(ownerId: string, v: Videowall): Promise<string> {
  const zones = (v.zones ?? []).map((z) => ({
    ...z,
    id: zid(),
    items: (z.items ?? []).map((it) => ({ ...it, id: `it-${Math.random().toString(36).slice(2, 9)}` })),
  }));
  const name = `${v.name} (kopya)`;
  const cleanZones = stripUndefined(zones);
  const ref = await addDoc(collection(db(), "videowalls"), {
    ownerId,
    ownerName: v.ownerName ?? "",
    name,
    slug: await uniqueSlug(name),
    width: v.width,
    height: v.height,
    cols: v.cols,
    rows: v.rows,
    zones: cleanZones,
    live: { zones: cleanZones, cols: v.cols, rows: v.rows, width: v.width, height: v.height, publishedAt: serverTimestamp() },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Duvarı sil. idToken verilirse ÖNCE Cloudinary flowsign/{id}/ klasörü sunucu
 * tarafında topluca temizlenir (yetim dosya/depolama sızıntısı kalmaz), sonra
 * Firestore dokümanı silinir. Temizlik hatası silmeyi engellemez (best-effort).
 */
export async function deleteVideowall(v: Videowall, idToken?: string): Promise<void> {
  if (idToken) {
    await fetch("/api/wall/destroy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallId: v.id, idToken, mode: "sign" }),
    }).catch(() => {});
  }
  // Ekran sağlığı kayıtları yetim kalmasın (heartbeat alt koleksiyonu)
  try {
    const beats = await getDocs(collection(db(), "videowalls", v.id, "screens"));
    await Promise.all(beats.docs.map((d) => deleteDoc(d.ref)));
  } catch {}
  await deleteDoc(doc(db(), "videowalls", v.id));
}
