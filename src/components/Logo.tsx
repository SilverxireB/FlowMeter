"use client";

import { useState } from "react";

/**
 * Marka logosu: /logo-flow.png ("Flow" görseli) + yanında "meter" yazısı
 * (Beko lacisi). Görsel henüz yoksa eski nokta + FlowMeter yazısına düşer.
 * Kural: logo görseli asla deforme edilmez (h sabit, w auto).
 */
export default function Logo({
  size = "md",
  onDark = false,
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const h = size === "lg" ? "h-10" : size === "sm" ? "h-5" : "h-7";
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-lg";

  if (!imgOk) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-brand" aria-hidden />
        <span
          className={`font-display font-semibold tracking-tight ${text} ${
            onDark ? "text-white" : ""
          }`}
        >
          FlowMeter
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-flow.png"
        alt="Flow"
        className={`${h} w-auto self-center`}
        onError={() => setImgOk(false)}
      />
      <span
        className={`font-display font-semibold tracking-tight ${text}`}
        style={{ color: onDark ? "#ffffff" : "#001e64" }}
      >
        meter
      </span>
    </span>
  );
}
