"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/** 2x2 Izgara sonucu: tüm işaretler dört bölgeli alanda nokta bulutu olarak. */
export default function Grid2x2Result({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const [xLeft, xRight, yBottom, yTop] = slide.settings?.gridLabels ?? ["", "", "", ""];
  const pts = responses
    .map((r) => r.value)
    .filter(
      (v): v is number[] =>
        Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number"
    );

  return (
    <div className="w-full flex flex-col gap-2 max-w-xl mx-auto">
      <p className="text-center text-sm font-semibold text-muted truncate">{yTop}</p>
      <div className="flex items-stretch gap-2">
        <span className="flex items-center text-sm font-semibold text-muted [writing-mode:vertical-rl] rotate-180 truncate">
          {xLeft}
        </span>
        <div className="relative flex-1 aspect-square rounded-2xl border-2 border-line bg-paper overflow-hidden">
          <span className="absolute left-1/2 top-0 bottom-0 w-px bg-line" aria-hidden />
          <span className="absolute top-1/2 left-0 right-0 h-px bg-line" aria-hidden />
          {pts.map((p, i) => (
            <span
              key={i}
              className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow animate-pop"
              style={{
                left: `${p[0] * 100}%`,
                top: `${p[1] * 100}%`,
                background: `var(--series-${(i % 8) + 1})`,
                opacity: 0.8,
              }}
              aria-hidden
            />
          ))}
        </div>
        <span className="flex items-center text-sm font-semibold text-muted [writing-mode:vertical-rl] truncate">
          {xRight}
        </span>
      </div>
      <p className="text-center text-sm font-semibold text-muted truncate">{yBottom}</p>
      <p className="text-muted text-sm font-semibold tabular-nums text-center mt-1">{pts.length} işaret</p>
    </div>
  );
}
