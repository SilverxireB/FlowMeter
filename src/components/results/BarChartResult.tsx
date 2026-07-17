"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Çoktan seçmeli canlı sonuç grafiği — saf CSS bar chart.
 * settings.chartOrientation ile yatay (çubuk) veya dikey (sütun) seçilir;
 * çoktan seçmeli varsayılanı yatay.
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
  const vertical = (slide.settings?.chartOrientation ?? "horizontal") === "vertical";

  if (vertical) {
    return (
      <div className="w-full flex flex-col gap-4">
        {/* Sütunlar */}
        <div className="flex items-end justify-center gap-3 md:gap-6 h-64 md:h-80">
          {slide.options.map((option, i) => {
            const count = counts[i];
            const pct = total ? Math.round((count / total) * 100) : 0;
            const isLeader = total > 0 && count === leader;
            return (
              <div
                key={i}
                className="flex-1 max-w-[9rem] h-full flex flex-col items-center justify-end gap-2"
              >
                <span
                  className={`tabular-nums text-sm ${isLeader ? "font-bold text-ink" : "text-muted"}`}
                >
                  {count}
                  {total ? <span className="text-xs"> · %{pct}</span> : null}
                </span>
                <div
                  className="w-full rounded-t-lg transition-[height] duration-700 ease-out"
                  style={{
                    height: `${(count / max) * 100}%`,
                    minHeight: count > 0 ? "8px" : "0",
                    background: `var(--series-${(i % 8) + 1})`,
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* Sütun etiketleri (barlarla hizalı) */}
        <div className="flex justify-center gap-3 md:gap-6">
          {slide.options.map((option, i) => (
            <div
              key={i}
              className="flex-1 max-w-[9rem] flex items-center justify-center gap-1.5 min-w-0"
            >
              <span
                aria-hidden
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: `var(--series-${(i % 8) + 1})` }}
              />
              <span className="truncate text-sm text-center font-medium">{option}</span>
            </div>
          ))}
        </div>
        <p className="text-muted text-sm font-semibold tabular-nums text-center">{total} cevap</p>
      </div>
    );
  }

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
