"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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

// Sahne sırası + süreleri (ms). Ürün sahneleri 10sn (4 pencere × 2.5sn).
const SCENES = ["intro", "meter", "wall", "sign", "pulse"] as const;
type Scene = (typeof SCENES)[number];
const DURATION: Record<Scene, number> = {
  intro: 5000,
  meter: 10000,
  wall: 10000,
  sign: 10000,
  pulse: 10000,
};

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
              <img src={t.o} alt="" className="h-6 w-auto opacity-90" />
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

/** Sağdaki mini reklam turu: her pencere 2.5sn — sahne süresi (10sn) ile senkron. */
function Vignette({ i, children }: { i: number; children: ReactNode }) {
  return (
    <div className="fs-vig absolute inset-0" style={{ animationDelay: `${i * 2.5}s` }}>
      <div className="h-full rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col">
        {children}
      </div>
    </div>
  );
}

function VigHead({ label, live }: { label: string; live?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-2 gap-2 shrink-0">
      <span className="text-[11px] sm:text-xs text-white/80 font-semibold truncate">{label}</span>
      {live && (
        <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-white/70 shrink-0">
          <span className="fs-live-dot" />
          CANLI
        </span>
      )}
    </div>
  );
}

/** Ürün sahnesi çerçevesi: solda dikey marka bloğu, sağda 4 pencereli reklam. */
function SceneFrame({
  img,
  name,
  floats,
  children,
}: {
  img: string;
  name: string;
  floats?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-between gap-4 sm:gap-8 px-5 sm:px-10">
      {/* Marka: logo üstte ortalı, altında ad — soldan büyüyerek girer.
          ml: sol kenara yapışmasın, ortaya doğru dursun */}
      <div className="fs-in-left flex flex-col items-center shrink-0 ml-2 sm:ml-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" className="h-16 sm:h-24 w-auto" />
        <span className="mt-2 font-display font-semibold text-3xl sm:text-5xl tracking-tight">
          {name}
        </span>
      </div>
      <div className="fs-in-right relative w-[56%] max-w-[400px] h-36 sm:h-40 shrink">
        {children}
        {floats}
      </div>
    </div>
  );
}

