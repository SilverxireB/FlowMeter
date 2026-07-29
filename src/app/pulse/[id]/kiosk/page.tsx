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
  const [pinErr, setPinErr] = useState(false);
  const [adminMenu, setAdminMenu] = useState(false);
  const [offlineHint, setOfflineHint] = useState(false);
  const lastVote = useRef(0);
  const taps = useRef<number[]>([]);

  useEffect(() => watchPulse(id, setPulse), [id]);
  // İlk açılışta hiç veri gelmezse (önbelleksiz + çevrimdışı) sonsuz "Yükleniyor" olmasın.
  useEffect(() => {
    const t = window.setTimeout(() => setOfflineHint(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

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
    // Teşekkür, FREN süresi kadar kalır — "hazır görünüp oy yutan" ölü bölge yok.
    setThanks(true);
    window.setTimeout(() => setThanks(false), cd);
    castVote(id, v, "kiosk").catch(() => {}); // offline → kuyruk; kiosk asla hata göstermez
  };

  // Gizli çıkış: sol üst köşeye 3 sn içinde 5 dokunuş → PIN (varsa) → yönetici menüsü.
  const cornerTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setPin("");
      setPinErr(false);
      if (pulse?.pin) setPinAsk(true);
      else setAdminMenu(true);
    }
  };
  const tryPin = () => {
    if (pin === pulse?.pin) {
      setPinAsk(false);
      setAdminMenu(true);
    } else {
      setPinErr(true);
      setPin("");
    }
  };

  if (pulse === undefined)
    return (
      <main className="w-screen h-screen grid place-items-center bg-[#101014] text-white/50 animate-pulse text-center px-6">
        <span>Yükleniyor…{offlineHint && <span className="block text-white/60 mt-2 text-sm">Bağlantı yok gibi — kioskun İLK açılışı için internet gerekir; sonrasında çevrimdışı da çalışır.</span>}</span>
      </main>
    );
  if (pulse === null) return <main className="w-screen h-screen grid place-items-center bg-[#101014] text-white/40">Nokta bulunamadı.</main>;

  return (
    <main className="relative w-screen h-screen bg-[#101014] text-white flex flex-col items-center justify-center gap-12 px-6 select-none overflow-hidden" style={{ colorScheme: "dark" }}>
      {/* Gizli çıkış bölgesi */}
      <button onPointerDown={cornerTap} className="absolute top-0 left-0 w-24 h-24 opacity-0" aria-label="Yönetici çıkışı" />

      <h1 className="font-display font-bold text-center leading-tight" style={{ fontSize: "clamp(28px, 5.5vw, 72px)" }}>
        {pulse.question.text}
      </h1>

      <VoteButtons pulse={pulse} onVote={vote} size="kiosk" />

      {/* Anonimlik satırı güven-kritik → okunur kontrast */}
      <p className="text-white/60 text-sm absolute bottom-5">Geri bildirimin anonimdir · FlowPulse</p>

      {/* Teşekkür kaplaması */}
      {thanks && (
        <div className="absolute inset-0 z-40 bg-[#101014]/95 grid place-items-center animate-pop">
          <div className="text-center">
            <p className="text-8xl mb-6" aria-hidden>🙏</p>
            <p className="font-display font-bold text-4xl">Teşekkürler!</p>
          </div>
        </div>
      )}

      {/* PIN */}
      {pinAsk && (
        <div className="absolute inset-0 z-50 bg-black/80 grid place-items-center p-6" onClick={() => setPinAsk(false)}>
          <div className="bg-[#1c1c22] border border-white/15 rounded-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="font-display font-semibold mb-1">Yönetici PIN</p>
            <p className="text-white/50 text-xs mb-3">Sol üst köşeye 3 sn içinde 5 dokunuşla buraya gelinir.</p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinErr(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && tryPin()}
              className={`w-full rounded-lg bg-white/10 border px-3 py-2 text-center text-2xl tracking-widest focus:outline-none ${pinErr ? "border-rose-400" : "border-white/15 focus:border-white/40"}`}
            />
            {pinErr && <p className="text-rose-400 text-sm mt-2 font-semibold">Hatalı PIN</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPinAsk(false)} className="flex-1 rounded-xl bg-white/10 border border-white/15 py-2.5 font-semibold hover:bg-white/15">Vazgeç</button>
              <button onClick={tryPin} className="flex-1 rounded-xl bg-accent hover:bg-accent-dark text-white py-2.5 font-semibold">Aç</button>
            </div>
          </div>
        </div>
      )}

      {/* Yönetici menüsü — kioskı Google login'e savurmak yerine yerinde seçenek */}
      {adminMenu && (
        <div className="absolute inset-0 z-50 bg-black/80 grid place-items-center p-6" onClick={() => setAdminMenu(false)}>
          <div className="bg-[#1c1c22] border border-white/15 rounded-2xl p-6 w-full max-w-xs flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <p className="font-display font-semibold mb-1">Yönetici menüsü</p>
            <button onClick={() => setAdminMenu(false)} className="rounded-xl bg-accent hover:bg-accent-dark text-white py-3 font-semibold">← Kioska dön</button>
            <button onClick={() => router.push(`/pulse/${id}/manage`)} className="rounded-xl bg-white/10 border border-white/15 py-3 font-semibold hover:bg-white/15">
              Kokpiti aç <span className="text-white/50 text-xs">(giriş gerekir)</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
