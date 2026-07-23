"use client";

/**
 * Dönüşümlü marka logosu — nötr giriş ekranları için (ana sayfa + dashboard hub).
 * "FLOW" sabit kalır (iki wordmark PNG'de FLOW harfleri birebir aynı; yalnız O
 * içindeki glif farklı → bar-chart ↔ fotoğraf makinesi), iki görsel crossfade
 * edilince sadece O-glifi morph olur. Ek kelime METER ↔ WALL geçiş yapar.
 * Küçük ekranda (sm altı) ek kelime gizlenir → yer kaplamaz (yalnız Flow+O).
 */
import { useEffect, useState } from "react";

const SIZES = {
  sm: { img: "h-5", fontSize: 23 },
  md: { img: "h-7", fontSize: 32 },
  lg: { img: "h-10", fontSize: 46 },
} as const;

const PERIOD_MS = 3400;
const FADE = "opacity 700ms ease";

export default function LogoRotating({ size = "md", onDark = false }: { size?: "sm" | "md" | "lg"; onDark?: boolean }) {
  const [wall, setWall] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setWall((w) => !w), PERIOD_MS);
    return () => window.clearInterval(t);
  }, []);

  const { img, fontSize } = SIZES[size];
  const flowImg = onDark ? "/logo-flow-white.png" : "/logo-flow.png";
  const wallImg = onDark ? "/logo-flowwall-white.png" : "/logo-flowwall.png";
  const color = onDark ? "#ffffff" : "#001e64";

  return (
    <span className="inline-flex items-center" aria-label="FlowMeter · FlowWall">
      {/* İki wordmark üst üste — FLOW aynı hizada, yalnız O-glifi değişir */}
      <span className={`relative inline-block ${img}`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flowImg} alt="" className={`${img} w-auto`} style={{ opacity: wall ? 0 : 1, transition: FADE }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wallImg} alt="" className={`${img} w-auto absolute inset-0`} style={{ opacity: wall ? 1 : 0, transition: FADE }} />
      </span>

      {/* Ek kelime METER ↔ WALL (küçük ekranda gizli) */}
      <span
        className="relative font-display font-semibold hidden sm:inline-block"
        style={{ color, fontSize, lineHeight: 1, letterSpacing: "0.03em", marginLeft: "0.1em" }}
        aria-hidden
      >
        <span style={{ opacity: wall ? 0 : 1, transition: FADE }}>METER</span>
        <span className="absolute left-0 top-0" style={{ opacity: wall ? 1 : 0, transition: FADE }}>WALL</span>
      </span>
    </span>
  );
}
