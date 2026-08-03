/**
 * FlowSign (VideoWall) — duvar tanımı CRUD. Online: Firestore `videowalls/{id}`.
 * Self-host'ta bu dosya veri katmanının takas noktası (bkz. docs/VIDEOWALL.md).
 */
import {
  addDoc,
  deleteField,
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
import { ScreenBeat, SignGrant, Videowall, VideowallPlayMode, Zone, ZoneItem } from "./types";

/**
 * Öğe şu an takvimde mi? (gün + saat penceresi; boşsa hep). Gece yarısını aşan
 * pencere desteklenir (22:00–06:00). Perde OYNATIRKEN ve editör "takvim dışı"
 * rozetini gösterirken aynı fonksiyon kullanılır — asla ayrışmasınlar.
 */
export function itemInWindow(item: ZoneItem, now: Date): boolean {
  // Kampanya tarih aralığı (yerel tarih, bitiş günü DAHİL): "5–15 Ağustos arası
  // dönsün, sonra kendiliğinden düşsün". Sözlük sırası = tarih sırası (YYYY-MM-DD).
  if (item.fromDate || item.toDate) {
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (item.fromDate && ymd < item.fromDate) return false;
    if (item.toDate && ymd > item.toDate) return false;
  }
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

/** Alan zemini VARSAYILANI — Flow lacivert (siyah yerine marka rengi;
 *  kullanıcı kararı). Alanın kendi `bg`si varsa o kazanır. */
export const ZONE_BG_DEFAULT = "#001e64";

/** Tek hücrelik alan. */
function unitZone(c: number, r: number, cols: number, rows: number): Zone {
  return { id: zid(), ...rectFromCells({ c0: c, r0: r, c1: c, r1: r }, cols, rows), items: [] };
}

/** Ekran sayısı üst sınırı — devasa ızgara tarayıcıyı ve 1MB doküman limitini patlatır. */
export const MAX_SCREENS_PER_AXIS = 24;
export const clampScreens = (n: number) => Math.min(MAX_SCREENS_PER_AXIS, Math.max(1, Math.round(n) || 1));

/**
 * YERLEŞİM ızgarası — fiziksel ekran ızgarasından bağımsız (yoksa ona eşit).
 * Aşağıdaki tüm hücre matematiği (birleştir/böl/ızgara) BU sayıları kullanır;
 * fiziksel cols/rows yalnız editördeki çerçeve (bezel) çizgilerini ve perdedeki
 * "Ekranları tanı" numaralarını çizer.
 */
/**
 * YERLEŞİM ızgarası üst sınırı — fiziksel ekran sınırından AYRI ve daha yüksek.
 *
 * Neden ayrı: bölme ızgarayı KATLIYOR (3 ekranlık duvarda iki bölme 36'ya
 * çıkarabiliyor), oysa yerleşim ızgarası yalnızca iki tam sayı — tarayıcıyı
 * yoran şey alan sayısı, ızgaranın büyüklüğü değil.
 *
 * Eskiden okuma `clampScreens` (24) ile kırpılıyor, `splitZoneInto` 96'ya kadar
 * izin veriyor, `saveLayout` da kırpmadan yazıyordu. Sonuç: 24'ü aşan yerleşim
 * diske DOĞRU yazılıyor ama geri okunurken küçülüyor; `zoneCells` alanları
 * yanlış ızgarada hücreye çeviriyor ve kullanıcının hiç dokunmadığı alanlar
 * kendiliğinden kayıyor/boyut değiştiriyordu ("yerleşimler bir değişik").
 * Üç yer artık TEK sayıya bakıyor.
 */
export const MAX_LAYOUT_AXIS = 96;
export const clampLayout = (n: number) => Math.min(MAX_LAYOUT_AXIS, Math.max(1, Math.round(n) || 1));

export const layoutColsOf = (v: Pick<Videowall, "cols" | "layoutCols">) => clampLayout(v.layoutCols ?? v.cols);
export const layoutRowsOf = (v: Pick<Videowall, "rows" | "layoutRows">) => clampLayout(v.layoutRows ?? v.rows);
/** Kullanıcı yerleşimi elle ayarladı mı? (ayarladıysa fiziksel değişikliği yerleşimi bozmaz) */
export const hasCustomLayout = (v: Pick<Videowall, "layoutCols" | "layoutRows">) =>
  v.layoutCols != null || v.layoutRows != null;

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
 * Sürükleme kutusunu TAM ALAN SINIRLARINA genişlet.
 *
 * Sürükle-birleştir, kutunun kestiği alanın dışında kalan kısmını tek tek
 * hücrelere parçalıyordu (mergeCells → leftovers): kullanıcı birleştirmek
 * isterken farkında olmadan BÖLME yapıyor, o alanların içeriği siliniyordu.
 * Kullanıcı kararı: "birleştirme sürükle-bırakla olsun, bölme yalnız alanın
 * kendi panelinden". Bu yüzden kutu, dokunduğu her alanı TAMAMEN içine alacak
 * şekilde büyütülür — kısmi kesişme kalmaz, dolayısıyla parçalanma da olmaz.
 *
 * Büyüme yeni alanlara değebileceği için sabit noktaya kadar tekrarlanır.
 */
export function snapBoxToZones(zones: Zone[], cols: number, rows: number, box: CellBox): CellBox {
  const b: CellBox = { ...box };
  for (let guard = 0; guard < 12; guard++) {
    let grew = false;
    for (const z of zones) {
      const cb = zoneCells(z, cols, rows);
      if (!overlaps(cb, b)) continue;
      if (cb.c0 < b.c0) { b.c0 = cb.c0; grew = true; }
      if (cb.c1 > b.c1) { b.c1 = cb.c1; grew = true; }
      if (cb.r0 < b.r0) { b.r0 = cb.r0; grew = true; }
      if (cb.r1 > b.r1) { b.r1 = cb.r1; grew = true; }
    }
    if (!grew) break;
  }
  return b;
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

/**
 * ALANI PARÇALARA BÖL — "bu alanı 3'e böl" (yatay ⇄ ya da dikey ⇅).
 *
 * Kullanıcı kararı: yerleşim ızgarası ARTIK KOKPİTTE GÖRÜNMÜYOR (6 fiziksel
 * ekranın yanında "yerleşim 3×4" satırı kafa karıştırıyordu). Bölme artık
 * alanın kendi panelinde: seçili alanı kaça böleceğini söylüyorsun.
 *
 * Altta ızgara mantığı korunur (sürükle-birleştir bozulmasın): ızgara sessizce
 * `parts` katına çıkar, diğer alanların hücre kutuları aynı oranda ölçeklenir —
 * oransal dikdörtgenler DEĞİŞMEZ. Sonra ızgara EBOB ile sadeleştirilir ki
 * sayılar şişip 24 sınırına dayanmasın.
 *
 * İçerik kaybolmaz: öğeler/ayarlar İLK parçada kalır.
 * Sınır aşılırsa null döner (çağıran "daha fazla bölünemez" der).
 */
export interface SplitResult {
  zones: Zone[];
  cols: number;
  rows: number;
}

const gcd2 = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd2(b, a % b));

/** Izgarayı en sade hâline indir (tüm sınırların EBOB'u kadar küçült). */
export function normalizeGrid(zones: Zone[], cols: number, rows: number): SplitResult {
  const boxes = zones.map((z) => zoneCells(z, cols, rows));
  let gx = cols;
  let gy = rows;
  for (const b of boxes) {
    gx = gcd2(gcd2(gx, b.c0), b.c1 + 1);
    gy = gcd2(gcd2(gy, b.r0), b.r1 + 1);
  }
  if (gx <= 1 && gy <= 1) return { zones, cols, rows };
  const nc = Math.max(1, cols / Math.max(1, gx));
  const nr = Math.max(1, rows / Math.max(1, gy));
  const nz = zones.map((z, i) => ({
    ...z,
    ...rectFromCells(
      {
        c0: boxes[i].c0 / gx,
        c1: (boxes[i].c1 + 1) / gx - 1,
        r0: boxes[i].r0 / gy,
        r1: (boxes[i].r1 + 1) / gy - 1,
      },
      nc,
      nr
    ),
  }));
  return { zones: nz, cols: nc, rows: nr };
}

export function splitZoneInto(
  zones: Zone[],
  cols: number,
  rows: number,
  zoneId: string,
  parcaC: number,
  parcaR: number
): SplitResult | null {
  // İKİ EKSEN AYNI ANDA: eskiden imza (parts, axis) idi ve bölme tek yönde
  // yapılırdı. "3 yan yana + 2 alt alta" istendiğinde iki kez çağırmak işe
  // yaramıyordu: ilk bölmeden sonra içerik İLK parçada kalıyor, ikinci çağrı
  // da yalnız o ilk parçayı bölüyordu — ızgara değil, merdiven çıkıyordu.
  // Tek geçişte pc × pr parçaya bölmek doğru sonucu veriyor.
  const pc = Math.max(1, Math.min(8, Math.round(parcaC) || 1));
  const pr = Math.max(1, Math.min(8, Math.round(parcaR) || 1));
  if (pc === 1 && pr === 1) return null;
  const nc = cols * pc;
  const nr = rows * pr;
  if (nc > MAX_LAYOUT_AXIS || nr > MAX_LAYOUT_AXIS) return null;

  const scaled = (b: CellBox): CellBox => ({
    c0: b.c0 * pc,
    c1: (b.c1 + 1) * pc - 1,
    r0: b.r0 * pr,
    r1: (b.r1 + 1) * pr - 1,
  });

  const out: Zone[] = [];
  for (const z of zones) {
    const box = scaled(zoneCells(z, cols, rows));
    if (z.id !== zoneId) {
      out.push({ ...z, ...rectFromCells(box, nc, nr) });
      continue;
    }
    // Hedef alan: eşit parçalara ayrılır; içerik/ayarlar İLK parçada kalır.
    const spanC = (box.c1 - box.c0 + 1) / pc;
    const spanR = (box.r1 - box.r0 + 1) / pr;
    for (let j = 0; j < pr; j++) {
      for (let i = 0; i < pc; i++) {
        const piece: CellBox = {
          c0: box.c0 + i * spanC,
          c1: box.c0 + (i + 1) * spanC - 1,
          r0: box.r0 + j * spanR,
          r1: box.r0 + (j + 1) * spanR - 1,
        };
        const ilk = i === 0 && j === 0;
        const parca: Zone = { id: ilk ? z.id : zid(), ...rectFromCells(piece, nc, nr), items: [] };
        if (ilk) {
          parca.items = z.items ?? [];
          if (z.name) parca.name = z.name;
          if (z.transition) parca.transition = z.transition;
          if (z.bg) parca.bg = z.bg;
        }
        out.push(parca);
      }
    }
  }
  return normalizeGrid(out, nc, nr);
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
 * Yeniden adlandır. Kullanıcı kararı (2026-07): yayın linki (slug) ekran
 * adıyla BİRLİKTE değişir. Sahadaki 7/24 ekranlar kararmasın diye eski slug
 * `slugHistory`ye eklenir — /flowsign/[slug] geçmiş sluglarla da bulur.
 */
export async function renameVideowall(id: string, name: string): Promise<void> {
  const nm = name.trim().slice(0, 80);
  const patch: Record<string, unknown> = { name: nm, updatedAt: serverTimestamp() };
  try {
    const snap = await getDoc(doc(db(), "videowalls", id));
    const cur = snap.exists() ? (snap.data() as Videowall) : null;
    const newSlug = await uniqueSlug(nm, id);
    if (cur && cur.slug !== newSlug) {
      patch.slug = newSlug;
      const hist = new Set([...(cur.slugHistory ?? []), ...(cur.slug ? [cur.slug] : [])]);
      hist.delete(newSlug);
      patch.slugHistory = Array.from(hist).slice(-10); // sınırsız büyümesin
    }
  } catch {
    /* slug üretilemezse yalnız ad değişir (link bozulmaz) */
  }
  await updateDoc(doc(db(), "videowalls", id), patch);
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

/** ESKİ (yeniden adlandırma öncesi) slug ile duvar izle — eski link/QR kararmasın.
 *  Aynı dayanıklı-abonelik kalıbı (hata → içerik korunur + backoff yeniden bağlanma). */
export function watchVideowallBySlugHistory(slug: string, cb: (v: Videowall | null) => void): () => void {
  let stopped = false;
  let unsub: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  const start = () => {
    if (stopped) return;
    unsub = onSnapshot(
      query(collection(db(), "videowalls"), where("slugHistory", "array-contains", slug)),
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

/** FİZİKSEL ekran sayısı değişti ama yerleşim elle ayarlanmış: yerleşime DOKUNMA
 *  (çerçeve çizgileri kayar, içerik yerinde kalır — sorulacak bir şey de yok). */
export async function setScreenGrid(id: string, cols: number, rows: number): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), {
    cols: clampScreens(cols),
    rows: clampScreens(rows),
    updatedAt: serverTimestamp(),
  });
}

/** Alan bölme sonucunu yaz: yerleşim ızgarası + alanlar TEK yazımda gider
 *  (ikisi ayrı yazılırsa arada perde/kokpit tutarsız kare görebilir). */
export async function saveLayout(id: string, r: SplitResult): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), {
    // Yazarken de kırp: diskteki sayı ile okunan sayı ASLA ayrışmasın.
    layoutCols: clampLayout(r.cols),
    layoutRows: clampLayout(r.rows),
    zones: stripUndefined(r.zones),
    updatedAt: serverTimestamp(),
  });
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
    // Kopya KOPYALAYANIN'dır; yetki kayıtları taşınmaz (sessiz yetki mirası yok).
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

// ── YETKİ (yalnız FlowSign) ─────────────────────────────────────────────────
// TEK YERDEN yönetilir: /admin → "Sign yetkileri". Ekran sayfalarında yetki
// kutusu YOK (kullanıcı kararı). Matris kişi bazlı: yöneticinin sayfasında her
// kişinin altında tüm ekranlar açılır, tikler `grants` içine yazılır.
//
// Varsayılan: ekranı OLUŞTURAN (ownerId) tam yetkilidir — "yarattığına zaten
// yetkili". Yönetici o kişinin tikini kaldırdığı anda kendisi için de AÇIK
// kayıt yazılır; açık kayıt varsayılanı ezer (ayrılan personelin erişimi
// kesilebilsin).

/** Yöneticiler her ekranda tam yetkilidir (rules'ta isAdmin() karşılığı). */
const FULL: Required<SignGrant> = { view: true, edit: true, copy: true, delete: true };
const NONE: Required<SignGrant> = { view: false, edit: false, copy: false, delete: false };

/** Bu kişinin bu ekrandaki ETKİN yetkisi (açık kayıt > oluşturan varsayılanı). */
export function signPerm(
  v: Pick<Videowall, "ownerId" | "grants"> | null | undefined,
  uid: string | null | undefined,
  isAdmin = false
): Required<SignGrant> {
  if (isAdmin) return FULL;
  if (!v || !uid) return NONE;
  const explicit = v.grants?.[uid];
  if (explicit) return { ...NONE, ...explicit };
  return v.ownerId === uid ? FULL : NONE;
}

export const canEditSign = (v: Videowall | null | undefined, uid?: string | null, isAdmin = false) =>
  signPerm(v, uid, isAdmin).edit;
export const canDeleteSign = (v: Videowall | null | undefined, uid?: string | null, isAdmin = false) =>
  signPerm(v, uid, isAdmin).delete;
export const canCopySign = (v: Videowall | null | undefined, uid?: string | null, isAdmin = false) =>
  signPerm(v, uid, isAdmin).copy;
/** Listede/editörde görünür mü? (perde linki zaten public — bu GÖRÜNÜRLÜKTÜR) */
export const canViewSign = (v: Videowall | null | undefined, uid?: string | null, isAdmin = false) => {
  const p = signPerm(v, uid, isAdmin);
  return p.view || p.edit || p.copy || p.delete;
};

/** Yönetici sayfasındaki tikler → tek kişinin tek ekrandaki kaydı. */
export async function setSignGrant(wallId: string, uid: string, perms: SignGrant): Promise<void> {
  await updateDoc(doc(db(), "videowalls", wallId), {
    [`grants.${uid}`]: { view: !!perms.view, edit: !!perms.edit, copy: !!perms.copy, delete: !!perms.delete },
    updatedAt: serverTimestamp(),
  });
}

/** Kaydı tamamen kaldır → kişi varsayılana döner (oluşturansa tam yetki). */
export async function clearSignGrant(wallId: string, uid: string): Promise<void> {
  await updateDoc(doc(db(), "videowalls", wallId), {
    [`grants.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
