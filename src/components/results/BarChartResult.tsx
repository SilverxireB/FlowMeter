"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Çoktan seçmeli canlı sonuç grafiği — saf CSS yatay bar chart.
 * dataviz kurallarına uygun: baseline'a oturan 4px yuvarlak uçlar, barlar
 * arası boşluk, doğrudan etiketler (değerler metin renginde, seri renginde değil).
 */
export default function BarChartResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const counts = slide.options.map(
    (_, i) => responses.filter((r) => r.value === i).length
  );
  const max = Math.max(1, ...counts);
  const total = responses.length;

  return (
    <div className="w-full flex flex-col gap-4">
      {slide.options.map((option, i) => {
        const count = counts[i];
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-medium text-ink">{option}</span>
              <span className="text-muted text-sm tabular-nums">
                {count} oy · %{pct}
              </span>
            </div>
            <div className="h-8 bg-line/40 rounded-r">
              <div
                className="h-full rounded-r transition-[width] duration-500"
                style={{
                  width: `${(count / max) * 100}%`,
                  minWidth: count > 0 ? "8px" : "0",
                  background: `var(--series-${(i % 8) + 1})`,
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-muted text-sm">{total} cevap</p>
    </div>
  );
}
