"use client";

import { useState } from "react";

/**
 * Boyutlar EKRANA GÖRE esner: logo `whitespace-nowrap` olduğu için dar
 * telefonda kırpılamıyor, sabit punto verildiğinde başlığın en küçük genişliği
 * ekranı aşıp SAYFAYI YATAY KAYDIRIYORDU. `clamp` ile geniş ekranda punto
 * eskisiyle birebir aynı kalır, dar ekranda kendiliğinden küçülür.
 * İkon yüksekliği em cinsinden — yazıyla birlikte ölçeklenir, oran bozulmaz.
 */
const SIZES = {
  sm: { fontSize: "clamp(15px, 4.6vw, 20px)" },
  md: { fontSize: "clamp(19px, 6.2vw, 27px)" },
  lg: { fontSize: "clamp(26px, 8.8vw, 38px)" },
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
  const { fontSize } = SIZES[size];
  const v = VARIANTS[variant];
  const color = onDark ? "#ffffff" : "#001e64";

  // Çatı marka: O-halkası kelimenin İÇİNDE — FL◯W STUDIO (başta ikon değil)
  // shrink-0: dar başlıklarda flex logoyu EZEMEZ — ezerse yazı taşar ve
  // yanındaki başlıkla üst üste biner (kokpit mobil vakası).
  if (variant === "studio" && imgOk) {
    return (
      <span className="inline-flex items-center shrink-0 whitespace-nowrap" role="img" aria-label="FLOW STUDIO">
        <span
          aria-hidden
          className="font-display font-semibold inline-flex items-center"
          style={{ color, fontSize, lineHeight: 1, letterSpacing: "0.03em" }}
        >
          FL
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={onDark ? v.iconDark : v.icon}
            alt=""
            style={{ height: "1.06em", width: "auto", margin: "0 0.05em" }}
            onError={() => setImgOk(false)}
          />
          W&nbsp;STUDIO
        </span>
      </span>
    );
  }

  return (
    // Ekran okuyucu markayı TEK kez tam adıyla duyar; parçalar gizli.
    <span
      className="inline-flex items-center shrink-0 whitespace-nowrap"
      role="img"
      aria-label={v.full}
      style={{ fontSize, lineHeight: 1 }}
    >
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onDark ? v.iconDark : v.icon}
          alt=""
          className="w-auto"
          style={{ height: "1.05em" }}
          onError={() => setImgOk(false)}
        />
      )}
      <span
        aria-hidden
        className="font-display font-semibold"
        style={{
          color: onDark ? "#ffffff" : "#001e64",
          fontSize: "1em",
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
