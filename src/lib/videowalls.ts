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

/** cols×rows tam ızgara (başlangıç yerleşimi; kullanıcı böler/birleştirir). */
export function gridZones(cols: number, rows: number): Zone[] {
  const zones: Zone[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      zones.push({
        id: `z-${r}-${c}-${Math.random().toString(36).slice(2, 6)}`,
        x: c / cols,
        y: r / rows,
        w: 1 / cols,
        h: 1 / rows,
        fit: "cover",
        items: [],
      });
    }
  }
  return zones;
}

export async function createVideowall(
  ownerId: string,
  name: string,
  width: number,
  height: number,
  cols: number,
  rows: number
): Promise<string> {
  const ref = await addDoc(collection(db(), "videowalls"), {
    ownerId,
    name: name.trim() || "Yeni duvar",
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
  await updateDoc(doc(db(), "videowalls", id), { name: name.trim().slice(0, 80), updatedAt: serverTimestamp() });
}

/** Çözünürlük/ızgara değişince zone'ları taze ızgaraya sıfırla. */
export async function resetGrid(id: string, cols: number, rows: number): Promise<void> {
  await updateDoc(doc(db(), "videowalls", id), { cols, rows, zones: gridZones(cols, rows), updatedAt: serverTimestamp() });
}

export async function deleteVideowall(v: Videowall): Promise<void> {
  await deleteDoc(doc(db(), "videowalls", v.id));
}
