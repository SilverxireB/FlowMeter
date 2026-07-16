"use client";

import { useState } from "react";
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
      setError("Gönderilemedi, tekrar dene.");
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-500 text-sm">En önemliyi en üste taşı:</p>
      {order.map((optionIndex, pos) => (
        <div
          key={optionIndex}
          className="flex items-center gap-3 bg-white rounded-xl border-2 border-slate-200 px-4 py-3"
        >
          <span className="text-slate-400 font-semibold tabular-nums w-6">{pos + 1}.</span>
          <span className="flex-1 font-medium">{slide.options[optionIndex]}</span>
          <div className="flex gap-1">
            <button
              onClick={() => move(pos, -1)}
              disabled={pos === 0}
              className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
              aria-label={`${slide.options[optionIndex]} yukarı taşı`}
            >
              ↑
            </button>
            <button
              onClick={() => move(pos, 1)}
              disabled={pos === order.length - 1}
              className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
              aria-label={`${slide.options[optionIndex]} aşağı taşı`}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={vote}
        disabled={sending || order.length === 0}
        className="mt-2 w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-xl py-4"
      >
        {sending ? "Gönderiliyor…" : "Sıralamayı gönder"}
      </button>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
