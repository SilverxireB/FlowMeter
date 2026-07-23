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
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import WallEffectLayer from "@/components/wall/WallEffectLayer";
import WallReactionOverlay from "@/components/wall/WallReactionOverlay";
import WallContest from "@/components/wall/WallContest";
import WallWishes from "@/components/wall/WallWishes";
import WallAnnouncement from "@/components/wall/WallAnnouncement";
import WallMilestone from "@/components/wall/WallMilestone";
import WallTopLoved from "@/components/wall/WallTopLoved";
import WallFilmStage from "@/components/wall/WallFilmStage";
import { EmptyState, WallNewMemory, WallStyles } from "@/components/wall/screen/shared";
import { usePagedPlayback, useDominantColor } from "@/components/wall/screen/hooks";
import StageMode from "@/components/wall/screen/StageMode";
import MosaicMode from "@/components/wall/screen/MosaicMode";
import SpotlightMode from "@/components/wall/screen/SpotlightMode";
import PolaroidMode from "@/components/wall/screen/PolaroidMode";
import TimelineMode from "@/components/wall/screen/TimelineMode";
import CinemaMode from "@/components/wall/screen/CinemaMode";
import { FilmLength } from "@/lib/wallFilm/timeline";
import { useWall, useWallMedia, useWallWishes } from "@/lib/hooks";
import { isCurrentSession, resolveCode } from "@/lib/walls";
import { cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { wallThemeStyle } from "@/lib/themes";
import { BASE_WALL_SCREEN_MODES, WALL_SCREEN_MODES, WallMedia, WallScreenMode, wallEffectOf } from "@/lib/types";

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
  // Yalnız AKTİF oturumun onaylı medyası (yeni oturum → temiz perde).
  const media = useMemo(
    () => allMedia.filter((m) => m.status === "approved" && isCurrentSession(m, wall)),
    [allMedia, wall]
  );
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

  // Anı Filmi perde oynatma — kokpit tetikleyince (startedAt taze) filmi büyük
  // ekranda göster. Perde açılmadan ÖNCE tetiklenmiş eski filmi oynatma (geç
  // katılan cihaz tekrar oynatmasın); her startedAt bir kez oynar.
  const filmMountRef = useRef<number>(Date.now());
  const filmPlayedRef = useRef<number>(0);
  const [filmOpts, setFilmOpts] = useState<{ length: FilmLength; musicId: string } | null>(null);
  useEffect(() => {
    const at = wall?.filmPlay?.startedAt?.toMillis?.();
    if (at && at > filmMountRef.current && at !== filmPlayedRef.current) {
      filmPlayedRef.current = at;
      setFilmOpts({ length: (wall?.filmPlay?.length as FilmLength) || "medium", musicId: wall?.filmPlay?.musicId || "warm" });
    }
  }, [wall?.filmPlay]);

  // Şampanya (dugun) + Sedef (kurumsal): açık temalar, siyah yazı. Resimden
  // türeyen ambient tint `multiply` ile açık zemini karartıp yazıyı okunmaz
  // yapıyor → yalnız bu ikisinde karartmayan çok hafif bir harman kullan.
  const pearlTheme =
    !themeDark && !wall?.theme?.bgImage &&
    (wall?.theme?.preset === "dugun" || wall?.theme?.preset === "kurumsal");

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
            opacity: themeDark ? 0.4 : pearlTheme ? 0.45 : 0.26,
            // Şampanya/Sedef: `screen` açık zemini ASLA karartmaz (koyu resim ≈
            // etkisiz), böylece siyah yazı her resimde okunur kalır.
            mixBlendMode: themeDark ? "screen" : pearlTheme ? "screen" : "multiply",
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
          <PolaroidMode media={media} themeDark={themeDark} topLovedId={topLovedId} front={play.current} />
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

      {/* Katılım kartı (alt orta) — kapalıysa "teşekkürler" mesajı */}
      {wall?.closed ? (
        <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-20 text-center rounded-2xl px-7 py-4 backdrop-blur-md shadow-xl ${cardChrome}`}>
          <p className="font-display text-2xl font-bold">🎉 Teşekkürler</p>
          <p className={`text-sm ${mutedClass}`}>Etkinlik tamamlandı — anılar için sağ olun.</p>
        </div>
      ) : (
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
      )}

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

      {/* Anı Filmi — perdede canlı oynatma (kokpit tetikler) */}
      {filmOpts && wall && (
        <WallFilmStage
          wall={wall}
          media={media}
          wishes={wishes}
          length={filmOpts.length}
          musicId={filmOpts.musicId}
          onEnd={() => setFilmOpts(null)}
        />
      )}

      <WallStyles />
    </main>
  );
}
