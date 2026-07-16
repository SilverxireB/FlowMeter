import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getVoterId } from "./responses";

const NICKNAME_KEY = "flowmeter.nickname";
const EMOJI_KEY = "flowmeter.emoji";
const LAST_PRESENTATION_KEY = "flowmeter.lastPresentation";

/** Katılımcının seçebileceği avatar emojileri */
export const AVATAR_EMOJIS = [
  "😀", "😎", "🤩", "🥳", "😇", "🤓", "😺", "🦊",
  "🐼", "🐨", "🦁", "🐸", "🐙", "🦄", "🐝", "🦋",
  "🌟", "🔥", "⚡", "🌈", "🍀", "🍉", "🎸", "🚀",
] as const;

/** Cihazda kayıtlı takma ad (auth yok — Menti gibi, sadece localStorage). */
export function getStoredNickname(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NICKNAME_KEY);
}

export function getStoredEmoji(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMOJI_KEY);
}

export function storeIdentity(nickname: string, emoji: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname);
  localStorage.setItem(EMOJI_KEY, emoji);
}

/** Katılımcıyı sunuma kaydeder (voterId başına tek doküman, tekrar girişte günceller). */
export async function joinPresentation(
  presentationId: string,
  nickname: string,
  emoji: string
): Promise<void> {
  await setDoc(
    doc(db(), "presentations", presentationId, "participants", getVoterId()),
    { nickname, emoji, joinedAt: serverTimestamp() },
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
