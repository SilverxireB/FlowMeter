/**
 * FlowPulse — sürekli nabız/geri bildirim. Firestore `pulses/{id}` + günlük
 * özet rollup (`days/{yyyy-mm-dd}`): oy yazılırken güne ve saate increment →
 * kokpit 30 günlük trendi 30 dokümanla okur (kota bilinci, Paket 3 ruhu).
 * DIŞ SERVİS SIFIR (Cloudinary bile yok) → self-host'a en kolay ürün.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { Pulse, PulseDay, PulseQuestionType } from "./types";

/** Yerel tarih anahtarı (kiosk saat dilimi) — yyyy-mm-dd. */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tip başına ölçek (min..max) — skor normalizasyonu için. */
export function scaleOf(type: PulseQuestionType): { min: number; max: number } {
  if (type === "smiley") return { min: 1, max: 5 };
  if (type === "nps") return { min: 0, max: 10 };
  return { min: 0, max: 1 }; // yesno; choice'ta skor yerine dağılım kullanılır
}

/** Gün özetinden %0–100 skor (choice → null; onun grafiği dağılımdır). */
export function percentOf(type: PulseQuestionType, day?: { total?: number; sum?: number } | null): number | null {
  if (type === "choice" || !day?.total) return null;
  const { min, max } = scaleOf(type);
  const avg = (day.sum ?? 0) / day.total;
  return Math.round(((avg - min) / (max - min)) * 100);
}

export async function createPulse(
  ownerId: string,
  title: string,
  question: Pulse["question"]
): Promise<string> {
  const ref = await addDoc(collection(db(), "pulses"), {
    ownerId,
    title: title.trim() || "Yeni nokta",
    question,
    cooldownSec: 3,
    commentsEnabled: true,
    moderation: true,
    threshold: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listPulses(ownerId: string): Promise<Pulse[]> {
  const snap = await getDocs(query(collection(db(), "pulses"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Pulse)
    .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
}

export function watchPulse(id: string, cb: (p: Pulse | null) => void): () => void {
  return onSnapshot(doc(db(), "pulses", id), (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Pulse) : null));
}

export async function updatePulse(id: string, patch: Partial<Pulse>): Promise<void> {
  await updateDoc(doc(db(), "pulses", id), { ...patch, updatedAt: serverTimestamp() });
}

/** Noktayı ve alt verisini sil (sayfalı — büyük koleksiyon güvenli). */
export async function deletePulse(id: string): Promise<void> {
  for (const sub of ["votes", "days", "comments"]) {
    for (;;) {
      const snap = await getDocs(query(collection(db(), "pulses", id, sub), limit(450)));
      if (snap.empty) break;
      const b = writeBatch(db());
      snap.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
      if (snap.size < 450) break;
    }
  }
  await deleteDoc(doc(db(), "pulses", id));
}

/**
 * Oy ver (anonim). Tek batch: ham oy + günlük özete increment (total/sum/
 * counts.{v}/hours.{h}) → trend ucuz. Kiosk offline'da Firestore kuyruğuna
 * yazar, ağ gelince akar (persistentLocalCache).
 */
export async function castVote(pulseId: string, value: number, channel: "kiosk" | "qr"): Promise<void> {
  const now = new Date();
  const b = writeBatch(db());
  b.set(doc(collection(db(), "pulses", pulseId, "votes")), { value, channel, createdAt: serverTimestamp() });
  b.set(
    doc(db(), "pulses", pulseId, "days", dayKey(now)),
    {
      total: increment(1),
      sum: increment(value),
      counts: { [String(value)]: increment(1) },
      hours: { [String(now.getHours())]: { t: increment(1), s: increment(value) } },
    },
    { merge: true }
  );
  await b.commit();
}

/** Son N günün özetleri (eksik günler yok sayılır; docId sıralı aralık okuma). */
export async function getRecentDays(pulseId: string, nDays: number): Promise<PulseDay[]> {
  const from = new Date();
  from.setDate(from.getDate() - (nDays - 1));
  const snap = await getDocs(
    query(collection(db(), "pulses", pulseId, "days"), orderBy(documentId()), startAt(dayKey(from)))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PulseDay);
}

/** Bugünün özetini canlı izle (kokpit/pano anlık skor). */
export function watchToday(pulseId: string, cb: (d: PulseDay | null) => void): () => void {
  return onSnapshot(doc(db(), "pulses", pulseId, "days", dayKey()), (s) =>
    cb(s.exists() ? ({ id: s.id, ...s.data() } as PulseDay) : null)
  );
}

// ── Yorumlar ──
export interface PulseComment {
  id: string;
  text: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp | null;
}

export async function addComment(pulseId: string, text: string, moderation: boolean): Promise<void> {
  await addDoc(collection(db(), "pulses", pulseId, "comments"), {
    text: text.trim().slice(0, 200),
    status: moderation ? "pending" : "approved",
    createdAt: serverTimestamp(),
  });
}

export function watchComments(pulseId: string, cb: (c: PulseComment[]) => void): () => void {
  return onSnapshot(query(collection(db(), "pulses", pulseId, "comments"), orderBy("createdAt", "desc"), limit(100)), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PulseComment))
  );
}

export async function setCommentStatus(pulseId: string, commentId: string, status: "approved" | "rejected"): Promise<void> {
  await updateDoc(doc(db(), "pulses", pulseId, "comments", commentId), { status });
}

export async function deleteComment(pulseId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db(), "pulses", pulseId, "comments", commentId));
}
