"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { submitResponse } from "@/lib/responses";
import { Slide } from "@/lib/types";

/** 2x2 Izgara: iki eksenli alanda bir nokta seç. value = [x, y] (0–1). */
export default function Grid2x2Vote({
  presentationId,
  slide,
  onVoted,
}: {
  presentationId: string;
  slide: Slide;
  onVoted: () => void;
}) {
  const [xLeft, xRight, yBottom, yTop] = slide.settings?.gridLabels ?? ["", "", "", ""];
  const [pt, setPt] = useState<[number, number] | null>(null);
  const [sending, setSending] = useState(false);

  function place(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPt([x, y]);
  }

  async function send() {
    if (!pt || sending) return;
    setSending(true);
    try {
      await submitResponse(presentationId, slide.id, [pt[0], pt[1]]);
      onVoted();
    } catch {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        {/* Üst / alt etiketleri */}
        <p className="text-center text-xs font-semibold text-muted mb-1 truncate">{yTop}</p>
        <div className="flex items-stretch gap-1">
          <span className="flex items-center text-xs font-semibold text-muted [writing-mode:vertical-rl] rotate-180 truncate max-h-40">
            {xLeft}
          </span>
          <div
            onClick={place}
            role="button"
            aria-label={t("Izgarada bir nokta seç", "Pick a point on the grid")}
            className="relative flex-1 aspect-square rounded-2xl border-2 border-line bg-paper cursor-crosshair select-none touch-manipulation overflow-hidden"
          >
            {/* Eksen çizgileri */}
            <span className="absolute left-1/2 top-0 bottom-0 w-px bg-line" aria-hidden />
            <span className="absolute top-1/2 left-0 right-0 h-px bg-line" aria-hidden />
            {pt && (
              <span
                className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent border-2 border-white shadow-lg animate-pop"
                style={{ left: `${pt[0] * 100}%`, top: `${pt[1] * 100}%` }}
                aria-hidden
              />
            )}
          </div>
          <span className="flex items-center text-xs font-semibold text-muted [writing-mode:vertical-rl] truncate max-h-40">
            {xRight}
          </span>
        </div>
        <p className="text-center text-xs font-semibold text-muted mt-1 truncate">{yBottom}</p>
      </div>
      <button onClick={send} disabled={!pt || sending} className="btn-accent py-4">
        {sending ? t("Gönderiliyor…", "Sending…") : t("İşareti gönder →", "Send pin →")}
      </button>
    </div>
  );
}
