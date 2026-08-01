import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
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
  if (dryRun) return 0; // prova hep temiz başlar — gerçek oy kaydı karışmasın
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

// Prova (kuru çalışma) modu: editördeki "Dene" paneli açıkken cevaplar
// Firestore'a YAZILMAZ, yerel oy sayaçları da kirlenmez — veri temiz kalır.
let dryRun = false;
export function setResponseDryRun(on: boolean): void {
  dryRun = on;
}

export async function submitResponse(
  presentationId: string,
  slideId: string,
  value: ResponseValue,
  opts?: { pending?: boolean }
): Promise<void> {
  if (dryRun) {
    await new Promise((r) => setTimeout(r, 250)); // gerçekçi "gönderiliyor" hissi
    return;
  }
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
        // Açık metin moderasyonu açıkken cevap perdeye düşmeden onay bekler
        ...(opts?.pending ? { status: "pending" } : {}),
      }
    )
  );
  localStorage.setItem(votedKey(slideId), String(getVoteCount(slideId) + 1));
}

/** Moderasyon: cevabı onayla (perde/sonuçlarda görünür olur). Sadece sahibi (rules). */
export async function approveResponse(presentationId: string, slideId: string, responseId: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId, "slides", slideId, "responses", responseId), { status: "approved" });
}

/** Moderasyon: cevabı reddet (siler). Sadece sahibi (rules). */
export async function deleteResponse(presentationId: string, slideId: string, responseId: string): Promise<void> {
  await deleteDoc(doc(db(), "presentations", presentationId, "slides", slideId, "responses", responseId));
}
