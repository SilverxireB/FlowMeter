"use client";

import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db, isFirebaseConfigured } from "@/lib/firebase";

interface FloatingReaction {
  key: string;
  emoji: string;
  /** Sağ kenardan uzaklık (%) */
  right: number;
  /** Yatay sürüklenme (px) ve süre (s) — doğal görünüm için rastgele */
  drift: number;
  duration: number;
}

/**
 * Tepkiler sağ alt köşeden yukarı fırlar (Menti tarzı); köşede emoji başına
 * canlı sayaç birikir. Sadece ekran açıldıktan sonra gelen tepkiler uçar.
 */
export default function ReactionOverlay({ presentationId }: { presentationId: string }) {
  const [floats, setFloats] = useState<FloatingReaction[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const mountedAt = useRef(Timestamp.now());

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const q = query(
      collection(db(), "presentations", presentationId, "reactions"),
      where("createdAt", ">", mountedAt.current)
    );
    return onSnapshot(q, (snap) => {
      const added = snap.docChanges().filter((c) => c.type === "added");
      if (added.length === 0) return;

      setCounts((prev) => {
        const next = { ...prev };
        for (const c of added) {
          const e = String(c.doc.data().emoji ?? "❤️");
          next[e] = (next[e] ?? 0) + 1;
        }
        return next;
      });

      const fresh = added.map((c) => ({
        key: c.doc.id,
        emoji: String(c.doc.data().emoji ?? "❤️"),
        right: 3 + Math.random() * 12,
        drift: -60 + Math.random() * 90,
        duration: 2.2 + Math.random() * 1.4,
      }));
      setFloats((prev) => [...prev.slice(-40), ...fresh]);
      setTimeout(() => {
        setFloats((prev) => prev.filter((f) => !fresh.some((n) => n.key === f.key)));
      }, 4000);
    });
  }, [presentationId]);

  const totals = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {/* Uçuşan tepkiler — sağ alt köşeden */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {floats.map((f) => (
          <span
            key={f.key}
            className="absolute text-4xl animate-float-up"
            style={{
              right: `${f.right}%`,
              bottom: "6rem",
              animationDuration: `${f.duration}s`,
              ["--drift" as string]: `${f.drift}px`,
            }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Sol alt köşede canlı sayaç (sağ alttaki katıl pili/QR ile çakışmasın) */}
      {totals.length > 0 && (
        <div
          className="fixed bottom-20 left-4 z-40 flex flex-row flex-wrap items-center gap-1.5 max-w-[60vw]"
          aria-label="Tepki sayıları"
        >
          {totals.map(([emoji, count]) => (
            <span
              key={emoji}
              className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur border border-line rounded-full pl-2 pr-3 py-1 text-sm font-bold tabular-nums shadow-sm"
            >
              <span className="text-lg" aria-hidden>{emoji}</span> {count}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
