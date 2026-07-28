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
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Videowall, Zone } from "./types";

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

/** cols×rows tam ızgara (başlangıç yerleşimi; kullanıcı böler/birleştirir). */
export function gridZones(cols: number, rows: number): Zone[] {
  const zones: Zone[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) zones.push(unitZone(c, r, cols, rows));
  return zones;
}

function overlaps(a: CellBox, b: CellBox): boolean {
  return a.c0 <= b.c1 && a.c1 >= b.c0 && a.r0 <= b.r1 && a.r1 >= b.r0;
}

/**
 * Hücre kutusunu tek alana birleştir. Kutuyla kesişen alanlar sökülür; kutunun
 * DIŞINDA kalan hücreleri tekrar tek-hücre alanlara döner (kısmi çakışma temiz
 * çözülür). Yeni alan kutuyu kaplar (içerik boş). Kesişmeyen alanlar korunur.
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
  const merged: Zone = { id: zid(), ...rectFromCells(box, cols, rows), items: [] };
  return [...kept, ...leftovers, merged];
}

/** Bir alanı kapladığı hücrelere böl (tek-hücre alanlar). İçerik kaybolur. */
export function splitZone(zones: Zone[], cols: number, rows: number, zoneId: string): Zone[] {
  const out: Zone[] = [];
  for (const z of zones) {
    if (z.id !== zoneId) {
      out.push(z);
      continue;
    }
    const cb = zoneCells(z, cols, rows);
    for (let r = cb.r0; r <= cb.r1; r++) for (let c = cb.c0; c <= cb.c1; c++) out.push(unitZone(c, r, cols, rows));
  }
  return out;
}

export async function createVideowall(
  ownerId: string,
  name: string,
  width: number,
  height: number,
  cols: number,
  rows: number
): Promise<string> {
  const nm = name.trim() || "Yeni duvar";
  const ref = await addDoc(collection(db(), "videowalls"), {
    ownerId,
    name: nm,
    slug: slugify(nm),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    cols: Math.max(1, Math.round(cols)),
    rows: Math.max(1, Math.round(rows)),
    zones: gridZones(Math.max(1, cols), Math.max(1, rows)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listVideowalls(ownerId: string): Promise<Videowall[]> {
  const snap = await getDocs(query(collection(db(), "videowalls"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Videowall)
    .sort((a, b) => (b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0));
}

export async function getVideowall(id: string): Promise<Videowall | null> {
  const snap = await getDoc(doc(db(), "videowalls", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Videowall) : null;
}

export function watchVideowall(id: string, cb: (v: Videowall | null) => void): () => void {
  return onSnapshot(doc(db(), "videowalls", id), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Videowall) : null);
  });
}

export async function updateVideowall(id: string, patch: Partial<Videowall>): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), { ...patch, updatedAt: serverTimestamp() });
}

export async function renameVideowall(id: string, name: string): Promise<void> {
  const nm = name.trim().slice(0, 80);
  await updateDoc(doc(db(), "videowalls", id), { name: nm, slug: slugify(nm), updatedAt: serverTimestamp() });
}

/** Eski (slug'sız) duvarlara isimden slug doldur (edit sayfası açılınca bir kez). */
export async function ensureSlug(v: Videowall): Promise<void> {
  if (v.slug) return;
  await updateDoc(doc(db(), "videowalls", v.id), { slug: slugify(v.name) });
}

/** Slug ile duvar izle (public yayın linki /flowsign/[slug]). */
export function watchVideowallBySlug(slug: string, cb: (v: Videowall | null) => void): () => void {
  return onSnapshot(
    query(collection(db(), "videowalls"), where("slug", "==", slug)),
    (snap) => {
      if (snap.empty) return cb(null);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Videowall);
      docs.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
      cb(docs[0]);
    },
    () => cb(null)
  );
}

/** Yerleşim/içerik yazımı (birleştir/böl/öğe ekle). */
export async function updateZones(id: string, zones: Zone[]): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), { zones, updatedAt: serverTimestamp() });
}

/** Çözünürlük/ızgara değişince zone'ları taze ızgaraya sıfırla. */
export async function resetGrid(id: string, cols: number, rows: number): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), { cols, rows, zones: gridZones(cols, rows), updatedAt: serverTimestamp() });
}

/** Duvarı kopyala (yeni id + taze zone/öğe id'leri; içerik referansları korunur). */
export async function duplicateVideowall(ownerId: string, v: Videowall): Promise<string> {
  const zones = (v.zones ?? []).map((z) => ({
    ...z,
    id: zid(),
    items: (z.items ?? []).map((it) => ({ ...it, id: `it-${Math.random().toString(36).slice(2, 9)}` })),
  }));
  const ref = await addDoc(collection(db(), "videowalls"), {
    ownerId,
    name: `${v.name} (kopya)`,
    width: v.width,
    height: v.height,
    cols: v.cols,
    rows: v.rows,
    zones,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteVideowall(v: Videowall): Promise<void> {
  await deleteDoc(doc(db(), "videowalls", v.id));
}
