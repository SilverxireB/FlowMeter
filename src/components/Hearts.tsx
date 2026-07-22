"use client";

/** Düğün teması — süzülen kalpler (CSS, dış servis yok; Snowflakes'in eşi). */
import { useEffect, useState } from "react";

interface Heart {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

export default function Hearts({ contained }: { contained?: boolean }) {
  const [items, setItems] = useState<Heart[]>([]);

  useEffect(() => {
    const arr: Heart[] = [];
    for (let i = 0; i < 26; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 9 + Math.random() * 9,
        size: 0.7 + Math.random() * 1.5,
        opacity: 0.22 + Math.random() * 0.5,
      });
    }
    setItems(arr);
  }, []);

  return (
    <div aria-hidden className={`ww-fx pointer-events-none overflow-hidden ${contained ? "absolute inset-0 z-0" : "fixed inset-0 z-[15]"}`}>
      {items.map((f) => (
        <div
          key={f.id}
          className="absolute bottom-[-8cqh] ww-heart-rise"
          style={{
            left: `${f.x}cqw`,
            fontSize: `${f.size}rem`,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            filter: "drop-shadow(0 0 6px rgba(244,63,94,0.4))",
          }}
        >
          💗
        </div>
      ))}
      <style jsx global>{`
        .ww-heart-rise { animation-name: wwheartrise; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes wwheartrise {
          0% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(-55cqh) translateX(5cqw) scale(1.12); }
          100% { transform: translateY(-115cqh) translateX(-5cqw) scale(0.9); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .ww-heart-rise { animation: none !important; } }
      `}</style>
    </div>
  );
}
