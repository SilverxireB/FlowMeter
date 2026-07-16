"use client";

import { ResponseDoc, Slide } from "@/lib/types";

const MAX = 5;

/** İfade başına ortalama puan (1–5) — tek renkli sequential bar. */
export default function ScalesResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const averages = slide.options.map((_, i) => {
    const ratings = responses
      .map((r) => (Array.isArray(r.value) ? r.value[i] : undefined))
      .filter((v): v is number => typeof v === "number");
    if (ratings.length === 0) return null;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  });

  return (
    <div className="w-full flex flex-col gap-4">
      {slide.options.map((statement, i) => {
        const avg = averages[i];
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-medium text-ink">{statement}</span>
              <span className="text-muted text-sm tabular-nums">
                {avg === null ? "—" : `ort. ${avg.toFixed(1)} / ${MAX}`}
              </span>
            </div>
            <div className="h-8 bg-line/40 rounded-r">
              <div
                className="h-full rounded-r transition-[width] duration-500"
                style={{
                  width: `${((avg ?? 0) / MAX) * 100}%`,
                  background: "var(--series-1)",
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-muted text-sm">{responses.length} cevap</p>
    </div>
  );
}
