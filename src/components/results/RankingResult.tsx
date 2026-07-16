"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Ortalama sıraya göre sonuç: her seçeneğin aldığı sıraların ortalaması
 * hesaplanır, en iyi (en düşük) ortalama en üstte gösterilir.
 */
export default function RankingResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const n = slide.options.length;
  const positionSums = new Array<number>(n).fill(0);
  let validCount = 0;

  for (const r of responses) {
    if (!Array.isArray(r.value) || r.value.length !== n) continue;
    validCount++;
    (r.value as number[]).forEach((optionIndex, pos) => {
      if (typeof optionIndex === "number" && optionIndex < n) {
        positionSums[optionIndex] += pos + 1;
      }
    });
  }

  const ranked = slide.options
    .map((option, i) => ({
      option,
      i,
      avg: validCount ? positionSums[i] / validCount : null,
    }))
    .sort((a, b) => (a.avg ?? Infinity) - (b.avg ?? Infinity));

  return (
    <div className="w-full flex flex-col gap-4">
      {ranked.map((item, pos) => {
        const score = item.avg === null ? 0 : (n - item.avg + 1) / n;
        return (
          <div key={item.i} className="flex items-center gap-4">
            <span
              className={`font-display font-semibold tabular-nums w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                pos === 0 && validCount > 0
                  ? "bg-brand-soft text-brand text-lg"
                  : "bg-line/50 text-muted"
              }`}
              aria-label={`${pos + 1}. sıra`}
            >
              {pos + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-4 mb-1">
                <span className={`truncate text-lg ${pos === 0 && validCount > 0 ? "font-bold" : "font-medium"}`}>
                  {item.option}
                </span>
                <span className="text-muted text-sm tabular-nums shrink-0 font-semibold">
                  {item.avg === null ? "—" : `ort. ${item.avg.toFixed(1)}`}
                </span>
              </div>
              <div className="h-6 bg-line/50 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-r-lg transition-[width] duration-700 ease-out"
                  style={{
                    width: `${score * 100}%`,
                    background: `var(--series-${(item.i % 8) + 1})`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-muted text-sm font-semibold tabular-nums">{validCount} cevap</p>
    </div>
  );
}
