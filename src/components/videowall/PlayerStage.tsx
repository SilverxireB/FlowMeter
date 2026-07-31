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
import { Icon } from "@/components/videowall/icons";
import { itemInWindow as inWindow } from "@/lib/videowalls";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

type Transition = "fade" | "cut" | "slide";

/** Yalnız http(s) kaynaklar oynatılır — javascript:/data: XSS'i keser (derin savunma). */
const safeSrc = (src?: string) => (src && /^https?:\/\//i.test(src) ? src : undefined);

function ClockView({ item }: { item: ZoneItem }) {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center" style={{ background: item.bg ?? "#0d102f", color: item.color ?? "#fff" }}>
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
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center px-[6%]" style={{ background: item.bg ?? "#312e81", color: item.color ?? "#fff" }}>
      {item.title && <div className="font-display font-bold leading-tight" style={{ fontSize: "clamp(24px, 6vw, 130px)" }}>{item.title}</div>}
      {item.text && <div className="font-display opacity-90 leading-snug whitespace-pre-wrap" style={{ fontSize: "clamp(14px, 2.6vw, 52px)" }}>{item.text}</div>}
    </div>
  );
}

/** Tek öğe katmanı — güvenilir enter animasyonu (reflow + çift rAF → asla ani
 * zıplama/flaş yapmaz). İçerik alana STRETCH edilir (object-fit: fill).
 * Video: giriş animasyonu İLK KARE HAZIR OLANA dek bekler (loadeddata) —
 * kırpışmanın/siyah boşluğun ana kaynağı boş videonun fade'lenmesiydi. */
function Layer({ item, transition, loop, onEnded, onError }: { item: ZoneItem; transition: Transition; loop: boolean; onEnded?: () => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const isVideo = item.kind === "video";
  const [ready, setReady] = useState(!isVideo);
  const [on, setOn] = useState(transition === "cut");
  // Emniyet: loadeddata hiç gelmezse (yavaş ağ/bozuk dosya) 1.2sn sonra yine gir
  useEffect(() => {
    if (!isVideo || ready) return;
    const t = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(t);
  }, [isVideo, ready]);
  useEffect(() => {
    if (transition === "cut" || !ready) return;
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
  }, [transition, ready]);
  // 7/24 bellek disiplini: video elemanı sökülürken kaynağı gerçekten bırak
  // (docs/VIDEOWALL.md "video release ŞART" kuralı).
  useEffect(() => {
    return () => {
      const v = vidRef.current;
      if (v) {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } catch {}
      }
    };
  }, []);

  // DONMA BEKÇİSİ: ağ koparsa video buffer bitiminde donar — ended de error da
  // gelmez, alan sonsuza dek donuk karede kalırdı. currentTime ~12sn ilerlemezse
  // zorla sıradakine geç (yalnız otomatik akışta ilerletilebilen videolar).
  useEffect(() => {
    if (item.kind !== "video" || !onEnded) return;
    let last = -1;
    let stuckMs = 0;
    let fired = false;
    const iv = window.setInterval(() => {
      const v = vidRef.current;
      if (!v || fired) return;
      if (v.currentTime === last) {
        stuckMs += 4000;
        if (stuckMs >= 12000) {
          fired = true;
          onEnded();
        }
      } else {
        last = v.currentTime;
        stuckMs = 0;
      }
    }, 4000);
    return () => window.clearInterval(iv);
  }, [item.kind, onEnded]);

  const style =
    transition === "slide"
      ? { transform: on ? "translateX(0)" : "translateX(100%)", transition: "transform 550ms ease" }
      : transition === "cut"
      ? {}
      : { opacity: on ? 1 : 0, transition: "opacity 500ms ease" };

  return (
    <div ref={ref} className="absolute inset-0" style={style}>
      {item.kind === "video" ? (
        <video
          ref={vidRef}
          src={safeSrc(item.src)}
          autoPlay
          muted
          playsInline
          loop={loop}
          onLoadedData={() => setReady(true)}
          onEnded={onEnded}
          onError={onError}
          className="w-full h-full"
          style={{ objectFit: "fill" }}
        />
      ) : item.kind === "url" ? (
        // sandbox: üst pencereye yönlendirme/popup/indirme YOK (dashboard script+
        // cookie'yle çalışmaya devam eder). pointer-events-none: tabela salt-görüntü;
        // iframe fare olaylarını yutup kontrollerin belirmesini engellemesin.
        // zoom: sayfa daha BÜYÜK sanal pencerede render edilip ölçeklenir —
        // dashboard grafiklerinin sığması için Chrome'da elle zoom gerekmez.
        <iframe
          src={safeSrc(item.src)}
          title={item.name || "sayfa"}
          sandbox="allow-scripts allow-same-origin allow-forms"
          referrerPolicy="no-referrer"
          className="absolute top-0 left-0 border-0 pointer-events-none"
          style={{
            width: `${10000 / Math.min(150, Math.max(25, item.zoom ?? 100))}%`,
            height: `${10000 / Math.min(150, Math.max(25, item.zoom ?? 100))}%`,
            transform: `scale(${Math.min(150, Math.max(25, item.zoom ?? 100)) / 100})`,
            transformOrigin: "top left",
          }}
        />
      ) : item.kind === "text" ? (
        <TextView item={item} />
      ) : item.kind === "clock" ? (
        <ClockView item={item} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeSrc(item.src)} alt={item.name || ""} onError={onError} className="w-full h-full" style={{ objectFit: "fill" }} />
      )}
    </div>
  );
}

