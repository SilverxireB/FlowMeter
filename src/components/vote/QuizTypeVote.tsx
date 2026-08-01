"use client";

import { FormEvent, useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/**
 * Yazarak quiz (Menti "Type Answer"): süre içinde cevabı yaz.
 * value = [yazılanCevap, geçenMs]. Doğruluk sunum tarafında
 * kabul edilen cevap listesine (options) göre değerlendirilir.
 */
export default function QuizTypeVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const timeLimit = slide.settings?.timeLimit ?? 30;
  const startedMs = slide.quizStartedAt?.toMillis() ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (!startedMs) {
    return (
      <div className="card text-center py-12 px-6">
        <p className="text-5xl mb-4 animate-pulse" aria-hidden>✍️</p>
        <p className="text-xl font-bold">{t("Quiz başlamak üzere…", "Quiz is about to start…")}</p>
      </div>
    );
  }

  const remaining = Math.max(0, startedMs + timeLimit * 1000 - now);
  const pct = (remaining / (timeLimit * 1000)) * 100;

  if (remaining <= 0) {
    return (
      <div className="card text-center py-12 px-6">
        <p className="text-5xl mb-4" aria-hidden>⏰</p>
        <p className="text-xl font-bold">{t("Süre doldu!", "Time's up!")}</p>
        <p className="text-muted mt-1">{t("Sonuçlar ekranda açıklanıyor.", "Results are being revealed on the big screen.")}</p>
      </div>
    );
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim().slice(0, 60);
    if (!clean || sending) return;
    // Gönderim anında süre bitmiş olabilir — gönderme (asıl kilit rules'ta).
    if (Date.now() >= startedMs! + timeLimit * 1000) return;
    setSending(true);
    try {
      const answer = [clean, Date.now() - startedMs!];
      await submitResponse(presentationId, slide.id, answer);
      localStorage.setItem(`flowmeter.quizAnswer.${slide.id}`, JSON.stringify(answer));
      onVoted();
    } catch {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
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

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={60}
        autoFocus
        placeholder={t("Cevabını yaz…", "Type your answer…")}
        className="input-base text-lg font-semibold"
      />
      <button type="submit" disabled={!text.trim() || sending} className="btn-accent py-4">
        {t("Gönder →", "Send →")}
      </button>
      <p className="text-muted text-xs text-center">{t("Hızlı cevap = daha çok puan · yazım küçük/büyük harfe duyarsız", "Faster answers = more points · spelling is case-insensitive")}</p>
    </form>
  );
}
