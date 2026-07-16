"use client";

import { useState } from "react";

const SIZES = {
  sm: { img: "h-5", fontSize: 23 },
  md: { img: "h-7", fontSize: 32 },
  lg: { img: "h-10", fontSize: 46 },
} as const;

/**
 * Marka logosu: FLOW görseli (renkli O halkası, harfler Beko lacisi) +
 * yanında benzer puntoda "METER" yazısı. Logo asla deforme edilmez
 * (yükseklik sabit, genişlik otomatik). Koyu zeminde beyaz sürüm kullanılır.
 */
export default function Logo({
  size = "md",
  onDark = false,
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const { img, fontSize } = SIZES[size];

  return (
    <span className="inline-flex items-center">
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onDark ? "/logo-flow-white.png" : "/logo-flow.png"}
          alt="Flow"
          className={`${img} w-auto`}
          onError={() => setImgOk(false)}
        />
      )}
      <span
        className="font-display font-semibold"
        style={{
          color: onDark ? "#ffffff" : "#001e64",
          fontSize,
          lineHeight: 1,
          letterSpacing: "0.03em",
          marginLeft: imgOk ? "0.1em" : 0,
        }}
      >
        {imgOk ? "METER" : "FLOWMETER"}
      </span>
    </span>
  );
}
