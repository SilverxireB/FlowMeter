"use client";

/**
 * FlowWall perde — "En Sevilenler" highlight turu. Belirli aralıklarla (≈2 dk)
 * kısa süre (≈10 sn) en çok beğenilen ilk 3 anıyı altın temalı bir sahnede
 * gösterir; #1 = "günün karesi". Yeterli beğeni yoksa görünmez.
 */
import { useEffect, useMemo, useState } from "react";
import { WallMedia } from "@/lib/types";
import { cldFit, cldVideoPoster } from "@/lib/cloudinary";

export default function WallTopLoved({ media }: { media: WallMedia[] }) {
  const [show, setShow] = useState(false);

  const top = useMemo(
    () => [...media].filter((m) => (m.likes ?? 0) > 0).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 3),
    [media]
  );

  useEffect(() => {
    const cycle = window.setInterval(() => {
      setShow(true);
      window.setTimeout(() => setShow(false), 10000);
    }, 120000);
    return () => window.clearInterval(cycle);
  }, []);

  if (!show || top.length < 2) return null;

  // Sıralama: #2 sol, #1 orta (büyük), #3 sağ
  const ordered = top.length >= 3 ? [top[1], top[0], top[2]] : [top[1], top[0]];

  return (
    <div className="absolute inset-0 z-50 grid place-items-center px-6 ww-tl-fade">
      <div aria-hidden className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative text-center">
        <p className="font-display text-3xl sm:text-5xl font-extrabold mb-8" style={{ color: "#f6b73c" }}>
          ❤ En Sevilenler
        </p>
        <div className="flex items-end justify-center gap-4 sm:gap-8">
          {ordered.map((m, i) => {
            const isFirst = m.id === top[0].id;
            const poster = m.type === "video" ? cldVideoPoster(m.url, 500, 500) : cldFit(m.url, 600);
            return (
              <figure key={m.id} className={`ww-tl-pop flex flex-col items-center ${isFirst ? "" : "opacity-90"}`} style={{ animationDelay: `${i * 0.15}s` }}>
                {isFirst && <div className="text-4xl mb-1" aria-hidden>👑</div>}
                <div
                  className="rounded-2xl overflow-hidden shadow-2xl border-2"
                  style={{
                    borderColor: isFirst ? "#f6b73c" : "rgba(255,255,255,0.2)",
                    width: isFirst ? "clamp(180px,26vw,340px)" : "clamp(120px,18vw,220px)",
                    aspectRatio: "1",
                    boxShadow: isFirst ? "0 0 60px rgba(246,183,60,0.4)" : undefined,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={poster} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 text-white font-bold px-3 py-1 backdrop-blur">
                  <span aria-hidden>❤</span> {m.likes}
                </span>
                {m.nickname && <span className="mt-1.5 text-white/80 text-sm font-semibold">{m.nickname}</span>}
              </figure>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        .ww-tl-fade { animation: wwtlfade 0.6s ease-out; }
        @keyframes wwtlfade { from { opacity: 0; } to { opacity: 1; } }
        .ww-tl-pop { animation: wwtlpop 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes wwtlpop { from { opacity: 0; transform: translateY(16px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ww-tl-fade, .ww-tl-pop { animation: none !important; } }
      `}</style>
    </div>
  );
}
