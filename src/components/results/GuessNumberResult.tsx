"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/** Sayı tahmini sonucu: ortalama + doğru sayı + histogram dağılımı. */
export default function GuessNumberResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const min = slide.settings?.min ?? 0;
  const max = slide.settings?.max ?? 100;
  const unit = slide.settings?.unit ?? "";
  const correct = slide.settings?.correctNumber;

  const nums = responses
    .map((r) => (typeof r.value === "number" ? r.value : NaN))
    .filter((n) => !Number.isNaN(n));
  const total = nums.length;
  const avg = total ? nums.reduce((a, b) => a + b, 0) / total : 0;

  // Histogram: 10 kova
  const buckets = 10;
  const span = Math.max(1, max - min);
  const hist = Array.from({ length: buckets }, () => 0);
  nums.forEach((n) => {
    const idx = Math.min(buckets - 1, Math.floor(((n - min) / span) * buckets));
    hist[Math.max(0, idx)] += 1;
  });
  const maxBar = Math.max(1, ...hist);

  const fmt = (n: number) => `${Math.round(n * 10) / 10}${unit ? " " + unit : ""}`;

  return (
    <div className="w-full flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[8rem] rounded-2xl bg-paper border border-line px-5 py-4 text-center">
          <p className="eyebrow mb-1">Ortalama</p>
          <p className="font-display text-3xl font-semibold tabular-nums">{fmt(avg)}</p>
        </div>
        {correct !== undefined && (
          <div className="flex-1 min-w-[8rem] rounded-2xl bg-green-600/10 border border-green-600/30 px-5 py-4 text-center">
            <p className="eyebrow mb-1 text-green-700">Doğru cevap</p>
            <p className="font-display text-3xl font-semibold tabular-nums text-green-700">{fmt(correct)}</p>
          </div>
        )}
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-1.5 h-40">
        {hist.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-xs tabular-nums text-muted mb-1">{count || ""}</span>
            <div
              className="w-full rounded-t-md transition-[height] duration-700 ease-out"
              style={{
                height: `${(count / maxBar) * 100}%`,
                minHeight: count > 0 ? "6px" : "0",
                background: `var(--series-1)`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted font-semibold tabular-nums">
        <span>{min}{unit ? " " + unit : ""}</span>
        <span>{max}{unit ? " " + unit : ""}</span>
      </div>
      <p className="text-muted text-sm font-semibold tabular-nums">{total} tahmin</p>
    </div>
  );
}
