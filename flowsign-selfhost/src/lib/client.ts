"use client";

import { clampLayout } from "@/lib/zones";

/**
 * FlowSign self-host — İSTEMCİ veri katmanı. Online sürümdeki `videowalls.ts`
 * imzalarının karşılığı: izleme SSE (EventSource) ile, yazma fetch ile.
 *
 * 7/24 BEKÇİ (dayanıklı abonelik): EventSource kopunca tarayıcı kendisi
 * yeniden bağlanır; sunucu hiç ulaşılamazsa mevcut içerik KORUNUR (cb null
 * çağrılmaz) ve bağlantı gelince ilk olayda tazelenir. cb(null) yalnız sunucu
 * "böyle bir ekran yok" dediğinde çağrılır.
 */
import { PublicUser, ScreenBeat, SignPerms, Videowall, VideowallPlayMode, Zone } from "./types";
import { RafOgesi } from "./ortakRaf";
import { clampScreens, gridZones, SplitResult, stripUndefined } from "./zones";

type WallEvent = { found: boolean; wall: Videowall | null; screens: ScreenBeat[] };

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `İstek başarısız (${res.status})`);
  return (await res.json()) as T;
}

// ── İzleme (SSE) ─────────────────────────────────────────────────────────────

function watchSse(url: string, cb: (v: Videowall | null) => void, onScreens?: (s: ScreenBeat[]) => void): () => void {
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data) as WallEvent;
      cb(d.found ? d.wall : null);
      if (onScreens && d.found) onScreens(d.screens ?? []);
    } catch {}
  };
  // onerror: EventSource kendi backoff'uyla yeniden bağlanır; içerik korunur.
  return () => es.close();
}

/** id ile duvarı canlı izle (kokpit + önizleme). */
export function watchWall(id: string, cb: (v: Videowall | null) => void): () => void {
  return watchSse(`/api/walls/${encodeURIComponent(id)}/events`, cb);
}

/** slug → eski slug → id zinciriyle duvarı canlı izle (public yayın linki). */
export function watchWallByKey(key: string, cb: (v: Videowall | null) => void): () => void {
  return watchSse(`/api/resolve/${encodeURIComponent(key)}/events`, cb);
}

/** Ekran kayıtlarını canlı izle (kokpit ekran sağlığı kartı). */
export function watchScreens(id: string, cb: (s: ScreenBeat[]) => void): () => void {
  return watchSse(`/api/walls/${encodeURIComponent(id)}/events`, () => {}, cb);
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listWalls(): Promise<{
  walls: Videowall[];
  beats: Record<string, { online: number; lastSeen: number }>;
  users: PublicUser[];
  me: PublicUser;
}> {
  return j(await fetch("/api/walls", { cache: "no-store" }));
}

export async function createWall(name: string, width: number, height: number, cols: number, rows: number): Promise<Videowall> {
  return j(
    await fetch("/api/walls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, width, height, cols, rows }),
    })
  );
}

export async function updateWall(id: string, patch: Partial<Videowall>): Promise<void> {
  await j(
    await fetch(`/api/walls/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stripUndefined(patch)),
    })
  );
}

/** TASLAK yerleşim/içerik yazımı (birleştir/böl/öğe ekle). Yayına dokunmaz. */
export async function updateZones(id: string, zones: Zone[]): Promise<void> {
  await updateWall(id, { zones });
}

/**
 * YAYINDAKİ adresleri yerinde değiştir (ortak rafa taşıma).
 *
 * Dosya rafa taşınınca ESKİ adres artık yok. Taslak çevrilip yayın çevrilmezse:
 *  - yayındaki ekran var olmayan bir adresi göstermeye devam eder (alan kararır),
 *  - kütüphane taslak+yayını birleştirdiği için aynı fotoğraf İKİ KEZ görünür
 *    ("fotoğraflar çoğaldı" şikâyeti tam olarak budur).
 * Yayın YENİDEN YAYINLANMAZ, yalnız adres düzeltilir.
 */
export async function fixLiveSrc(id: string, live: Videowall["live"], eski: string, yeni: string): Promise<void> {
  if (!live?.zones?.length) return;
  const zones = live.zones.map((z) => ({
    ...z,
    items: (z.items ?? []).map((it) => (it.src === eski ? { ...it, src: yeni } : it)),
  }));
  await updateWall(id, { live: { ...live, zones } });
}

/** Oynatma modu (tabela/sunum) — yayından bağımsız, perde anında uyar. */
export async function setPlayMode(id: string, playMode: VideowallPlayMode): Promise<void> {
  await updateWall(id, { playMode });
}

/** Yeniden adlandır — slug sunucuda yenilenir, eski slug history'ye eklenir. */
export async function renameWall(id: string, name: string): Promise<void> {
  await j(
    await fetch(`/api/walls/${encodeURIComponent(id)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );
}

/** Taslağı yayına al — anlık görüntü sunucuda alınır (atomik). */
export async function publishWall(id: string): Promise<void> {
  await j(await fetch(`/api/walls/${encodeURIComponent(id)}/publish`, { method: "POST" }));
}

/** Çözünürlük/ızgara değişince TASLAK yerleşimi taze ızgaraya sıfırlar.
 *  İÇERİK KAYBOLMAZ: eski alanlardaki tüm öğeler ilk alana taşınır — kullanıcı oradan dağıtır. */
export async function resetGrid(id: string, cols: number, rows: number, oldZones: Zone[] = []): Promise<void> {
  const cc = clampScreens(cols);
  const rr = clampScreens(rows);
  const zones = gridZones(cc, rr);
  const carried = oldZones.flatMap((z) => z.items ?? []);
  if (carried.length && zones.length) zones[0] = { ...zones[0], items: carried };
  await updateWall(id, { cols: cc, rows: rr, zones });
}

/** FİZİKSEL ekran sayısı değişti; yerleşim elle ayarlıysa ona dokunulmaz. */
export async function setScreenGrid(id: string, cols: number, rows: number): Promise<void> {
  await updateWall(id, { cols: clampScreens(cols), rows: clampScreens(rows) });
}

/** Alan bölme sonucu: yerleşim ızgarası + alanlar TEK yazımda gider. */
export async function saveLayout(id: string, r: SplitResult): Promise<void> {
  // Yazarken de kırp: diskteki sayı ile okunan sayı ASLA ayrışmasın.
  await updateWall(id, { layoutCols: clampLayout(r.cols), layoutRows: clampLayout(r.rows), zones: r.zones });
}

export async function duplicateWall(id: string): Promise<void> {
  await j(await fetch(`/api/walls/${encodeURIComponent(id)}/duplicate`, { method: "POST" }));
}

export async function deleteWall(id: string): Promise<void> {
  await j(await fetch(`/api/walls/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

// ── Ekran sağlığı (heartbeat) ────────────────────────────────────────────────

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
export async function sendScreenBeat(wallId: string, includeStart = false): Promise<void> {
  await fetch(`/api/walls/${encodeURIComponent(wallId)}/beat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      screenId: getScreenId(),
      ua: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 140),
      vwPx: typeof window !== "undefined" ? window.innerWidth : 0,
      vhPx: typeof window !== "undefined" ? window.innerHeight : 0,
      includeStart,
    }),
  });
}

