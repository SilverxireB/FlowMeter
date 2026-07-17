"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { ScoreRow } from "@/lib/quizScores";
import { Participant } from "@/lib/types";

/**
 * Menti tarzı bar-race: yatay barlar önceki puandan (points−delta) yeni puana
 * doğru büyür; her satırda avatar + ad + puan + "+delta". Sıralı, ilk 10.
 */
export default function BarRace({
  rows,
  participants,
  dark = false,
}: {
  rows: ScoreRow[];
  participants: Participant[];
  dark?: boolean;
}) {
  const byVoter = new Map(participants.map((p) => [p.id, p]));
  const top = rows.slice(0, 10);
  const max = Math.max(1, ...top.map((r) => r.points));
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (top.length === 0) {
    return <p className={`text-center py-10 ${dark ? "text-white/70" : "text-muted"}`}>Henüz doğru cevap yok.</p>;
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {top.map((row, i) => {
        const p = byVoter.get(row.voterId);
        const from = Math.max(0, row.points - row.delta);
        const pct = ((grown ? row.points : from) / max) * 100;
        return (
          <li key={row.voterId} className="flex items-center gap-3">
            <span className={`w-6 text-sm font-display font-semibold tabular-nums shrink-0 ${dark ? "text-white/60" : "text-muted"}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="relative h-9 rounded-lg overflow-hidden bg-black/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-r-lg transition-[width] duration-1000 ease-out"
                  style={{ width: `${pct}%`, background: `var(--series-${(i % 8) + 1})` }}
                />
                {/* Ad + puan bar üstünde */}
                <div className="absolute inset-0 flex items-center justify-between px-3 gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    {p?.avatarSeed ? (
                      <Avatar seed={p.avatarSeed} size={24} />
                    ) : (
                      <span className="text-lg" aria-hidden>{p?.emoji ?? "😀"}</span>
                    )}
                    <span className="truncate font-semibold text-white drop-shadow-sm">
                      {p?.nickname ?? "Anonim"}
                      {row.streak >= 2 && <span className="ml-1" aria-hidden>🔥</span>}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {row.delta > 0 && (
                      <span className="text-xs font-bold text-white/90 bg-black/25 rounded-full px-1.5 py-0.5 tabular-nums">
                        +{row.delta}
                      </span>
                    )}
                    <span className="font-display font-semibold text-white tabular-nums drop-shadow-sm">
                      {row.points}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
