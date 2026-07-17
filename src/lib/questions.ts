import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { getVoterId } from "./responses";

/** Q&A: izleyici soru gönderir, diğerleri upvote eder (sunum geneli havuz). */
export async function submitQuestion(presentationId: string, text: string): Promise<void> {
  await addDoc(collection(db(), "presentations", presentationId, "questions"), {
    text: text.slice(0, 250),
    voterId: getVoterId(),
    upvotes: 0,
    createdAt: serverTimestamp(),
  });
}

function upvoteKey(questionId: string): string {
  return `flowmeter.upvoted.${questionId}`;
}

export function hasUpvoted(questionId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(upvoteKey(questionId)) === "1";
}

export async function upvoteQuestion(presentationId: string, questionId: string): Promise<void> {
  if (hasUpvoted(questionId)) return;
  localStorage.setItem(upvoteKey(questionId), "1");
  await updateDoc(doc(db(), "presentations", presentationId, "questions", questionId), {
    upvotes: increment(1),
  });
}

/** Moderasyon (sadece sahibi — rules ile korunur). */
export async function setQuestionHidden(
  presentationId: string,
  questionId: string,
  hidden: boolean
): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId, "questions", questionId), { hidden });
}

/** "Cevaplandı" işareti (gizlemeden ayrı — soru listede kalır, rozet alır). */
export async function setQuestionAnswered(
  presentationId: string,
  questionId: string,
  answered: boolean
): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId, "questions", questionId), { answered });
}

export async function deleteQuestion(presentationId: string, questionId: string): Promise<void> {
  await deleteDoc(doc(db(), "presentations", presentationId, "questions", questionId));
}