function MeterScene() {
  return (
    <SceneFrame
      img="/logo-o-meter-white.png"
      name="METER"
      floats={
        <>
          <span className="fs-float absolute -right-1 bottom-1 text-lg" style={{ animationDelay: "0s" }}>❤️</span>
          <span className="fs-float absolute right-6 bottom-0 text-base" style={{ animationDelay: "1.2s" }}>🎉</span>
          <span className="fs-float absolute -right-4 bottom-3 text-base" style={{ animationDelay: "2.3s" }}>👍</span>
        </>
      }
    >
        {/* 1 — Katılım */}
        <Vignette i={0}>
          <VigHead label="Saniyeler içinde katılım" />
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <span className="font-display font-bold text-2xl sm:text-3xl tracking-[0.3em]">
              482 193
            </span>
            <div className="flex items-center gap-1.5">
              {["🦊", "🐼", "🦁", "🐨", "🐸"].map((a, i) => (
                <span
                  key={i}
                  className="fs-pop w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/15 grid place-items-center text-sm"
                  style={{ animationDelay: `${0.3 + i * 0.18}s` }}
                >
                  {a}
                </span>
              ))}
              <span className="text-[10px] text-white/60 font-semibold ml-1">+38</span>
            </div>
          </div>
        </Vignette>

        {/* 2 — Canlı oylama */}
        <Vignette i={1}>
          <VigHead label="Mola içeceği hangisi?" live />
          <div className="flex-1 flex flex-col justify-center gap-2">
            {METER_BARS.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs text-white/70 font-semibold w-10 sm:w-12 shrink-0 text-left">
                  {b.label}
                </span>
                <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="fs-poll-bar h-full rounded-full"
                    style={
                      { background: b.color, animationDelay: b.delay, "--wa": b.a, "--wb": b.b } as CSSProperties
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Vignette>

        {/* 3 — Quiz skor tablosu (podyum) */}
        <Vignette i={2}>
          <VigHead label="Quiz — skor tablosu 🏆" />
          <div className="flex-1 flex items-end justify-center gap-2 sm:gap-3 pb-1">
            {[
              { m: "🥈", h: "58%", n: "Ece" },
              { m: "🥇", h: "88%", n: "Mert" },
              { m: "🥉", h: "42%", n: "Can" },
            ].map((p, i) => (
              <div key={p.n} className="flex flex-col items-center justify-end w-12 sm:w-14 h-full">
                <span className="text-sm mb-0.5">{p.m}</span>
                <div
                  className="fs-podium w-full rounded-t-lg bg-gradient-to-b from-white/30 to-white/10"
                  style={{ height: p.h, animationDelay: `${5.2 + i * 0.15}s` }}
                />
                <span className="text-[9px] text-white/60 font-semibold mt-0.5">{p.n}</span>
              </div>
            ))}
          </div>
        </Vignette>

        {/* 4 — Soru-Cevap */}
        <Vignette i={3}>
          <VigHead label="Soru-Cevap" />
          <div className="flex-1 flex flex-col justify-center gap-1.5">
            <div className="fs-pop flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5" style={{ animationDelay: "7.7s" }}>
              <span className="text-[10px] sm:text-xs text-white/85 truncate flex-1 text-left">Bir sonraki etkinlik nerede?</span>
              <span className="text-[9px] font-bold text-white/70 shrink-0">▲ 14</span>
            </div>
            <div className="fs-pop flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5" style={{ animationDelay: "7.95s" }}>
              <span className="text-[10px] sm:text-xs text-white/85 truncate flex-1 text-left">Kulis turu olacak mı?</span>
              <span className="text-[9px] font-bold text-white/70 shrink-0">▲ 9</span>
              <span className="text-[10px] text-emerald-300 shrink-0">✓</span>
            </div>
          </div>
        </Vignette>
    </SceneFrame>
  );
}

/* ── Sahne 3: FlowWall — anı duvarı ──────────────────────────────────────── */
const WALL_TILES = [
  "linear-gradient(135deg,#f0913a,#d62027)",
  "linear-gradient(135deg,#2094f3,#131847)",
  "linear-gradient(135deg,#1b7d3a,#2094f3)",
  "linear-gradient(135deg,#d62027,#f0913a)",
  "linear-gradient(135deg,#131847,#1b7d3a)",
  "linear-gradient(135deg,#2094f3,#f0913a)",
];

function WallScene() {
  return (
    <SceneFrame
      img="/logo-o-wall-white.png"
      name="WALL"
      floats={
        <>
          <span className="fs-float absolute -right-1 bottom-1 text-lg" style={{ animationDelay: ".4s" }}>❤️</span>
          <span className="fs-float absolute right-8 bottom-0 text-base" style={{ animationDelay: "1.6s" }}>✨</span>
          <span className="fs-float absolute -right-4 bottom-3 text-base" style={{ animationDelay: "2.7s" }}>📸</span>
        </>
      }
    >
      {/* 1 — Anılar duvara akar */}
      <Vignette i={0}>
        <VigHead label="Anılar duvara akar" live />
        <div className="flex-1 grid grid-cols-3 gap-1.5 content-center">
          {WALL_TILES.map((g, i) => (
            <div
              key={i}
              className="fs-pop h-9 sm:h-11 rounded-lg grid place-items-center text-xs"
              style={{ background: g, animationDelay: `${0.25 + i * 0.14}s` }}
            >
              {i === 4 ? "📷" : ""}
            </div>
          ))}
        </div>
      </Vignette>

      {/* 2 — Beğeni + en sevilen */}
      <Vignette i={1}>
        <VigHead label="Beğen — en sevilen taçlanır" />
        <div className="flex-1 flex items-center justify-center gap-3">
          <div
            className="fs-pop relative w-24 h-16 sm:w-28 sm:h-20 rounded-xl"
            style={{ background: WALL_TILES[0], animationDelay: "2.8s" }}
          >
            <span className="absolute -top-2.5 -right-1.5 text-lg">👑</span>
            <span className="fs-heart absolute -bottom-2 left-2 rounded-full bg-white/90 text-[#d62027] text-[10px] font-bold px-2 py-0.5">
              ❤ 42
            </span>
          </div>
          <div className="fs-pop w-16 h-12 sm:w-20 sm:h-14 rounded-xl opacity-70" style={{ background: WALL_TILES[2], animationDelay: "3.1s" }} />
        </div>
      </Vignette>

      {/* 3 — Dilekler perdede */}
      <Vignette i={2}>
        <VigHead label="Dilekler perdede 💌" />
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
          <div className="fs-pop rounded-xl bg-white/10 px-4 py-2 max-w-full" style={{ animationDelay: "5.3s" }}>
            <span className="text-[11px] sm:text-xs text-white/85 italic">&ldquo;İyi ki varsınız, unutulmaz bir gece!&rdquo;</span>
          </div>
          <span className="fs-pop text-[9px] text-white/55 font-semibold" style={{ animationDelay: "5.7s" }}>— Ayşe & Deniz</span>
        </div>
      </Vignette>

      {/* 4 — Anı Filmi */}
      <Vignette i={3}>
        <VigHead label="🎬 Anı Filmi — müzikli hatıra videosu" />
        <div className="flex-1 flex items-center justify-center">
          <div className="fs-pop relative w-36 sm:w-44 h-16 sm:h-20 rounded-xl overflow-hidden" style={{ animationDelay: "7.75s" }}>
            <div className="fs-kenburns absolute inset-0" style={{ background: WALL_TILES[5] }} />
            <span className="absolute inset-0 grid place-items-center text-2xl drop-shadow">▶</span>
            <div className="absolute bottom-1 inset-x-2 h-1 rounded-full bg-white/25">
              <div className="fs-poll-bar h-full rounded-full bg-white/90" style={{ "--wa": "20%", "--wb": "85%" } as CSSProperties} />
            </div>
          </div>
        </div>
      </Vignette>
    </SceneFrame>
  );
}

/* ── Sahne 4: FlowSign — dijital tabela ──────────────────────────────────── */
function SignScene() {
  return (
    <SceneFrame img="/logo-o-sign-white.png" name="SIGN">
      {/* 1 — Ekranını böl, tasarla */}
      <Vignette i={0}>
        <VigHead label="Ekranını böl, alanları tasarla" />
        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-1.5 content-stretch">
          <div className="fs-pop col-span-2 row-span-2 rounded-lg bg-white/15 border border-white/25" style={{ animationDelay: ".25s" }} />
          <div className="fs-pop rounded-lg bg-white/10 border border-white/25" style={{ animationDelay: ".45s" }} />
          <div className="fs-pop rounded-lg bg-white/10 border border-white/25" style={{ animationDelay: ".65s" }} />
        </div>
      </Vignette>

      {/* 2 — İçerik + saat/takvim */}
      <Vignette i={1}>
        <VigHead label="Görsel, video, URL — saatli takvim" />
        <div className="flex-1 flex items-center gap-2">
          <div className="fs-pop flex-1 h-full max-h-20 rounded-lg overflow-hidden relative" style={{ animationDelay: "2.8s", background: "linear-gradient(135deg,#312e81,#2094f3)" }}>
            <span className="absolute top-1 right-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold tabular-nums">12:45</span>
          </div>
          <div className="flex flex-col gap-1.5 w-20 sm:w-24">
            <span className="fs-pop rounded-md bg-white/10 px-2 py-1 text-[9px] text-white/75 font-semibold" style={{ animationDelay: "3.05s" }}>🖼 Menü.png</span>
            <span className="fs-pop rounded-md bg-white/10 px-2 py-1 text-[9px] text-white/75 font-semibold" style={{ animationDelay: "3.25s" }}>🎞 Tanıtım.mp4</span>
            <span className="fs-pop rounded-md bg-white/10 px-2 py-1 text-[9px] text-white/75 font-semibold" style={{ animationDelay: "3.45s" }}>⏰ 09:00–18:00</span>
          </div>
        </div>
      </Vignette>

      {/* 3 — Kaydet & Yayınla */}
      <Vignette i={2}>
        <VigHead label="Taslakta dene, tek tıkla yayınla" />
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <span className="fs-pop rounded-full bg-[#6366f1] px-4 py-1.5 text-xs font-bold" style={{ animationDelay: "5.3s" }}>
            💾 Kaydet &amp; Yayınla
          </span>
          <span className="fs-pop flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300" style={{ animationDelay: "5.9s" }}>
            <span className="fs-live-dot !bg-emerald-400" /> Perde yayında
          </span>
        </div>
      </Vignette>

      {/* 4 — 7/24 kesintisiz */}
      <Vignette i={3}>
        <VigHead label="7/24 kesintisiz oynatma" />
        <div className="flex-1 flex items-center justify-center">
          <div className="fs-pop relative w-36 sm:w-44 h-16 sm:h-20 rounded-xl overflow-hidden" style={{ animationDelay: "7.75s" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#131847,#1b7d3a)" }} />
            <div className="fs-xfade absolute inset-0" style={{ background: "linear-gradient(135deg,#312e81,#d62027)" }} />
            <span className="absolute bottom-1 right-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold">7/24</span>
          </div>
        </div>
      </Vignette>
    </SceneFrame>
  );
}

/* ── Sahne 5: FlowPulse — sürekli nabız ──────────────────────────────────── */
function PulseScene() {
  return (
    <SceneFrame img="/logo-o-pulse-white.png" name="PULSE">
      {/* 1 — Tek dokunuş */}
      <Vignette i={0}>
        <VigHead label="Tek dokunuşla nabız — anonim" />
        <div className="flex-1 flex items-center justify-center gap-2.5 sm:gap-3 text-2xl sm:text-3xl">
          {["😠", "😕", "🙂"].map((s, i) => (
            <span key={s} className="fs-pop opacity-70" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>{s}</span>
          ))}
          <span className="fs-pop fs-heart rounded-full ring-2 ring-emerald-300/80 p-1" style={{ animationDelay: "0.75s" }}>😍</span>
        </div>
      </Vignette>

      {/* 2 — Canlı skor */}
      <Vignette i={1}>
        <VigHead label="Bugünün skoru" live />
        <div className="flex-1 flex items-center justify-center gap-4">
          <span className="fs-pop font-display font-bold text-4xl sm:text-5xl text-emerald-300" style={{ animationDelay: "2.85s" }}>78</span>
          <div className="flex-1 max-w-40">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="fs-poll-bar h-full rounded-full bg-emerald-400" style={{ "--wa": "58%", "--wb": "82%" } as CSSProperties} />
            </div>
            <span className="text-[9px] text-white/55 font-semibold">düne göre +6</span>
          </div>
        </div>
      </Vignette>

      {/* 3 — 30 günlük trend */}
      <Vignette i={2}>
        <VigHead label="30 günlük trend + gün×saat ısı" />
        <div className="flex-1 flex items-center justify-center px-2">
          <svg viewBox="0 0 120 36" className="w-full max-w-56 h-14 overflow-visible">
            <polyline
              points="0,30 15,26 30,28 45,20 60,22 75,14 90,16 105,9 120,6"
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={100}
              className="fs-line"
            />
            <circle cx="120" cy="6" r="3" fill="#34d399" className="fs-pop" style={{ animationDelay: "6.3s" }} />
          </svg>
        </div>
      </Vignette>

      {/* 4 — Kiosk + QR */}
      <Vignette i={3}>
        <VigHead label="Kapıda kiosk, cepte QR" />
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="fs-pop rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold" style={{ animationDelay: "7.75s" }}>🖥 Kiosk</span>
            <span className="fs-pop rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold" style={{ animationDelay: "7.95s" }}>📱 QR ile oy</span>
          </div>
          <span className="fs-pop text-[9px] text-white/55 font-semibold" style={{ animationDelay: "8.3s" }}>günde 1 oy · tamamen anonim</span>
        </div>
      </Vignette>
    </SceneFrame>
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
        {scene === "intro" && <IntroScene />}
        {scene === "meter" && <MeterScene />}
        {scene === "wall" && <WallScene />}
        {scene === "sign" && <SignScene />}
        {scene === "pulse" && <PulseScene />}
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

        .fs-ghost { color: rgba(255, 255, 255, 0.92); }

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

        /* Mini reklam turu: 4 pencere × 2.5sn = 10sn (sahne süresiyle senkron) */
        .fs-vig {
          opacity: 0;
          animation: fs-vig 10s linear infinite;
        }
        @keyframes fs-vig {
          0% { opacity: 0; transform: translateY(10px); }
          3%, 22% { opacity: 1; transform: translateY(0); }
          25%, 100% { opacity: 0; transform: translateY(-8px); }
        }

        /* Pencere içi girişler: 10sn döngüye senkron — her turda yeniden oynar.
           delay, elemanın ait olduğu pencerenin başlangıcına ayarlanır. */
        .fs-pop {
          opacity: 0;
          animation: fs-pop 10s ease-out infinite;
        }
        @keyframes fs-pop {
          0% { opacity: 0; transform: scale(0.5); }
          4% { opacity: 1; transform: scale(1.06); }
          6% { transform: scale(1); }
          22% { opacity: 1; transform: scale(1); }
          26%, 100% { opacity: 0; transform: scale(0.9); }
        }

        .fs-podium {
          transform-origin: bottom;
          transform: scaleY(0);
          animation: fs-podium 10s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        @keyframes fs-podium {
          0% { transform: scaleY(0); }
          6% { transform: scaleY(1); }
          24% { transform: scaleY(1); }
          27%, 100% { transform: scaleY(0); }
        }

        .fs-heart { animation: fs-heart 1.3s ease-in-out infinite; }
        @keyframes fs-heart { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }

        .fs-kenburns { animation: fs-kenburns 8s ease-in-out infinite alternate; }
        @keyframes fs-kenburns {
          from { transform: scale(1) translate(0, 0); }
          to { transform: scale(1.18) translate(4%, -3%); }
        }

        .fs-xfade { animation: fs-xfade 3.4s ease-in-out infinite alternate; }
        @keyframes fs-xfade { from { opacity: 0; } to { opacity: 1; } }

        /* Trend çizgisi: 10sn döngüde kendi penceresinde (5.0–7.5sn) çizilir */
        .fs-line {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: fs-line 10s ease-out infinite;
          animation-delay: 5.2s;
        }
        @keyframes fs-line {
          0% { stroke-dashoffset: 100; }
          10% { stroke-dashoffset: 0; }
          24% { stroke-dashoffset: 0; }
          26%, 100% { stroke-dashoffset: 100; }
        }

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
          .fs-scene, .fs-word, .fs-bar, .fs-in-left, .fs-in-right, .fs-vig,
          .fs-pop, .fs-podium, .fs-heart, .fs-kenburns, .fs-xfade, .fs-line,
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
