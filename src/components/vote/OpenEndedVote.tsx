"use client";

import { FormEvent, useState } from "react";
import { t } from "@/lib/i18n";
import { getVoteCount, submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

export default function OpenEndedVote({
  presentationId,
  slide,
  onDone,
  moderated,
}: {
  presentationId: string;
  slide: Slide;
  onDone: () => void;
  /** Açık metin moderasyonu açık: cevap pending yazılır, perdeye onayla düşer */
  moderated?: boolean;
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
      await submitResponse(presentationId, slide.id, clean.slice(0, 250), { pending: moderated });
      const next = sent + 1;
      setSent(next);
      setText("");
      if (next >= maxEntries) onDone();
    } catch {
      setError(t("Gönderilemedi, tekrar dene.", "Couldn't send, try again."));
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
        placeholder={t("Cevabını yaz…", "Type your answer…")}
        className="input-base text-lg resize-none"
      />
      <div className="flex justify-between text-sm text-muted">
        <span>{text.length}/250</span>
        {maxEntries > 1 && (
          <span>
            {remaining > 0
              ? `${remaining} ${t("hakkın kaldı", remaining === 1 ? "entry left" : "entries left")}`
              : t("Hakların bitti", "No entries left")}
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={!text.trim() || sending || remaining <= 0}
        className="btn-accent w-full py-4"
      >
        {sending ? t("Gönderiliyor…", "Sending…") : t("Gönder", "Send")}
      </button>
      {error && <p className="text-brand text-sm text-center">{error}</p>}
    </form>
  );
}
