"use client";

import { useCallback, useEffect, useState } from "react";
import BarRace from "@/components/present/BarRace";
import Podium from "@/components/present/Podium";
import Spotlight from "@/components/present/Spotlight";
import { computeQuizScores, ScoreRow } from "@/lib/quizScores";
import { Participant, Slide } from "@/lib/types";

/**
 * Skor tablosu modalı: açılışta spotlight (en çok puan kazanan), sonra
 * Podyum (ilk 3 kürsü + arka liste) veya Sıralama (bar-race) görünümü.
 * Puan formülü src/lib/quizScores.ts'te (Menti formülü + seri bonusu).
 */
export default function Leaderboard({
  presentationId,
  slides,
  participants,
  sessionId,
  onClose,
}: {
  presentationId: string;
  slides: Slide[];
  participants: Participant[];
  sessionId?: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [view, setView] = useState<"podium" | "bars">("podium");
  const [spotlightDone, setSpotlightDone] = useState(false);

  const compute = useCallback(async () => {
    setRows(await computeQuizScores(presentationId, slides, sessionId));
  }, [presentationId, slides, sessionId]);

  useEffect(() => {
    compute();
  }, [compute]);

  const confetti = rows && rows.length > 0
    ? Array.from({ length: 60 }, (_, i) => ({
        left: (i * 137.5) % 100,
        delay: (i % 12) * 0.18,
        duration: 2.6 + (i % 5) * 0.5,
        color: `var(--series-${(i % 8) + 1})`,
      }))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      {/* 🎊 Konfeti */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {confetti.map((c, i) => (
          <span
            key={i}
            className="absolute top-0 w-2.5 h-2.5 rounded-sm animate-confetti"
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>
      <div
        className="card relative w-full max-w-2xl p-8 max-h-[85vh] overflow-y-auto animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Açılış spotlight'ı */}
        {rows && !spotlightDone && (
          <Spotlight rows={rows} participants={participants} onDone={() => setSpotlightDone(true)} />
        )}

        <div className={spotlightDone ? "" : "opacity-0"}>
          <div className="flex items-center justify-between mb-6 gap-3">
            <h2 className="font-display text-3xl font-semibold">🏆 Skor Tablosu</h2>
            <div className="flex items-center gap-2">
              {/* Görünüm geçişi */}
              <div className="flex gap-1 p-1 bg-paper rounded-full border border-line">
                {([["podium", "🏆 Podyum"], ["bars", "📊 Sıralama"]] as const).map(([v, lbl]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      view === v ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <button onClick={onClose} className="btn-ghost !px-3 !py-1.5 text-sm">Kapat</button>
            </div>
          </div>

          {rows === null ? (
            <p className="text-muted text-center py-8 animate-pulse">Hesaplanıyor…</p>
          ) : view === "podium" ? (
            <Podium rows={rows} participants={participants} />
          ) : (
            <BarRace rows={rows} participants={participants} />
          )}

          <button onClick={compute} className="btn-ghost w-full mt-6 !py-2 text-sm">
            ↻ Güncelle
          </button>
          <p className="text-muted text-xs text-center mt-3">
            Puan: hıza göre 500–1000 · üst üste doğrularda 🔥 seri bonusu (+50/soru, max +250)
          </p>
        </div>
      </div>
    </div>
  );
}
