"use client";

/**
 * FlowWall perde — canlı anons. Moderasyondan yayınlanır; `until` anına kadar
 * perdede öne çıkan bir banner olarak durur (arka planı hafif karartır),
 * süresi dolunca kaybolur. Kalan süre küçük geri sayımla gösterilir.
 */
import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";

export default function WallAnnouncement({ announcement }: { announcement?: { text: string; until: Timestamp | null } | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const untilMs = announcement?.until?.toMillis?.() ?? 0;
  const active = Boolean(announcement?.text) && untilMs > now;
  if (!active) return null;

  const remainingSec = Math.max(0, Math.round((untilMs - now) / 1000));
  const mm = Math.floor(remainingSec / 60);
  const ss = String(remainingSec % 60).padStart(2, "0");

  return (
    <div className="absolute inset-0 z-50 grid place-items-center pointer-events-none px-6">
      <div aria-hidden className="absolute inset-0 bg-black/45 backdrop-blur-[2px] ww-ann-fade" />
      <div className="relative ww-ann-pop max-w-3xl w-full rounded-3xl px-8 py-7 text-center shadow-2xl border border-white/20"
        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
        <div className="text-4xl mb-3" aria-hidden>📢</div>
        <p className="font-display text-2xl sm:text-4xl font-bold text-white text-balance leading-snug">
          {announcement!.text}
        </p>
        <p className="mt-4 text-white/70 text-sm tabular-nums">{mm}:{ss}</p>
      </div>
      <style jsx>{`
        .ww-ann-fade { animation: wwannfade 0.4s ease-out; }
        @keyframes wwannfade { from { opacity: 0; } to { opacity: 1; } }
        .ww-ann-pop { animation: wwannpop 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes wwannpop { from { opacity: 0; transform: scale(0.92) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .ww-ann-fade, .ww-ann-pop { animation: none !important; } }
      `}</style>
    </div>
  );
}
