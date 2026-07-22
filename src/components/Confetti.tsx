"use client";

/** Parti teması — düşen konfeti + süzülen balonlar (CSS, dış servis yok). */
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
interface Balloon {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
}

export default function Confetti() {
  const [conf, setConf] = useState<Conf[]>([]);
  const [balloons, setBalloons] = useState<Balloon[]>([]);

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
    const b: Balloon[] = [];
    for (let i = 0; i < 7; i++) {
      b.push({
        id: i,
        x: 4 + Math.random() * 90,
        delay: Math.random() * 10,
        duration: 12 + Math.random() * 10,
        size: 26 + Math.random() * 18,
        color: COLORS[i % COLORS.length],
      });
    }
    setBalloons(b);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {conf.map((p) => (
        <div
          key={"c" + p.id}
          className="absolute top-[-6vh] ww-confetti-fall"
          style={{
            left: `${p.x}vw`,
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
      {balloons.map((b) => (
        <div
          key={"b" + b.id}
          className="absolute bottom-[-18vh] ww-balloon-rise"
          style={{
            left: `${b.x}vw`,
            width: `${b.size}px`,
            height: `${b.size * 1.25}px`,
            background: b.color,
            opacity: 0.45,
            borderRadius: "50%",
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
      <style jsx global>{`
        .ww-confetti-fall { animation-name: wwconffall; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes wwconffall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(112vh) rotate(var(--rot, 360deg)); } }
        .ww-balloon-rise { animation-name: wwballoonrise; animation-timing-function: ease-in; animation-iteration-count: infinite; }
        @keyframes wwballoonrise { 0% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-62vh) translateX(4vw); } 100% { transform: translateY(-132vh) translateX(-3vw); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .ww-confetti-fall, .ww-balloon-rise { animation: none !important; } }
      `}</style>
    </div>
  );
}
