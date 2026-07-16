"use client";

import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db, isFirebaseConfigured } from "@/lib/firebase";

interface FloatingReaction {
  key: string;
  emoji: string;
  /** Yatay konum (viewport yüzdesi) */
  x: number;
  /** Hafif süre çeşitliliği (s) */
  duration: number;
}

/**
 * Yeni gelen tepkileri dinler ve ekranda yukarı doğru uçurur.
 * Sadece bileşen açıldıktan SONRA gelen tepkiler gösterilir.
 */
export default function ReactionOverlay({ presentationId }: { presentationId: string }) {
  const [floats, setFloats] = useState<FloatingReaction[]>([]);
  const mountedAt = useRef(Timestamp.now());

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const q = query(
      collection(db(), "presentations", presentationId, "reactions"),
      where("createdAt", ">", mountedAt.current)
    );
    return onSnapshot(q, (snap) => {
      const fresh = snap
        .docChanges()
        .filter((c) => c.type === "added")
        .map((c) => ({
          key: c.doc.id,
          emoji: String(c.doc.data().emoji ?? "❤️"),
          x: 8 + Math.random() * 84,
          duration: 2.4 + Math.random() * 1.4,
        }));
      if (fresh.length === 0) return;
      setFloats((prev) => [...prev.slice(-40), ...fresh]);
      // Animasyon bitince temizle
      setTimeout(() => {
        setFloats((prev) => prev.filter((f) => !fresh.some((n) => n.key === f.key)));
      }, 4000);
    });
  }, [presentationId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {floats.map((f) => (
        <span
          key={f.key}
          className="absolute bottom-0 text-4xl animate-float-up"
          style={{ left: `${f.x}%`, animationDuration: `${f.duration}s` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
