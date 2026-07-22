"use client";

/**
 * FlowWall perde — milestone kutlaması. Anı sayısı bir eşiği geçince kısa süre
 * konfeti + "N. anı!" banner'ı patlar. Ekran açıldığında mevcut sayı temel
 * alınır (eski eşikler kutlanmaz).
 */
import { useEffect, useRef, useState } from "react";
import Confetti from "@/components/Confetti";

const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000];

function highestUpTo(n: number): number {
  let r = 0;
  for (const m of MILESTONES) if (m <= n) r = m;
  return r;
}

export default function WallMilestone({ count, enabled = true }: { count: number; enabled?: boolean }) {
  const celebrated = useRef<number | null>(null);
  const baselined = useRef(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!baselined.current) {
      baselined.current = true;
      celebrated.current = highestUpTo(count);
      return;
    }
    let target: number | null = null;
    for (const x of MILESTONES) if (x > (celebrated.current ?? 0) && count >= x) target = x;
    if (target !== null) {
      celebrated.current = target;
      setActive(target);
      const t = window.setTimeout(() => setActive(null), 7000);
      return () => window.clearTimeout(t);
    }
  }, [count, enabled]);

  if (!enabled || active === null) return null;

  return (
    <>
      <Confetti />
      <div className="absolute inset-0 z-50 grid place-items-center pointer-events-none px-6">
        <div
          className="ww-mile-pop rounded-3xl px-10 py-7 text-center shadow-2xl border border-white/20"
          style={{ background: "linear-gradient(135deg, #f59e0b, #e11d48)" }}
        >
          <div className="text-5xl mb-2" aria-hidden>🎉</div>
          <p className="font-display text-3xl sm:text-5xl font-extrabold text-white leading-none">{active}. anı!</p>
          <p className="text-white/85 mt-2">Duvar şenleniyor 🥳</p>
        </div>
      </div>
      <style jsx>{`
        .ww-mile-pop { animation: wwmilepop 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes wwmilepop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ww-mile-pop { animation: none !important; } }
      `}</style>
    </>
  );
}
