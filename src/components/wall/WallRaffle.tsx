"use client";

/**
 * FlowWall perde — ÇEKİLİŞ. Kokpit "Çek!" deyince (raffle.draw taze startedAt)
 * tüm ekranı kaplar: isim/sicil (ya da rakam) hızla döner, yavaşlar, kazananda
 * durur → konfeti + spotlight + dev isim. Çoklu kazanan sırayla. Kazananlar
 * kokpitte çekim anında belirlenip yazılır (moderatöre güven + `draws` logu);
 * perde sadece heyecanı sahneler. Süre kokpitten (suspenseSec).
 */
import { useEffect, useRef, useState } from "react";
import Confetti from "@/components/Confetti";
import { RaffleEntry, RaffleWinner, Wall } from "@/lib/types";
import { wallBannerColors } from "@/lib/themes";

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export default function WallRaffle({ wall, entries }: { wall: Wall; entries: RaffleEntry[] }) {
  const r = wall.raffle;
  const mountRef = useRef(Date.now());
  const playedRef = useRef(0);
  const cancelRef = useRef(false);
  const [active, setActive] = useState(false);
  const [flick, setFlick] = useState<RaffleWinner | null>(null);
  const [reveal, setReveal] = useState<RaffleWinner | null>(null);
  const [revealed, setRevealed] = useState<RaffleWinner[]>([]);
  const [ordinal, setOrdinal] = useState("");
  const bc = wallBannerColors(wall.theme?.preset);

  // entries'i ref'te tut (spin sırasında güncel havuz)
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => () => { cancelRef.current = true; }, []);

  useEffect(() => {
    const at = r?.draw?.startedAt?.toMillis?.();
    if (!at || at <= mountRef.current || at === playedRef.current) return;
    playedRef.current = at;
    void runDraw(r!.draw!.winners ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.draw?.startedAt]);

  function nextFlick(): RaffleWinner {
    if (r?.type === "number") {
      const min = r.min ?? 1;
      const max = Math.max(min, r.max ?? min);
      return { label: String(min + Math.floor(Math.random() * (max - min + 1))) };
    }
    const list = entriesRef.current;
    if (!list.length) return { label: "…" };
    const e = list[Math.floor(Math.random() * list.length)];
    return { label: e.name };
  }

  function spin(winner: RaffleWinner, durMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        if (cancelRef.current) return resolve();
        const t = performance.now() - start;
        if (t >= durMs) {
          setFlick(winner);
          return resolve();
        }
        setFlick(nextFlick());
        const delay = 45 + Math.pow(t / durMs, 2.2) * 360; // hızlı → giderek yavaş
        window.setTimeout(tick, delay);
      };
      tick();
    });
  }

  async function runDraw(winners: RaffleWinner[]) {
    if (!winners.length) return;
    cancelRef.current = false;
    setRevealed([]);
    setReveal(null);
    setFlick(null);
    setActive(true);
    const dur = Math.max(2, r?.suspenseSec ?? 7) * 1000;
    const total = winners.length;
    for (let i = 0; i < total; i++) {
      if (cancelRef.current) return;
      setReveal(null);
      setOrdinal(total > 1 ? `${i + 1} / ${total}` : "");
      await spin(winners[i], dur);
      if (cancelRef.current) return;
      setFlick(null);
      setReveal(winners[i]);
      setRevealed((prev) => [...prev, winners[i]]);
      await wait(total > 1 ? 3200 : 4200);
    }
    await wait(6000);
    if (!cancelRef.current) setActive(false);
  }

  if (!active) return null;
  const show = reveal ?? flick;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center text-white overflow-hidden animate-[fadeIn_0.5s_ease]"
      style={{ background: "radial-gradient(circle at 50% 38%, #131a45 0%, #070c22 68%, #02030a 100%)" }}
    >
      {reveal && <Confetti />}

      {/* Başlık */}
      <div className="absolute top-[7%] text-center px-6">
        <p className="font-display text-2xl sm:text-4xl font-extrabold" style={{ color: bc.accent }}>
          🎁 Çekiliş{r?.prize ? ` · ${r.prize}` : ""}
        </p>
        {ordinal && <p className="text-white/60 mt-1 text-lg tabular-nums">{ordinal}. kazanan</p>}
      </div>

      {/* Orta gösterim */}
      <div className="text-center px-6 w-full">
        {reveal ? (
          <div className="ww-pop">
            <div className="text-5xl sm:text-6xl mb-4" aria-hidden>🎉</div>
            <p className="font-display font-extrabold leading-none break-words" style={{ fontSize: "clamp(2.75rem,12vw,10rem)", textShadow: "0 0 60px rgba(255,255,255,0.25)" }}>
              {show?.label}
            </p>
            {show?.sub && <p className="mt-5 text-2xl sm:text-4xl text-white/75">Sicil: {show.sub}</p>}
          </div>
        ) : (
          <p className="font-display font-extrabold leading-none opacity-90 break-words" style={{ fontSize: "clamp(2.75rem,12vw,10rem)" }}>
            {show?.label ?? "…"}
          </p>
        )}
      </div>

      {/* Önceki kazananlar (çoklu ödülde) */}
      {revealed.length > 1 && (
        <div className="absolute bottom-[6%] flex flex-wrap gap-2 justify-center px-6 max-w-5xl">
          {revealed.slice(0, -1).map((w, i) => (
            <span key={i} className="rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-sm sm:text-base">
              {w.label}{w.sub ? ` · ${w.sub}` : ""}
            </span>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
