"use client";

import { useState } from "react";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

const SERIES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export default function MultipleChoiceVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vote() {
    if (selected === null || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitResponse(presentationId, slide.id, selected);
      onVoted();
    } catch {
      setError("Oy gönderilemedi, tekrar dene.");
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {slide.options.map((option, i) => (
        <button
          key={i}
          onClick={() => setSelected(i)}
          className={`w-full text-left px-4 py-4 rounded-xl border-2 font-medium transition-colors ${
            selected === i
              ? "border-brand-blue bg-brand-sky"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <span
            aria-hidden
            className="inline-block w-3 h-3 rounded-full mr-3"
            style={{ background: `var(--series-${SERIES[i % 8]})` }}
          />
          {option}
        </button>
      ))}
      <button
        onClick={vote}
        disabled={selected === null || sending}
        className="mt-2 w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-xl py-4"
      >
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
