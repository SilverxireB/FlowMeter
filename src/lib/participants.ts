import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getVoterId } from "./responses";

const NICKNAME_KEY = "flowmeter.nickname";
const AVATAR_KEY = "flowmeter.avatarSeed";
const LAST_PRESENTATION_KEY = "flowmeter.lastPresentation";
const SESSION_KEY_PREFIX = "flowmeter.session.";

/** Galeride gösterilen hazır avatar seed'leri (DiceBear deterministik üretir). */
export const AVATAR_SEEDS = [
  "Luna", "Atlas", "Nova", "Pixel", "Koda", "Mira",
  "Zephyr", "Rio", "Alya", "Bulut", "Duman", "Fıstık",
  "Karamel", "Limon", "Maya", "Pati", "Sedef", "Tarçın",
  "Yıldız", "Zeytin", "Poyraz", "Badem", "Çakıl", "İnci",
] as const;

export function randomAvatarSeed(): string {
  return `rnd-${Math.random().toString(36).slice(2, 10)}`;
}

/** Cihazda kayıtlı takma ad (auth yok — Menti gibi, sadece localStorage). */
export function getStoredNickname(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NICKNAME_KEY);
}

export function getStoredAvatarSeed(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AVATAR_KEY);
}

export function storeIdentity(nickname: string, avatarSeed: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname);
  localStorage.setItem(AVATAR_KEY, avatarSeed);
}

/** Kimliği siler (yeni oturumda avatar/ad yeniden seçilsin diye). */
export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NICKNAME_KEY);
  localStorage.removeItem(AVATAR_KEY);
}

/** Bu cihazın bu sunum için en son gördüğü oturum kimliği. */
export function getStoredSession(presentationId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY_PREFIX + presentationId);
}

export function storeSession(presentationId: string, sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY_PREFIX + presentationId, sessionId);
}

/** Katılımcıyı sunuma kaydeder (voterId başına tek doküman, tekrar girişte günceller). */
export async function joinPresentation(
  presentationId: string,
  nickname: string,
  avatarSeed: string
): Promise<void> {
  await setDoc(
    doc(db(), "presentations", presentationId, "participants", getVoterId()),
    { nickname, avatarSeed, joinedAt: serverTimestamp() },
    { merge: true }
  );
}

export interface LastPresentation {
  id: string;
  title: string;
}

/** İzleyicinin en son katıldığı sunum — landing'de "geri dön" için. */
export function storeLastPresentation(p: LastPresentation): void {
  localStorage.setItem(LAST_PRESENTATION_KEY, JSON.stringify(p));
}

export function getLastPresentation(): LastPresentation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_PRESENTATION_KEY);
    return raw ? (JSON.parse(raw) as LastPresentation) : null;
  } catch {
    return null;
  }
}
