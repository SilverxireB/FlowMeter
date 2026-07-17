import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { getVoterId } from "./responses";

const MAX_LENGTH = 200;
let lastSentAt = 0;

/** Canlı sohbet mesajı gönderir (izleyici — basit istemci tarafı rate limit). */
export async function sendChatMessage(
  presentationId: string,
  nickname: string,
  text: string
): Promise<void> {
  const clean = text.trim().slice(0, MAX_LENGTH);
  if (!clean) return;
  const now = Date.now();
  if (now - lastSentAt < 1500) return; // saniyede bir mesajdan fazlasını engelle
  lastSentAt = now;
  await addDoc(collection(db(), "presentations", presentationId, "messages"), {
    text: clean,
    voterId: getVoterId(),
    nickname: nickname.slice(0, 30),
    createdAt: serverTimestamp(),
  });
}

/** Mesaj siler (sadece sunum sahibi — rules ile korunur). */
export async function deleteChatMessage(
  presentationId: string,
  messageId: string
): Promise<void> {
  await deleteDoc(doc(db(), "presentations", presentationId, "messages", messageId));
}
