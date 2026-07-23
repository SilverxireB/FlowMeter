"use client";

/**
 * FlowWall perde — foto yarışması. running iken periyodik ilk 3 + kalıcı "oy ver"
 * rozeti; ended'de kazanan takeover + konfeti. Oyları YALNIZ perde/kokpit dinler.
 */
import { useEffect, useMemo, useState } from "react";
import { Wall, WallMedia } from "@/lib/types";
import { useContestVotes } from "@/lib/hooks";
import { tallyContest } from "@/lib/walls";
import { wallBannerColors } from "@/lib/themes";
import { cldFit, cldVideoPoster } from "@/lib/cloudinary";
import Confetti from "@/components/Confetti";

export default function WallContest({ wallId, wall, media }: { wallId: string; wall: Wall; media: WallMedia[] }) {
  const votes = useContestVotes(wallId);
  const contest = wall.contest;
  const [showBoard, setShowBoard] = useState(false);
  const bc = wallBannerColors(wall.theme?.preset); // temaya uygun gösterim rengi

  const byId = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const ranking = useMemo(() => (contest ? tallyContest(votes, contest.id, media) : []), [votes, contest, media]);

  // Geri sayım (opsiyonel süre) — sadece süreli + running iken tik.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!(contest?.status === "running" && contest.endsAt)) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [contest?.status, contest?.endsAt]);

  useEffect(() => {
    if (!contest || contest.status !== "running") return;
    const iv = window.setInterval(() => {
      setShowBoard(true);
      window.setTimeout(() => setShowBoard(false), 10000);
    }, 90000);
    return () => window.clearInterval(iv);
  }, [contest?.status]);

  if (!contest) return null;

  if (contest.status === "ended") {
    const winner = contest.winnerMediaId ? byId.get(contest.winnerMediaId) : null;
    return (
      <div className="absolute inset-0 z-50 grid place-items-center px-6 ww-fade">
        <Confetti />
        <div aria-hidden className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
        <div className="relative text-center ww-pop">
          <p className="text-2xl font-bold mb-1" style={{ color: bc.accent }}>🏆 {contest.title}</p>
          <p className="text-white/80 mb-5">Kazanan</p>
          {winner ? (
            <>
              <div className="mx-auto rounded-3xl overflow-hidden shadow-2xl ring-4" style={{ width: "clamp(240px,34vw,440px)", aspectRatio: "1", borderColor: bc.accent }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={winner.type === "video" ? cldVideoPoster(winner.url, 700, 700) : cldFit(winner.url, 760)} alt="" className="w-full h-full object-cover" />
              </div>
              {winner.nickname && <p className="text-white text-xl font-bold mt-4">👑 {winner.nickname}</p>}
            </>
          ) : (
            <p className="text-white/70">Yeterli oy toplanmadı.</p>
          )}
        </div>
      </div>
    );
  }

  // running
  const top3 = ranking.slice(0, 3).map((r) => ({ m: byId.get(r.mediaId), count: r.count })).filter((x) => x.m) as { m: WallMedia; count: number }[];
  const ordered = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const endsMs = contest.endsAt?.toMillis?.() ?? 0;
  const remain = endsMs ? Math.max(0, Math.round((endsMs - now) / 1000)) : 0;
  const cdText = endsMs ? ` · ⏳ ${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}` : "";

  return (
    <>
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 rounded-3xl text-sm sm:text-base font-bold px-6 py-3 shadow-2xl border border-white/20 text-white text-center pointer-events-none ww-pop" style={{ background: bc.gradient }}>
        🏆 {contest.title} · telefondan oy ver{cdText}
      </div>
      {showBoard && top3.length > 0 && (
        <div className="absolute inset-0 z-50 grid place-items-center px-6 ww-fade">
          <div aria-hidden className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative text-center">
            <p className="font-display text-3xl sm:text-5xl font-extrabold mb-6" style={{ color: bc.accent }}>🏆 {contest.title}</p>
            <div className="flex items-end justify-center gap-4 sm:gap-8">
              {ordered.map((x, i) => {
                const first = x.m.id === top3[0].m.id;
                return (
                  <figure key={x.m.id} className="flex flex-col items-center ww-pop" style={{ animationDelay: `${i * 0.15}s` }}>
                    {first && <div className="text-4xl mb-1" aria-hidden>👑</div>}
                    <div className="rounded-2xl overflow-hidden shadow-2xl border-2" style={{ borderColor: first ? bc.accent : "rgba(255,255,255,0.2)", width: first ? "clamp(180px,26vw,340px)" : "clamp(120px,18vw,220px)", aspectRatio: "1" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.m.type === "video" ? cldVideoPoster(x.m.url, 500, 500) : cldFit(x.m.url, 600)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="mt-3 rounded-full bg-black/50 text-white font-bold px-3 py-1 backdrop-blur tabular-nums">{x.count} oy</span>
                    {x.m.nickname && <span className="mt-1 text-white/80 text-sm">{x.m.nickname}</span>}
                  </figure>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
