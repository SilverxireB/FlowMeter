/**
 * FlowSign self-host — SUNUCU veri katmanı. Veritabanı YOK: her duvar
 * `data/walls/{id}.json`, ekran kalp atışları `data/screens/{id}.json`,
 * medya `data/media/{id}/...`. Yedek almak = data klasörünü kopyalamak.
 *
 * Gerçek zamanlılık: her yazma bellekteki EventEmitter'ı tetikler; SSE
 * rotaları bu olayları dinleyip bağlı perde/kokpitlere anında iletir
 * (internetsiz iç ağda çalışır — dış servis yok).
 *
 * Yazmalar atomiktir (tmp dosyaya yaz + rename) — elektrik kesilse bile
 * yarım JSON kalmaz. Tek süreç varsayımı: uygulama tek instance çalıştırılır
 * (README'de belirtildi); PM2 cluster modu KULLANILMAZ.
 */
import { promises as fs } from "fs";
import path from "path";
import { EventEmitter } from "events";
import { ScreenBeat, Videowall, Zone } from "./types";
import { gridZones, slugify, stripUndefined } from "./zones";

export const DATA_DIR = process.env.SIGN_DATA_DIR || path.join(process.cwd(), "data");
const WALLS_DIR = path.join(DATA_DIR, "walls");
const SCREENS_DIR = path.join(DATA_DIR, "screens");
export const MEDIA_DIR = path.join(DATA_DIR, "media");

// Next dev'de modüller yeniden yüklenebilir — emitter globalde tek kalsın.
const g = globalThis as unknown as { __signEmitter?: EventEmitter };
export const emitter = g.__signEmitter ?? (g.__signEmitter = new EventEmitter());
emitter.setMaxListeners(200); // her perde/kokpit bir dinleyici

/** Duvar id'si dosya adı olur — yalnız güvenli karakter kabul et (path traversal kilidi). */
const safeId = (id: string) => /^[a-z0-9-]{1,64}$/i.test(id);

