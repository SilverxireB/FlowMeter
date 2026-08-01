"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/** Seçenekleri yukarı/aşağı butonlarıyla sırala; value = sıralı index dizisi. */
export default function RankingVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  // order[i] = i. sırada duran seçeneğin options içindeki index'i
  const [order, setOrder] = useState<number[]>(() => slide.options.map((_, i) => i));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move(pos: number, dir: -1 | 1) {
    const next = [...order];
    const target = pos + dir;
    if (target < 0 || target >= next.length) return;
    [next[pos], next[target]] = [next[target], next[pos]];
    setOrder(next);
  }

  async function vote() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await submitResponse(presentationId, slide.id, order);
      onVoted();
    } catch {
      setError(t("Gönderilemedi, tekrar dene.", "Couldn't send, try again."));
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-sm">{t("En önemliyi en üste taşı:", "Move the most important to the top:")}</p>
      {order.map((optionIndex, pos) => (
        <div
          key={optionIndex}
          className="flex items-center gap-3 bg-white rounded-2xl border-2 border-line px-4 py-3 shadow-sm"
        >
          <span className="text-muted font-semibold tabular-nums w-6">{pos + 1}.</span>
          <span className="flex-1 font-medium">{slide.options[optionIndex]}</span>
          <div className="flex gap-1">
            <button
              onClick={() => move(pos, -1)}
              disabled={pos === 0}
              className="w-9 h-9 rounded-lg border border-line hover:bg-paper disabled:opacity-30"
              aria-label={`${slide.options[optionIndex]} ${t("yukarı taşı", "move up")}`}
            >
              ↑
            </button>
            <button
              onClick={() => move(pos, 1)}
              disabled={pos === order.length - 1}
              className="w-9 h-9 rounded-lg border border-line hover:bg-paper disabled:opacity-30"
              aria-label={`${slide.options[optionIndex]} ${t("aşağı taşı", "move down")}`}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={vote}
        disabled={sending || order.length === 0}
        className="btn-accent mt-2 w-full py-4"
      >
        {sending ? t("Gönderiliyor…", "Sending…") : t("Sıralamayı gönder", "Send ranking")}
      </button>
      {error && <p className="text-brand text-sm text-center">{error}</p>}
    </div>
  );
}
