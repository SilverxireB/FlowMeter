"use client";

/**
 * FlowWall perde ekranı — projeksiyon gösterisi. Kokpitten seçilen `screenMode`
 * ile 5 farklı görünüm:
 *  - stage    : ortada büyük anı (Ken Burns + crossfade) + yanlarda akan şeritler
 *  - mosaic   : tüm anılar canlı, kayan bir ızgarada
 *  - spotlight: rastgele bir anı öne çıkar, diğerleri arkada soluk
 *  - polaroid : masaya saçılan eğik polaroid kartlar, en yenisi tepeye düşer
 *  - cinema   : tam ekran tek anı, sinematik geçiş
 * Ortak: tema arka planı, köşe logo/sayaç, katılım kartı, ✨ yeni anı, ❤ en sevilen.
 * Yalnız onaylı (approved) medya gösterilir.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import WallEffectLayer from "@/components/wall/WallEffectLayer";
import WallReactionOverlay from "@/components/wall/WallReactionOverlay";
import WallContest from "@/components/wall/WallContest";
import WallWishes from "@/components/wall/WallWishes";
import WallAnnouncement from "@/components/wall/WallAnnouncement";
import WallMilestone from "@/components/wall/WallMilestone";
import WallTopLoved from "@/components/wall/WallTopLoved";
import { useWall, useWallMedia, useWallWishes } from "@/lib/hooks";
import { resolveCode } from "@/lib/walls";
import { cldFit, cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { wallThemeStyle } from "@/lib/themes";
import { BASE_WALL_SCREEN_MODES, WALL_SCREEN_MODES, WallMedia, WallScreenMode, wallEffectOf } from "@/lib/types";

const IMAGE_MS = 6500; // tüm modlarda fotoğraf sahne süresi
const VIDEO_CAP_MS = 12000; // uzun videoları kesme sınırı

export default function WallScreen() {
  const { id: raw } = useParams<{ id: string }>();

  const [wallId, setWallId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (/^\d{6}$/.test(raw)) {
      resolveCode(raw).then((t) => setWallId(t?.kind === "wall" ? t.id : null)).catch(() => setWallId(null));
    } else {
      setWallId(raw);
    }
  }, [raw]);

  const { wall } = useWall(wallId ?? null);
  const allMedia = useWallMedia(wallId ?? null);
  const media = useMemo(() => allMedia.filter((m) => m.status === "approved"), [allMedia]);
  const allWishes = useWallWishes(wallId ?? null);
  const wishes = useMemo(() => allWishes.filter((w) => (w.status ?? "approved") === "approved"), [allWishes]);

  // Baskın renk ambiyansı — en son anının renginden perdeye yumuşak tint.
  const latest = media.length ? media[media.length - 1] : null;
  const ambientThumb = latest ? (latest.type === "video" ? cldVideoPoster(latest.url, 32, 32) : cldThumb(latest.url, 32, 32)) : undefined;
  const ambientColor = useDominantColor(ambientThumb);

  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => {
    if (wallId) setJoinUrl(`${window.location.origin}/u/${wallId}`);
  }, [wallId]);

  // Perde modu — "auto" ise seçili modlar arasında belirlenen aralıkla döner.
  const stored: WallScreenMode = wall?.screenMode ?? "stage";
  const autoInterval = Math.max(8, wall?.autoIntervalSec ?? 30);
  const autoModes = useMemo(() => {
    const base = BASE_WALL_SCREEN_MODES.map((m) => m.id);
    const chosen = (wall?.autoModes ?? base).filter((m) => m !== "auto");
    return chosen.length ? chosen : base;
  }, [wall?.autoModes]);
  const [autoIdx, setAutoIdx] = useState(0);
  useEffect(() => {
    if (stored !== "auto") return;
    setAutoIdx(0);
    const t = window.setInterval(() => setAutoIdx((i) => i + 1), autoInterval * 1000);
    return () => window.clearInterval(t);
  }, [stored, autoInterval, autoModes]);
  const mode: WallScreenMode = stored === "auto" ? autoModes[autoIdx % autoModes.length] : stored;

  const { style: themeStyleObj, dark: themeDark } = wallThemeStyle(wall?.theme);

  // En sevilen anı (en çok beğeni; eşitlikte en yenisi). >0 beğeni şart.
  const topLovedId = useMemo(() => {
    let best: WallMedia | null = null;
    for (const m of media) {
      const l = m.likes ?? 0;
      if (l > 0 && (!best || l > (best.likes ?? 0))) best = m;
    }
    return best?.id ?? null;
  }, [media]);

  // Ortak oynatma denetleyicisi — tekil-foto modları (Sahne/Sinema/Spot) için:
  // ağırlıklı adil seçim + YENİ foto anında açılır + tüm modlarda AYNI süre.
  const play = usePagedPlayback(media);

  if (wallId === null) {
    return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/70">Duvar bulunamadı.</main>;
  }

  const textClass = themeDark ? "text-white" : "text-ink";
  const mutedClass = themeDark ? "text-white/60" : "text-ink/60";
  const cardChrome = themeDark ? "bg-white/10 border border-white/15" : "bg-black/5 border border-black/10";

  return (
    <main className={`relative h-screen overflow-hidden ${textClass}`} style={themeStyleObj}>
      <WallEffectLayer effect={wallEffectOf(wall)} />
      {typeof wallId === "string" && <WallReactionOverlay wallId={wallId} />}

      {/* Baskın renk ambiyansı (en son anının renginden) */}
      {ambientColor && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none transition-[background] duration-1000"
          style={{
            background: `radial-gradient(75% 55% at 50% 22%, ${ambientColor}, transparent 72%)`,
            opacity: themeDark ? 0.4 : 0.26,
            mixBlendMode: themeDark ? "screen" : "multiply",
          }}
        />
      )}

      {/* Mod içeriği — auto'da mod değişince yumuşak geçiş için key+fade */}
      <div key={mode} className="relative z-10 h-full ww-fade">
        {media.length === 0 ? (
          <EmptyState mutedClass={mutedClass} />
        ) : mode === "mosaic" ? (
          <MosaicMode media={media} themeDark={themeDark} topLovedId={topLovedId} />
        ) : mode === "spotlight" ? (
          <SpotlightMode media={media} themeDark={themeDark} topLovedId={topLovedId} hero={play.current} />
        ) : mode === "polaroid" ? (
          <PolaroidMode media={media} themeDark={themeDark} topLovedId={topLovedId} />
        ) : mode === "timeline" ? (
          <TimelineMode media={media} themeDark={themeDark} />
        ) : mode === "cinema" ? (
          <CinemaMode media={media} topLovedId={topLovedId} current={play.current} advance={play.advance} />
        ) : (
          <StageMode media={media} themeDark={themeDark} topLovedId={topLovedId} current={play.current} advance={play.advance} />
        )}
      </div>

      {/* ✨ Yeni anı — global, tüm modlarda görünür */}
      <WallNewMemory media={media} />

      {/* Başlık (üst orta) */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 text-center px-4 w-full max-w-[70vw] pointer-events-none">
        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-balance drop-shadow-lg">
          {wall?.headline || wall?.title || "FlowWall"}
        </h1>
      </div>

      {/* Dilek bandı (başlık altında dönen kart) */}
      <WallWishes wishes={wishes} themeDark={themeDark} />

      {/* Katılım kartı (alt orta) */}
      <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 rounded-2xl px-4 py-3 backdrop-blur-md shadow-xl ${cardChrome}`}>
        {joinUrl && (
          <div className="bg-white rounded-xl p-1.5 shrink-0 shadow-sm border border-black/5">
            <QrCode text={joinUrl} size={82} />
          </div>
        )}
        <div className="text-left">
          <p className={`text-[11px] uppercase tracking-[0.2em] ${mutedClass}`}>Katıl · paylaş</p>
          <p className="font-display text-3xl font-bold tabular-nums tracking-[0.12em] leading-tight">
            {wall?.joinCode || "——————"}
          </p>
          <p className={`text-xs ${mutedClass}`}>flowwall — fotoğrafını at, perdede parla</p>
        </div>
      </div>

      {/* Köşe süsleri */}
      <div className="absolute top-5 left-5 z-20 opacity-90">
        <Logo variant="wall" onDark={themeDark} size="sm" />
      </div>
      {media.length > 0 && (
        <div className={`absolute top-5 right-5 z-20 rounded-full px-3 py-1 text-xs font-semibold tabular-nums backdrop-blur ${cardChrome}`}>
          {media.length} anı
        </div>
      )}
      {stored === "auto" && (
        <div className={`absolute top-14 right-5 z-20 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur ${cardChrome}`}>
          🔀 {WALL_SCREEN_MODES.find((m) => m.id === mode)?.name ?? mode}
        </div>
      )}

      {/* En sevilenler highlight turu (periyodik) + milestone kutlamaları */}
      {media.length > 0 && <WallTopLoved media={media} everySec={wall?.topLovedEverySec ?? 120} />}
      <WallMilestone count={media.length} enabled={wall?.milestones !== false} />

      {/* Foto yarışması (running: ilk 3 turu + rozet; ended: kazanan takeover) */}
      {typeof wallId === "string" && wall && <WallContest wallId={wallId} wall={wall} media={media} />}

      {/* Canlı anons (moderasyondan; süresi dolunca kaybolur) */}
      <WallAnnouncement announcement={wall?.announcement} />

      <WallStyles />
    </main>
  );
}

// ── Ortak parçalar ────────────────────────────────────────────────────────────

function EmptyState({ mutedClass }: { mutedClass: string }) {
  return (
    <div className="h-full grid place-items-center">
      <div className="text-center">
        <div className="text-7xl mb-6 ww-pulse" aria-hidden>📷</div>
        <p className="text-3xl font-bold mb-2">İlk anı sen paylaş</p>
        <p className={`text-lg ${mutedClass}`}>QR&apos;ı okut, fotoğrafını yükle — birazdan burada parlayacak.</p>
      </div>
    </div>
  );
}

/** Beğeni pili — perdede yalnız gösterim (>0 ise). */
function LikePill({ likes, large }: { likes?: number; large?: boolean }) {
  if (!likes || likes <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-black/45 text-white font-bold backdrop-blur tabular-nums shadow ${
        large ? "text-base px-3 py-1" : "text-xs px-2 py-0.5"
      }`}
    >
      <span className="ww-heart" aria-hidden>❤</span>
      {likes}
    </span>
  );
}

