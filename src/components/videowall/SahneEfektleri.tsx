"use client";

/**
 * FOTO SAHNE ambient efektleri — Wall perde efekt katmanının Sign KOPYASI
 * (ayrı paket kuralı: Wall koduna import YOK; sınıf öneki `sfx-`).
 * Hepsi CSS, dış servis yok; alanın İÇİNDE yaşar (contained — cq birimleri
 * alanın kendi ölçüsüne göre çalışır, viewport'a göre değil).
 */
import { memo, useEffect, useState } from "react";
import { SahneEfektAd } from "@/lib/fotoSahne";

const RENKLER = ["#e11d48", "#4f46e5", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#22d3ee"];
const sarici = "pointer-events-none overflow-hidden absolute inset-0 z-20";
const sariciStil: React.CSSProperties = { containerType: "size" };

/** memo: sahnenin 6.5 sn'lik kare tikleri efekt ağacını yeniden çizmesin —
 *  parçacıklar kendi CSS animasyonlarında kesintisiz akar. */
export default memo(SahneEfektleri);

function SahneEfektleri({ efekt }: { efekt?: SahneEfektAd }) {
  switch (efekt) {
    case "snow": return <Kar />;
    case "hearts": return <Kalpler />;
    case "confetti": return <Konfeti />;
    case "fireworks": return <HavaiFisek />;
    case "balloons": return <Balonlar />;
    case "bubbles": return <Kabarciklar />;
    case "stars": return <Yildizlar />;
    default: return null;
  }
}

function Kar() {
  const [taneler, setTaneler] = useState<{ id: number; x: number; delay: number; duration: number; size: number; opacity: number }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 40; i++)
      a.push({ id: i, x: Math.random() * 100, delay: Math.random() * 10, duration: 10 + Math.random() * 15, size: 0.2 + Math.random() * 0.8, opacity: 0.2 + Math.random() * 0.6 });
    setTaneler(a);
  }, []);
  return (
    <div aria-hidden className={sarici} style={sariciStil}>
      {taneler.map((f) => (
        <div key={f.id} className="absolute top-[-5cqh] rounded-full bg-white" style={{ left: `${f.x}cqw`, width: `${f.size}rem`, height: `${f.size}rem`, opacity: f.opacity, animation: `sfxkar ${f.duration}s linear ${f.delay}s infinite`, filter: "blur(1px)" }} />
      ))}
      <style>{`
        @keyframes sfxkar { 0% { transform: translateY(0) translateX(0) rotate(0deg); } 50% { transform: translateY(55cqh) translateX(10cqw) rotate(180deg); } 100% { transform: translateY(110cqh) translateX(-10cqw) rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Kalpler() {
  const [items, setItems] = useState<{ id: number; x: number; delay: number; duration: number; size: number; opacity: number }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 26; i++)
      a.push({ id: i, x: Math.random() * 100, delay: Math.random() * 8, duration: 9 + Math.random() * 9, size: 0.7 + Math.random() * 1.5, opacity: 0.22 + Math.random() * 0.5 });
    setItems(a);
  }, []);
  return (
    <div aria-hidden className={sarici} style={sariciStil}>
      {items.map((f) => (
        <div key={f.id} className="absolute bottom-[-8cqh] sfx-kalp" style={{ willChange: "transform", left: `${f.x}cqw`, fontSize: `${f.size}rem`, opacity: f.opacity, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, filter: "drop-shadow(0 0 6px rgba(244,63,94,0.4))" }}>
          💗
        </div>
      ))}
      <style>{`
        .sfx-kalp { animation-name: sfxkalp; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes sfxkalp { 0% { transform: translateY(0) translateX(0) scale(1); } 50% { transform: translateY(-55cqh) translateX(5cqw) scale(1.12); } 100% { transform: translateY(-115cqh) translateX(-5cqw) scale(0.9); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .sfx-kalp { animation: none !important; } }
      `}</style>
    </div>
  );
}

function Konfeti() {
  const [conf, setConf] = useState<{ id: number; x: number; delay: number; duration: number; size: number; color: string; rot: number }[]>([]);
  useEffect(() => {
    const c = [];
    for (let i = 0; i < 44; i++)
      c.push({ id: i, x: Math.random() * 100, delay: Math.random() * 6, duration: 6 + Math.random() * 7, size: 6 + Math.random() * 8, color: RENKLER[i % RENKLER.length], rot: 180 + Math.random() * 540 });
    setConf(c);
  }, []);
  return (
    <div aria-hidden className={sarici} style={sariciStil}>
      {conf.map((p) => (
        <div key={p.id} className="absolute top-[-6cqh] sfx-konfeti" style={{ willChange: "transform", left: `${p.x}cqw`, width: `${p.size}px`, height: `${p.size * 0.5}px`, background: p.color, opacity: 0.72, borderRadius: "1px", animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`, ["--rot" as string]: `${p.rot}deg` }} />
      ))}
      <style>{`
        .sfx-konfeti { animation-name: sfxkonfeti; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes sfxkonfeti { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(112cqh) rotate(var(--rot, 360deg)); } }
        @media (prefers-reduced-motion: reduce) { .sfx-konfeti { animation: none !important; } }
      `}</style>
    </div>
  );
}

