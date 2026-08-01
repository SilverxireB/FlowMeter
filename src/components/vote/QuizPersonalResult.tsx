"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
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
        <p className="text-xl font-bold">{t("Cevabın alındı!", "Answer received!")}</p>
        <p className="text-muted mt-1">{t("Süre dolunca sonucunu göreceksin.", "You'll see your result when time is up.")}</p>
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
  // Puanlama moduna göre — seri bonusu skor tablosunda eklenir
  const points = correct
    ? slide.settings?.scoreMode === "fixed"
      ? 1000
      : Math.round(1000 * (1 - Math.min(1, Math.max(0, elapsed / (timeLimit * 1000))) / 2))
    : 0;

  return (
    <div className="card text-center py-12 px-6 animate-pop">
      <p className="text-6xl mb-4" aria-hidden>{correct ? "🎉" : "😅"}</p>
      <p className="text-2xl font-bold mb-1">{correct ? t("Doğru!", "Correct!") : t("Yanlış", "Wrong")}</p>
      {correct ? (
        <>
          <p className="font-display text-4xl font-semibold text-brand mt-2">+{points} {t("puan", "points")}</p>
          <p className="text-muted text-xs mt-2">{t("Seri bonusun 🔥 skor tablosuna eklenir", "Your streak bonus 🔥 is added on the leaderboard")}</p>
        </>
      ) : (
        <p className="text-muted mt-1">
          {t("Doğru cevap", "Correct answer")}: <span className="font-bold text-ink">{correctLabel}</span>
        </p>
      )}
      <p className="text-muted text-sm mt-4 tabular-nums">
        {t("Cevap süren", "Your answer time")}: {(elapsed / 1000).toFixed(1)} {t("sn", "s")}
      </p>
    </div>
  );
}
