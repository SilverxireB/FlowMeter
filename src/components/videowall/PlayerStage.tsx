"use client";

/**
 * FlowSign yayın sahnesi (oynatma motoru). Duvar tam ekran (100vw×100vh); alanlar
 * oransal (0–1) → fiziksel çözünürlükten bağımsız böler. Her alan kendi listesini
 * döndürür (görsel/video/URL/metin/saat), saat aralığı + gün filtresi, geçiş efekti
 * (fade/cut/slide), bozuk öğe atlama (7/24). Ekran uyumaz (Wake Lock) + tam ekran +
 * ekran tanıma. Görseller önceden yüklenip DECODE edilir → geçişte flaş/boşluk yok.
 * /videowall/[id]/play ve /flowsign/[slug] bunu kullanır.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

type Transition = "fade" | "cut" | "slide";

function inWindow(item: ZoneItem, now: Date): boolean {
  if (item.days?.length && !item.days.includes(now.getDay())) return false;
  if (!item.from && !item.to) return true;
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (item.from && hm < item.from) return false;
  if (item.to && hm > item.to) return false;
  return true;
}

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

function TextView({ item }: { item: ZoneItem }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center px-[6%]" style={{ background: item.bg ?? "#0c3b3b", color: item.color ?? "#fff" }}>
      {item.title && <div className="font-display font-bold leading-tight" style={{ fontSize: "clamp(24px, 6vw, 130px)" }}>{item.title}</div>}
      {item.text && <div className="font-display opacity-90 leading-snug whitespace-pre-wrap" style={{ fontSize: "clamp(14px, 2.6vw, 52px)" }}>{item.text}</div>}
    </div>
  );
}

/** Tek öğe katmanı — güvenilir enter animasyonu (reflow + çift rAF → asla ani
 * zıplama/flaş yapmaz). İçerik alana STRETCH edilir (object-fit: fill). */
function Layer({ item, transition, loop, onEnded, onError }: { item: ZoneItem; transition: Transition; loop: boolean; onEnded?: () => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(transition === "cut");
  useEffect(() => {
    if (transition === "cut") return;
    // Başlangıç (gizli) durumu bir kare boyansın, SONRA animasyonla gir
    // (reflow + çift rAF → sağlam; asla ani zıplama/flaş yapmaz).
    if (ref.current) void ref.current.offsetWidth; // reflow
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [transition]);

  const style =
    transition === "slide"
      ? { transform: on ? "translateX(0)" : "translateX(100%)", transition: "transform 550ms ease" }
      : transition === "cut"
      ? {}
      : { opacity: on ? 1 : 0, transition: "opacity 500ms ease" };

  return (
    <div ref={ref} className="absolute inset-0" style={style}>
      {item.kind === "video" ? (
        <video src={item.src} autoPlay muted playsInline loop={loop} onEnded={onEnded} onError={onError} className="w-full h-full" style={{ objectFit: "fill" }} />
      ) : item.kind === "url" ? (
        <iframe src={item.src} title={item.name || "sayfa"} className="w-full h-full border-0" />
      ) : item.kind === "text" ? (
        <TextView item={item} />
      ) : item.kind === "clock" ? (
        <ClockView item={item} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.src} alt={item.name || ""} onError={onError} className="w-full h-full" style={{ objectFit: "fill" }} />
      )}
    </div>
  );
}

function ZonePlayer({ zone }: { zone: Zone }) {
  const transition: Transition = zone.transition ?? "fade";
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Bütün görselleri önceden yükle + DECODE et → geçişte boş kare/flaş olmaz.
  useEffect(() => {
    (zone.items ?? []).forEach((it) => {
      if (it.kind === "image" && it.src) {
        const img = new Image();
        img.src = it.src;
        img.decode?.().catch(() => {});
      }
    });
  }, [zone.items]);

  const items = useMemo(() => (zone.items ?? []).filter((it) => inWindow(it, now)), [zone.items, now]);
  const len = items.length;

  const [idx, setIdx] = useState(0);
  const advance = useCallback(() => setIdx((i) => i + 1), []);
  useEffect(() => setIdx(0), [len]);

  const cur = len ? items[idx % len] : undefined;
  const next = len > 1 ? items[(idx + 1) % len] : undefined;

  const keyRef = useRef(0);
  const [layers, setLayers] = useState<{ key: number; item: ZoneItem }[]>([]);
  useEffect(() => {
    if (!cur) {
      setLayers([]);
      return;
    }
    const k = keyRef.current++;
    setLayers((prev) => [...prev, { key: k, item: cur }].slice(-2));
    const t = window.setTimeout(() => setLayers((prev) => prev.slice(-1)), transition === "cut" ? 30 : 650);
    return () => window.clearTimeout(t);
  }, [cur?.id, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cur || cur.kind === "video" || len <= 1) return;
    const secs = Math.max(2, cur.durationSec ?? 8);
    const t = window.setTimeout(advance, secs * 1000);
    return () => window.clearTimeout(t);
  }, [cur, idx, len, advance]);

  return (
    <div
      className="absolute overflow-hidden"
      style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.w * 100}%`, height: `${zone.h * 100}%`, background: zone.bg ?? "#000" }}
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
              transition={transition}
              loop={top && l.item.kind === "video" && len <= 1}
              onEnded={top && l.item.kind === "video" && len > 1 ? advance : undefined}
              onError={top ? () => window.setTimeout(advance, 2000) : undefined}
            />
          );
        })
      )}
      {next?.kind === "video" && next.src && <video key={next.src} src={next.src} preload="auto" muted playsInline className="hidden" aria-hidden />}
    </div>
  );
}

export default function PlayerStage({ vw }: { vw: Videowall }) {
  const [controls, setControls] = useState(false);
  const [fs, setFs] = useState(false);
  const [identify, setIdentify] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
        try {
          await navigator.wakeLock?.request("screen");
        } catch {}
      }
    } catch {}
  };

  const showIdentify = () => {
    setIdentify(true);
    window.setTimeout(() => setIdentify(false), 6000);
  };

  const screens = vw.cols * vw.rows;

  return (
    <main className={`relative w-screen h-screen bg-black overflow-hidden ${controls ? "" : "cursor-none"}`} onPointerMove={poke}>
      {vw.zones?.map((z) => (
        <ZonePlayer key={z.id} zone={z} />
      ))}

      {identify && (
        <div className="fixed inset-0 z-40 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${vw.cols},1fr)`, gridTemplateRows: `repeat(${vw.rows},1fr)` }}>
          {Array.from({ length: screens }).map((_, i) => (
            <div key={i} className="border border-[#2dd4bf]/60 bg-[#041a1a]/80 grid place-items-center">
              <span className="font-display font-bold text-[#7ff0e4]" style={{ fontSize: "clamp(40px, 12vw, 260px)" }}>{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <div className={`fixed bottom-4 right-4 z-50 flex gap-2 transition-opacity ${controls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {screens > 1 && <button onClick={showIdentify} className="rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2 text-sm font-semibold">⊞ Ekranları tanı</button>}
        <button onClick={toggleFs} className="rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2 text-sm font-semibold">
          {fs ? "✕ Tam ekrandan çık" : "⛶ Tam ekran"}
        </button>
      </div>
    </main>
  );
}
