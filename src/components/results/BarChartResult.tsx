"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Çoktan seçmeli canlı sonuç grafiği — saf CSS yatay bar chart.
 * dataviz kuralları: baseline'a oturan yuvarlak uçlar, barlar arası boşluk,
 * değer etiketleri metin renginde (seri renginde değil), lider vurgusu.
 */
export default function BarChartResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const counts = slide.options.map(
    (_, i) =>
      responses.filter(
        (r) => r.value === i || (Array.isArray(r.value) && (r.value as number[]).includes(i))
      ).length
  );
  const max = Math.max(1, ...counts);
  const total = responses.length;
  const leader = total > 0 ? Math.max(...counts) : -1;

  return (
    <div className="w-full flex flex-col gap-5">
      {slide.options.map((option, i) => {
        const count = counts[i];
        const pct = total ? Math.round((count / total) * 100) : 0;
        const isLeader = total > 0 && count === leader;
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-4 mb-1.5">
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: `var(--series-${(i % 8) + 1})` }}
                />
                <span
                  className={`truncate text-lg ${isLeader ? "font-bold" : "font-medium"}`}
                >
                  {option}
                </span>
              </span>
              <span
                className={`shrink-0 tabular-nums ${
                  isLeader ? "font-bold text-ink" : "text-muted"
                }`}
              >
                {count} <span className="text-sm font-semibold text-muted">· %{pct}</span>
              </span>
            </div>
            <div className="h-9 bg-line/50 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-r-lg transition-[width] duration-700 ease-out"
                style={{
                  width: `${(count / max) * 100}%`,
                  minWidth: count > 0 ? "10px" : "0",
                  background: `var(--series-${(i % 8) + 1})`,
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-muted text-sm font-semibold tabular-nums">{total} cevap</p>
    </div>
  );
}
