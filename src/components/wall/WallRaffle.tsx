"use client";

/**
 * FlowWall perde — ÇEKİLİŞ. Kokpit "Çek!" deyince (raffle.draw yeni nonce) perdede
 * ortada büyük dramatik bir kart açılır (arka plan/anılar hafif görünür kalır —
 * tam kapatmaz). 3·2·1 geri sayım → çerçeveli slot penceresinde isim/rakam hızla
 * döner, yavaşlar → kazananda durur → konfeti + spotlight + dev isim. Çoklu
 * kazanan sırayla. Kazananlar kokpitte çekim anında belirlenip yazılır
 * (moderatöre güven + `draws` logu); perde sadece heyecanı sahneler.
 */
import { useEffect, useRef, useState } from "react";
import Confetti from "@/components/Confetti";
import { RaffleEntry, RaffleWinner, Wall } from "@/lib/types";
import { wallBannerColors } from "@/lib/themes";

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
type Phase = "intro" | "spin" | "reveal";

/** KAZANAN yazı boyu — etikete göre, karta sığacak şekilde (uzun isim küçülür). */
function labelFont(s: string): string {
  const n = s.length;
  if (n <= 3) return "clamp(3rem,11vw,6.5rem)";
  if (n <= 8) return "clamp(2.25rem,6vw,4rem)";
  if (n <= 16) return "clamp(1.6rem,4.2vw,2.9rem)";
  if (n <= 26) return "clamp(1.25rem,3vw,2rem)";
  return "clamp(1rem,2.4vw,1.5rem)";
}

