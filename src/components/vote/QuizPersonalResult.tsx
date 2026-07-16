"use client";

import { useEffect, useState } from "react";
import { isTypedAnswerCorrect } from "@/lib/quizScores";
import { Slide } from "@/lib/types";

/**
 * İzleyicinin kendi quiz sonucu: süre dolana kadar "cevabın alındı",
 * dolunca doğru/yanlış + kazanılan puan (sunumdaki reveal ile eş zamanlı).
 * quiz (seçmeli) ve quiz-type (yazarak) için ortak.
 */
export default function QuizPersonalResult({ slide }: { slide: Slide }) {
  const timeLimit = slide.settings?.timeLimit ?? 20;
  const correctIndex = slide.settings?.correctIndex ?? 0;
  const startedMs = slide.quizStartedAt?.toMillis() ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [answer, setAnswer] = useState<[number | string, number] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`flowmeter.quizAnswer.${slide.id}`);
      if (raw) setAnswer(JSON.parse(raw));
    } catch {
      setAnswer(null);
    }
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, [slide.id]);

  const revealed = startedMs !== null && now > startedMs + timeLimit * 1000;

  if (!revealed || !answer) {
    return (
      <div className="card text-center py-12 px-6">
        <p className="text-5xl mb-4" aria-hidden>🤞</p>
        <p className="text-xl font-bold">Cevabın alındı!</p>
        <p className="text-muted mt-1">Süre dolunca sonucunu göreceksin.</p>
      </div>
    );
  }

  const [picked, elapsed] = answer;
  const correct =
    slide.type === "quiz-type"
      ? typeof picked === "string" && isTypedAnswerCorrect(picked, slide.options)
      : picked === correctIndex;
  const correctLabel =
    slide.type === "quiz-type" ? slide.options.join(" / ") : slide.options[correctIndex];
  // Menti formülü: 1000 × (1 − (t/T)/2) — seri bonusu skor tablosunda eklenir
  const points = correct
    ? Math.round(1000 * (1 - Math.min(1, Math.max(0, elapsed / (timeLimit * 1000))) / 2))
    : 0;

  return (
    <div className="card text-center py-12 px-6 animate-pop">
      <p className="text-6xl mb-4" aria-hidden>{correct ? "🎉" : "😅"}</p>
      <p className="text-2xl font-bold mb-1">{correct ? "Doğru!" : "Yanlış"}</p>
      {correct ? (
        <>
          <p className="font-display text-4xl font-semibold text-brand mt-2">+{points} puan</p>
          <p className="text-muted text-xs mt-2">Seri bonusun 🔥 skor tablosuna eklenir</p>
        </>
      ) : (
        <p className="text-muted mt-1">
          Doğru cevap: <span className="font-bold text-ink">{correctLabel}</span>
        </p>
      )}
      <p className="text-muted text-sm mt-4 tabular-nums">
        Cevap süren: {(elapsed / 1000).toFixed(1)} sn
      </p>
    </div>
  );
}