/** Sunum modunda kumandadan gelen gezinme sinyali (n her basışta artar). */
type NavSignal = { dir: 1 | -1; n: number };

function ZonePlayer({
  zone,
  manual = false,
  nav,
  onIndex,
}: {
  zone: Zone;
  /** Sunum modu: otomatik ilerleme kapalı; nav sinyaliyle gezinilir, uçlarda durur. */
  manual?: boolean;
  nav?: NavSignal;
  /** Sayaç için (yalnız en büyük alana verilir): aktif index + toplam. */
  onIndex?: (i: number, len: number) => void;
}) {
  const transition: Transition = zone.transition ?? "fade";
  const [now, setNow] = useState(() => new Date());
  // Takvim tiki dakika sınırına hizalı — "08:00'da başlar" gerçekten 08:00'da başlar
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    const align = window.setTimeout(() => {
      setNow(new Date());
      iv = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000) + 250);
    return () => {
      window.clearTimeout(align);
      if (iv) clearInterval(iv);
    };
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

  // Sunum modu gezinmesi: uçlarda durur (döngü yok — kullanıcının oynatıcısındaki gibi)
  const lastNavN = useRef(0);
  useEffect(() => {
    if (!manual || !nav || nav.n === 0 || nav.n === lastNavN.current) return;
    lastNavN.current = nav.n;
    setIdx((i) => {
      const cur = ((i % Math.max(1, len)) + len) % Math.max(1, len);
      return Math.min(len - 1, Math.max(0, cur + nav.dir));
    });
  }, [nav, manual, len]);

  const cur = len ? items[((idx % len) + len) % len] : undefined;

  // Saat penceresi bir öğeyi düşürünce/ekleyince akış BAŞA SARMAZ: gösterilen
  // öğe hâlâ listedeyse kaldığı yerden sürer, değilse sıradakine geçilir.
  const curIdRef = useRef<string | undefined>(undefined);
  curIdRef.current = cur?.id ?? curIdRef.current;
  useEffect(() => {
    if (!len) return;
    const keep = items.findIndex((it) => it.id === curIdRef.current);
    setIdx((i) => (keep >= 0 ? keep : i % len));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len]);
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
    // Eski katman, YENİ katman görünür olana dek kalmalı: video ilk karesini
    // bekleyebildiğinden (loadeddata + 1.2sn emniyet) videoda pencere daha uzun —
    // yoksa alt katman erken sökülüp siyah boşluk/kırpışma görünüyordu.
    const holdMs = transition === "cut" ? 30 : cur.kind === "video" ? 2000 : 650;
    const t = window.setTimeout(() => setLayers((prev) => prev.slice(-1)), holdMs);
    return () => window.clearTimeout(t);
  }, [cur?.id, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sayaç bildirimi (sunum modunda sağ alt "3 / 12")
  useEffect(() => {
    if (!onIndex || !len) return;
    onIndex((((idx % len) + len) % len) + 1, len);
  }, [idx, len, onIndex]);

  // TEK ÖĞELİ URL BEKÇİSİ: hiç rotasyon olmadığından iframe bir kez açılıp
  // günlerce kalıyordu (oturumu dolan dashboard donuk hata sayfasında takılır).
  // 15 dk'da bir sessizce yeniden yüklenir; çoklu listeyi rotasyon zaten tazeler.
  const [urlEpoch, setUrlEpoch] = useState(0);
  useEffect(() => {
    if (manual || len !== 1 || cur?.kind !== "url") return;
    const iv = window.setInterval(() => setUrlEpoch((e) => e + 1), 15 * 60_000);
    return () => window.clearInterval(iv);
  }, [manual, len, cur?.kind]);

  useEffect(() => {
    if (manual) return; // sunum modu: otomatik ilerleme YOK — kumanda söyler
    if (!cur || len <= 1) return;
    // Video: süre girilmişse ÜST SINIR (10 dk'lık video döngüyü kilitlemesin);
    // girilmemişse kendi bitişinde ilerler (onEnded). Diğer türler: gösterim süresi.
    if (cur.kind === "video" && !cur.durationSec) return;
    const secs = Math.max(2, cur.durationSec ?? 8);
    const t = window.setTimeout(advance, secs * 1000);
    return () => window.clearTimeout(t);
  }, [cur, idx, len, advance, manual]);

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
              key={`${l.key}-${urlEpoch}`}
              item={l.item}
              transition={transition}
              /* Sunum modunda video hep loop eder (sayfada kaldıkça döner) */
              loop={top && l.item.kind === "video" && (manual || len <= 1)}
              onEnded={top && !manual && l.item.kind === "video" && len > 1 ? advance : undefined}
              onError={top && !manual ? () => window.setTimeout(advance, 2000) : undefined}
            />
          );
        })
      )}
      {next?.kind === "video" && next.src && <video key={next.src} src={next.src} preload="auto" muted playsInline className="hidden" aria-hidden />}
    </div>
  );
}

