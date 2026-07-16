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
    r.value.forEach((optionIndex, pos) => {
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
    <div className="w-full flex flex-col gap-3">
      {ranked.map((item, pos) => {
        // En iyi sıra (1) en uzun bar olacak şekilde ters ölçek
        const score = item.avg === null ? 0 : (n - item.avg + 1) / n;
        return (
          <div key={item.i} className="flex items-center gap-3">
            <span className="text-slate-400 font-bold tabular-nums w-8 text-lg">
              {pos + 1}.
            </span>
            <div className="flex-1">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-medium text-slate-800">{item.option}</span>
                <span className="text-slate-500 text-sm tabular-nums">
                  {item.avg === null ? "—" : `ort. sıra ${item.avg.toFixed(1)}`}
                </span>
              </div>
              <div className="h-6 bg-slate-100 rounded-r">
                <div
                  className="h-full rounded-r transition-[width] duration-500"
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
      <p className="text-slate-400 text-sm">{validCount} cevap</p>
    </div>
  );
}
