import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getVoterId } from "./responses";

const NICKNAME_KEY = "flowmeter.nickname";
const LAST_PRESENTATION_KEY = "flowmeter.lastPresentation";

/** Cihazda kayıtlı takma ad (auth yok — Menti gibi, sadece localStorage). */
export function getStoredNickname(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NICKNAME_KEY);
}

export function storeNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname);
}

/** Katılımcıyı sunuma kaydeder (voterId başına tek doküman, tekrar girişte günceller). */
export async function joinPresentation(presentationId: string, nickname: string): Promise<void> {
  await setDoc(
    doc(db(), "presentations", presentationId, "participants", getVoterId()),
    { nickname, joinedAt: serverTimestamp() },
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
