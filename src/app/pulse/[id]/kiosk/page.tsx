"use client";

/**
 * FlowPulse KIOSK — duvara asılan tablet/telefonun yüzü. Dev butonlar, oy →
 * teşekkür → sıfırlan; cooldown; wake lock (uyumaz); offline'da Firestore
 * kuyruğuna yazar (persistentLocalCache). Çıkış: sol üst köşeye 5 dokunuş
 * (+ PIN tanımlıysa PIN). auth YOK — cihaz herkese açık.
 */
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { VoteButtons } from "@/components/pulse/shared";
import { castVote, watchPulse } from "@/lib/pulses";
import { Pulse } from "@/lib/types";

export default function PulseKioskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pulse, setPulse] = useState<Pulse | null | undefined>(undefined);
  const [thanks, setThanks] = useState(false);
  const [pinAsk, setPinAsk] = useState(false);
  const [pin, setPin] = useState("");
  const lastVote = useRef(0);
  const taps = useRef<number[]>([]);

  useEffect(() => watchPulse(id, setPulse), [id]);

  // Kiosk: kaydırma kapalı + ekran uyumaz (görünürlük dönüşünde tekrar al).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let lock: WakeLockSentinel | null = null;
    const req = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {}
    };
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, []);

  const vote = async (v: number) => {
    if (!pulse) return;
    const cd = (pulse.cooldownSec ?? 3) * 1000;
    if (Date.now() - lastVote.current < cd) return; // üst üste basma freni
    lastVote.current = Date.now();
    setThanks(true);
    window.setTimeout(() => setThanks(false), 1600);
    castVote(id, v, "kiosk").catch(() => {}); // offline → kuyruk; kiosk asla hata göstermez
  };

  // Gizli çıkış: sol üst köşeye 3 sn içinde 5 dokunuş.
  const cornerTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      if (pulse?.pin) setPinAsk(true);
      else router.push(`/pulse/${id}/manage`);
    }
  };

  if (pulse === undefined) return <main className="w-screen h-screen grid place-items-center bg-[#101014] text-white/40 animate-pulse">Yükleniyor…</main>;
  if (pulse === null) return <main className="w-screen h-screen grid place-items-center bg-[#101014] text-white/40">Nokta bulunamadı.</main>;

  return (
    <main className="relative w-screen h-screen bg-[#101014] text-white flex flex-col items-center justify-center gap-12 px-6 select-none overflow-hidden" style={{ colorScheme: "dark" }}>
      {/* Gizli çıkış bölgesi */}
      <button onPointerDown={cornerTap} className="absolute top-0 left-0 w-24 h-24 opacity-0" aria-label="Yönetici çıkışı" />

      <h1 className="font-display font-bold text-center leading-tight" style={{ fontSize: "clamp(28px, 5.5vw, 72px)" }}>
        {pulse.question.text}
      </h1>

      <VoteButtons pulse={pulse} onVote={vote} size="kiosk" />

      <p className="text-white/30 text-sm absolute bottom-5">Geri bildirimin anonimdir · FlowPulse</p>

      {/* Teşekkür kaplaması */}
      {thanks && (
        <div className="absolute inset-0 z-40 bg-[#101014]/95 grid place-items-center animate-pop">
          <div className="text-center">
            <p className="text-8xl mb-6" aria-hidden>🙏</p>
            <p className="font-display font-bold text-4xl">Teşekkürler!</p>
          </div>
        </div>
      )}

      {/* PIN çıkışı */}
      {pinAsk && (
        <div className="absolute inset-0 z-50 bg-black/80 grid place-items-center p-6" onClick={() => setPinAsk(false)}>
          <div className="bg-[#1c1c22] border border-white/15 rounded-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="font-display font-semibold mb-3">Yönetici PIN</p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pin === pulse.pin) router.push(`/pulse/${id}/manage`);
              }}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-center text-2xl tracking-widest focus:outline-none focus:border-white/40"
            />
            <button
              onClick={() => pin === pulse.pin && router.push(`/pulse/${id}/manage`)}
              className="mt-3 w-full rounded-xl bg-accent hover:bg-accent-dark text-white py-2.5 font-semibold"
            >
              Çıkış
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
