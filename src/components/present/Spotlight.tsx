"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { ScoreRow } from "@/lib/quizScores";
import { Participant } from "@/lib/types";

/**
 * Skor açılışında en çok puan kazananı (max delta) büyük gösterir
 * (Menti'deki "Sinem 11319 p" spotlight'ı), ~2 sn sonra kaybolur.
 */
export default function Spotlight({
  rows,
  participants,
  onDone,
}: {
  rows: ScoreRow[];
  participants: Participant[];
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const top = [...rows].sort((a, b) => b.delta - a.delta)[0];

  useEffect(() => {
    if (!top || top.delta <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setVisible(false), 2000);
    const t2 = setTimeout(onDone, 2400);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [top, onDone]);

  if (!top || top.delta <= 0) return null;
  const p = participants.find((x) => x.id === top.voterId);

  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="animate-pop flex flex-col items-center">
        {p?.avatarSeed ? (
          <Avatar seed={p.avatarSeed} size={120} className="ring-4 ring-amber-300 shadow-xl" />
        ) : (
          <span className="text-7xl" aria-hidden>{p?.emoji ?? "🎉"}</span>
        )}
        <p className="font-display text-4xl font-semibold mt-4">{p?.nickname ?? "Anonim"}</p>
        <p className="font-display text-2xl font-semibold text-brand tabular-nums mt-1">
          +{top.delta} puan
        </p>
      </div>
    </div>
  );
}