export default function WallRaffle({ wall, entries }: { wall: Wall; entries: RaffleEntry[] }) {
  const r = wall.raffle;
  // Tetikleme SAAT-BAĞIMSIZ nonce ile: mount anındaki çekim "görülmüş" sayılır
  // (eski çekimi oynatma); yeni nonce gelince oynat.
  const initialNonceRef = useRef<string | null | undefined>(undefined);
  if (initialNonceRef.current === undefined) initialNonceRef.current = wall.raffle?.draw?.nonce ?? null;
  const lastPlayedRef = useRef<string | null>(null);
  const cancelRef = useRef(false);
  const activeRef = useRef(false); // çekim oynarken yeni çekimi yok say (çift çekim yok)
  const orderRef = useRef<number[]>([]); // karıştırılmış sıra (adil algı)
  const cursorRef = useRef(0);

  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flick, setFlick] = useState<RaffleWinner | null>(null);
  const [reveal, setReveal] = useState<RaffleWinner | null>(null);
  const [revealed, setRevealed] = useState<RaffleWinner[]>([]);
  const [ordinal, setOrdinal] = useState("");
  const bc = wallBannerColors(wall.theme?.preset);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => () => { cancelRef.current = true; }, []);

  useEffect(() => {
    const nonce = r?.draw?.nonce ?? null;
    if (!nonce || nonce === initialNonceRef.current || nonce === lastPlayedRef.current) return;
    if (activeRef.current) return; // bir çekim oynuyorsa yenisini oynatma
    lastPlayedRef.current = nonce;
    void runDraw(r!.draw!.winners ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.draw?.nonce]);

  function nextFlick(): RaffleWinner {
    if (r?.type === "number") {
      const min = r.min ?? 1;
      const max = Math.max(min, r.max ?? min);
      return { label: String(min + Math.floor(Math.random() * (max - min + 1))) };
    }
    // Kayıt: karıştırılmış sırada SIRAYLA geçir → izleyici birçok FARKLI isim görür
    // (rastgele tek tek değil → "sadece bazıları" algısı olmaz, herkes akıp geçer).
    const list = entriesRef.current;
    if (!list.length) return { label: "…" };
    const order = orderRef.current.length === list.length ? orderRef.current : list.map((_, i) => i);
    const idx = order[cursorRef.current % order.length];
    cursorRef.current += 1;
    return { label: list[idx]?.name ?? "…" };
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
    activeRef.current = true;
    setRevealed([]);
    setReveal(null);
    setFlick(null);
    setActive(true);
    // Havuzu karıştır (sıralı geçiş için) — her çekimde farklı sıra.
    const nn = entriesRef.current.length;
    const order = Array.from({ length: nn }, (_, i) => i);
    for (let i = nn - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    orderRef.current = order;
    cursorRef.current = 0;
    const dur = Math.max(2, r?.suspenseSec ?? 7) * 1000;
    const total = winners.length;
    for (let i = 0; i < total; i++) {
      if (cancelRef.current) return;
      setReveal(null);
      setFlick(null);
      setOrdinal(total > 1 ? `${i + 1} / ${total}` : "");
      // 3·2·1 geri sayım
      setPhase("intro");
      for (const n of [3, 2, 1]) {
        if (cancelRef.current) return;
        setCountdown(n);
        await wait(650);
      }
      setCountdown(null);
      // spin
      setPhase("spin");
      await spin(winners[i], dur);
      if (cancelRef.current) return;
      // reveal
      setFlick(null);
      setReveal(winners[i]);
      setRevealed((prev) => [...prev, winners[i]]);
      setPhase("reveal");
      await wait(total > 1 ? 3400 : 4600);
    }
    await wait(6000);
    activeRef.current = false;
    if (!cancelRef.current) setActive(false);
  }

  if (!active) return null;
  const drawingLabel = r?.type === "number" ? "Numara çekiliyor" : "İsim çekiliyor";
  // Spin sırasında SABİT font (her isim farklı uzunlukta → zıplamasın); numara büyük, isim orta.
  const spinFont = r?.type === "number" ? "clamp(2.5rem,9vw,5.5rem)" : "clamp(1.4rem,4vw,2.6rem)";
  const poolLabel = r?.type === "number"
    ? `${r.min ?? 1}–${Math.max(r.min ?? 1, r.max ?? 1)} arasından`
    : `${entries.length} kişi arasından`;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4 bg-black/55 backdrop-blur-[3px] ww-raffle-in">
      {reveal && <Confetti />}
      <div
        className="relative w-[92%] max-w-2xl rounded-[2rem] border-2 shadow-2xl text-center px-6 py-9 sm:py-12 text-white ww-pop"
        style={{ borderColor: bc.accent, background: "linear-gradient(160deg,#0c1236 0%,#141b48 100%)", boxShadow: `0 0 90px ${bc.accent}55` }}
      >
        <p className="font-display text-xl sm:text-3xl font-extrabold" style={{ color: bc.accent }}>
          🎁 Çekiliş{r?.prize ? ` · ${r.prize}` : ""}
        </p>
        {ordinal && <p className="text-white/55 mt-1 text-sm sm:text-base tabular-nums">{ordinal}. kazanan</p>}

        <div className="my-7 sm:my-9 min-h-[7rem] sm:min-h-[9rem] grid place-items-center">
          {phase === "intro" ? (
            <p className="font-display font-extrabold tabular-nums ww-count" style={{ fontSize: "clamp(4rem,16vw,9rem)", color: bc.accent }}>
              {countdown ?? ""}
            </p>
          ) : reveal ? (
            <div className="ww-pop w-full">
              <div className="text-4xl sm:text-5xl mb-2" aria-hidden>🎉</div>
              <p className="font-display font-extrabold leading-tight break-words px-2" style={{ fontSize: labelFont(reveal.label), textShadow: `0 0 55px ${bc.accent}` }}>
                {reveal.label}
              </p>
              {reveal.sub && <p className="mt-3 text-xl sm:text-3xl text-white/70">Sicil: {reveal.sub}</p>}
            </div>
          ) : (
            <div className="w-full">
              <p className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-white/45 mb-4">{drawingLabel}…</p>
              <p className="font-display font-extrabold leading-tight break-words text-center px-2" style={{ fontSize: spinFont, opacity: 0.95 }}>
                {flick?.label ?? "…"}
              </p>
              <p className="mt-4 text-sm sm:text-base text-white/50 tabular-nums">🎲 {poolLabel}</p>
            </div>
          )}
        </div>

        {revealed.length > 1 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {revealed.slice(0, -1).map((w, i) => (
              <span key={i} className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs sm:text-sm">
                {w.label}{w.sub ? ` · ${w.sub}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .ww-raffle-in { animation: wwrfin 0.4s ease-out; }
        @keyframes wwrfin { from { opacity: 0; } to { opacity: 1; } }
        .ww-count { animation: wwcount 0.65s ease-out; }
        @keyframes wwcount { from { opacity: 0; transform: scale(1.6); } 60% { opacity: 1; } to { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ww-count, .ww-raffle-in { animation: none !important; } }
      `}</style>
    </div>
  );
}