/** "En sevilen" altın kurdele. */
function LovedRibbon() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold text-[#3a2a00] shadow-lg ww-glow"
      style={{ background: "linear-gradient(135deg,#ffe27a,#f6b73c)" }}>
      👑 En sevilen
    </span>
  );
}

function mediaPoster(m: WallMedia, w = 500, h = 500) {
  return m.type === "video" ? cldVideoPoster(m.url, w, h) : cldThumb(m.url, w, h);
}

/**
 * Ortak oynatma denetleyicisi (tekil-foto modları için).
 *  - Ağırlıklı adil seçim: taze foto öne, aynı kişi arka arkaya gelmez,
 *    az gösterilen öne, beğeni bonusu, küçük rastgelelik.
 *  - Yeni foto gelince ANINDA ona geçer (kesintisiz — en kritik davranış).
 *  - Kalma süresi tüm modlarda AYNI (IMAGE_MS / video cap).
 * advance() kimlik olarak sabittir (ref'lerle) → zamanlayıcı kararsızlaşmaz.
 */
function usePagedPlayback(media: WallMedia[]): { current: WallMedia | null; advance: () => void } {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const currentIdRef = useRef<string | null>(null);
  const playCounts = useRef<Record<string, number>>({});
  const lastByVoter = useRef<Record<string, number>>({});
  const knownIds = useRef<Set<string>>(new Set());

  const current = useMemo(
    () => media.find((m) => m.id === currentId) ?? media[media.length - 1] ?? null,
    [media, currentId]
  );
  currentIdRef.current = current?.id ?? null;

  const advance = useCallback(() => {
    const list = mediaRef.current;
    if (!list.length) { setCurrentId(null); return; }
    if (list.length === 1) { setCurrentId(list[0].id); return; }
    const now = Date.now();
    const curId = currentIdRef.current;
    let bestId = list[0].id;
    let best = -Infinity;
    for (const m of list) {
      if (m.id === curId) continue;
      let s = 1 + Math.random() * 0.5;
      const age = now - (m.createdAt?.toMillis?.() ?? now);
      if (age < 5 * 60000) s += 2; else if (age < 15 * 60000) s += 0.8;
      if (m.voterId) { const t = lastByVoter.current[m.voterId] ?? 0; if (now - t < 30000) s -= 5; }
      s -= (playCounts.current[m.id] ?? 0) * 0.4;
      s += (m.likes ?? 0) * 0.2;
      if (s > best) { best = s; bestId = m.id; }
    }
    playCounts.current[bestId] = (playCounts.current[bestId] ?? 0) + 1;
    const bm = list.find((m) => m.id === bestId);
    if (bm?.voterId) lastByVoter.current[bm.voterId] = now;
    setCurrentId(bestId);
  }, []);

  // Yeni medya → anında ona geç (ilk yüklemede baseline kurar, atlamaz).
  useEffect(() => {
    let newest: WallMedia | null = null;
    for (const m of media) if (!knownIds.current.has(m.id)) newest = m; // asc → son yeni = en yeni
    const first = knownIds.current.size === 0;
    knownIds.current = new Set(media.map((m) => m.id));
    if (first) { if (media.length) setCurrentId(media[media.length - 1].id); return; }
    if (newest) {
      playCounts.current[newest.id] = (playCounts.current[newest.id] ?? 0) + 1;
      if (newest.voterId) lastByVoter.current[newest.voterId] = Date.now();
      setCurrentId(newest.id);
    }
  }, [media]);

  // Kalma süresi zamanlayıcısı — yalnız aktif id/tip değişince yeniden kurulur.
  const curId = current?.id;
  const curType = current?.type;
  useEffect(() => {
    if (!curId) return;
    const dur = curType === "video" ? VIDEO_CAP_MS : IMAGE_MS;
    const t = window.setTimeout(advance, dur);
    return () => window.clearTimeout(t);
  }, [curId, curType, advance]);

  return { current, advance };
}

