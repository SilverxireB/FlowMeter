"use client";

/**
 * FlowWall perde ekranı — projeksiyon. Sağ/sol akan film şeritleri + ortada
 * büyük sahne (fotoğraflar ~7 sn'de değişir, videolar süresince oynar).
 * Köşede QR + katılım kodu. Yalnız onaylı (status=approved) medya gösterilir.
 */
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import { useWall, useWallMedia } from "@/lib/hooks";
import { resolveCode } from "@/lib/walls";
import { cldFit, cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";

const IMAGE_MS = 7000;

export default function WallScreen() {
  const { id: raw } = useParams<{ id: string }>();

  // 6 haneli kod da kabul et
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

  // Orta sahne döngüsü
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);
  const current = media.length ? media[idx % media.length] : null;

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!current || current.type === "video") return; // video kendi bitince ilerler
    timer.current = window.setTimeout(() => setIdx((i) => i + 1), IMAGE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [current, media.length]);

  // yeni medya gelince index taşmasını düzelt
  useEffect(() => {
    if (idx >= media.length && media.length) setIdx(0);
  }, [media.length, idx]);

  if (wallId === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#070c22] text-white/70">
        Duvar bulunamadı.
      </main>
    );
  }

  const strips = splitStrips(media);

  return (
    <main className="relative h-screen overflow-hidden bg-[#070c22] text-white flex">
      {/* Sol şerit */}
      <Strip items={strips.left} side="left" />

      {/* Orta sahne */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 min-w-0">
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            {wall?.headline || wall?.title || "FlowWall"}
          </h1>
        </div>

        {current ? (
          <Stage media={current} onEnded={() => setIdx((i) => i + 1)} />
        ) : (
          <div className="text-center">
            <div className="text-6xl mb-5" aria-hidden>📷</div>
            <p className="text-2xl font-bold mb-1">İlk anı sen paylaş</p>
            <p className="text-white/60">QR'ı okut, fotoğrafını yükle — birazdan burada.</p>
          </div>
        )}

        {/* Köşe: katılım */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/8 border border-white/12 rounded-2xl px-4 py-3 backdrop-blur">
          {joinUrl && (
            <div className="bg-white rounded-xl p-1.5">
              <QrCode text={joinUrl} size={92} />
            </div>
          )}
          <div className="text-left">
            <p className="text-xs uppercase tracking-widest text-white/55">Katıl</p>
            <p className="font-display text-3xl font-bold tabular-nums tracking-[0.12em]">
              {wall?.joinCode || "——————"}
            </p>
            <p className="text-white/50 text-xs mt-0.5">Fotoğrafını paylaş</p>
          </div>
        </div>
      </section>

      {/* Sağ şerit */}
      <Strip items={strips.right} side="right" />

      {/* Logo köşe */}
      <div className="absolute top-4 left-4 z-10 opacity-90">
        <Logo variant="wall" onDark size="sm" />
      </div>
      {media.length > 0 && (
        <div className="absolute top-4 right-4 z-10 chip bg-white/10 border-white/15 text-white/80 text-xs">
          {media.length} anı
        </div>
      )}
    </main>
  );
}

/** Büyük sahne: fotoğraf ya da video. */
function Stage({ media, onEnded }: { media: WallMedia; onEnded: () => void }) {
  if (media.type === "video") {
    return (
      <video
        key={media.id}
        src={cldFit(media.url, 1400)}
        autoPlay
        muted
        playsInline
        onEnded={onEnded}
        className="max-h-[74vh] max-w-full rounded-3xl shadow-2xl object-contain ww-pop"
      />
    );
  }
  return (
    <figure key={media.id} className="flex flex-col items-center ww-pop">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cldFit(media.url, 1400)}
        alt=""
        className="max-h-[74vh] max-w-full rounded-3xl shadow-2xl object-contain"
      />
      {media.nickname && (
        <figcaption className="mt-4 px-4 py-1.5 rounded-full bg-white/10 text-white/85 text-sm font-semibold">
          {media.nickname}
        </figcaption>
      )}
      <style jsx>{`
        .ww-pop {
          animation: wwpop 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes wwpop {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ww-pop {
            animation: none;
          }
        }
      `}</style>
    </figure>
  );
}

/** Dikey akan küçük resim şeridi (kenar). */
function Strip({ items, side }: { items: WallMedia[]; side: "left" | "right" }) {
  if (items.length === 0) return <div className="hidden lg:block w-40 xl:w-52 shrink-0" aria-hidden />;
  const loop = [...items, ...items]; // kesintisiz döngü
  const dur = Math.max(18, items.length * 5);
  return (
    <div className="relative hidden lg:block w-40 xl:w-52 shrink-0 overflow-hidden opacity-90">
      <div
        className="flex flex-col gap-3 p-3 ww-marquee"
        style={{ animationDuration: `${dur}s`, animationDirection: side === "right" ? "reverse" : "normal" }}
      >
        {loop.map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.id + "-" + i}
            src={m.type === "video" ? cldVideoPoster(m.url, 300, 300) : cldThumb(m.url, 300, 300)}
            alt=""
            className="w-full aspect-square object-cover rounded-xl border border-white/10"
          />
        ))}
      </div>
      <style jsx>{`
        .ww-marquee {
          animation-name: wwmarquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes wwmarquee {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ww-marquee {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/** Medyayı iki kenar şeridine böler (en yeniler önce). */
function splitStrips(media: WallMedia[]): { left: WallMedia[]; right: WallMedia[] } {
  const recent = [...media].reverse().slice(0, 24);
  const left: WallMedia[] = [];
  const right: WallMedia[] = [];
  recent.forEach((m, i) => (i % 2 === 0 ? left : right).push(m));
  return { left, right };
}
