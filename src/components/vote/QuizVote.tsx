"use client";

import { useEffect, useState } from "react";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/**
 * Quiz: tek dokunuşla cevap (Menti tarzı). Hız puana yansır —
 * value = [seçenekIndex, geçenMs]. Geri sayım quizStartedAt'ten hesaplanır.
 */
export default function QuizVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const timeLimit = slide.settings?.timeLimit ?? 20;
  const startedMs = slide.quizStartedAt?.toMillis() ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (!startedMs) {
    return (
      <div className="card text-center py-12 px-6">
        <p className="text-5xl mb-4 animate-pulse" aria-hidden>⚡</p>
        <p className="text-xl font-bold">Quiz başlamak üzere…</p>
      </div>
    );
  }

  const remaining = Math.max(0, startedMs + timeLimit * 1000 - now);
  const pct = (remaining / (timeLimit * 1000)) * 100;

  if (remaining <= 0) {
    return (
      <div className="card text-center py-12 px-6">
        <p className="text-5xl mb-4" aria-hidden>⏰</p>
        <p className="text-xl font-bold">Süre doldu!</p>
        <p className="text-muted mt-1">Sonuçlar ekranda açıklanıyor.</p>
      </div>
    );
  }

  async function pick(i: number) {
    if (sending) return;
    setSending(true);
    try {
      const answer = [i, Date.now() - startedMs!];
      await submitResponse(presentationId, slide.id, answer);
      localStorage.setItem(`flowmeter.quizAnswer.${slide.id}`, JSON.stringify(answer));
      onVoted();
    } catch {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Geri sayım çubuğu */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2.5 bg-line/50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-display font-semibold text-brand text-xl tabular-nums w-10 text-right">
          {Math.ceil(remaining / 1000)}
        </span>
      </div>

      {slide.options.map((option, i) => (
        <button
          key={i}
          onClick={() => pick(i)}
          disabled={sending}
          className="w-full text-left px-4 py-4 rounded-2xl border-2 border-line bg-white font-semibold cursor-pointer shadow-sm transition-all duration-150 hover:border-accent hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
        >
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-sm font-bold mr-3"
            style={{ background: `var(--series-${(i % 8) + 1})` }}
          >
            {String.fromCharCode(65 + i)}
          </span>
          {option}
        </button>
      ))}
      <p className="text-muted text-xs text-center">Hızlı cevap = daha çok puan · üst üste doğrular 🔥 seri bonusu</p>
    </div>
  );
}
