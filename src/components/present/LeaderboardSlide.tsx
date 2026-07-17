"use client";

import { useCallback, useEffect, useState } from "react";
import BarRace from "@/components/present/BarRace";
import Podium from "@/components/present/Podium";
import Spotlight from "@/components/present/Spotlight";
import { computeQuizScores, ScoreRow } from "@/lib/quizScores";
import { Participant, Slide } from "@/lib/types";

/**
 * "Skor Tablosu" slayt tipi. Konuma göre otomatik davranır:
 * - final=false (sunum arası): doğrudan Sıralama (bar-race) verir.
 * - final=true (son quiz'den sonra): spotlight + Podyum ile heyecanlı final.
 * Sunucu istediğinde görünümü elle değiştirebilir.
 */
export default function LeaderboardSlide({
  presentationId,
  slides,
  participants,
  sessionId,
  final = false,
}: {
  presentationId: string;
  slides: Slide[];
  participants: Participant[];
  sessionId?: string;
  final?: boolean;
}) {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [view, setView] = useState<"podium" | "bars">(final ? "podium" : "bars");
  // Final podyumdan önce spotlight (heyecan); ara sıralamada spotlight yok
  const [reveal, setReveal] = useState(!final);

  const compute = useCallback(async () => {
    setRows(await computeQuizScores(presentationId, slides, sessionId));
  }, [presentationId, slides, sessionId]);

  useEffect(() => {
    compute();
  }, [compute]);

  if (rows === null) {
    return <p className="text-muted text-center py-12 animate-pulse">Hesaplanıyor…</p>;
  }

  return (
    <div className="relative">
      {final && !reveal && (
        <Spotlight rows={rows} participants={participants} onDone={() => setReveal(true)} />
      )}
      <div className={final && !reveal ? "opacity-0" : "animate-pop"}>
        <div className="flex justify-center mb-5">
          <div className="flex gap-1 p-1 bg-paper rounded-full border border-line">
            {([["podium", "Podyum"], ["bars", "Sıralama"]] as const).map(([v, lbl]) => (
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
          <button onClick={compute} className="btn-ghost !py-1.5 !px-4 text-sm">Güncelle</button>
        </div>
      </div>
    </div>
  );
}
