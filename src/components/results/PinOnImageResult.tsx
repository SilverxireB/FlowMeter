"use client";

import { isPinInArea } from "@/lib/quizScores";
import { ResponseDoc, Slide } from "@/lib/types";

/** Görselde işaretleme sonucu: tüm pinler görsel üstünde nokta olarak. */
export default function PinOnImageResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const image = slide.settings?.image;
  if (!image) {
    return <p className="text-muted text-center py-10">Bu slayta görsel eklenmemiş.</p>;
  }

  const pins = responses
    .map((r) => r.value)
    .filter(
      (v): v is number[] =>
        Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number"
    );
  const area = slide.settings?.correctArea;
  const inside = area ? pins.filter((p) => isPinInArea([p[0], p[1]], area)).length : 0;

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden border border-line max-w-3xl mx-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={slide.question} className="w-full h-auto block" draggable={false} />
        {/* Doğru alan dairesi (varsa) */}
        {area && (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green-400 bg-green-400/20"
            style={{
              left: `${area[0] * 100}%`,
              top: `${area[1] * 100}%`,
              width: `${area[2] * 200}%`,
              height: `${area[2] * 200}%`,
            }}
            aria-hidden
          />
        )}
        {/* Çok işaret olduğunda okunur kalması için TEK tutarlı renk + yarı saydam
            (yoğunluk üst üste binerek "sıcaklık" gibi görünür). Doğru alan varsa
            yeşil/kırmızı. Renk döngüsü YOK. */}
        {pins.map((p, i) => {
          const ok = area ? isPinInArea([p[0], p[1]], area) : false;
          const bg = area ? (ok ? "#16a34a" : "#f43f5e") : "#4f46e5";
          const size = pins.length > 120 ? 10 : pins.length > 40 ? 12 : 15;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
              style={{
                left: `${p[0] * 100}%`,
                top: `${p[1] * 100}%`,
                width: size,
                height: size,
                background: bg,
                opacity: 0.62,
                mixBlendMode: "normal",
              }}
              aria-hidden
            />
          );
        })}
      </div>
      <p className="text-muted text-sm font-semibold tabular-nums text-center">
        {pins.length} işaret{area ? ` · ${inside} doğru alanda ✓` : ""}
      </p>
    </div>
  );
}
