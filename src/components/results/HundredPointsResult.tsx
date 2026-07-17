"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/** 100 Puan sonucu: seçenek başına ortalama dağıtılan puan (bar). */
export default function HundredPointsResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const valid = responses
    .map((r) => r.value)
    .filter((v): v is number[] => Array.isArray(v) && v.every((x) => typeof x === "number"));
  const total = valid.length;

  const avg = slide.options.map((_, i) => {
    if (!total) return 0;
    const sum = valid.reduce((a, v) => a + (typeof v[i] === "number" ? (v[i] as number) : 0), 0);
    return sum / total;
  });
  const max = Math.max(1, ...avg);
  const leader = total > 0 ? Math.max(...avg) : -1;

  return (
    <div className="w-full flex flex-col gap-5">
      {slide.options.map((option, i) => {
        const val = avg[i];
        const isLeader = total > 0 && val === leader;
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-4 mb-1.5">
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: `var(--series-${(i % 8) + 1})` }}
                />
                <span className={`truncate text-lg ${isLeader ? "font-bold" : "font-medium"}`}>{option}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${isLeader ? "font-bold text-ink" : "text-muted"}`}>
                ⌀ {Math.round(val * 10) / 10} puan
              </span>
            </div>
            <div className="h-9 bg-line/50 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-r-lg transition-[width] duration-700 ease-out"
                style={{
                  width: `${(val / max) * 100}%`,
                  minWidth: val > 0 ? "10px" : "0",
                  background: `var(--series-${(i % 8) + 1})`,
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-muted text-sm font-semibold tabular-nums">{total} katılımcı · kişi başı 100 puan</p>
    </div>
  );
}