/** ✨ Yeni anı — global rozet; yeni medya gelince ~5 sn görünür (TÜM modlarda). */
function WallNewMemory({ media }: { media: WallMedia[] }) {
  const [show, setShow] = useState<WallMedia | null>(null);
  const known = useRef<Set<string>>(new Set());
  useEffect(() => {
    let newest: WallMedia | null = null;
    for (const m of media) if (!known.current.has(m.id)) newest = m;
    const first = known.current.size === 0;
    known.current = new Set(media.map((m) => m.id));
    if (first || !newest) return;
    setShow(newest);
    const t = window.setTimeout(() => setShow(null), 5000);
    return () => window.clearTimeout(t);
  }, [media]);

  if (!show) return null;
  const poster = mediaPoster(show, 120, 120);
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 ww-pop pointer-events-none">
      <div className="flex items-center gap-2.5 rounded-full bg-[#e34948] text-white pl-2 pr-4 py-1.5 shadow-2xl">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white/40" />
        )}
        <span className="text-sm font-bold">✨ Yeni anı{show.nickname ? ` · ${show.nickname}` : ""}</span>
      </div>
    </div>
  );
}

// ── Mod: SAHNE (mevcut resital) ───────────────────────────────────────────────

function StageMode({ media, themeDark, topLovedId, current, advance }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null; current: WallMedia | null; advance: () => void }) {
  const strips = splitStrips(media);
  const backdrop = current ? mediaPoster(current, 500, 500) : "";

  return (
    <div className="h-full flex">
      {backdrop && (
        <>
          <div
            key={"bg-" + current?.id}
            aria-hidden
            className="absolute inset-0 -z-0 ww-fade"
            style={{
              backgroundImage: `url(${backdrop})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(60px) brightness(0.42) saturate(1.3)",
              transform: "scale(1.25)",
            }}
          />
          <div aria-hidden className="absolute inset-0 -z-0" style={{ background: themeDark ? "radial-gradient(120% 100% at 50% 40%, transparent 40%, rgba(5,9,28,0.80) 100%)" : "radial-gradient(120% 100% at 50% 40%, transparent 30%, rgba(255,255,255,0.92) 100%)" }} />
        </>
      )}
      <Strip items={strips.left} side="left" themeDark={themeDark} />
      <section className="flex-1 flex flex-col items-center justify-center px-4 min-w-0 relative z-10">
        {current && <Stage media={current} loved={current.id === topLovedId} onEnded={advance} themeDark={themeDark} />}
      </section>
      <Strip items={strips.right} side="right" themeDark={themeDark} />
    </div>
  );
}

function Stage({ media, loved, onEnded, themeDark }: { media: WallMedia; loved: boolean; onEnded: () => void; themeDark: boolean }) {
  return (
    <figure key={media.id} className="relative flex flex-col items-center ww-pop">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10" style={{ maxHeight: "68vh" }}>
        {media.type === "video" ? (
          <video src={cldFit(media.url, 1400)} autoPlay muted playsInline preload="auto" onEnded={onEnded} onError={onEnded}
            className="max-h-[54vh] sm:max-h-[64vh] max-w-full object-contain block bg-black" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldFit(media.url, 1600)} alt="" className="max-h-[54vh] sm:max-h-[64vh] max-w-full object-contain block ww-ken" />
        )}
        {(media.likes ?? 0) > 0 && <div className="absolute bottom-2 right-2"><LikePill likes={media.likes} large /></div>}
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
        {loved && <LovedRibbon />}
        {media.nickname && (
          <figcaption className={`px-4 py-1.5 rounded-full border text-sm font-semibold backdrop-blur ${themeDark ? "bg-white/12 border-white/10 text-white/90" : "bg-black/5 border-black/10 text-ink/90"}`}>
            {media.nickname}
          </figcaption>
        )}
      </div>
    </figure>
  );
}

/** Dikey akan küçük resim şeridi (üst/alt fade maskeli). */
function Strip({ items, side, themeDark }: { items: WallMedia[]; side: "left" | "right"; themeDark: boolean }) {
  if (items.length === 0) return <div className="w-14 sm:w-20 md:w-40 xl:w-56 shrink-0" aria-hidden />;
  const loop = [...items, ...items];
  const dur = Math.max(22, items.length * 6);
  return (
    <div className="relative block w-14 sm:w-20 md:w-40 xl:w-56 shrink-0 overflow-hidden z-10"
      style={{ maskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)" }}>
      <div className="flex flex-col gap-3 p-3 ww-marquee" style={{ animationDuration: `${dur}s`, animationDirection: side === "right" ? "reverse" : "normal" }}>
        {loop.map((m, i) => (
          <StripThumb key={m.id + "-" + i} m={m} themeDark={themeDark} />
        ))}
      </div>
    </div>
  );
}

function StripThumb({ m, themeDark }: { m: WallMedia; themeDark: boolean }) {
  const poster = mediaPoster(m, 320, 320);
  return (
    <div className={`relative w-full aspect-square rounded-xl overflow-hidden border shadow-lg ${themeDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"}`}>
      {m.type === "video" && !poster ? (
        <video src={m.url + "#t=0.5"} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      )}
      {m.type === "video" && <span className="absolute bottom-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/55 text-white text-[10px]">▶</span>}
      {(m.likes ?? 0) > 0 && <div className="absolute top-1 left-1"><LikePill likes={m.likes} /></div>}
    </div>
  );
}

function splitStrips(media: WallMedia[]): { left: WallMedia[]; right: WallMedia[] } {
  const recent = [...media].reverse().slice(0, 24);
  const left: WallMedia[] = [];
  const right: WallMedia[] = [];
  recent.forEach((m, i) => (i % 2 === 0 ? left : right).push(m));
  return { left, right };
}

// ── Mod: MOZAİK (kayan çok sütunlu ızgara) ────────────────────────────────────

function MosaicMode({ media, themeDark, topLovedId }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null }) {
  // 5 sütuna round-robin dağıt; her sütun dikey marquee (alternatif yön/hız).
  const cols = useMemo(() => {
    const N = 5;
    const buckets: WallMedia[][] = Array.from({ length: N }, () => []);
    media.forEach((m, i) => buckets[i % N].push(m));
    return buckets;
  }, [media]);

  return (
    <div className="h-full flex gap-3 px-3 pt-20 pb-28 justify-center">
      {cols.map((col, ci) => {
        if (col.length === 0) return null;
        const loop = [...col, ...col];
        const dur = Math.max(26, col.length * 8) + ci * 3;
        return (
          <div key={ci} className={`relative flex-1 min-w-0 overflow-hidden ${ci >= 3 ? "hidden lg:block" : ci >= 2 ? "hidden sm:block" : ""}`}
            style={{ maskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 92%, transparent)" }}>
            <div className="flex flex-col gap-3 ww-marquee" style={{ animationDuration: `${dur}s`, animationDirection: ci % 2 === 0 ? "normal" : "reverse" }}>
              {loop.map((m, i) => (
                <MosaicTile key={m.id + "-" + i} m={m} themeDark={themeDark} loved={m.id === topLovedId} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MosaicTile({ m, themeDark, loved }: { m: WallMedia; themeDark: boolean; loved: boolean }) {
  const ratio = m.w && m.h ? m.w / m.h : 1;
  const poster = m.type === "video" ? cldVideoPoster(m.url, 640, Math.round(640 / (ratio || 1))) : cldFit(m.url, 640);
  return (
    <div className={`relative w-full rounded-2xl overflow-hidden shadow-lg border ${loved ? "ring-2 ring-[#f6b73c] border-[#f6b73c]" : themeDark ? "border-white/10" : "border-black/10"}`}
      style={{ aspectRatio: `${ratio || 1}` }}>
      {m.type === "video" && !poster ? (
        <video src={m.url + "#t=0.5"} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      )}
      {m.type === "video" && <span className="absolute bottom-1.5 right-1.5 grid place-items-center w-7 h-7 rounded-full bg-black/55 text-white text-xs">▶</span>}
      {(m.likes ?? 0) > 0 && <div className="absolute top-1.5 left-1.5"><LikePill likes={m.likes} /></div>}
      {loved && <div className="absolute top-1.5 right-1.5">👑</div>}
      {m.nickname && (
        <span className="absolute bottom-0 inset-x-0 px-2 py-1 text-white text-xs font-semibold truncate bg-gradient-to-t from-black/60 to-transparent">{m.nickname}</span>
      )}
    </div>
  );
}

// ── Mod: SPOTLIGHT (öne çıkan + soluk arka) ───────────────────────────────────

function SpotlightMode({ media, themeDark, topLovedId, hero }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null; hero: WallMedia | null }) {
  const ring = useMemo(() => media.filter((m) => m.id !== hero?.id).slice(-14), [media, hero?.id]);

  return (
    <div className="relative h-full overflow-hidden">
      {/* Arka halka — soluk kayan thumbnaillar */}
      <div className="absolute inset-0 grid grid-cols-4 md:grid-cols-6 gap-2 p-2 pt-20 pb-28 opacity-30 blur-[1px]">
        {ring.map((m) => (
          <div key={m.id} className={`relative aspect-square rounded-xl overflow-hidden border ${themeDark ? "border-white/10" : "border-black/10"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaPoster(m, 300, 300)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
      {/* Merkez spot */}
      <div className="absolute inset-0 grid place-items-center px-4">
        {hero && (
          <figure key={hero.id} className="relative flex flex-col items-center ww-spot">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-2 ring-white/20" style={{ maxHeight: "62vh", boxShadow: "0 0 120px rgba(255,255,255,0.15)" }}>
              {hero.type === "video" ? (
                <video src={cldFit(hero.url, 1200)} autoPlay muted playsInline preload="auto" className="max-h-[58vh] max-w-[80vw] object-contain block bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cldFit(hero.url, 1400)} alt="" className="max-h-[58vh] max-w-[80vw] object-contain block" />
              )}
              {(hero.likes ?? 0) > 0 && <div className="absolute bottom-2 right-2"><LikePill likes={hero.likes} large /></div>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {hero.id === topLovedId && <LovedRibbon />}
              {hero.nickname && (
                <figcaption className={`px-4 py-1.5 rounded-full border text-sm font-semibold backdrop-blur ${themeDark ? "bg-white/12 border-white/10 text-white/90" : "bg-black/5 border-black/10 text-ink/90"}`}>
                  {hero.nickname}
                </figcaption>
              )}
            </div>
          </figure>
        )}
      </div>
    </div>
  );
}

// ── Mod: POLAROID (saçılan eğik kartlar) ──────────────────────────────────────

function PolaroidMode({ media, topLovedId }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null }) {
  // Arka: saçılan küçük/soluk polaroidler (dağınık masa hissi).
  const back = useMemo(() => [...media].slice(-12), [media]);
  // Ön: tek büyük polaroid, dönerek öne çıkar.
  const [idx, setIdx] = useState(0);
  const prevLen = useRef(0);

  useEffect(() => {
    if (media.length > prevLen.current && prevLen.current > 0) setIdx(media.length - 1);
    prevLen.current = media.length;
  }, [media.length]);

  useEffect(() => {
    if (media.length < 2) return;
    const t = window.setInterval(() => setIdx((i) => i + 1), IMAGE_MS);
    return () => window.clearInterval(t);
  }, [media.length]);

  const front = media.length ? media[((idx % media.length) + media.length) % media.length] : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Arka yığın — küçük, soluk, dağınık */}
      {back.map((m, i) => {
        const seed = hashStr(m.id);
        const left = 5 + ((seed % 1000) / 1000) * 82; // %
        const top = 12 + (((seed >> 3) % 1000) / 1000) * 66; // %
        const rot = -16 + (((seed >> 6) % 32)); // -16..+16
        return (
          <div
            key={m.id}
            className="absolute ww-float rounded-sm bg-white shadow-xl"
            style={{ left: `${left}%`, top: `${top}%`, transform: `rotate(${rot}deg)`, zIndex: 5, width: "clamp(78px, 9vw, 140px)", padding: "5px 5px 20px", opacity: 0.5, animationDelay: `${(i % 8) * 0.4}s` }}
          >
            <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaPoster(m, 260, 260)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
        );
      })}

      {/* Ön: tekil büyük polaroid */}
      {front && (
        <div className="absolute inset-0 grid place-items-center">
          <figure key={front.id} className="ww-drop rounded-sm bg-white shadow-2xl" style={{ transform: "rotate(-3deg)", width: "clamp(240px, 33vw, 430px)", padding: "14px 14px 56px", zIndex: 30 }}>
            <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "1" }}>
              {front.type === "video" ? (
                <video src={cldFit(front.url, 900)} autoPlay muted playsInline preload="auto" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPoster(front, 760, 760)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              {(front.likes ?? 0) > 0 && <div className="absolute top-2 left-2"><LikePill likes={front.likes} large /></div>}
            </div>
            <figcaption className="absolute bottom-3.5 inset-x-4 text-center text-[#2a2a2a] text-lg font-bold truncate" style={{ fontFamily: "var(--font-display, inherit)" }}>
              {front.id === topLovedId ? "👑 " : ""}{front.nickname || "✨"}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

// ── Mod: ZAMAN TÜNELİ (kronolojik akış, saat damgalı) ─────────────────────────

function TimelineMode({ media, themeDark }: { media: WallMedia[]; themeDark: boolean }) {
  // media zaten createdAt'e göre artan sırada (watchWallMedia orderBy asc).
  const loop = media.length ? [...media, ...media] : [];
  const dur = Math.max(30, media.length * 7);
  if (!media.length) return null;
  return (
    <div className="h-full flex justify-center overflow-hidden pt-24 pb-28 px-4">
      <div
        className="relative w-full max-w-xl overflow-hidden"
        style={{ maskImage: "linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)" }}
      >
        <div className="flex flex-col items-center gap-7 ww-marquee" style={{ animationDuration: `${dur}s` }}>
          {loop.map((m, i) => (
            <TimelineItem key={m.id + "-" + i} m={m} themeDark={themeDark} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ m, themeDark }: { m: WallMedia; themeDark: boolean }) {
  const t = m.createdAt?.toDate?.();
  const label = t ? t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
  const poster = m.type === "video" ? cldVideoPoster(m.url, 600, 600) : cldFit(m.url, 700);
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tabular-nums backdrop-blur ${themeDark ? "bg-white/12 text-white/90 border border-white/15" : "bg-black/5 text-ink/80 border border-black/10"}`}>
        🕰 {label}
      </span>
      <div className={`relative rounded-2xl overflow-hidden shadow-xl border max-w-full ${themeDark ? "border-white/10" : "border-black/10"}`} style={{ maxHeight: "42vh" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className="max-h-[42vh] w-auto object-contain block" loading="lazy" />
        {(m.likes ?? 0) > 0 && <div className="absolute bottom-2 right-2"><LikePill likes={m.likes} /></div>}
      </div>
      {m.nickname && <span className={`text-sm font-semibold ${themeDark ? "text-white/75" : "text-ink/70"}`}>{m.nickname}</span>}
      <span aria-hidden className={`w-px h-6 ${themeDark ? "bg-white/20" : "bg-black/15"}`} />
    </div>
  );
}

/** Görselin baskın (ortalama) rengini canvas'la örnekler; CORS/hatada null. */
function useDominantColor(url: string | undefined): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setColor(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        if (!cancelled && n) setColor(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
      } catch {
        if (!cancelled) setColor(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setColor(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return color;
}

// ── Mod: SİNEMA (tam ekran tek anı) ───────────────────────────────────────────

function CinemaMode({ media, topLovedId, current, advance }: { media: WallMedia[]; topLovedId: string | null; current: WallMedia | null; advance: () => void }) {
  if (!current) return null;
  const backdrop = mediaPoster(current, 600, 600);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {/* Sinematik bulanık dolgu (letterbox boşluklarını doldurur) */}
      <div key={"cbg-" + current.id} aria-hidden className="absolute inset-0 ww-fade"
        style={{ backgroundImage: `url(${backdrop})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(70px) brightness(0.5)", transform: "scale(1.3)" }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(130% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)" }} />
      <figure key={current.id} className="absolute inset-0 grid place-items-center ww-fade">
        {current.type === "video" ? (
          <video src={cldFit(current.url, 1800)} autoPlay muted playsInline preload="auto" onEnded={advance} onError={advance}
            className="max-h-screen max-w-full object-contain block" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldFit(current.url, 2000)} alt="" className="max-h-screen max-w-full object-contain block ww-ken-slow" />
        )}
      </figure>
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {current.id === topLovedId && <LovedRibbon />}
        {(current.likes ?? 0) > 0 && <LikePill likes={current.likes} large />}
        {current.nickname && (
          <span className="px-4 py-1.5 rounded-full border border-white/15 bg-white/10 text-white/90 text-sm font-semibold backdrop-blur">{current.nickname}</span>
        )}
      </div>

      {/* Alt film şeridi — koleksiyon bütünselliği (bütün anılar akar) */}
      <CinemaReel media={media} />
    </div>
  );
}

/** Sinema modunda alttan yatay akan ince film şeridi (soluk; kart üstünde durur). */
function CinemaReel({ media }: { media: WallMedia[] }) {
  if (media.length < 2) return null;
  const items = [...media].slice(-20);
  const loop = [...items, ...items];
  const dur = Math.max(34, items.length * 4);
  return (
    <div
      className="absolute bottom-0 inset-x-0 h-[74px] z-[8] overflow-hidden opacity-55"
      style={{ maskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)" }}
    >
      <div className="flex gap-2 p-2 ww-marquee-x" style={{ animationDuration: `${dur}s` }}>
        {loop.map((m, i) => (
          <div key={m.id + "-" + i} className="relative h-[58px] aspect-square rounded-lg overflow-hidden border border-white/15 shrink-0 bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaPoster(m, 180, 180)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ortak animasyonlar ────────────────────────────────────────────────────────

function WallStyles() {
  return (
    <style jsx global>{`
      .ww-fade { animation: wwfade 1s ease-out; }
      @keyframes wwfade { from { opacity: 0; } to { opacity: 1; } }
      .ww-pulse { animation: wwpulse 2.4s ease-in-out infinite; }
      @keyframes wwpulse { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.08); opacity: 1; } }
      .ww-pop { animation: wwpop 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes wwpop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      .ww-ken { animation: wwken 8s ease-out both; }
      @keyframes wwken { from { transform: scale(1.02); } to { transform: scale(1.13) translate(1.5%, -1.5%); } }
      .ww-ken-slow { animation: wwkenslow 9s ease-out both; }
      @keyframes wwkenslow { from { transform: scale(1.04); } to { transform: scale(1.14) translate(-1.5%, 1.5%); } }
      .ww-marquee { animation-name: wwmarquee; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes wwmarquee { from { transform: translateY(0); } to { transform: translateY(-50%); } }
      .ww-marquee-x { animation-name: wwmarqueex; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes wwmarqueex { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .ww-spot { animation: wwspot 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes wwspot { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      .ww-heart { animation: wwheart 1.6s ease-in-out infinite; display: inline-block; }
      @keyframes wwheart { 0%,100% { transform: scale(1); } 30% { transform: scale(1.25); } }
      .ww-glow { animation: wwglow 2s ease-in-out infinite; }
      @keyframes wwglow { 0%,100% { filter: drop-shadow(0 0 3px rgba(246,183,60,0.5)); } 50% { filter: drop-shadow(0 0 12px rgba(246,183,60,0.9)); } }
      .ww-drop { animation: wwdrop 0.9s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes wwdrop { from { opacity: 0; transform: translateY(-40px) rotate(0deg) scale(1.1); } }
      .ww-float { animation: wwfloat 7s ease-in-out infinite; }
      @keyframes wwfloat { 0%,100% { transform: translateY(0) rotate(var(--r,0)); } 50% { transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) {
        .ww-fade, .ww-pulse, .ww-ken, .ww-ken-slow, .ww-pop, .ww-marquee, .ww-marquee-x, .ww-spot, .ww-heart, .ww-glow, .ww-drop, .ww-float { animation: none !important; }
      }
    `}</style>
  );
}
