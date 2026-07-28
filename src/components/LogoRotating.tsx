"use client";

/**
 * Dönüşümlü marka logosu — nötr giriş ekranları için (ana sayfa + dashboard hub).
 * "FLOW" sabit kalır (wordmark PNG'lerde FLOW harfleri birebir aynı; yalnız O
 * içindeki glif farklı), görseller crossfade edilince sadece O-glifi morph olur.
 * Ek kelime METER → WALL → SIGN döngüsü (üç ürün). Küçük ekranda (sm altı)
 * ek kelime gizlenir → yer kaplamaz (yalnız Flow+O).
 */
import { useEffect, useState } from "react";

const SIZES = {
  sm: { img: "h-5", fontSize: 23 },
  md: { img: "h-7", fontSize: 32 },
  lg: { img: "h-10", fontSize: 46 },
} as const;

// Sıra: Meter → Wall → Sign (FlowSign kendi O-glifli PNG'sini alana dek FLOW görseli)
const STEPS = [
  { img: "/logo-flow.png", imgDark: "/logo-flow-white.png", word: "METER" },
  { img: "/logo-flowwall.png", imgDark: "/logo-flowwall-white.png", word: "WALL" },
  { img: "/logo-flow.png", imgDark: "/logo-flow-white.png", word: "SIGN" },
] as const;

const PERIOD_MS = 3400;
const FADE = "opacity 700ms ease";

export default function LogoRotating({ size = "md", onDark = false }: { size?: "sm" | "md" | "lg"; onDark?: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), PERIOD_MS);
    return () => window.clearInterval(t);
  }, []);

  const { img, fontSize } = SIZES[size];
  const color = onDark ? "#ffffff" : "#001e64";

  return (
    <span className="inline-flex items-center" aria-label="FlowMeter · FlowWall · FlowSign">
      {/* Wordmark'lar üst üste — FLOW aynı hizada, yalnız O-glifi değişir */}
      <span className={`relative inline-block ${img}`} aria-hidden>
        {STEPS.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={onDark ? s.imgDark : s.img}
            alt=""
            className={`${img} w-auto ${i === 0 ? "" : "absolute inset-0"}`}
            style={{ opacity: step === i ? 1 : 0, transition: FADE }}
          />
        ))}
      </span>

      {/* Ek kelime METER → WALL → SIGN (küçük ekranda gizli) */}
      <span
        className="relative font-display font-semibold hidden sm:inline-block"
        style={{ color, fontSize, lineHeight: 1, letterSpacing: "0.03em", marginLeft: "0.1em" }}
        aria-hidden
      >
        {/* En geniş kelime akışta kalır → genişlik zıplamaz */}
        <span style={{ opacity: step === 0 ? 1 : 0, transition: FADE }}>METER</span>
        {STEPS.slice(1).map((s, i) => (
          <span key={s.word} className="absolute left-0 top-0" style={{ opacity: step === i + 1 ? 1 : 0, transition: FADE }}>
            {s.word}
          </span>
        ))}
      </span>
    </span>
  );
}
