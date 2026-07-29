"use client";

import { useState } from "react";

const SIZES = {
  sm: { img: "h-5", fontSize: 20 },
  md: { img: "h-7", fontSize: 27 },
  lg: { img: "h-10", fontSize: 38 },
} as const;

const VARIANTS = {
  studio: { icon: "/logo-o-studio.png", iconDark: "/logo-o-studio-white.png", word: "FLOW STUDIO", full: "FLOW STUDIO" },
  meter: { icon: "/logo-o-meter.png", iconDark: "/logo-o-meter-white.png", word: "METER", full: "FLOWMETER" },
  wall: { icon: "/logo-o-wall.png", iconDark: "/logo-o-wall-white.png", word: "WALL", full: "FLOWWALL" },
  sign: { icon: "/logo-o-sign.png", iconDark: "/logo-o-sign-white.png", word: "SIGN", full: "FLOWSIGN" },
  pulse: { icon: "/logo-o-pulse.png", iconDark: "/logo-o-pulse-white.png", word: "PULSE", full: "FLOWPULSE" },
} as const;

/**
 * Marka logosu: başta yalnız O-halkası ikonu (renkli yaylar, glif ürüne göre) +
 * devamında marka adı. "FLOW" yazısı YALNIZ çatı markada görünür; ürünler
 * O-ikon + kısa ad taşır (O zaten Flow'u temsil eder). `variant`:
 *  - "studio": çatı marka — O içinde 4 ürün karosu (app-grid) → FLOW STUDIO
 *  - "meter" (varsayılan): bar-chart → METER
 *  - "wall": fotoğraf makinesi → WALL
 *  - "sign": dikey dijital tabela (totem) → SIGN
 *  - "pulse": EKG nabız çizgisi → PULSE
 * İkon asla deforme edilmez (yükseklik sabit, genişlik otomatik).
 * Koyu zeminde beyaz glifli sürüm + beyaz metin kullanılır.
 */
export default function Logo({
  size = "md",
  onDark = false,
  variant = "meter",
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  variant?: "studio" | "meter" | "wall" | "sign" | "pulse";
}) {
  const [imgOk, setImgOk] = useState(true);
  const { img, fontSize } = SIZES[size];
  const v = VARIANTS[variant];

  return (
    // Ekran okuyucu markayı TEK kez tam adıyla duyar; parçalar gizli.
    <span className="inline-flex items-center" role="img" aria-label={v.full}>
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onDark ? v.iconDark : v.icon}
          alt=""
          className={`${img} w-auto`}
          onError={() => setImgOk(false)}
        />
      )}
      <span
        aria-hidden
        className="font-display font-semibold"
        style={{
          color: onDark ? "#ffffff" : "#001e64",
          fontSize,
          lineHeight: 1,
          letterSpacing: "0.03em",
          marginLeft: imgOk ? "0.28em" : 0,
        }}
      >
        {imgOk ? v.word : v.full}
      </span>
    </span>
  );
}