async function ensureDirs() {
  await fs.mkdir(WALLS_DIR, { recursive: true });
  await fs.mkdir(SCREENS_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}

async function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp-${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function emitWall(id: string) {
  emitter.emit(`wall:${id}`);
  emitter.emit("walls"); // liste/çözümleme dinleyicileri
}

// ── Duvar CRUD ───────────────────────────────────────────────────────────────

export async function listWalls(): Promise<Videowall[]> {
  await ensureDirs();
  const files = (await fs.readdir(WALLS_DIR)).filter((f) => f.endsWith(".json"));
  const walls = (await Promise.all(files.map((f) => readJson<Videowall>(path.join(WALLS_DIR, f))))).filter(
    Boolean
  ) as Videowall[];
  return walls.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
}

export async function getWall(id: string): Promise<Videowall | null> {
  if (!safeId(id)) return null;
  await ensureDirs();
  return readJson<Videowall>(path.join(WALLS_DIR, `${id}.json`));
}

/** Bulma zinciri: güncel slug → eski slug (slugHistory) → doküman id. */
export async function getWallByKey(key: string): Promise<Videowall | null> {
  const walls = await listWalls();
  return (
    walls.find((w) => w.slug === key) ??
    walls.find((w) => w.slugHistory?.includes(key)) ??
    walls.find((w) => w.id === key) ??
    null
  );
}

/** Çakışmayan slug üret: "giris" doluysa "giris-2", "giris-3"… (kendi id'si hariç). */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const walls = await listWalls();
  const taken = new Set(walls.filter((w) => w.id !== excludeId).flatMap((w) => [w.slug, ...(w.slugHistory ?? [])]));
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const cand = i === 0 ? base : `${base}-${i + 1}`;
    if (!taken.has(cand)) return cand;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function createWall(name: string, width: number, height: number, cols: number, rows: number): Promise<Videowall> {
  await ensureDirs();
  const id = `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const zones = gridZones(cols, rows);
  const now = Date.now();
  const wall: Videowall = {
    id,
    name: name.trim() || "Yeni ekran",
    slug: await uniqueSlug(name.trim() || "Yeni ekran"),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    cols,
    rows,
    zones,
    // Yayın linki ilk andan ölü olmasın: boş ızgara yayına da yazılır.
    live: { zones, cols, rows, width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), publishedAt: now },
    playMode: "auto",
    createdAt: now,
    updatedAt: now,
  };
  await writeJsonAtomic(path.join(WALLS_DIR, `${id}.json`), wall);
  emitWall(id);
  return wall;
}

export async function patchWall(id: string, patch: Partial<Videowall>): Promise<Videowall | null> {
  const cur = await getWall(id);
  if (!cur) return null;
  // id/slug alanları serbest patch ile ezilemez (rename ayrı kapıdan geçer).
  const { id: _i, slug: _s, slugHistory: _h, createdAt: _c, ...rest } = patch;
  const next = stripUndefined({ ...cur, ...rest, updatedAt: Date.now() }) as Videowall;
  await writeJsonAtomic(path.join(WALLS_DIR, `${id}.json`), next);
  emitWall(id);
  return next;
}

/** Yeniden adlandır — yayın linki (slug) adla BİRLİKTE değişir; eski slug
 *  slugHistory'ye eklenir, sahadaki eski link/QR kararmaz. */
export async function renameWall(id: string, name: string): Promise<Videowall | null> {
  const cur = await getWall(id);
  if (!cur) return null;
  const nm = name.trim().slice(0, 80);
  const next: Videowall = { ...cur, name: nm, updatedAt: Date.now() };
  const newSlug = await uniqueSlug(nm, id);
  if (cur.slug !== newSlug) {
    const hist = new Set([...(cur.slugHistory ?? []), ...(cur.slug ? [cur.slug] : [])]);
    hist.delete(newSlug);
    next.slug = newSlug;
    next.slugHistory = Array.from(hist).slice(-10);
  }
  await writeJsonAtomic(path.join(WALLS_DIR, `${id}.json`), next);
  emitWall(id);
  return next;
}

/** Taslağı YAYINA al ("Kaydet & Yayınla") — perde bundan sonra bu hâli oynatır. */
export async function publishWall(id: string): Promise<Videowall | null> {
  const cur = await getWall(id);
  if (!cur) return null;
  const next: Videowall = {
    ...cur,
    live: stripUndefined({ zones: cur.zones ?? [], cols: cur.cols, rows: cur.rows, width: cur.width, height: cur.height, publishedAt: Date.now() }),
    updatedAt: Date.now(),
  };
  await writeJsonAtomic(path.join(WALLS_DIR, `${id}.json`), next);
  emitWall(id);
  return next;
}

/** Duvarı kopyala (yeni id + taze zone/öğe id'leri; medya dosyaları paylaşılır). */
export async function duplicateWall(id: string): Promise<Videowall | null> {
  const cur = await getWall(id);
  if (!cur) return null;
  const zones: Zone[] = (cur.zones ?? []).map((z) => ({
    ...z,
    id: `z-${Math.random().toString(36).slice(2, 8)}`,
    items: (z.items ?? []).map((it) => ({ ...it, id: `it-${Math.random().toString(36).slice(2, 9)}` })),
  }));
  const name = `${cur.name} (kopya)`;
  const now = Date.now();
  const nid = `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const wall: Videowall = {
    ...stripUndefined({ ...cur, zones }),
    id: nid,
    name,
    slug: await uniqueSlug(name),
    slugHistory: [],
    live: { zones: stripUndefined(zones), cols: cur.cols, rows: cur.rows, width: cur.width, height: cur.height, publishedAt: now },
    createdAt: now,
    updatedAt: now,
  };
  await writeJsonAtomic(path.join(WALLS_DIR, `${nid}.json`), wall);
  emitWall(nid);
  return wall;
}

/** Duvarı sil: tanım + kalp atışları + medya klasörü birlikte gider (yetim dosya kalmaz). */
export async function deleteWall(id: string): Promise<void> {
  if (!safeId(id)) return;
  await fs.rm(path.join(WALLS_DIR, `${id}.json`), { force: true });
  await fs.rm(path.join(SCREENS_DIR, `${id}.json`), { force: true });
  await fs.rm(path.join(MEDIA_DIR, id), { recursive: true, force: true });
  emitWall(id);
}

// ── Ekran sağlığı (heartbeat) ────────────────────────────────────────────────

type ScreensFile = Record<string, Omit<ScreenBeat, "id">>;

export async function getScreens(wallId: string): Promise<ScreenBeat[]> {
  if (!safeId(wallId)) return [];
  await ensureDirs();
  const map = (await readJson<ScreensFile>(path.join(SCREENS_DIR, `${wallId}.json`))) ?? {};
  return Object.entries(map)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
}

export async function beat(wallId: string, screenId: string, data: Omit<ScreenBeat, "id" | "lastSeenAt">, includeStart: boolean): Promise<void> {
  if (!safeId(wallId) || !/^[a-z0-9-]{1,64}$/i.test(screenId)) return;
  await ensureDirs();
  const file = path.join(SCREENS_DIR, `${wallId}.json`);
  const map = (await readJson<ScreensFile>(file)) ?? {};
  const prev = map[screenId] ?? {};
  map[screenId] = {
    ...prev,
    ua: data.ua,
    vwPx: data.vwPx,
    vhPx: data.vhPx,
    lastSeenAt: Date.now(),
    ...(includeStart ? { startedAt: Date.now() } : {}),
  };
  await writeJsonAtomic(file, map);
  emitWall(wallId);
}

export async function deleteScreen(wallId: string, screenId: string): Promise<void> {
  if (!safeId(wallId)) return;
  const file = path.join(SCREENS_DIR, `${wallId}.json`);
  const map = (await readJson<ScreensFile>(file)) ?? {};
  delete map[screenId];
  await writeJsonAtomic(file, map);
  emitWall(wallId);
}

/** Liste kartları için canlılık özeti. */
export async function screenSummaries(ids: string[]): Promise<Record<string, { online: number; lastSeen: number }>> {
  const ONLINE_MS = 5 * 60_000;
  const now = Date.now();
  const out: Record<string, { online: number; lastSeen: number }> = {};
  await Promise.all(
    ids.map(async (id) => {
      const screens = await getScreens(id);
      let online = 0;
      let lastSeen = 0;
      for (const s of screens) {
        const t = s.lastSeenAt ?? 0;
        if (t > lastSeen) lastSeen = t;
        if (now - t < ONLINE_MS) online += 1;
      }
      out[id] = { online, lastSeen };
    })
  );
  return out;
}