interface Patlama { id: number; x: number; y: number; color: string; parts: { a: number; d: number }[] }

function HavaiFisek() {
  const [bursts, setBursts] = useState<Patlama[]>([]);
  useEffect(() => {
    let id = 0;
    const spawn = () => {
      const n = 16 + Math.floor(Math.random() * 8);
      const b: Patlama = {
        id: id++,
        x: 12 + Math.random() * 76,
        y: 14 + Math.random() * 44,
        color: RENKLER[Math.floor(Math.random() * RENKLER.length)],
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
    <div aria-hidden className={sarici} style={sariciStil}>
      {bursts.map((b) => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {b.parts.map((p, i) => (
            <span key={i} className="sfx-fisek absolute rounded-full" style={{ width: 7, height: 7, background: b.color, boxShadow: `0 0 8px ${b.color}`, ["--dx" as string]: `${Math.cos(p.a) * p.d}px`, ["--dy" as string]: `${Math.sin(p.a) * p.d}px` }} />
          ))}
        </div>
      ))}
      <style>{`
        .sfx-fisek { animation: sfxfisek 1.4s ease-out forwards; }
        @keyframes sfxfisek { 0% { transform: translate(0,0) scale(1.1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .sfx-fisek { animation: none !important; opacity: 0; } }
      `}</style>
    </div>
  );
}

function Balonlar() {
  const [items, setItems] = useState<{ id: number; x: number; delay: number; duration: number; size: number; color: string }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 12; i++) a.push({ id: i, x: 4 + Math.random() * 90, delay: Math.random() * 10, duration: 11 + Math.random() * 9, size: 30 + Math.random() * 24, color: RENKLER[i % RENKLER.length] });
    setItems(a);
  }, []);
  return (
    <div aria-hidden className={sarici} style={sariciStil}>
      {items.map((b) => (
        <div key={b.id} className="absolute bottom-[-20cqh] sfx-balon" style={{ willChange: "transform", left: `${b.x}cqw`, animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }}>
          <div style={{ width: b.size, height: b.size * 1.25, background: b.color, opacity: 0.55, borderRadius: "50% 50% 50% 50% / 45% 45% 55% 55%", boxShadow: "inset -4px -6px 10px rgba(0,0,0,0.15)" }} />
          <div style={{ width: 1, height: b.size * 0.7, background: "rgba(255,255,255,0.3)", margin: "0 auto" }} />
        </div>
      ))}
      <style>{`
        .sfx-balon { animation-name: sfxbalon; animation-timing-function: ease-in; animation-iteration-count: infinite; }
        @keyframes sfxbalon { 0% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-65cqh) translateX(3cqw); } 100% { transform: translateY(-135cqh) translateX(-3cqw); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .sfx-balon { animation: none !important; } }
      `}</style>
    </div>
  );
}

function Kabarciklar() {
  const [items, setItems] = useState<{ id: number; x: number; delay: number; duration: number; size: number }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 26; i++) a.push({ id: i, x: Math.random() * 100, delay: Math.random() * 9, duration: 9 + Math.random() * 8, size: 10 + Math.random() * 40 });
    setItems(a);
  }, []);
  return (
    <div aria-hidden className={sarici} style={sariciStil}>
      {items.map((b) => (
        <div key={b.id} className="absolute bottom-[-12cqh] rounded-full sfx-kabarcik" style={{ willChange: "transform", left: `${b.x}cqw`, width: b.size, height: b.size, background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.28)", animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }} />
      ))}
      <style>{`
        .sfx-kabarcik { animation-name: sfxkabarcik; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes sfxkabarcik { 0% { transform: translateY(0) translateX(0); opacity: 0; } 12% { opacity: 0.9; } 50% { transform: translateY(-58cqh) translateX(4cqw); } 100% { transform: translateY(-118cqh) translateX(-4cqw); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .sfx-kabarcik { animation: none !important; opacity: 0; } }
      `}</style>
    </div>
  );
}

function Yildizlar() {
  const [items, setItems] = useState<{ id: number; x: number; y: number; delay: number; duration: number; size: number }[]>([]);
  useEffect(() => {
    const a = [];
    for (let i = 0; i < 40; i++) a.push({ id: i, x: Math.random() * 100, y: Math.random() * 100, delay: Math.random() * 4, duration: 2.2 + Math.random() * 2.6, size: 3 + Math.random() * 6 });
    setItems(a);
  }, []);
  return (
    <div aria-hidden className={sarici} style={sariciStil}>
      {items.map((s) => (
        <div key={s.id} className="absolute sfx-yildiz" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, background: "#fff", borderRadius: "50%", boxShadow: `0 0 ${s.size * 1.6}px ${s.size * 0.5}px rgba(255,255,255,0.7)`, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }} />
      ))}
      <style>{`
        .sfx-yildiz { animation-name: sfxyildiz; animation-timing-function: ease-in-out; animation-iteration-count: infinite; opacity: 0; }
        @keyframes sfxyildiz { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 0.95; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .sfx-yildiz { animation: none !important; opacity: 0.5; } }
      `}</style>
    </div>
  );
}
