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
          className={`w-full text-left px-4 py-4 rounded-2xl border-2 font-semibold cursor-pointer transition-all duration-200 active:scale-[0.98] ${
            selected === i
              ? "border-accent bg-accent-soft/50 shadow-md shadow-accent/10"
              : "border-line bg-white hover:border-muted shadow-sm"
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
        className="btn-accent mt-2 w-full py-4"
      >
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
      {error && <p className="text-brand text-sm text-center">{error}</p>}
    </div>
  );
}
