"use client";

/**
 * FlowWall perde ambient efekt katmanı — temadan bağımsız, kokpitten seçilir.
 * Tek dispatcher: hem perdede (fixed, z-[15]) hem kokpit önizlemesinde
 * (contained → absolute) aynı bileşenler kullanılır. Hepsi CSS, dış servis yok.
 */
import { useEffect, useState } from "react";
import Snowflakes from "@/components/Snowflakes";
import Hearts from "@/components/Hearts";
import Confetti from "@/components/Confetti";
import { WallEffect } from "@/lib/types";

const COLORS = ["#e11d48", "#4f46e5", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#22d3ee", "#f43f5e"];
const wrap = (contained?: boolean) =>
  `ww-fx pointer-events-none overflow-hidden ${contained ? "absolute inset-0 z-0" : "fixed inset-0 z-[15]"}`;

export default function WallEffectLayer({ effect, contained }: { effect: WallEffect; contained?: boolean }) {
  switch (effect) {
    case "snow": return <Snowflakes contained={contained} />;
    case "hearts": return <Hearts contained={contained} />;
    case "confetti": return <Confetti contained={contained} />;
    case "fireworks": return <Fireworks contained={contained} />;
    case "balloons": return <Balloons contained={contained} />;
    case "bubbles": return <Bubbles contained={contained} />;
    case "stars": return <Stars contained={contained} />;
    default: return null;
  }
}

// ── Havai fişek ───────────────────────────────────────────────────────────────
interface Burst { id: number; x: number; y: number; color: string; parts: { a: number; d: number }[] }

function Fireworks({ contained }: { contained?: boolean }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    let id = 0;
    const spawn = () => {
      const n = 16 + Math.floor(Math.random() * 8);
      const b: Burst = {
        id: id++,
        x: 12 + Math.random() * 76,
        y: 14 + Math.random() * 44,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        parts: Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2, d: 60 + Math.random() * 55 })),
      };
      setBursts((prev) => [...prev.slice(-4), b]);
      window.setTimeout(() => setBursts((prev) => prev.filter((x) => x.id !== b.id)), 1500);
    };
    spawn();
    const iv = window.setInterval(spawn, 1500);
    return () => window.clearInterval(iv);
  }, []);

  return (
    <div aria-hidden className={wrap(contained)}>
      {bursts.map((b) => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {b.parts.map((p, i) => (
            <span
              key={i}
              className="ww-fw absolute rounded-full"
              style={{
                width: 7, height: 7, background: b.color, boxShadow: `0 0 8px ${b.color}`,
                ["--dx" as string]: `${Math.cos(p.a) * p.d}px`,
                ["--dy" as string]: `${Math.sin(p.a) * p.d}px`,
              }}
            />
          ))}
        </div>
      ))}
      <style jsx global>{`
        .ww-fw { animation: wwfw 1.4s ease-out forwards; }
        @keyframes wwfw { 0% { transform: translate(0,0) scale(1.1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .ww-fw { animation: none !important; opacity: 0; } }
      `}</style>
    </div>
  );
}

// ── Balon ─────────────────────────────────────────────────────────────────────
function Balloons({ contained }: { contained?: boolean }) {
  const [items, setItems] = useState<{ id: number; x: number; delay: number; duration: number; size: number; color: string }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 12; i++) a.push({ id: i, x: 4 + Math.random() * 90, delay: Math.random() * 10, duration: 11 + Math.random() * 9, size: 30 + Math.random() * 24, color: COLORS[i % COLORS.length] });
    setItems(a);
  }, []);
  return (
    <div aria-hidden className={wrap(contained)}>
      {items.map((b) => (
        <div key={b.id} className="absolute bottom-[-20cqh] ww-balloon" style={{ left: `${b.x}cqw`, animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }}>
          <div style={{ width: b.size, height: b.size * 1.25, background: b.color, opacity: 0.55, borderRadius: "50% 50% 50% 50% / 45% 45% 55% 55%", boxShadow: "inset -4px -6px 10px rgba(0,0,0,0.15)" }} />
          <div style={{ width: 1, height: b.size * 0.7, background: "rgba(255,255,255,0.3)", margin: "0 auto" }} />
        </div>
      ))}
      <style jsx global>{`
        .ww-balloon { animation-name: wwballoon; animation-timing-function: ease-in; animation-iteration-count: infinite; }
        @keyframes wwballoon { 0% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-65cqh) translateX(3cqw); } 100% { transform: translateY(-135cqh) translateX(-3cqw); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .ww-balloon { animation: none !important; } }
      `}</style>
    </div>
  );
}

// ── Kabarcık ──────────────────────────────────────────────────────────────────
function Bubbles({ contained }: { contained?: boolean }) {
  const [items, setItems] = useState<{ id: number; x: number; delay: number; duration: number; size: number }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 26; i++) a.push({ id: i, x: Math.random() * 100, delay: Math.random() * 9, duration: 9 + Math.random() * 8, size: 10 + Math.random() * 40 });
    setItems(a);
  }, []);
  return (
    <div aria-hidden className={wrap(contained)}>
      {items.map((b) => (
        <div
          key={b.id}
          className="absolute bottom-[-12cqh] rounded-full ww-bubble"
          style={{
            left: `${b.x}cqw`, width: b.size, height: b.size,
            background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.02))",
            border: "1px solid rgba(255,255,255,0.28)",
            animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s`,
          }}
        />
      ))}
      <style jsx global>{`
        .ww-bubble { animation-name: wwbubble; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes wwbubble { 0% { transform: translateY(0) translateX(0); opacity: 0; } 12% { opacity: 0.9; } 50% { transform: translateY(-58cqh) translateX(4cqw); } 100% { transform: translateY(-118cqh) translateX(-4cqw); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .ww-bubble { animation: none !important; opacity: 0; } }
      `}</style>
    </div>
  );
}

// ── Yıldız (parıltı) ──────────────────────────────────────────────────────────
function Stars({ contained }: { contained?: boolean }) {
  const [items, setItems] = useState<{ id: number; x: number; y: number; delay: number; duration: number; size: number }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 40; i++) a.push({ id: i, x: Math.random() * 100, y: Math.random() * 100, delay: Math.random() * 4, duration: 2.2 + Math.random() * 2.6, size: 3 + Math.random() * 6 });
    setItems(a);
  }, []);
  return (
    <div aria-hidden className={wrap(contained)}>
      {items.map((s) => (
        <div
          key={s.id}
          className="absolute ww-star"
          style={{
            left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size,
            background: "#fff", borderRadius: "50%",
            boxShadow: `0 0 ${s.size * 1.6}px ${s.size * 0.5}px rgba(255,255,255,0.7)`,
            animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      <style jsx global>{`
        .ww-star { animation-name: wwstar; animation-timing-function: ease-in-out; animation-iteration-count: infinite; opacity: 0; }
        @keyframes wwstar { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 0.95; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ww-star { animation: none !important; opacity: 0.5; } }
      `}</style>
    </div>
  );
}
