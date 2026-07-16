"use client";

import { useState } from "react";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/**
 * Görselde işaretleme (Menti "Pin on Image"): görsele dokun → pin düşer →
 * onayla. value = [x, y] (0–1 normalize koordinat).
 */
export default function PinOnImageVote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [sending, setSending] = useState(false);
  const image = slide.settings?.image;

  if (!image) {
    return (
      <div className="card text-center py-12 px-6">
        <p className="text-5xl mb-4" aria-hidden>📍</p>
        <p className="text-muted">Bu slayta henüz görsel eklenmemiş.</p>
      </div>
    );
  }

  function place(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPin([x, y]);
  }

  async function send() {
    if (!pin || sending) return;
    setSending(true);
    try {
      await submitResponse(presentationId, slide.id, [pin[0], pin[1]]);
      onVoted();
    } catch {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onClick={place}
        className="relative rounded-2xl overflow-hidden border-2 border-line cursor-crosshair select-none touch-manipulation"
        role="button"
        aria-label="İşaretlemek için görsele dokun"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={slide.question} className="w-full h-auto block" draggable={false} />
        {pin && (
          <span
            className="absolute -translate-x-1/2 -translate-y-full text-3xl drop-shadow animate-pop"
            style={{ left: `${pin[0] * 100}%`, top: `${pin[1] * 100}%` }}
            aria-hidden
          >
            📍
          </span>
        )}
      </div>
      <p className="text-muted text-sm text-center">
        {pin ? "Pini taşımak için başka bir yere dokun." : "İşaretlemek istediğin yere dokun."}
      </p>
      <button onClick={send} disabled={!pin || sending} className="btn-accent py-4">
        {sending ? "Gönderiliyor…" : "İşareti gönder →"}
      </button>
    </div>
  );
}
