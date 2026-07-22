"use client";

/**
 * FlowWall perde — dilek/not bandı. Misafirlerin bıraktığı yazılı dilekler
 * başlık altında tek tek, camsı bir kartta dönerek (crossfade) gösterilir.
 * Projeksiyonda okunur olsun diye "akan yazı" yerine dönen kart tercih edildi.
 */
import { useEffect, useState } from "react";
import { WallWish } from "@/lib/types";

export default function WallWishes({ wishes, themeDark }: { wishes: WallWish[]; themeDark: boolean }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (wishes.length < 2) return;
    const t = window.setInterval(() => setIdx((i) => i + 1), 6000);
    return () => window.clearInterval(t);
  }, [wishes.length]);

  if (wishes.length === 0) return null;
  const w = wishes[idx % wishes.length];

  return (
    <div className="absolute top-[4.75rem] left-1/2 -translate-x-1/2 z-20 w-full max-w-[64vw] flex justify-center px-4 pointer-events-none">
      <div
        key={w.id}
        className={`ww-wish-in max-w-full rounded-2xl px-5 py-2.5 backdrop-blur-md shadow-lg border text-center ${
          themeDark ? "bg-white/10 border-white/15 text-white" : "bg-black/5 border-black/10 text-ink"
        }`}
      >
        <span className="text-base sm:text-lg font-medium">💌 {w.text}</span>
        {w.nickname && <span className={`ml-2 text-sm font-semibold ${themeDark ? "text-white/70" : "text-ink/60"}`}>— {w.nickname}</span>}
      </div>
      <style jsx>{`
        .ww-wish-in { animation: wwwishin 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes wwwishin { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ww-wish-in { animation: none !important; } }
      `}</style>
    </div>
  );
}
