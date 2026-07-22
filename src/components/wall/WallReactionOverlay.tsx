"use client";

/**
 * FlowWall perde — misafir tepkileri (emoji/kalp yağmuru). Yalnız ekran
 * açıldıktan sonra gelenler, perde genişliğine yayılıp yukarı uçar.
 */
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db, isFirebaseConfigured } from "@/lib/firebase";

interface Float {
  key: string;
  emoji: string;
  left: number; // vw
  drift: number; // px
  duration: number; // s
  size: number; // rem
}

export default function WallReactionOverlay({ wallId }: { wallId: string }) {
  const [floats, setFloats] = useState<Float[]>([]);
  const mountedAt = useRef(Timestamp.now());

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const q = query(
      collection(db(), "walls", wallId, "reactions"),
      where("createdAt", ">", mountedAt.current)
    );
    return onSnapshot(q, (snap) => {
      const added = snap.docChanges().filter((c) => c.type === "added");
      if (added.length === 0) return;
      const fresh: Float[] = added.map((c) => ({
        key: c.doc.id,
        emoji: String(c.doc.data().emoji ?? "❤️"),
        left: 3 + Math.random() * 92,
        drift: -80 + Math.random() * 160,
        duration: 3 + Math.random() * 2.2,
        size: 2.4 + Math.random() * 1.8,
      }));
      setFloats((prev) => [...prev.slice(-60), ...fresh]);
      setTimeout(() => {
        setFloats((prev) => prev.filter((f) => !fresh.some((n) => n.key === f.key)));
      }, 6000);
    });
  }, [wallId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {floats.map((f) => (
        <span
          key={f.key}
          className="absolute animate-float-up"
          style={{
            left: `${f.left}vw`,
            bottom: "5rem",
            fontSize: `${f.size}rem`,
            animationDuration: `${f.duration}s`,
            ["--drift" as string]: `${f.drift}px`,
          }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
