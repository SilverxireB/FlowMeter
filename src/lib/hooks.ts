"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { AudienceQuestion, Participant, Presentation, ResponseDoc, Slide } from "./types";

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

/** Sunuma katılanları canlı dinler — sunum ekranındaki sayaç ve isimler. */
export function useParticipants(presentationId: string | null) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!presentationId || !isFirebaseConfigured()) return;
    const q = collection(db(), "presentations", presentationId, "participants");
    return onSnapshot(q, (snap) => {
      setParticipants(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participant));
    });
  }, [presentationId]);

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

/** Bir slaytın cevaplarını canlı dinler — sonuç ekranlarının kalbi. */
export function useLiveResponses(presentationId: string | null, slideId: string | null) {
  const [responses, setResponses] = useState<ResponseDoc[]>([]);

  useEffect(() => {
    if (!presentationId || !slideId || !isFirebaseConfigured()) return;
    const q = collection(db(), "presentations", presentationId, "slides", slideId, "responses");
    return onSnapshot(q, (snap) => {
      setResponses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ResponseDoc));
    });
  }, [presentationId, slideId]);

  return responses;
}
