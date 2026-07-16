import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const REACTION_EMOJIS = ["❤️", "👍", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

let lastSent = 0;

/** Tepki gönderir — client-side 700ms rate limit (spam koruması). */
export async function sendReaction(presentationId: string, emoji: ReactionEmoji): Promise<void> {
  const now = Date.now();
  if (now - lastSent < 700) return;
  lastSent = now;
  await addDoc(collection(db(), "presentations", presentationId, "reactions"), {
    emoji,
    createdAt: serverTimestamp(),
  });
}
