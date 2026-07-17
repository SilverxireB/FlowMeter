"use client";

import { useEffect, useState } from "react";
import { isTypedAnswerCorrect, normalizeAnswer } from "@/lib/quizScores";
import { ResponseDoc, Slide } from "@/lib/types";

/**
 * Yazarak quiz canlı sonucu: süre dolana kadar cevap sayısı,
 * dolunca doğru cevap + en sık yazılan cevaplar (✓/✗ rozetli).
 */
export default function QuizTypeResult({
  slide,
  responses,
}: {
  slide: Slide;
  responses: ResponseDoc[];
}) {
  const timeLimit = slide.settings?.timeLimit ?? 30;
  const startedMs = slide.quizStartedAt?.toMillis() ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = startedMs ? Math.max(0, startedMs + timeLimit * 1000 - now) : null;
  const revealed = remaining !== null && remaining <= 0;
  const total = responses.length;

  // Aynı (normalize) cevapları grupla, sıklığa göre sırala
  const groups = new Map<string, { label: string; count: number; correct: boolean }>();
  responses.forEach((r) => {
    if (!Array.isArray(r.value) || typeof r.value[0] !== "string") return;
    const key = normalizeAnswer(r.value[0]);
    if (!key) return;
    const g = groups.get(key) ?? {
      label: r.value[0],
      count: 0,
      correct: isTypedAnswerCorrect(r.value[0], slide.options),
    };
    g.count += 1;
    groups.set(key, g);
  });
  const rows = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const correctCount = revealed
    ? responses.filter(
        (r) => Array.isArray(r.value) && typeof r.value[0] === "string" && isTypedAnswerCorrect(r.value[0], slide.options)
      ).length
    : 0;

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

      {!revealed ? (
        <div className="text-center py-10">
          <p className="text-5xl mb-3" aria-hidden>✍️</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{total} cevap geldi</p>
          <p className="text-muted mt-1">Süre dolunca cevaplar açıklanır.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-green-600/10 border border-green-600/30 px-5 py-4">
            <p className="text-sm font-bold text-green-700 mb-0.5">✓ Doğru cevap</p>
            <p className="font-display text-2xl font-semibold">{slide.options.join(" / ")}</p>
          </div>
          {rows.map((row, i) => (
            <div key={i} className={row.correct ? "" : "opacity-70"}>
              <div className="flex items-baseline justify-between gap-4 mb-1.5">
                <span className={`truncate text-lg ${row.correct ? "font-bold" : "font-medium"}`}>
                  {row.label}{" "}
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] text-white align-middle ${
                      row.correct ? "bg-green-600" : "bg-rose-400"
                    }`}
                    aria-label={row.correct ? "doğru" : "yanlış"}
                  >
                    {row.correct ? "✓" : "✕"}
                  </span>
                </span>
                <span className={`shrink-0 tabular-nums ${row.correct ? "font-bold" : "text-muted"}`}>
                  {row.count}
                </span>
              </div>
              <div className="h-7 bg-line/50 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-r-lg transition-[width] duration-700 ease-out"
                  style={{
                    width: `${(row.count / max) * 100}%`,
                    minWidth: row.count > 0 ? "10px" : "0",
                    background: row.correct ? "var(--series-2)" : "var(--series-3)",
                  }}
                />
              </div>
            </div>
          ))}
        </>
      )}
      <p className="text-muted text-sm font-semibold tabular-nums">
        {total} cevap{revealed ? ` · ${correctCount} doğru` : ""}
      </p>
    </div>
  );
}
