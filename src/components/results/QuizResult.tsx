"use client";

import { useEffect, useState } from "react";
import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Quiz canlı sonucu: süre dolana kadar sadece cevap sayıları,
 * süre dolunca doğru seçenek vurgulanır.
 * settings.chartOrientation ile dikey (sütun) / yatay (çubuk); quiz varsayılanı dikey.
 */
export default function QuizResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const timeLimit = slide.settings?.timeLimit ?? 20;
  const correctIndex = slide.settings?.correctIndex ?? 0;
  const startedMs = slide.quizStartedAt?.toMillis() ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = startedMs ? Math.max(0, startedMs + timeLimit * 1000 - now) : null;
  const revealed = remaining !== null && remaining <= 0;

  const counts = slide.options.map(
    (_, i) => responses.filter((r) => Array.isArray(r.value) && r.value[0] === i).length
  );
  const max = Math.max(1, ...counts);
  const total = responses.length;
  const vertical = (slide.settings?.chartOrientation ?? "vertical") === "vertical";

  const countdown = remaining !== null && !revealed && (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-3 bg-line/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-linear"
          style={{ width: `${(remaining / (timeLimit * 1000)) * 100}%` }}
        />
      </div>
      <span className="font-display font-semibold text-brand text-4xl tabular-nums w-16 text-right">
        {Math.ceil(remaining / 1000)}
      </span>
    </div>
  );

  const footer = (
    <p className="text-muted text-sm font-semibold tabular-nums">
      {total} cevap {revealed ? "· doğru cevap açıklandı" : ""}
    </p>
  );

  if (vertical) {
    return (
      <div className="w-full flex flex-col gap-5">
        {countdown}
        {/* Sütunlar */}
        <div className="flex items-end justify-center gap-3 md:gap-6 h-64 md:h-80">
          {slide.options.map((option, i) => {
            const count = counts[i];
            const isCorrect = revealed && i === correctIndex;
            const dimmed = revealed && i !== correctIndex;
            return (
              <div
                key={i}
                className={`flex-1 max-w-[9rem] h-full flex flex-col items-center justify-end gap-2 ${
                  dimmed ? "opacity-45" : ""
                }`}
              >
                <span
                  className={`tabular-nums text-sm flex items-center gap-1.5 ${
                    isCorrect ? "font-bold text-ink" : "text-muted"
                  }`}
                >
                  {revealed ? count : total > 0 ? count : 0}
                  {revealed && (
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] text-white ${
                        isCorrect ? "bg-green-600" : "bg-rose-400"
                      }`}
                      aria-label={isCorrect ? "doğru cevap" : "yanlış"}
                    >
                      {isCorrect ? "✓" : "✕"}
                    </span>
                  )}
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
        {/* Etiketler (harf rozeti + seçenek) */}
        <div className="flex justify-center gap-3 md:gap-6">
          {slide.options.map((option, i) => {
            const isCorrect = revealed && i === correctIndex;
            const dimmed = revealed && i !== correctIndex;
            return (
              <div
                key={i}
                className={`flex-1 max-w-[9rem] flex items-center justify-center gap-1.5 min-w-0 ${
                  dimmed ? "opacity-45" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0"
                  style={{ background: `var(--series-${(i % 8) + 1})` }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className={`truncate text-sm text-center ${isCorrect ? "font-bold" : "font-medium"}`}>
                  {option}
                </span>
              </div>
            );
          })}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5">
      {countdown}

      {slide.options.map((option, i) => {
        const count = counts[i];
        const isCorrect = revealed && i === correctIndex;
        const dimmed = revealed && i !== correctIndex;
        return (
          <div key={i} className={dimmed ? "opacity-45" : ""}>
            <div className="flex items-baseline justify-between gap-4 mb-1.5">
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-sm font-bold shrink-0"
                  style={{ background: `var(--series-${(i % 8) + 1})` }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className={`truncate text-lg ${isCorrect ? "font-bold" : "font-medium"}`}>
                  {option}
                </span>
              </span>
              <span className={`shrink-0 tabular-nums flex items-center gap-1.5 ${isCorrect ? "font-bold" : "text-muted"}`}>
                {revealed ? count : total > 0 ? count : 0}
                {/* Menti tarzı ✓/✗ rozeti — süre dolunca */}
                {revealed && (
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] text-white ${
                      isCorrect ? "bg-green-600" : "bg-rose-400"
                    }`}
                    aria-label={isCorrect ? "doğru cevap" : "yanlış"}
                  >
                    {isCorrect ? "✓" : "✕"}
                  </span>
                )}
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
      {footer}
    </div>
  );
}
