import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { censorText } from "./profanity";
import { ResponseValue } from "./types";
import { withTimeout } from "./withTimeout";

const VOTER_ID_KEY = "flowmeter.voterId";

/** Aktif oturum (presentation.sessionId) — oylar bununla etiketlenir. */
let activeSessionId: string | undefined;
export function setActiveSession(id: string | undefined): void {
  activeSessionId = id;
}
export function getActiveSession(): string | undefined {
  return activeSessionId;
}

/** Anonim izleyici kimliği — cihaz başına bir UUID, localStorage'da tutulur. */
export function getVoterId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_ID_KEY, id);
  }
  return id;
}

function votedKey(slideId: string): string {
  return `flowmeter.voted.${slideId}`;
}

/** Bu cihaz bu slayta kaç kez cevap gönderdi (mükerrer oy engeli için). */
export function getVoteCount(slideId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(votedKey(slideId)) ?? 0);
}

/** Verilen slaytların yerel oy + quiz cevap kayıtlarını siler (yeni oturum). */
export function clearSlideVotes(slideIds: string[]): void {
  if (typeof window === "undefined") return;
  slideIds.forEach((id) => {
    localStorage.removeItem(votedKey(id));
    localStorage.removeItem(`flowmeter.quizAnswer.${id}`);
  });
}

export async function submitResponse(
  presentationId: string,
  slideId: string,
  value: ResponseValue
): Promise<void> {
  const sessionId = getActiveSession();
  // Açık uçlu/kelime bulutu gibi serbest metin cevaplarında küfür süzgeci
  // (sayı/seçenek indeksi gibi değerlere dokunmaz).
  const safe: ResponseValue =
    typeof value === "string" ? censorText(value) : Array.isArray(value) ? (value.map((v) => (typeof v === "string" ? censorText(v) : v)) as ResponseValue) : value;
  await withTimeout(
    addDoc(
      collection(db(), "presentations", presentationId, "slides", slideId, "responses"),
      {
        voterId: getVoterId(),
        value: safe,
        createdAt: serverTimestamp(),
        ...(sessionId ? { sessionId } : {}),
      }
    )
  );
  localStorage.setItem(votedKey(slideId), String(getVoteCount(slideId) + 1));
}
