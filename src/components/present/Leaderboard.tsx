"use client";

import { collection, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { db } from "@/lib/firebase";
import { Participant, Slide } from "@/lib/types";

interface Row {
  voterId: string;
  points: number;
  correct: number;
}

/**
 * Skor tablosu: tüm quiz slaytlarının cevaplarından puan hesaplar.
 * Doğru cevap = 500 taban + hıza göre 500'e kadar bonus.
 */
export default function Leaderboard({
  presentationId,
  slides,
  participants,
  onClose,
}: {
  presentationId: string;
  slides: Slide[];
  participants: Participant[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const compute = useCallback(async () => {
    const quizSlides = slides.filter((s) => s.type === "quiz");
    const scores = new Map<string, Row>();
    for (const s of quizSlides) {
      const timeLimitMs = (s.settings?.timeLimit ?? 20) * 1000;
      const correctIndex = s.settings?.correctIndex ?? 0;
      const snap = await getDocs(
        collection(db(), "presentations", presentationId, "slides", s.id, "responses")
      );
      snap.docs.forEach((d) => {
        const { voterId, value } = d.data() as { voterId: string; value: unknown };
        if (!Array.isArray(value) || value[0] !== correctIndex) return;
        const elapsed = typeof value[1] === "number" ? value[1] : timeLimitMs;
        const points = 500 + Math.round(500 * Math.max(0, 1 - elapsed / timeLimitMs));
        const row = scores.get(voterId) ?? { voterId, points: 0, correct: 0 };
        row.points += points;
        row.correct += 1;
        scores.set(voterId, row);
      });
    }
    setRows([...scores.values()].sort((a, b) => b.points - a.points).slice(0, 10));
  }, [presentationId, slides]);

  useEffect(() => {
    compute();
  }, [compute]);

  const byVoter = new Map(participants.map((p) => [p.id, p]));
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-8 max-h-[85vh] overflow-y-auto animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl font-semibold">🏆 Skor Tablosu</h2>
          <button onClick={onClose} className="btn-ghost !px-3 !py-1.5 text-sm">Kapat</button>
        </div>

        {rows === null ? (
          <p className="text-muted text-center py-8 animate-pulse">Hesaplanıyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted text-center py-8">Henüz doğru cevap yok.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((row, i) => {
              const p = byVoter.get(row.voterId);
              return (
                <li
                  key={row.voterId}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                    i === 0 ? "bg-brand-soft" : i < 3 ? "bg-paper" : ""
                  }`}
                >
                  <span className="w-8 text-xl font-display font-semibold tabular-nums shrink-0">
                    {medals[i] ?? `${i + 1}.`}
                  </span>
                  {p?.avatarSeed ? (
                    <Avatar seed={p.avatarSeed} size={i === 0 ? 44 : 34} />
                  ) : (
                    <span className="text-2xl" aria-hidden>{p?.emoji ?? "😀"}</span>
                  )}
                  <span className={`flex-1 truncate ${i === 0 ? "font-bold text-lg" : "font-semibold"}`}>
                    {p?.nickname ?? "Anonim"}
                  </span>
                  <span className="text-muted text-xs shrink-0">{row.correct} doğru</span>
                  <span className={`tabular-nums shrink-0 font-display font-semibold ${i === 0 ? "text-brand text-xl" : ""}`}>
                    {row.points}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <button onClick={compute} className="btn-ghost w-full mt-6 !py-2 text-sm">
          ↻ Güncelle
        </button>
      </div>
    </div>
  );
}
