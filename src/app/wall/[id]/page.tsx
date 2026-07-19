"use client";

/**
 * FlowWall perde ekranı — "resital". Projeksiyon için tam ekran gösteri:
 *  - Anlık fotoğrafın bulanık, renk-tepkili immersif arka planı (now-playing hissi)
 *  - Orta sahne: fotoğraflarda yavaş Ken Burns + crossfade; videolar oynar (12sn cap)
 *  - Sağ/sol akan film şeritleri (üst/alt fade maskeli)
 *  - Yeni gelen medya "✨ Yeni anı" kurdelesiyle öne alınır
 *  - Köşede QR + katılım kodu. Yalnız onaylı (approved) medya.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import { useWall, useWallMedia } from "@/lib/hooks";
import { resolveCode } from "@/lib/walls";
import { cldFit, cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";

const IMAGE_MS = 6500; // fotoğraf sahne süresi
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

  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => {
    if (wallId) setJoinUrl(`${window.location.origin}/u/${wallId}`);
  }, [wallId]);

  const [idx, setIdx] = useState(0);
  const [isNew, setIsNew] = useState(false);
  const prevLen = useRef(0);
  const timer = useRef<number | null>(null);

  const advance = useCallback(() => setIdx((i) => i + 1), []);

  // Yeni medya gelince en yeniyi öne al + kurdele göster
  useEffect(() => {
    if (media.length > prevLen.current && prevLen.current > 0) {
      setIdx(media.length - 1);
      setIsNew(true);
    }
    prevLen.current = media.length;
  }, [media.length]);

  const current = media.length ? media[((idx % media.length) + media.length) % media.length] : null;

  // Sahne zamanlayıcı: foto sabit süre, video kendi bitince/cap'te ilerler
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!current) return;
    const dur = current.type === "video" ? VIDEO_CAP_MS : IMAGE_MS;
    timer.current = window.setTimeout(advance, dur);
    const t = window.setTimeout(() => setIsNew(false), Math.min(dur, 5000));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      window.clearTimeout(t);
    };
  }, [current, advance]);

  useEffect(() => {
    if (idx >= media.length && media.length) setIdx(idx % media.length);
  }, [media.length, idx]);

  if (wallId === null) {
    return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/70">Duvar bulunamadı.</main>;
  }

  const strips = splitStrips(media);
  const backdrop = current ? (current.type === "video" ? cldVideoPoster(current.url, 400, 400) : cldThumb(current.url, 500, 500)) : "";

  return (
    <main className="relative h-screen overflow-hidden bg-[#05091c] text-white">
      {/* İmmersif bulanık arka plan (renk ambiyansı) */}
      {backdrop && (
        <div
          key={"bg-" + current?.id}
          aria-hidden
          className="absolute inset-0 ww-fade"
          style={{
            backgroundImage: `url(${backdrop})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) brightness(0.42) saturate(1.3)",
            transform: "scale(1.25)",
          }}
        />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 40%, rgba(5,9,28,0.75) 100%)" }} />

      <div className="relative z-10 h-full flex">
        {/* Sol şerit */}
        <Strip items={strips.left} side="left" />

        {/* Orta sahne */}
        <section className="flex-1 flex flex-col items-center justify-center px-4 min-w-0 relative">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center px-4 w-full">
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-balance drop-shadow-lg">
              {wall?.headline || wall?.title || "FlowWall"}
            </h1>
          </div>

          {current ? (
            <Stage media={current} isNew={isNew} onEnded={advance} />
          ) : (
            <div className="text-center">
              <div className="text-7xl mb-6 ww-pulse" aria-hidden>📷</div>
              <p className="text-3xl font-bold mb-2">İlk anı sen paylaş</p>
              <p className="text-white/60 text-lg">QR&apos;ı okut, fotoğrafını yükle — birazdan burada parlayacak.</p>
            </div>
          )}

          {/* Katılım kartı */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 border border-white/15 rounded-2xl px-4 py-3 backdrop-blur-md shadow-xl">
            {joinUrl && (
              <div className="bg-white rounded-xl p-1.5 shrink-0">
                <QrCode text={joinUrl} size={88} />
              </div>
            )}
            <div className="text-left">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Katıl · paylaş</p>
              <p className="font-display text-3xl font-bold tabular-nums tracking-[0.12em] leading-tight">
                {wall?.joinCode || "——————"}
              </p>
              <p className="text-white/55 text-xs">flowwall — fotoğrafını at, perdede parla</p>
            </div>
          </div>
        </section>

        {/* Sağ şerit */}
        <Strip items={strips.right} side="right" />
      </div>

      {/* Köşe süsleri */}
      <div className="absolute top-5 left-5 z-20 opacity-90">
        <Logo variant="wall" onDark size="sm" />
      </div>
      {media.length > 0 && (
        <div className="absolute top-5 right-5 z-20 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold tabular-nums backdrop-blur">
          {media.length} anı
        </div>
      )}

      <style jsx global>{`
        .ww-fade { animation: wwfade 1s ease-out; }
        @keyframes wwfade { from { opacity: 0; } to { opacity: 1; } }
        .ww-pulse { animation: wwpulse 2.4s ease-in-out infinite; }
        @keyframes wwpulse { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.08); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .ww-fade, .ww-pulse, .ww-ken, .ww-pop, .ww-marquee { animation: none !important; }
        }
      `}</style>
    </main>
  );
}

/** Orta büyük sahne. */
function Stage({ media, isNew, onEnded }: { media: WallMedia; isNew: boolean; onEnded: () => void }) {
  return (
    <figure key={media.id} className="relative flex flex-col items-center ww-pop">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10" style={{ maxHeight: "72vh" }}>
        {media.type === "video" ? (
          <video
            src={cldFit(media.url, 1400)}
            autoPlay
            muted
            playsInline
            onEnded={onEnded}
            className="max-h-[72vh] max-w-[86vw] object-contain block bg-black"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldFit(media.url, 1600)} alt="" className="max-h-[72vh] max-w-[86vw] object-contain block ww-ken" />
        )}
      </div>

      {isNew && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#e34948] text-white text-xs font-bold px-3 py-1 shadow-lg ww-pop">
          ✨ Yeni anı
        </span>
      )}
      {media.nickname && (
        <figcaption className="mt-4 px-4 py-1.5 rounded-full bg-white/12 border border-white/10 text-white/90 text-sm font-semibold backdrop-blur">
          {media.nickname}
        </figcaption>
      )}

      <style jsx>{`
        .ww-pop { animation: wwpop 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes wwpop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        .ww-ken { animation: wwken 8s ease-out both; }
        @keyframes wwken { from { transform: scale(1.02); } to { transform: scale(1.13) translate(1.5%, -1.5%); } }
      `}</style>
    </figure>
  );
}

/** Dikey akan küçük resim şeridi (üst/alt fade maskeli). */
function Strip({ items, side }: { items: WallMedia[]; side: "left" | "right" }) {
  if (items.length === 0) return <div className="hidden lg:block w-40 xl:w-56 shrink-0" aria-hidden />;
  const loop = [...items, ...items];
  const dur = Math.max(22, items.length * 6);
  return (
    <div
      className="relative hidden lg:block w-40 xl:w-56 shrink-0 overflow-hidden"
      style={{ maskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)" }}
    >
      <div
        className="flex flex-col gap-3 p-3 ww-marquee"
        style={{ animationDuration: `${dur}s`, animationDirection: side === "right" ? "reverse" : "normal" }}
      >
        {loop.map((m, i) => (
          <StripThumb key={m.id + "-" + i} m={m} />
        ))}
      </div>
      <style jsx>{`
        .ww-marquee { animation-name: wwmarquee; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes wwmarquee { from { transform: translateY(0); } to { transform: translateY(-50%); } }
      `}</style>
    </div>
  );
}

function StripThumb({ m }: { m: WallMedia }) {
  const poster = m.type === "video" ? cldVideoPoster(m.url, 320, 320) : cldThumb(m.url, 320, 320);
  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 shadow-lg">
      {m.type === "video" && !poster ? (
        <video src={m.url + "#t=0.5"} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      )}
      {m.type === "video" && (
        <span className="absolute bottom-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/55 text-white text-[10px]">▶</span>
      )}
    </div>
  );
}

/** En yeni 24 medyayı iki kenara böler. */
function splitStrips(media: WallMedia[]): { left: WallMedia[]; right: WallMedia[] } {
  const recent = [...media].reverse().slice(0, 24);
  const left: WallMedia[] = [];
  const right: WallMedia[] = [];
  recent.forEach((m, i) => (i % 2 === 0 ? left : right).push(m));
  return { left, right };
}
