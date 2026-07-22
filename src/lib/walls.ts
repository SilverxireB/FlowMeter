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
  increment,
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
import { getVoterId } from "./responses";
import { Wall, WallMedia, WallScreenMode, WallWish } from "./types";

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

export async function setWallTheme(id: string, theme: { preset?: string; bgImage?: string }): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { theme, updatedAt: serverTimestamp() });
}

export async function setWallScreenMode(id: string, screenMode: WallScreenMode): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { screenMode, updatedAt: serverTimestamp() });
}

export async function setWallAutoModes(id: string, autoModes: WallScreenMode[]): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { autoModes, updatedAt: serverTimestamp() });
}

export async function setWallAutoInterval(id: string, autoIntervalSec: number): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { autoIntervalSec, updatedAt: serverTimestamp() });
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
    likes: 0,
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

// ── Tepkiler (misafir → perde emoji/kalp yağmuru; create-only) ────────────────
export const WALL_REACTION_EMOJIS = ["❤️", "👏", "🎉", "😍", "🔥", "😮"] as const;
export type WallReactionEmoji = (typeof WALL_REACTION_EMOJIS)[number];

let lastReactionSent = 0;

/** Perdeye emoji gönderir — client-side 500ms rate limit (spam koruması). */
export async function sendWallReaction(wallId: string, emoji: WallReactionEmoji): Promise<void> {
  const now = Date.now();
  if (now - lastReactionSent < 500) return;
  lastReactionSent = now;
  await addDoc(collection(db(), "walls", wallId, "reactions"), {
    emoji,
    createdAt: serverTimestamp(),
  });
}

// ── Dilek/not mesajları (misafir yazılı → perdede akan dilek bandı) ───────────
let lastWishSent = 0;

/** Duvara dilek/not bırakır (create-only). Moderasyon açıksa status=pending. */
export async function sendWallWish(wallId: string, text: string, nickname: string | undefined, moderation: boolean): Promise<void> {
  const clean = text.trim().slice(0, 140);
  if (!clean) return;
  const now = Date.now();
  if (now - lastWishSent < 800) return;
  lastWishSent = now;
  const data: Record<string, unknown> = {
    text: clean,
    voterId: getVoterId(),
    status: moderation ? "pending" : "approved",
    createdAt: serverTimestamp(),
  };
  if (nickname && nickname.trim()) data.nickname = nickname.trim().slice(0, 30);
  await addDoc(collection(db(), "walls", wallId, "wishes"), data);
}

export function watchWallWishes(id: string, cb: (w: WallWish[]) => void): () => void {
  const q = query(collection(db(), "walls", id, "wishes"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WallWish));
  });
}

export async function setWishStatus(wallId: string, wishId: string, status: WallWish["status"]): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId, "wishes", wishId), { status });
}

export async function deleteWish(wallId: string, wishId: string): Promise<void> {
  await deleteDoc(doc(db(), "walls", wallId, "wishes", wishId));
}

// ── Canlı anons (moderasyondan; süre sonuna kadar perdede durur) ──────────────
/** Anons yayınlar: `until` = şimdi + dakika. Perde bu ana kadar gösterir. */
export async function setWallAnnouncement(wallId: string, text: string, durationMin: number): Promise<void> {
  const clean = text.trim().slice(0, 160);
  if (!clean) return;
  const until = new Date(Date.now() + Math.max(1, durationMin) * 60_000);
  await updateDoc(doc(db(), "walls", wallId), { announcement: { text: clean, until }, updatedAt: serverTimestamp() });
}

export async function clearWallAnnouncement(wallId: string): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId), { announcement: null, updatedAt: serverTimestamp() });
}

/** "En Sevilenler" turu sıklığı (saniye; 0 = kapalı). */
export async function setWallTopLovedInterval(wallId: string, topLovedEverySec: number): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId), { topLovedEverySec, updatedAt: serverTimestamp() });
}

// ── Beğeni (misafir ❤ — sunum Q&A upvote deseniyle aynı: +1, localStorage dedup) ─
function likeKey(mediaId: string): string {
  return `flowwall.liked.${mediaId}`;
}

/** Bu cihaz bu medyayı daha önce beğendi mi? (tek beğeni; kurallar da +1 sınırlar) */
export function hasLikedMedia(mediaId: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(likeKey(mediaId)) === "1";
}

/** Medyayı beğen (+1). Tekrarları localStorage engeller; sunucuda +1 kuralı var. */
export async function likeMedia(wallId: string, mediaId: string): Promise<void> {
  if (hasLikedMedia(mediaId)) return;
  localStorage.setItem(likeKey(mediaId), "1");
  await updateDoc(doc(db(), "walls", wallId, "media", mediaId), { likes: increment(1) });
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
