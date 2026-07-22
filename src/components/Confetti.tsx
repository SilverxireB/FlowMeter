"use client";

/** Konfeti efekti — düşen renkli kağıtlar (CSS, dış servis yok). */
import { useEffect, useState } from "react";

const COLORS = ["#e11d48", "#4f46e5", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#22d3ee"];

interface Conf {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rot: number;
}

export default function Confetti({ contained }: { contained?: boolean }) {
  const [conf, setConf] = useState<Conf[]>([]);

  useEffect(() => {
    const c: Conf[] = [];
    for (let i = 0; i < 44; i++) {
      c.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 7,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        rot: 180 + Math.random() * 540,
      });
    }
    setConf(c);
  }, []);

  return (
    <div aria-hidden className={`ww-fx pointer-events-none overflow-hidden ${contained ? "absolute inset-0 z-0" : "fixed inset-0 z-[15]"}`}>
      {conf.map((p) => (
        <div
          key={p.id}
          className="absolute top-[-6cqh] ww-confetti-fall"
          style={{
            left: `${p.x}cqw`,
            width: `${p.size}px`,
            height: `${p.size * 0.5}px`,
            background: p.color,
            opacity: 0.72,
            borderRadius: "1px",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--rot" as string]: `${p.rot}deg`,
          }}
        />
      ))}
      <style jsx global>{`
        .ww-confetti-fall { animation-name: wwconffall; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes wwconffall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(112cqh) rotate(var(--rot, 360deg)); } }
        @media (prefers-reduced-motion: reduce) { .ww-confetti-fall { animation: none !important; } }
      `}</style>
    </div>
  );
}
