"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { ScoreRow } from "@/lib/quizScores";
import { Participant } from "@/lib/types";

/** Sayacı prev→target arasında yumuşakça sayar (skor reveal hissi). */
function useCountUp(target: number, from: number, duration = 1200): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (from === target) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, from, duration]);
  return value;
}

const MEDALS = ["🥇", "🥈", "🥉"];
/** Kürsü yüksekliği ve rengi (1., 2., 3.) */
const PEDESTALS = [
  { h: "h-36", bg: "linear-gradient(180deg, #fbbf24, #d97706)" },
  { h: "h-24", bg: "linear-gradient(180deg, #cbd5e1, #94a3b8)" },
  { h: "h-16", bg: "linear-gradient(180deg, #fdba74, #ea580c)" },
];

function PodiumColumn({
  row,
  participant,
  place,
  dark,
}: {
  row: ScoreRow;
  participant?: Participant;
  place: number; // 0 = 1., 1 = 2., 2 = 3.
  dark: boolean;
}) {
  const points = useCountUp(row.points, Math.max(0, row.points - row.delta));
  const first = place === 0;
  return (
    <div className="flex flex-col items-center justify-end flex-1 min-w-0 animate-pop">
      {participant?.avatarSeed ? (
        <Avatar
          seed={participant.avatarSeed}
          size={first ? 84 : 64}
          className={`ring-4 shadow-lg ${first ? "ring-amber-300" : "ring-white/70"}`}
        />
      ) : (
        <span className={first ? "text-6xl" : "text-5xl"} aria-hidden>
          {participant?.emoji ?? "😀"}
        </span>
      )}
      <p
        className={`mt-2 max-w-full truncate font-bold ${
          first ? "text-lg" : "text-sm"
        } ${dark ? "text-white" : "text-ink"}`}
      >
        {participant?.nickname ?? "Anonim"}
      </p>
      <p
        className={`font-display font-semibold tabular-nums ${
          first ? "text-2xl" : "text-lg"
        } ${dark ? "text-white" : "text-ink"}`}
      >
        {points}
        <span className="text-sm font-sans font-semibold opacity-60"> p</span>
      </p>
      {row.delta > 0 && (
        <span className="text-xs font-bold rounded-full px-2 py-0.5 mt-0.5 bg-green-600/15 text-green-600 tabular-nums animate-pop">
          +{row.delta}
        </span>
      )}
      <div
        className={`podium-pedestal w-full max-w-[9rem] mt-2 rounded-t-2xl flex items-start justify-center pt-2 text-3xl shadow-inner ${PEDESTALS[place].h}`}
        style={{ background: PEDESTALS[place].bg, animationDelay: `${(2 - place) * 0.15}s` }}
        aria-hidden
      >
        {MEDALS[place]}
      </div>
    </div>
  );
}

/**
 * Podyumlu skor tablosu: ilk 3 avatarlarıyla kürsüde (2-1-3 dizilimi),
 * geri kalanlar (4–10) altta kompakt liste. Puanlar count-up ile,
 * son sorudan gelen puan "+X" rozetiyle gösterilir.
 */
export default function Podium({
  rows,
  participants,
  dark = false,
}: {
  rows: ScoreRow[];
  participants: Participant[];
  dark?: boolean;
}) {
  const byVoter = new Map(participants.map((p) => [p.id, p]));
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 10);
  // Kürsü dizilimi: 2. | 1. | 3.
  const arranged = [top3[1], top3[0], top3[2]].filter(Boolean) as ScoreRow[];

  if (rows.length === 0) {
    return <p className={`text-center py-10 ${dark ? "text-white/70" : "text-muted"}`}>Henüz doğru cevap yok.</p>;
  }

  return (
    <div className="w-full">
      {/* Kürsü */}
      <div className="flex items-end justify-center gap-3 md:gap-6 max-w-xl mx-auto">
        {arranged.map((row) => (
          <PodiumColumn
            key={row.voterId}
            row={row}
            participant={byVoter.get(row.voterId)}
            place={rows.indexOf(row)}
            dark={dark}
          />
        ))}
      </div>

      {/* Geri kalanlar */}
      {rest.length > 0 && (
        <div
          className={`mt-5 pt-4 border-t grid gap-x-6 gap-y-1.5 sm:grid-cols-2 max-w-xl mx-auto ${
            dark ? "border-white/15" : "border-line"
          }`}
        >
          {rest.map((row, i) => {
            const p = byVoter.get(row.voterId);
            return (
              <div
                key={row.voterId}
                className={`flex items-center gap-2.5 rounded-xl px-2 py-1 ${dark ? "text-white/90" : ""}`}
              >
                <span className={`w-6 text-sm font-display font-semibold tabular-nums shrink-0 ${dark ? "text-white/50" : "text-muted"}`}>
                  {i + 4}.
                </span>
                {p?.avatarSeed ? (
                  <Avatar seed={p.avatarSeed} size={28} />
                ) : (
                  <span className="text-xl" aria-hidden>{p?.emoji ?? "😀"}</span>
                )}
                <span className="flex-1 truncate text-sm font-semibold">
                  {p?.nickname ?? "Anonim"}
                  {row.streak >= 2 && <span className="ml-1" aria-label={`${row.streak} seri`}>🔥</span>}
                </span>
                {row.delta > 0 && (
                  <span className="text-[11px] font-bold text-green-600 tabular-nums shrink-0">+{row.delta}</span>
                )}
                <span className="tabular-nums text-sm font-display font-semibold shrink-0">{row.points}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
