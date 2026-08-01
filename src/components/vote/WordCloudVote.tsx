"use client";

import { FormEvent, useState } from "react";
import { t } from "@/lib/i18n";
import { getVoteCount, submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

export default function WordCloudVote({
  presentationId,
  slide,
  onDone,
  moderated,
}: {
  presentationId: string;
  slide: Slide;
  onDone: () => void;
  /** Açık metin moderasyonu açık: kelime pending yazılır, perdeye onayla düşer */
  moderated?: boolean;
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
      await submitResponse(presentationId, slide.id, clean.slice(0, 30), { pending: moderated });
      const next = sent + 1;
      setSent(next);
      setWord("");
      if (next >= maxEntries) onDone();
    } catch {
      setError(t("Gönderilemedi, tekrar dene.", "Couldn't send, try again."));
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
        placeholder={t("Bir kelime yaz…", "Type a word…")}
        className="input-base text-lg py-4"
      />
      <button
        type="submit"
        disabled={!word.trim() || sending || remaining <= 0}
        className="btn-accent w-full py-4"
      >
        {sending ? t("Gönderiliyor…", "Sending…") : t("Gönder", "Send")}
      </button>
      <p className="text-muted text-sm text-center">
        {remaining > 0
          ? `${remaining} ${t("hakkın kaldı", remaining === 1 ? "entry left" : "entries left")}`
          : t("Tüm hakların kullanıldı", "You've used all your entries")}
      </p>
      {error && <p className="text-brand text-sm text-center">{error}</p>}
    </form>
  );
}
