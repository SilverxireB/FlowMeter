"use client";

import { useState } from "react";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/**
 * 100 Puan: izleyici 100 puanı seçenekler arasında dağıtır.
 * value = number[] (seçenek başına puan, toplam 100).
 */
export default function HundredPointsVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const [points, setPoints] = useState<number[]>(slide.options.map(() => 0));
  const [sending, setSending] = useState(false);
  const total = points.reduce((a, b) => a + b, 0);
  const remaining = 100 - total;

  function set(i: number, val: number) {
    const others = points.reduce((a, b, j) => (j === i ? a : a + b), 0);
    const clamped = Math.max(0, Math.min(100 - others, val));
    setPoints(points.map((p, j) => (j === i ? clamped : p)));
  }

  async function send() {
    if (total !== 100 || sending) return;
    setSending(true);
    try {
      await submitResponse(presentationId, slide.id, points);
      onVoted();
    } catch {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`text-center font-display text-lg font-semibold rounded-2xl py-2 ${
          remaining === 0 ? "bg-green-600/10 text-green-700" : "bg-paper text-ink"
        }`}
      >
        Kalan: <span className="tabular-nums">{remaining}</span> / 100
      </div>
      {slide.options.map((opt, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-2 min-w-0 font-semibold">
              <span
                aria-hidden
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: `var(--series-${(i % 8) + 1})` }}
              />
              <span className="truncate">{opt}</span>
            </span>
            <span className="tabular-nums font-display font-semibold w-10 text-right">{points[i]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={points[i]}
            onChange={(e) => set(i, Number(e.target.value))}
            className="w-full accent-[#2563eb]"
          />
        </div>
      ))}
      <button onClick={send} disabled={total !== 100 || sending} className="btn-accent py-4">
        {total === 100 ? "Gönder →" : `${remaining} puan daha dağıt`}
      </button>
    </div>
  );
}
