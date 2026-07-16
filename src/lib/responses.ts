import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const VOTER_ID_KEY = "flowmeter.voterId";

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

export async function submitResponse(
  presentationId: string,
  slideId: string,
  value: string | number
): Promise<void> {
  await addDoc(
    collection(db(), "presentations", presentationId, "slides", slideId, "responses"),
    {
      voterId: getVoterId(),
      value,
      createdAt: serverTimestamp(),
    }
  );
  localStorage.setItem(votedKey(slideId), String(getVoteCount(slideId) + 1));
}
