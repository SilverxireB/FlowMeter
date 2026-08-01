"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { AudienceQuestion, ChatMessage, ContestVote, Participant, Presentation, ResponseDoc, Slide, Wall, WallMedia, WallWish } from "./types";
import { watchWall, watchWallMedia, watchWallWishes, watchContestVotes } from "./walls";

/** Presenter oturumu. loading=true iken yönlendirme yapma. */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

/** Sunum dokümanını canlı dinler (currentSlideIndex senkronu buradan gelir). */
export function usePresentation(id: string | null) {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    return onSnapshot(doc(db(), "presentations", id), (snap) => {
      setPresentation(snap.exists() ? ({ id: snap.id, ...snap.data() } as Presentation) : null);
      setLoading(false);
    });
  }, [id]);

  return { presentation, loading };
}

/** Slaytları sıralı ve canlı dinler. */
export function useSlides(presentationId: string | null) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!presentationId || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db(), "presentations", presentationId, "slides"),
      orderBy("order")
    );
    return onSnapshot(q, (snap) => {
      setSlides(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Slide));
      setLoading(false);
    });
  }, [presentationId]);

  return { slides, loading };
}

/**
 * Sunuma katılanları canlı dinler. sessionId verilirse yalnızca o oturumun
 * katılımcıları gelir (eski oturumlar saklı kalır ama sayaca/listeye girmez).
 */
export function useParticipants(presentationId: string | null, sessionId?: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!presentationId || !isFirebaseConfigured()) return;
    const col = collection(db(), "presentations", presentationId, "participants");
    const q = sessionId ? query(col, where("sessionId", "==", sessionId)) : col;
    return onSnapshot(q, (snap) => {
      setParticipants(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participant));
    });
  }, [presentationId, sessionId]);

  return participants;
}

/** Q&A sorularını canlı dinler (upvote'a göre sıralı). */
export function useQuestions(presentationId: string | null) {
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);

  useEffect(() => {
    if (!presentationId || !isFirebaseConfigured()) return;
    const q = collection(db(), "presentations", presentationId, "questions");
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AudienceQuestion);
      items.sort(
        (a, b) =>
          b.upvotes - a.upvotes ||
          (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)
      );
      setQuestions(items);
    });
  }, [presentationId]);

  return questions;
}

/** Canlı sohbet mesajlarını dinler (zamana göre sıralı, son 100). */
export function useChatMessages(presentationId: string | null, enabled: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!presentationId || !enabled || !isFirebaseConfigured()) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db(), "presentations", presentationId, "messages"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage);
      setMessages(items.slice(-100));
    });
  }, [presentationId, enabled]);

  return messages;
}

/**
 * Bir slaytın cevaplarını canlı dinler. sessionId verilirse yalnızca o oturumun
 * cevapları gelir (canlı sonuç ekranı böylece taze başlar; eski cevaplar saklı).
 */
export function useLiveResponses(
  presentationId: string | null,
  slideId: string | null,
  sessionId?: string
) {
  const [responses, setResponses] = useState<ResponseDoc[]>([]);

  useEffect(() => {
    if (!presentationId || !slideId || !isFirebaseConfigured()) return;
    const col = collection(db(), "presentations", presentationId, "slides", slideId, "responses");
    const q = sessionId ? query(col, where("sessionId", "==", sessionId)) : col;
    return onSnapshot(q, (snap) => {
      // Açık metin moderasyonu: onay bekleyen cevaplar perde/sonuçlara sızmaz
      setResponses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ResponseDoc).filter((r) => r.status !== "pending"));
    });
  }, [presentationId, slideId, sessionId]);

  return responses;
}

// ── FlowWall ─────────────────────────────────────────────────────────────────

/** Duvar dokümanını canlı dinler. */
export function useWall(id: string | null) {
  const [wall, setWall] = useState<Wall | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    // id sonradan gelirse (ör. kod çözümü) yükleme durumu yeniden başlar —
    // yoksa "bulunamadı" kontrolü ilk snapshot'tan önce yanlış tetiklenir.
    setLoading(true);
    return watchWall(id, (w) => {
      setWall(w);
      setLoading(false);
    });
  }, [id]);
  return { wall, loading };
}

/** Duvar medyasını canlı dinler (zaman sırasına göre). */
export function useWallMedia(id: string | null) {
  const [media, setMedia] = useState<WallMedia[]>([]);
  useEffect(() => {
    if (!id || !isFirebaseConfigured()) return;
    return watchWallMedia(id, setMedia);
  }, [id]);
  return media;
}

export function useWallWishes(id: string | null) {
  const [wishes, setWishes] = useState<WallWish[]>([]);
  useEffect(() => {
    if (!id || !isFirebaseConfigured()) return;
    return watchWallWishes(id, setWishes);
  }, [id]);
  return wishes;
}

/** YALNIZ perde + kokpit çağırır (misafir değil — ölçek). */
export function useContestVotes(id: string | null) {
  const [votes, setVotes] = useState<ContestVote[]>([]);
  useEffect(() => {
    if (!id || !isFirebaseConfigured()) return;
    return watchContestVotes(id, setVotes);
  }, [id]);
  return votes;
}
