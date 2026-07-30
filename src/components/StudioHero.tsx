"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Hub açılış bannerı — Flow Studio "sahne"si + marka tanıtım turu.
 * Sahne makinesi: intro (soru + hayalet marka şeridi) → ürün sahneleri
 * (marka soldan büyüyerek girer, sağda ürünün kendi canlı animasyonu) →
 * başa döner. Ambiyans (aurora bulutları) tüm sahnelerde sabit kalır.
 * prefers-reduced-motion: tur durur, durağan intro gösterilir.
 */

const TICKER = [
  { o: "/logo-o-meter-white.png", name: "METER" },
  { o: "/logo-o-wall-white.png", name: "WALL" },
  { o: "/logo-o-sign-white.png", name: "SIGN" },
  { o: "/logo-o-pulse-white.png", name: "PULSE" },
];

const WORDS = ["Bugün", "ne", "oluşturmak", "istersin?"];

// Sahne sırası + süreleri (ms). Ürün sahneleri buraya eklenerek çoğalır.
const SCENES = ["intro", "meter"] as const;
type Scene = (typeof SCENES)[number];
const DURATION: Record<Scene, number> = { intro: 5000, meter: 9000 };

/* ── Sahne 1: soru + imza çizgisi + hayalet marka şeridi ─────────────────── */
function IntroScene() {
  const strip = [...TICKER, ...TICKER, ...TICKER];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display font-semibold tracking-tight text-3xl sm:text-5xl leading-tight">
        {WORDS.map((w, i) => (
          <span
            key={i}
            className="inline-block overflow-hidden align-bottom mr-[0.28em] last:mr-0 pb-[0.12em] -mb-[0.12em]"
          >
            <span className="fs-word inline-block" style={{ animationDelay: `${0.15 + i * 0.13}s` }}>
              {w}
            </span>
          </span>
        ))}
      </h1>
      <div className="fs-bar mt-6" aria-hidden>
        <span className="fs-shine" />
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-4 overflow-hidden">
        <div className="fs-ticker flex items-center gap-12 w-max pl-4">
          {strip.map((t, i) => (
            <span key={i} className="flex items-center gap-3 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.o} alt="" className="h-6 w-auto opacity-60" />
              <span className="fs-ghost text-2xl font-bold tracking-[0.25em]">{t.name}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Sahne 2: FlowMeter — solda marka, sağda canlı oylama şovu ───────────── */
const METER_BARS = [
  { label: "Çay", color: "#f0913a", a: "38%", b: "76%", delay: "0s" },
  { label: "Kahve", color: "#2094f3", a: "66%", b: "44%", delay: ".5s" },
  { label: "Ayran", color: "#1b7d3a", a: "28%", b: "58%", delay: "1s" },
];

function MeterScene() {
  return (
    <div className="absolute inset-0 flex items-center justify-between gap-4 sm:gap-8 px-5 sm:px-10">
      {/* Marka: soldan büyüyerek girer */}
      <div className="fs-in-left flex items-center shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-o-meter-white.png" alt="" className="h-10 sm:h-16 w-auto" />
        <span className="ml-2 font-display font-semibold text-3xl sm:text-5xl tracking-tight">
          METER
        </span>
      </div>

      {/* Canlı oylama kartı + uçuşan tepkiler */}
      <div className="fs-in-right relative w-[54%] max-w-[400px] shrink">
        <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-xs sm:text-sm text-white/80 font-semibold truncate">
              Mola içeceği hangisi?
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-white/70 shrink-0">
              <span className="fs-live-dot" />
              CANLI
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {METER_BARS.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs text-white/70 font-semibold w-10 sm:w-12 shrink-0 text-left">
                  {b.label}
                </span>
                <div className="flex-1 h-3 sm:h-3.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="fs-poll-bar h-full rounded-full"
                    style={
                      {
                        background: b.color,
                        animationDelay: b.delay,
                        "--wa": b.a,
                        "--wb": b.b,
                      } as CSSProperties
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Uçuşan emoji tepkileri (present ekranındaki gibi) */}
        <span className="fs-float absolute -right-1 bottom-1 text-lg" style={{ animationDelay: "0s" }}>❤️</span>
        <span className="fs-float absolute right-6 bottom-0 text-base" style={{ animationDelay: "1.2s" }}>🎉</span>
        <span className="fs-float absolute -right-4 bottom-3 text-base" style={{ animationDelay: "2.3s" }}>👍</span>
      </div>
    </div>
  );
}

/* ── Sahne makinesi ──────────────────────────────────────────────────────── */
export default function StudioHero() {
  const [idx, setIdx] = useState(0);
  const scene = SCENES[idx];

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setIdx((i) => (i + 1) % SCENES.length), DURATION[scene]);
    return () => window.clearTimeout(t);
  }, [idx, scene]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl mb-8 text-white shadow-sm h-60 sm:h-72"
      style={{ background: "linear-gradient(150deg,#001e64 0%,#0b1030 55%,#131847 100%)" }}
    >
      {/* Ambiyans: tüm sahnelerde sabit süzülen ışık bulutları */}
      <div aria-hidden className="fs-blob fs-blob-a" />
      <div aria-hidden className="fs-blob fs-blob-b" />
      <div aria-hidden className="fs-blob fs-blob-c" />

      {/* Aktif sahne (remount → giriş animasyonları her turda oynar) */}
      <div key={scene} className="fs-scene absolute inset-0 z-10">
        {scene === "intro" ? <IntroScene /> : <MeterScene />}
      </div>

      <style>{`
        .fs-scene { animation: fs-scene-in 0.6s ease-out; }
        @keyframes fs-scene-in { from { opacity: 0; } }

        .fs-word {
          transform: translateY(130%);
          animation: fs-word 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fs-word { to { transform: translateY(0); } }

        .fs-bar {
          position: relative;
          overflow: hidden;
          width: 190px;
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, #2094f3, #1b7d3a, #f0913a, #d62027);
          transform: scaleX(0);
          transform-origin: center;
          animation: fs-bar 0.9s 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fs-bar { to { transform: scaleX(1); } }

        .fs-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent);
          transform: translateX(-100%);
          animation: fs-shine 3.6s 2s ease-in-out infinite;
        }
        @keyframes fs-shine {
          0% { transform: translateX(-100%); }
          40%, 100% { transform: translateX(100%); }
        }

        .fs-ticker { animation: fs-ticker 36s linear infinite; }
        @keyframes fs-ticker { to { transform: translateX(-33.3333%); } }

        .fs-ghost {
          color: transparent;
          -webkit-text-stroke: 1px rgba(255, 255, 255, 0.3);
        }

        .fs-in-left {
          animation: fs-in-left 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes fs-in-left {
          from { opacity: 0; transform: translateX(-36px) scale(0.72); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        .fs-in-right {
          animation: fs-in-right 0.8s 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes fs-in-right {
          from { opacity: 0; transform: translateX(36px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .fs-poll-bar {
          width: var(--wa);
          animation: fs-poll 2.6s ease-in-out infinite alternate;
        }
        @keyframes fs-poll { from { width: var(--wa); } to { width: var(--wb); } }

        .fs-live-dot {
          width: 7px; height: 7px; border-radius: 999px; background: #f87171;
          animation: fs-live 1.6s ease-in-out infinite;
        }
        @keyframes fs-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

        .fs-float {
          opacity: 0;
          animation: fs-float 3.6s ease-out infinite;
        }
        @keyframes fs-float {
          0% { opacity: 0; transform: translateY(8px) scale(0.8); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-84px) scale(1.05); }
        }

        .fs-blob {
          position: absolute;
          width: 360px;
          height: 360px;
          border-radius: 9999px;
          filter: blur(80px);
        }
        .fs-blob-a { background: #2094f3; opacity: 0.33; top: -140px; left: -90px;
          animation: fs-float-a 16s ease-in-out infinite alternate; }
        .fs-blob-b { background: #d62027; opacity: 0.22; bottom: -170px; right: -80px;
          animation: fs-float-b 20s ease-in-out infinite alternate; }
        .fs-blob-c { background: #f0913a; opacity: 0.16; top: -100px; right: 20%;
          animation: fs-float-c 24s ease-in-out infinite alternate; }
        @keyframes fs-float-a { to { transform: translate(70px, 50px) scale(1.15); } }
        @keyframes fs-float-b { to { transform: translate(-80px, -40px) scale(1.1); } }
        @keyframes fs-float-c { to { transform: translate(-60px, 60px) scale(1.2); } }

        @media (prefers-reduced-motion: reduce) {
          .fs-scene, .fs-word, .fs-bar, .fs-in-left, .fs-in-right,
          .fs-poll-bar, .fs-live-dot, .fs-float, .fs-ticker, .fs-blob { animation: none; }
          .fs-word { transform: none; }
          .fs-bar { transform: none; }
          .fs-shine { display: none; }
          .fs-float { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
