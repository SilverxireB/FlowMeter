/**
 * FOTO SAHNE — SUNUCU veri katmanı (self-host). Her sahne
 * `data/sahneler/{id}.json`; fotoğraflar `data/media/sahne/{id}/...`
 * (ekran klasörlerinden AYRI — ekran silme sahneye değemez).
 *
 * Wall mantığı, sadeleşmiş: taslak/yayın katmanı YOK — her yazma emitter'ı
 * tetikler ve linke ANINDA düşer (SSE).
 */
import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR, MEDIA_DIR, emitter } from "./store";
import { FotoSahneKaydi, SAHNE_MODU_VARSAYILAN, SahneFoto } from "./fotoSahne";

const SAHNE_DIR = path.join(DATA_DIR, "sahneler");
export const SAHNE_MEDIA_DIR = path.join(MEDIA_DIR, "sahne");

const safeId = (id: string) => /^[a-z0-9-]{1,64}$/i.test(id);
const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

async function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp-${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function emitSahne(id: string) {
  emitter.emit(`sahne:${id}`);
}

export async function getSahne(id: string): Promise<FotoSahneKaydi | null> {
  if (!safeId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(SAHNE_DIR, `${id}.json`), "utf8")) as FotoSahneKaydi;
  } catch {
    return null;
  }
}

export async function createSahne(name: string, ownerId: string): Promise<FotoSahneKaydi> {
  await fs.mkdir(SAHNE_DIR, { recursive: true });
  const id = `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const sahne: FotoSahneKaydi = {
    id,
    ownerId,
    name: name.trim() || "Foto sahne",
    mod: SAHNE_MODU_VARSAYILAN,
    fotolar: [],
    createdAt: now,
    updatedAt: now,
  };
  await writeJsonAtomic(path.join(SAHNE_DIR, `${id}.json`), sahne);
  emitSahne(id);
  return sahne;
}

/** Ad / mod / efekt / fotolar. Kimlik ve sahiplik serbest patch ile ezilemez. */
export async function patchSahne(id: string, patch: Partial<FotoSahneKaydi>): Promise<FotoSahneKaydi | null> {
  const cur = await getSahne(id);
  if (!cur) return null;
  const { id: _i, ownerId: _o, createdAt: _c, ...rest } = patch;
  const next = stripUndefined({ ...cur, ...rest, updatedAt: Date.now() }) as FotoSahneKaydi;
  await writeJsonAtomic(path.join(SAHNE_DIR, `${id}.json`), next);
  emitSahne(id);
  return next;
}

export async function addSahneFotoKaydi(id: string, foto: SahneFoto): Promise<FotoSahneKaydi | null> {
  const cur = await getSahne(id);
  if (!cur) return null;
  return patchSahne(id, { fotolar: [...(cur.fotolar ?? []), stripUndefined(foto)] });
}

/** Sahne + fotoğraf klasörü birlikte gider (yetim dosya kalmaz). */
export async function deleteSahne(id: string): Promise<void> {
  if (!safeId(id)) return;
  await fs.rm(path.join(SAHNE_DIR, `${id}.json`), { force: true });
  await fs.rm(path.join(SAHNE_MEDIA_DIR, id), { recursive: true, force: true });
  emitSahne(id);
}
