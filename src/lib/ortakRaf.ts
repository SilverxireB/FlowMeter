/**
 * ORTAK RAF — Firestore katmanı (istemci).
 *
 * Sabitler ve saf işlevler `ortakRafCekirdek.ts`te: sunucu rotası onları
 * Firebase SDK'sını içeri çekmeden kullanabilsin diye (bkz. o dosyanın başlığı).
 */
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export * from "./ortakRafCekirdek";

export interface RafOgesi {
  id: string;
  kind: "image" | "video";
  src: string;
  /** Cloudinary public_id — silme ve taşıma için gerekir. */
  publicId?: string;
  name: string;
  /** Denetim izi: rafa kim koydu, ne zaman. */
  by?: string;
  at?: Timestamp | null;
  /** Hangi ekrandan paylaşıldı (bilgi; ekran silinse de raf etkilenmez). */
  fromWall?: string;
}

const rafRef = () => collection(db(), "signOrtak");

/** Rafı dinle (realtime — polling yok). En yeni üstte. */
export function watchOrtakRaf(cb: (items: RafOgesi[]) => void): () => void {
  return onSnapshot(
    query(rafRef(), orderBy("at", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RafOgesi)),
    // Kurallar henüz yayınlanmamışsa raf boş görünür, kokpit çökmez.
    () => cb([])
  );
}

/** Rafa kayıt ekle (dosya SUNUCUDA taşındıktan sonra çağrılır). */
export async function rafaEkle(o: Omit<RafOgesi, "id" | "at">): Promise<void> {
  await addDoc(rafRef(), { ...o, at: serverTimestamp() });
}

/** Raftan kaldır (yalnız yönetici — kurallar da öyle diyor). */
export async function raftanSil(id: string): Promise<void> {
  await deleteDoc(doc(db(), "signOrtak", id));
}
