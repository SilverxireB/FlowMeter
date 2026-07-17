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
        {pins.map((p, i) => {
          const ok = area ? isPinInArea([p[0], p[1]], area) : true;
          return (
            <span
              key={i}
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow animate-pop"
              style={{
                left: `${p[0] * 100}%`,
                top: `${p[1] * 100}%`,
                background: area ? (ok ? "#16a34a" : "#f43f5e") : `var(--series-${(i % 8) + 1})`,
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
