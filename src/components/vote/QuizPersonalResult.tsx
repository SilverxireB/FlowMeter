"use client";

import { useEffect, useState } from "react";
import { Slide } from "@/lib/types";

/**
 * İzleyicinin kendi quiz sonucu: süre dolana kadar "cevabın alındı",
 * dolunca doğru/yanlış + kazanılan puan (sunumdaki reveal ile eş zamanlı).
 */
export default function QuizPersonalResult({ slide }: { slide: Slide }) {
  const timeLimit = slide.settings?.timeLimit ?? 20;
  const correctIndex = slide.settings?.correctIndex ?? 0;
  const startedMs = slide.quizStartedAt?.toMillis() ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [answer, setAnswer] = useState<[number, number] | null>(null);

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
  const correct = picked === correctIndex;
  const points = correct
    ? 500 + Math.round(500 * Math.max(0, 1 - elapsed / (timeLimit * 1000)))
    : 0;

  return (
    <div className="card text-center py-12 px-6 animate-pop">
      <p className="text-6xl mb-4" aria-hidden>{correct ? "🎉" : "😅"}</p>
      <p className="text-2xl font-bold mb-1">{correct ? "Doğru!" : "Yanlış"}</p>
      {correct ? (
        <p className="font-display text-4xl font-semibold text-brand mt-2">+{points} puan</p>
      ) : (
        <p className="text-muted mt-1">
          Doğru cevap: <span className="font-bold text-ink">{slide.options[correctIndex]}</span>
        </p>
      )}
      <p className="text-muted text-sm mt-4 tabular-nums">
        Cevap süren: {(elapsed / 1000).toFixed(1)} sn
      </p>
    </div>
  );
}
