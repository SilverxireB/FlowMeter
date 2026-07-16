"use client";

import { useEffect, useState } from "react";
import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Quiz canlı sonucu: süre dolana kadar sadece cevap sayıları,
 * süre dolunca doğru seçenek vurgulanır.
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

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Geri sayım */}
      {remaining !== null && !revealed && (
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
      )}

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
                  {option} {isCorrect && <span className="text-green-700">✓ Doğru</span>}
                </span>
              </span>
              <span className={`shrink-0 tabular-nums ${isCorrect ? "font-bold" : "text-muted"}`}>
                {revealed ? count : total > 0 ? count : 0}
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
      <p className="text-muted text-sm font-semibold tabular-nums">
        {total} cevap {revealed ? "· doğru cevap açıklandı" : ""}
      </p>
    </div>
  );
}