export default function PlayerStage({ vw, draft = false }: { vw: Videowall; draft?: boolean }) {
  const [controls, setControls] = useState(false);
  const [fs, setFs] = useState(false);
  const [identify, setIdentify] = useState(false);

  // YAYIN modunda kaydedilmiş anlık görüntü oynar (editör taslağı ekranı bozamaz);
  // draft=true → editörün "Önizle"si. Eski duvarda live yoksa taslağa düşülür.
  const stage = draft ? vw : vw.live ?? vw;

  // ── SUNUM MODU: kumanda/klavye ile gezinme (tabela ekranlarını etkilemez) ──
  const manual = (vw.playMode ?? "auto") === "manual";
  const [nav, setNav] = useState<NavSignal>({ dir: 1, n: 0 });
  const [black, setBlack] = useState(false);
  const [counter, setCounter] = useState<{ i: number; len: number } | null>(null);
  const [counterDim, setCounterDim] = useState(true);
  const counterTimer = useRef<number | undefined>(undefined);
  const lastKeyRef = useRef(0);
  const onIndex = useCallback((i: number, len: number) => {
    setCounter({ i, len });
    setCounterDim(false);
    window.clearTimeout(counterTimer.current);
    counterTimer.current = window.setTimeout(() => setCounterDim(true), 1200);
  }, []);
  // Sayaç en büyük alana bağlanır (tipik kullanım: tek tam-ekran alan)
  const biggestZoneId = useMemo(() => {
    let best: Zone | null = null;
    for (const z of stage.zones ?? []) if (!best || z.w * z.h > best.w * best.h) best = z;
    return best?.id;
  }, [stage.zones]);

  useEffect(() => {
    if (!manual) return;
    const FWD: Record<string, 1> = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, " ": 1, Spacebar: 1, Enter: 1 };
    const BACK: Record<string, 1> = { ArrowLeft: 1, ArrowUp: 1, PageUp: 1, Backspace: 1 };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key;
      // Bazı kumandalar "sunumu başlat" için F5 gönderir — sayfa YENİLENMESİN
      if (k === "F5") {
        e.preventDefault();
        void document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (k === "b" || k === "B" || k === ".") {
        e.preventDefault();
        setBlack((v) => !v);
        return;
      }
      if (k === "f" || k === "F") {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (FWD[k] || BACK[k]) {
        e.preventDefault();
        const nowMs = Date.now();
        if (nowMs - lastKeyRef.current < 150) return; // kumanda çift sinyal koruması
        lastKeyRef.current = nowMs;
        setBlack(false);
        setNav((p) => ({ dir: FWD[k] ? 1 : -1, n: p.n + 1 }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manual]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Wake Lock: tek referansta tutulur (sızıntı yok); otomatik istek reddedilirse
  // İLK kullanıcı dokunuşunda bir kez daha denenir (ekran sessizce uyumasın).
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const requestWake = useCallback(async () => {
    try {
      await wakeRef.current?.release?.().catch(() => {});
      wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* kullanıcı hareketi gerekebilir; pointerdown/tam ekran yeniden dener */
    }
  }, []);
  useEffect(() => {
    requestWake();
    const onVis = () => document.visibilityState === "visible" && requestWake();
    const onFirstPointer = () => {
      if (!wakeRef.current) requestWake();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointerdown", onFirstPointer, { once: true });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", onFirstPointer);
      wakeRef.current?.release?.().catch(() => {});
    };
  }, [requestWake]);

  // GECE TAZELEME (yalnız gerçek yayın): ~04:00-04:10 arası sessiz reload —
  // günlerce birikmiş bellek temizlenir, kopuk ne varsa tazelenir ve yeni
  // deploy edilen sürüm alınır (perde eski JS'te sonsuza dek kalmaz).
  useEffect(() => {
    if (draft) return;
    const now = new Date();
    const next = new Date(now);
    next.setHours(4, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const jitter = Math.floor(Math.random() * 10 * 60_000); // ekranlar aynı anda gitmesin
    const t = window.setTimeout(() => window.location.reload(), next.getTime() - now.getTime() + jitter);
    return () => window.clearTimeout(t);
  }, [draft]);

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
        await requestWake(); // kullanıcı hareketi var → reddedilmişse şimdi alınır
      }
    } catch {}
  };

  const showIdentify = () => {
    setIdentify(true);
    window.setTimeout(() => setIdentify(false), 6000);
  };

  const screens = stage.cols * stage.rows;

  return (
    // onPointerDown da poke: dokunmatik ekranda "tap" move üretmez — kontroller
    // yoksa tam ekran butonuna hiç ulaşılamıyordu.
    <main className={`relative w-screen h-screen bg-black overflow-hidden ${controls ? "" : "cursor-none"}`} onPointerMove={poke} onPointerDown={poke}>
      {stage.zones?.map((z) => (
        <ZonePlayer
          key={z.id}
          zone={z}
          manual={manual}
          nav={manual ? nav : undefined}
          onIndex={manual && z.id === biggestZoneId ? onIndex : undefined}
        />
      ))}

      {/* Sunum modu katmanları: siyah ekran (B) + sayaç */}
      {manual && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black pointer-events-none transition-opacity duration-150"
          style={{ opacity: black ? 1 : 0 }}
        />
      )}
      {manual && counter && (
        <div
          className={`fixed bottom-5 right-6 z-40 rounded-xl bg-black/40 px-4 py-1.5 text-white text-2xl font-semibold tabular-nums transition-opacity duration-500 ${counterDim ? "opacity-0" : "opacity-90"}`}
          aria-hidden
        >
          {counter.i} / {counter.len}
        </div>
      )}

      {/* Önizleme rozeti — taslağı izlediğin belli olsun */}
      {draft && (
        <div className="fixed top-4 left-4 z-50 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white/80 px-4 py-1.5 text-xs font-semibold">
          👁 Önizleme — taslak (yayında olmayabilir)
        </div>
      )}

      {identify && (
        <div className="fixed inset-0 z-40 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${stage.cols},1fr)`, gridTemplateRows: `repeat(${stage.rows},1fr)` }}>
          {Array.from({ length: screens }).map((_, i) => (
            <div key={i} className="border border-[#6366f1]/60 bg-[#0d102f]/80 grid place-items-center">
              <span className="font-display font-bold text-[#a5b4fc]" style={{ fontSize: "clamp(40px, 12vw, 260px)" }}>{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <div className={`fixed bottom-4 right-4 z-50 flex gap-2 transition-opacity ${controls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {screens > 1 && (
          <button onClick={showIdentify} className="rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5">
            <Icon name="grid" size={15} /> Ekranları tanı
          </button>
        )}
        <button onClick={toggleFs} className="rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5">
          <Icon name={fs ? "close" : "expand"} size={15} /> {fs ? "Tam ekrandan çık" : "Tam ekran"}
        </button>
      </div>
    </main>
  );
}
