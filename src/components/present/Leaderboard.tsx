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
  streak: number;
}

/**
 * Skor tablosu — Menti formülü + Kahoot usulü seri bonusu:
 * - Doğru cevap: 1000 × (1 − (geçen süre / toplam süre) / 2)
 *   → en hızlı ≈1000, son anda doğru ≈500
 * - Seri bonusu: üst üste 2. doğrudan itibaren +50/soru (en çok +250)
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
    const streaks = new Map<string, number>();

    // Slayt sırasına göre işle — seri bonusu ardışıklığa bağlı
    for (const s of quizSlides) {
      const timeLimitMs = (s.settings?.timeLimit ?? 20) * 1000;
      const correctIndex = s.settings?.correctIndex ?? 0;
      const snap = await getDocs(
        collection(db(), "presentations", presentationId, "slides", s.id, "responses")
      );
      const answeredCorrect = new Set<string>();
      snap.docs.forEach((d) => {
        const { voterId, value } = d.data() as { voterId: string; value: unknown };
        if (!Array.isArray(value)) return;
        if (value[0] !== correctIndex) {
          streaks.set(voterId, 0); // yanlış → seri sıfırlanır
          return;
        }
        answeredCorrect.add(voterId);
        const elapsed = typeof value[1] === "number" ? value[1] : timeLimitMs;
        // Menti formülü: 1000 × (1 − (t/T)/2)
        const speedPoints = Math.round(
          1000 * (1 - Math.min(1, Math.max(0, elapsed / timeLimitMs)) / 2)
        );
        const streak = (streaks.get(voterId) ?? 0) + 1;
        streaks.set(voterId, streak);
        const streakBonus = Math.min(streak - 1, 5) * 50;
        const row = scores.get(voterId) ?? { voterId, points: 0, correct: 0, streak: 0 };
        row.points += speedPoints + streakBonus;
        row.correct += 1;
        row.streak = streak;
        scores.set(voterId, row);
      });
      // Bu soruyu hiç cevaplamayanların da serisi kırılır
      for (const [v, st] of streaks) {
        if (st > 0 && !answeredCorrect.has(v)) streaks.set(v, 0);
      }
    }
    setRows([...scores.values()].sort((a, b) => b.points - a.points).slice(0, 10));
  }, [presentationId, slides]);

  useEffect(() => {
    compute();
  }, [compute]);

  const byVoter = new Map(participants.map((p) => [p.id, p]));
  const medals = ["🥇", "🥈", "🥉"];
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
                  <span className="text-muted text-xs shrink-0">
                    {row.correct} doğru{row.streak >= 2 ? ` · 🔥${row.streak}` : ""}
                  </span>
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
        <p className="text-muted text-xs text-center mt-3">
          Puan: hıza göre 500–1000 · üst üste doğrularda 🔥 seri bonusu (+50/soru, max +250)
        </p>
      </div>
    </div>
  );
}
