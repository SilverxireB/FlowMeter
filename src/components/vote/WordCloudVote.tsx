"use client";

import { FormEvent, useState } from "react";
import { getVoteCount, submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

export default function WordCloudVote({
  presentationId,
  slide,
  onDone,
}: {
  presentationId: string;
  slide: Slide;
  onDone: () => void;
}) {
  const maxEntries = slide.settings?.maxEntries ?? 3;
  const [word, setWord] = useState("");
  const [sent, setSent] = useState(() => getVoteCount(slide.id));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = maxEntries - sent;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = word.trim().toLocaleLowerCase("tr");
    if (!clean || sending || remaining <= 0) return;
    setSending(true);
    setError(null);
    try {
      await submitResponse(presentationId, slide.id, clean.slice(0, 30));
      const next = sent + 1;
      setSent(next);
      setWord("");
      if (next >= maxEntries) onDone();
    } catch {
      setError("Gönderilemedi, tekrar dene.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        maxLength={30}
        placeholder="Bir kelime yaz…"
        className="w-full rounded-xl border-2 border-slate-200 px-4 py-4 text-lg focus:outline-none focus:border-brand-blue"
      />
      <button
        type="submit"
        disabled={!word.trim() || sending || remaining <= 0}
        className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-xl py-4"
      >
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
      <p className="text-slate-500 text-sm text-center">
        {remaining > 0 ? `${remaining} hakkın kaldı` : "Tüm hakların kullanıldı"}
      </p>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </form>
  );
}
