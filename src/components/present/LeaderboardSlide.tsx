"use client";

import { useCallback, useEffect, useState } from "react";
import BarRace from "@/components/present/BarRace";
import Podium from "@/components/present/Podium";
import { computeQuizScores, ScoreRow } from "@/lib/quizScores";
import { Participant, Slide } from "@/lib/types";

/**
 * "Skor Tablosu" slayt tipi — sunuma eklenip (genelde sona) açıldığında
 * podyumu/sıralamayı slayt içinde gösterir. Açılışta hesaplar, ↻ ile güncellenir.
 */
export default function LeaderboardSlide({
  presentationId,
  slides,
  participants,
}: {
  presentationId: string;
  slides: Slide[];
  participants: Participant[];
}) {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [view, setView] = useState<"podium" | "bars">("podium");

  const compute = useCallback(async () => {
    setRows(await computeQuizScores(presentationId, slides));
  }, [presentationId, slides]);

  useEffect(() => {
    compute();
  }, [compute]);

  if (rows === null) {
    return <p className="text-muted text-center py-12 animate-pulse">Hesaplanıyor…</p>;
  }

  return (
    <div>
      <div className="flex justify-center mb-5">
        <div className="flex gap-1 p-1 bg-paper rounded-full border border-line">
          {([["podium", "🏆 Podyum"], ["bars", "📊 Sıralama"]] as const).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                view === v ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      {view === "podium" ? (
        <Podium rows={rows} participants={participants} />
      ) : (
        <BarRace rows={rows} participants={participants} />
      )}
      <div className="text-center mt-6">
        <button onClick={compute} className="btn-ghost !py-1.5 !px-4 text-sm">↻ Güncelle</button>
      </div>
    </div>
  );
}
