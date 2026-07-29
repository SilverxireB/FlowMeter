"use client";

/** FlowPulse ortak parçaları — kiosk, telefon oyu ve pano aynı butonları kullanır. */
import { Pulse } from "@/lib/types";

export const SMILEYS = [
  { v: 1, e: "😡" },
  { v: 2, e: "🙁" },
  { v: 3, e: "😐" },
  { v: 4, e: "🙂" },
  { v: 5, e: "😍" },
];

/** Skor rengi: yeşil iyi · amber orta · gül kötü (dataviz semantiği). */
export const scoreColor = (pct: number) => (pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#f43f5e");
export const scoreEmoji = (pct: number) => (pct >= 80 ? "😍" : pct >= 60 ? "🙂" : pct >= 40 ? "😐" : pct >= 20 ? "🙁" : "😡");

/** Soru tipine göre oy butonları. size: kiosk=dev, phone=orta. */
export function VoteButtons({ pulse, onVote, size }: { pulse: Pulse; onVote: (v: number) => void; size: "kiosk" | "phone" }) {
  const big = size === "kiosk";
  const q = pulse.question;

  const ring = "focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30";
  const SMILEY_LABELS = ["Çok kötü", "Kötü", "Orta", "İyi", "Çok iyi"];

  if (q.type === "smiley")
    return (
      <div className={`flex flex-wrap justify-center ${big ? "gap-6" : "gap-3"}`}>
        {SMILEYS.map((s) => (
          <button
            key={s.v}
            onClick={() => onVote(s.v)}
            className={`${ring} rounded-3xl bg-white/10 border border-white/15 hover:bg-white/20 active:scale-95 transition grid place-items-center ${
              big ? "w-32 h-32 text-7xl" : "w-16 h-16 text-4xl"
            }`}
            aria-label={SMILEY_LABELS[s.v - 1]}
          >
            {s.e}
          </button>
        ))}
      </div>
    );

  if (q.type === "nps")
    return (
      // Kioskta AKIŞKAN ızgara — sabit 80px buton dar/dikey tablette üst üste biniyordu.
      <div className={big ? "w-full max-w-4xl" : ""}>
        <div className={big ? "grid grid-cols-11 gap-2 w-full" : "grid grid-cols-6 sm:grid-cols-11 gap-2"}>
          {Array.from({ length: 11 }).map((_, v) => (
            <button
              key={v}
              onClick={() => onVote(v)}
              className={`${ring} rounded-2xl border font-bold tabular-nums active:scale-95 transition grid place-items-center ${
                big ? "w-full aspect-square" : "w-11 h-11 text-base"
              } ${v <= 6 ? "bg-rose-500/20 border-rose-400/40" : v <= 8 ? "bg-amber-500/20 border-amber-400/40" : "bg-emerald-500/20 border-emerald-400/40"} text-white hover:bg-white/20`}
              style={big ? { fontSize: "clamp(16px, 2.4vw, 30px)" } : undefined}
            >
              {v}
            </button>
          ))}
        </div>
        <div className={`flex justify-between text-white/60 mt-2 ${big ? "text-base" : "text-xs"}`}>
          <span>0 · Hiç tavsiye etmem</span>
          <span>10 · Kesinlikle</span>
        </div>
      </div>
    );

  if (q.type === "yesno")
    return (
      <div className={`flex justify-center ${big ? "gap-8" : "gap-4"}`}>
        <button onClick={() => onVote(1)} className={`focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 text-white hover:bg-emerald-500/30 active:scale-95 transition grid place-items-center ${big ? "w-40 h-32 text-7xl" : "w-24 h-16 text-4xl"}`} aria-label="Evet">👍</button>
        <button onClick={() => onVote(0)} className={`focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 rounded-3xl bg-rose-500/20 border border-rose-400/40 text-white hover:bg-rose-500/30 active:scale-95 transition grid place-items-center ${big ? "w-40 h-32 text-7xl" : "w-24 h-16 text-4xl"}`} aria-label="Hayır">👎</button>
      </div>
    );

  // choice
  return (
    <div className={`flex flex-col items-stretch mx-auto w-full ${big ? "gap-4 max-w-2xl" : "gap-2 max-w-sm"}`}>
      {(q.options ?? []).slice(0, 11).map((opt, i) => (
        <button
          key={i}
          onClick={() => onVote(i)}
          className={`focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold hover:bg-white/20 active:scale-[0.98] transition ${
            big ? "px-8 py-6 text-3xl" : "px-5 py-3.5 text-base"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
