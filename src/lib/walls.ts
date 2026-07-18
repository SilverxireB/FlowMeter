/**
 * FlowWall — duvar (walls/{id}) CRUD + kod çözümü + medya moderasyonu.
 * Metadata Firebase'de; dosya byte'ları Cloudinary'de (bkz. cloudinary.ts).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { Wall, WallMedia } from "./types";

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function randomSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function deleteAllDocs(colPath: [string, ...string[]]): Promise<void> {
  const snap = await getDocs(collection(db(), ...colPath));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db());
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** joinCodes tek havuz — duvar kodu {id, kind:"wall"} olarak yazılır. */
async function allocateWallCode(wallId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const ref = doc(db(), "joinCodes", code);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { id: wallId, kind: "wall" });
      return code;
    }
  }
  throw new Error("Katılım kodu üretilemedi, tekrar deneyin.");
}

export async function createWall(ownerId: string, title: string): Promise<string> {
  const ref = await addDoc(collection(db(), "walls"), {
    ownerId,
    title,
    joinCode: "",
    moderation: false,
    sessionId: randomSessionId(),
    sessionStartedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  const code = await allocateWallCode(ref.id);
  await updateDoc(ref, { joinCode: code });
  return ref.id;
}

export async function listWalls(ownerId: string): Promise<Wall[]> {
  const snap = await getDocs(query(collection(db(), "walls"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Wall)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function renameWall(id: string, title: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { title, updatedAt: serverTimestamp() });
}

export async function setWallModeration(id: string, moderation: boolean): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { moderation });
}

export async function setWallHeadline(id: string, headline: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { headline, updatedAt: serverTimestamp() });
}

export async function deleteWall(w: Wall): Promise<void> {
  await deleteAllDocs(["walls", w.id, "media"]);
  const batch = writeBatch(db());
  if (w.joinCode) batch.delete(doc(db(), "joinCodes", w.joinCode));
  batch.delete(doc(db(), "walls", w.id));
  await batch.commit();
}

// ── Kod çözümü (deck | wall tek havuz) ───────────────────────────────────────
export interface CodeTarget {
  kind: "wall" | "deck";
  id: string;
}
export async function resolveCode(code: string): Promise<CodeTarget | null> {
  const snap = await getDoc(doc(db(), "joinCodes", code));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (d.kind === "wall" && d.id) return { kind: "wall", id: d.id as string };
  if (d.presentationId) return { kind: "deck", id: d.presentationId as string };
  return null;
}

// ── Medya ────────────────────────────────────────────────────────────────────
export interface NewMedia {
  voterId: string;
  nickname?: string;
  type: "image" | "video";
  cloudinaryId: string;
  url: string;
  w?: number;
  h?: number;
  durationMs?: number;
}

/** Medya dokümanı oluşturur. Moderasyon açıksa status=pending, değilse approved. */
export async function addWallMedia(
  wallId: string,
  media: NewMedia,
  moderation: boolean,
  sessionId?: string
): Promise<void> {
  const data: Record<string, unknown> = {
    voterId: media.voterId,
    type: media.type,
    cloudinaryId: media.cloudinaryId,
    url: media.url,
    status: moderation ? "pending" : "approved",
    createdAt: serverTimestamp(),
  };
  if (media.nickname) data.nickname = media.nickname;
  if (media.w != null) data.w = media.w;
  if (media.h != null) data.h = media.h;
  if (media.durationMs != null) data.durationMs = media.durationMs;
  if (sessionId) data.sessionId = sessionId;
  await addDoc(collection(db(), "walls", wallId, "media"), data);
}

export async function setMediaStatus(
  wallId: string,
  mediaId: string,
  status: WallMedia["status"]
): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId, "media", mediaId), { status });
}

export async function deleteMedia(wallId: string, mediaId: string): Promise<void> {
  // Not: Cloudinary'deki dosya silme API secret ister → ileride Vercel API route.
  // Şimdilik Firestore dokümanı silinir (duvardan kalkar).
  await deleteDoc(doc(db(), "walls", wallId, "media", mediaId));
}

// ── Canlı dinleyiciler ───────────────────────────────────────────────────────
export function watchWall(id: string, cb: (w: Wall | null) => void): () => void {
  return onSnapshot(doc(db(), "walls", id), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Wall) : null);
  });
}

export function watchWallMedia(id: string, cb: (m: WallMedia[]) => void): () => void {
  const q = query(collection(db(), "walls", id, "media"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WallMedia));
  });
}
