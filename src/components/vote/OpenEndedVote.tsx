"use client";

import { FormEvent, useState } from "react";
import { getVoteCount, submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

export default function OpenEndedVote({
  presentationId,
  slide,
  onDone,
}: {
  presentationId: string;
  slide: Slide;
  onDone: () => void;
}) {
  const maxEntries = slide.settings?.maxEntries ?? 1;
  const [text, setText] = useState("");
  const [sent, setSent] = useState(() => getVoteCount(slide.id));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = maxEntries - sent;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending || remaining <= 0) return;
    setSending(true);
    setError(null);
    try {
      await submitResponse(presentationId, slide.id, clean.slice(0, 250));
      const next = sent + 1;
      setSent(next);
      setText("");
      if (next >= maxEntries) onDone();
    } catch {
      setError("Gönderilemedi, tekrar dene.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={250}
        rows={4}
        placeholder="Cevabını yaz…"
        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg resize-none focus:outline-none focus:border-brand-blue"
      />
      <div className="flex justify-between text-sm text-slate-400">
        <span>{text.length}/250</span>
        {maxEntries > 1 && (
          <span>{remaining > 0 ? `${remaining} hakkın kaldı` : "Hakların bitti"}</span>
        )}
      </div>
      <button
        type="submit"
        disabled={!text.trim() || sending || remaining <= 0}
        className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-xl py-4"
      >
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </form>
  );
}
