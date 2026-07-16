"use client";

import { FormEvent, useState } from "react";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/** Sayı tahmini: tek sayı gönderilir (value = number). */
export default function GuessNumberVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitResponse(presentationId, slide.id, n);
      onVoted();
    } catch {
      setError("Gönderilemedi, tekrar dene.");
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        placeholder="Tahminini yaz…"
        className="input-base text-center text-3xl font-bold py-5 tabular-nums"
      />
      <button type="submit" disabled={!value.trim() || sending} className="btn-accent py-4">
        {sending ? "Gönderiliyor…" : "Tahmini gönder"}
      </button>
      {error && <p className="text-brand text-sm text-center">{error}</p>}
    </form>
  );
}