/** Bayat ekran kaydını sil (kokpit temizliği). */
export async function deleteScreenBeat(wallId: string, screenId: string): Promise<void> {
  await j(
    await fetch(`/api/walls/${encodeURIComponent(wallId)}/beat?screenId=${encodeURIComponent(screenId)}`, { method: "DELETE" })
  );
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

/** Bir yazma `ms` içinde dönmezse anlaşılır hatayla reddet (buton sonsuza dek "gönderiliyor" kalmasın). */
export function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Sunucuya ulaşılamadı — bağlantıyı kontrol edip tekrar dene.")), ms)),
  ]);
}

// ── Kim kim (oturum + defter) ────────────────────────────────────────────────

export async function whoAmI(): Promise<PublicUser | null> {
  const r = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok) return null;
  return ((await r.json()) as { user: PublicUser | null }).user;
}

export async function listUsers(): Promise<{ users: PublicUser[]; me: PublicUser }> {
  return j(await fetch("/api/users", { cache: "no-store" }));
}

export async function createUser(name: string, password: string, role: "admin" | "user", label?: string): Promise<void> {
  await j(
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password, role, label }),
    })
  );
}

export async function updateUser(
  id: string,
  patch: { password?: string; role?: "admin" | "user"; label?: string; canCreate?: boolean }
): Promise<void> {
  await j(
    await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteUser(id: string): Promise<void> {
  await j(await fetch(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

// ── Ekran yetkisi (yönetici matrisi) ────────────────────────────────────────

export async function setWallGrant(
  wallId: string,
  userId: string,
  perms: SignPerms | null
): Promise<void> {
  await j(
    await fetch(`/api/walls/${encodeURIComponent(wallId)}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, perms }),
    })
  );
}

// ── Yetki kararları (istemcide yalnız DÜĞME GİZLEME; asıl kapı sunucuda) ─────

const NONE: Required<SignPerms> = { view: false, edit: false, copy: false, delete: false };
const FULL: Required<SignPerms> = { view: true, edit: true, copy: true, delete: true };

/** Etkin yetki: açık kayıt > oluşturan varsayılanı. Yönetici her yerde tam. */
export function wallPerm(w: Videowall | null | undefined, me: PublicUser | null): Required<SignPerms> {
  if (!w || !me) return NONE;
  if (me.role === "admin") return FULL;
  const explicit = w.grants?.[me.id];
  if (explicit) return { ...NONE, ...explicit };
  return w.ownerId && w.ownerId === me.id ? FULL : NONE;
}

export const canEditWall = (w: Videowall | null | undefined, me: PublicUser | null) => wallPerm(w, me).edit;
export const canDeleteWall = (w: Videowall | null | undefined, me: PublicUser | null) => wallPerm(w, me).delete;
export const canCopyWall = (w: Videowall | null | undefined, me: PublicUser | null) => wallPerm(w, me).copy;
export const canViewWall = (w: Videowall | null | undefined, me: PublicUser | null) => {
  const p = wallPerm(w, me);
  return p.view || p.edit || p.copy || p.delete;
};

// ── ORTAK RAF ────────────────────────────────────────────────────────────────
// Kurumun paylaşılan medyası. Rafa HERKES koyar, YALNIZ YÖNETİCİ siler
// (kararlar sunucuda; buradaki işlevler yalnız uca gider).

/** Hata gövdesini insanca mesaja çeviren küçük sarmalayıcı. */
async function rafJson(r: Response): Promise<Record<string, unknown>> {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String((j as { error?: string }).error ?? "İşlem tamamlanamadı"));
  return j as Record<string, unknown>;
}

export async function listOrtakRaf(): Promise<RafOgesi[]> {
  const r = await fetch("/api/ortak-raf");
  if (!r.ok) return [];
  return ((await r.json()).raf ?? []) as RafOgesi[];
}

export async function rafaKoy(o: { src: string; kind: string; name: string; fromWall?: string }): Promise<RafOgesi> {
  const j = await rafJson(
    await fetch("/api/ortak-raf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(o),
    })
  );
  return j.oge as RafOgesi;
}

export async function raftanSil(id: string): Promise<void> {
  await rafJson(await fetch(`/api/ortak-raf?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
}
