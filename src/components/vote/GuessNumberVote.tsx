"use client";

import { FormEvent, useState } from "react";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/** Sayı tahmini: sınırlar içinde bir sayı gönder. value = number. */
export default function GuessNumberVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const min = slide.settings?.min ?? 0;
  const max = slide.settings?.max ?? 100;
  const unit = slide.settings?.unit ?? "";
  const [value, setValue] = useState<string>("");
  const [sending, setSending] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (value === "" || Number.isNaN(n) || sending) return;
    setSending(true);
    try {
      await submitResponse(presentationId, slide.id, Math.min(max, Math.max(min, n)));
      onVoted();
    } catch {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        placeholder={`${min} – ${max}`}
        className="input-base text-center text-3xl font-display font-semibold tabular-nums"
      />
      {unit && <p className="text-center text-muted font-semibold -mt-2">{unit}</p>}
      <input
        type="range"
        min={min}
        max={max}
        value={value === "" ? Math.round((min + max) / 2) : Number(value)}
        onChange={(e) => setValue(e.target.value)}
        className="accent-[#2563eb]"
      />
      <button type="submit" disabled={value === "" || sending} className="btn-accent py-4">
        Tahminini gönder →
      </button>
    </form>
  );
}
