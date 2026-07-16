"use client";

import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Sayı tahmini sonucu: ortalama + aralık + 12 kovalı mini histogram.
 * settings.correctNumber girildiyse doğru cevap ve en yakın tahmin vurgulanır.
 */
export default function GuessNumberResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const nums = responses
    .map((r) => (typeof r.value === "number" ? r.value : NaN))
    .filter((n) => Number.isFinite(n));

  if (nums.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-3 animate-pulse" aria-hidden>🔢</p>
        <p className="text-muted text-lg">Tahminler bekleniyor…</p>
      </div>
    );
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const correct = slide.settings?.correctNumber;

  // 12 kovalı histogram
  const B = 12;
  const span = max - min || 1;
  const buckets = new Array<number>(B).fill(0);
  nums.forEach((n) => {
    const i = Math.min(B - 1, Math.floor(((n - min) / span) * B));
    buckets[i]++;
  });
  const bucketMax = Math.max(...buckets);

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <p className="eyebrow">Ortalama</p>
          <p className="font-display text-5xl font-semibold" style={{ color: "var(--series-1)" }}>
            {avg.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
          </p>
        </div>
        {typeof correct === "number" && (
          <div>
            <p className="eyebrow">Doğru cevap</p>
            <p className="font-display text-5xl font-semibold text-brand">
              {correct.toLocaleString("tr-TR")}
            </p>
          </div>
        )}
        <p className="text-muted text-sm tabular-nums ml-auto self-end font-semibold">
          {nums.length} tahmin · aralık {min.toLocaleString("tr-TR")}–{max.toLocaleString("tr-TR")}
        </p>
      </div>

      {/* Histogram */}
      <div>
        <div className="flex items-end gap-1 h-36">
          {buckets.map((count, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md transition-[height] duration-500"
              title={`${count} tahmin`}
              style={{
                height: `${(count / bucketMax) * 100}%`,
                minHeight: count > 0 ? "6px" : "2px",
                background: count > 0 ? "var(--series-1)" : "var(--series-1)",
                opacity: count > 0 ? 1 : 0.15,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted font-semibold mt-1 tabular-nums">
          <span>{min.toLocaleString("tr-TR")}</span>
          <span>{max.toLocaleString("tr-TR")}</span>
        </div>
      </div>
    </div>
  );
}
