"use client";

import { useState } from "react";

const SIZES = {
  sm: { img: "h-5", fontSize: 23 },
  md: { img: "h-7", fontSize: 32 },
  lg: { img: "h-10", fontSize: 46 },
} as const;

const VARIANTS = {
  meter: { img: "/logo-flow.png", imgDark: "/logo-flow-white.png", word: "METER", full: "FLOWMETER" },
  wall: { img: "/logo-flowwall.png", imgDark: "/logo-flowwall-white.png", word: "WALL", full: "FLOWWALL" },
  // FlowSign: kendi wordmark PNG'si (ekran glifli O) çizilene dek paylaşılan FLOW
  // görselini kullanır (O halkası + "SIGN"). logo-flowsign.png eklenince bu iki
  // satırı değiştirmek yeter.
  sign: { img: "/logo-flow.png", imgDark: "/logo-flow-white.png", word: "SIGN", full: "FLOWSIGN" },
} as const;

/**
 * Marka logosu: FLOW görseli (renkli O halkası, harfler Beko lacisi) +
 * yanında benzer puntoda ikinci kelime. `variant`:
 *  - "meter" (varsayılan): O içinde bar-chart + "METER" → FlowMeter
 *  - "wall": AYNI O halkası, içinde fotoğraf makinesi + "WALL" → FlowWall
 *  - "sign": AYNI O halkası, içinde ekran/tabela + "SIGN" → FlowSign
 * Logo asla deforme edilmez (yükseklik sabit, genişlik otomatik).
 * Koyu zeminde beyaz sürüm kullanılır.
 */
export default function Logo({
  size = "md",
  onDark = false,
  variant = "meter",
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  variant?: "meter" | "wall" | "sign";
}) {
  const [imgOk, setImgOk] = useState(true);
  const { img, fontSize } = SIZES[size];
  const v = VARIANTS[variant];

  return (
    // Ekran okuyucu markayı TEK kez tam adıyla duyar ("FLOWSIGN"); parçalar gizli.
    <span className="inline-flex items-center" role="img" aria-label={v.full}>
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onDark ? v.imgDark : v.img}
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
          marginLeft: imgOk ? "0.1em" : 0,
        }}
      >
        {imgOk ? v.word : v.full}
      </span>
    </span>
  );
}
