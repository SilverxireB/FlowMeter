"use client";

import { useState } from "react";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

const MIN = 1;
const MAX = 5;

/** Her ifade (options[i]) için 1–5 arası puan; tek seferde gönderilir. */
export default function ScalesVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const [ratings, setRatings] = useState<number[]>(() => slide.options.map(() => 3));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vote() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await submitResponse(presentationId, slide.id, ratings);
      onVoted();
    } catch {
      setError("Gönderilemedi, tekrar dene.");
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {slide.options.map((statement, i) => (
        <div key={i} className="bg-white rounded-xl border-2 border-slate-200 p-4">
          <p className="font-medium mb-3">{statement}</p>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={1}
            value={ratings[i]}
            onChange={(e) =>
              setRatings(ratings.map((r, j) => (j === i ? Number(e.target.value) : r)))
            }
            className="w-full accent-[#2d6ff7]"
            aria-label={`${statement} puanı`}
          />
          <div className="flex justify-between text-sm text-slate-400 mt-1">
            <span>{MIN}</span>
            <span className="font-semibold text-brand-blue text-lg tabular-nums">
              {ratings[i]}
            </span>
            <span>{MAX}</span>
          </div>
        </div>
      ))}
      <button
        onClick={vote}
        disabled={sending || slide.options.length === 0}
        className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-xl py-4"
      >
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
