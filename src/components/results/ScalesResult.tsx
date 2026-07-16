"use client";

import { ResponseDoc, Slide } from "@/lib/types";

const MAX = 5;

/** İfade başına ortalama puan (1–5): işaretli ray üzerinde dolgu + büyük ortalama. */
export default function ScalesResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const averages = slide.options.map((_, i) => {
    const ratings = responses
      .map((r) => (Array.isArray(r.value) ? (r.value as number[])[i] : undefined))
      .filter((v): v is number => typeof v === "number");
    if (ratings.length === 0) return null;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  });

  return (
    <div className="w-full flex flex-col gap-7">
      {slide.options.map((statement, i) => {
        const avg = averages[i];
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <span className="font-medium text-lg">{statement}</span>
              <span className="font-display font-semibold text-2xl tabular-nums shrink-0" style={{ color: "var(--series-1)" }}>
                {avg === null ? "—" : avg.toFixed(1)}
              </span>
            </div>
            <div className="relative h-3 bg-line/50 rounded-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${(((avg ?? 1) - 1) / (MAX - 1)) * 100}%`,
                  background: "var(--series-1)",
                  opacity: avg === null ? 0 : 1,
                }}
              />
              {/* 1–5 işaretleri */}
              {[0, 1, 2, 3].map((t) => (
                <span
                  key={t}
                  aria-hidden
                  className="absolute top-0 bottom-0 w-px bg-white"
                  style={{ left: `${((t + 1) / (MAX - 1)) * 100 - 25}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted font-semibold mt-1 tabular-nums">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
        );
      })}
      <p className="text-muted text-sm font-semibold tabular-nums">{responses.length} cevap</p>
    </div>
  );
}
