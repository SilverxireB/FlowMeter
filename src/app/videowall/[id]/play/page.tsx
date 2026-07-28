"use client";

/**
 * FlowSign — yayın (perde) ekranı + oynatma motoru (v4). Duvar tam ekran
 * (100vw×100vh); alanlar oransal (0–1) → fiziksel çözünürlükten bağımsız böler.
 * Her alan kendi oynatma listesini döndürür: görsel/URL/metin süreyle, video kendi
 * süresince, saat canlı; saat aralığı filtresi; yumuşak crossfade; bozuk öğeyi
 * atlayıp devam (7/24). Ekran uyumaz (Wake Lock) + tek tıkla tam ekran.
 * auth YOK — link herkese açık.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { watchVideowall } from "@/lib/videowalls";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

/** "HH:MM" saat aralığı filtresi — boşsa hep göster. */
function inWindow(item: ZoneItem, now: Date): boolean {
  if (!item.from && !item.to) return true;
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (item.from && hm < item.from) return false;
  if (item.to && hm > item.to) return false;
  return true;
}

/** Canlı saat/tarih widget'ı. */
function ClockView({ item }: { item: ZoneItem }) {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center" style={{ background: item.bg ?? "#041a1a", color: item.color ?? "#fff" }}>
      <div className="font-display font-bold tabular-nums leading-none" style={{ fontSize: "clamp(28px, 9vw, 200px)" }}>
        {t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="font-display opacity-80" style={{ fontSize: "clamp(12px, 2.4vw, 44px)" }}>
        {t.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  );
}

/** Metin/duyuru öğesi. */
function TextView({ item }: { item: ZoneItem }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center px-[6%]" style={{ background: item.bg ?? "#0c3b3b", color: item.color ?? "#fff" }}>
      {item.title && <div className="font-display font-bold leading-tight" style={{ fontSize: "clamp(24px, 6vw, 130px)" }}>{item.title}</div>}
      {item.text && <div className="font-display opacity-90 leading-snug whitespace-pre-wrap" style={{ fontSize: "clamp(14px, 2.6vw, 52px)" }}>{item.text}</div>}
    </div>
  );
}

/** Tek öğe katmanı — mount'ta yumuşak fade-in (crossfade için üst üste yığılır). */
function Layer({
  item,
  fit,
  loop,
  onEnded,
  onError,
}: {
  item: ZoneItem;
  fit: "cover" | "contain";
  loop: boolean;
  onEnded?: () => void;
  onError?: () => void;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div className="absolute inset-0" style={{ opacity: on ? 1 : 0, transition: "opacity 650ms ease" }}>
      {item.kind === "video" ? (
        <video src={item.src} autoPlay muted playsInline loop={loop} onEnded={onEnded} onError={onError} className="w-full h-full" style={{ objectFit: fit }} />
      ) : item.kind === "url" ? (
        <iframe src={item.src} title={item.name || "sayfa"} className="w-full h-full border-0" />
      ) : item.kind === "text" ? (
        <TextView item={item} />
      ) : item.kind === "clock" ? (
        <ClockView item={item} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.src} alt={item.name || ""} onError={onError} className="w-full h-full" style={{ objectFit: fit }} />
      )}
    </div>
  );
}

function ZonePlayer({ zone }: { zone: Zone }) {
  const fit = zone.fit === "contain" ? "contain" : "cover";

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const items = useMemo(() => (zone.items ?? []).filter((it) => inWindow(it, now)), [zone.items, now]);
  const len = items.length;

  const [idx, setIdx] = useState(0);
  const advance = useCallback(() => setIdx((i) => i + 1), []);
  // Liste boyutu değişince baştan başla (temiz durum).
  useEffect(() => setIdx(0), [len]);

  const cur = len ? items[idx % len] : undefined;

  // Crossfade katmanları: geçerli öğeyi yığ, 700ms sonra öncekini at.
  const keyRef = useRef(0);
  const [layers, setLayers] = useState<{ key: number; item: ZoneItem }[]>([]);
  useEffect(() => {
    if (!cur) {
      setLayers([]);
      return;
    }
    const k = keyRef.current++;
    setLayers((prev) => [...prev, { key: k, item: cur }].slice(-2));
    const t = window.setTimeout(() => setLayers((prev) => prev.filter((l) => l.key === k)), 700);
    return () => window.clearTimeout(t);
  }, [cur?.id, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Görsel/URL/metin/saat süre sayacı (video kendi bitişinde ilerler).
  useEffect(() => {
    if (!cur || cur.kind === "video" || len <= 1) return;
    const secs = Math.max(2, cur.durationSec ?? 8);
    const t = window.setTimeout(advance, secs * 1000);
    return () => window.clearTimeout(t);
  }, [cur, idx, len, advance]);

  return (
    <div
      className="absolute overflow-hidden bg-black"
      style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.w * 100}%`, height: `${zone.h * 100}%` }}
    >
      {layers.length === 0 ? (
        <div className="w-full h-full grid place-items-center text-white/15 text-sm select-none">FlowSign</div>
      ) : (
        layers.map((l, i) => {
          const top = i === layers.length - 1;
          return (
            <Layer
              key={l.key}
              item={l.item}
              fit={fit}
              loop={top && l.item.kind === "video" && len <= 1}
              onEnded={top && l.item.kind === "video" && len > 1 ? advance : undefined}
              // Bozuk öğe → 2 sn sonra sıradakine geç (tek öğeyse tekrar dener).
              onError={top ? () => window.setTimeout(advance, 2000) : undefined}
            />
          );
        })
      )}
    </div>
  );
}

export default function VideowallPlayPage() {
  const { id } = useParams<{ id: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const [controls, setControls] = useState(false);
  const [fs, setFs] = useState(false);

  useEffect(() => watchVideowall(id, setVw), [id]);

  // Tam ekran tabela: gövde kaydırmasını kapat.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Ekran uyumasın (Wake Lock) — görünürlük değişince yeniden al.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* kullanıcı hareketi gerekebilir; tam ekran butonu tetikler */
      }
    };
    request();
    const onVis = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, []);

  // Fare hareketinde kontrolleri 3 sn göster (aksi hâlde imleç gizli).
  const hideRef = useRef<number | undefined>(undefined);
  const poke = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => setControls(false), 3000);
  }, []);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen();
        // Kullanıcı hareketiyle wake lock'u da dene.
        try {
          await navigator.wakeLock?.request("screen");
        } catch {}
      }
    } catch {}
  };

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Duvar bulunamadı.</main>;

  return (
    <main className={`relative w-screen h-screen bg-black overflow-hidden ${controls ? "" : "cursor-none"}`} onPointerMove={poke}>
      {vw.zones?.map((z) => (
        <ZonePlayer key={z.id} zone={z} />
      ))}

      {/* Tam ekran kontrolü (fare hareketinde belirir) */}
      <button
        onClick={toggleFs}
        className={`fixed bottom-4 right-4 z-50 rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2 text-sm font-semibold transition-opacity ${
          controls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {fs ? "✕ Tam ekrandan çık" : "⛶ Tam ekran"}
      </button>
    </main>
  );
}
