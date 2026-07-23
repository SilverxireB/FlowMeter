"use client";

/** Perde modu: SİNEMA — tam ekran tek anı + altta akan film şeridi. */
import { cldFit } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";
import { LikePill, LovedRibbon, mediaPoster } from "./shared";

export default function CinemaMode({ media, topLovedId, current, advance }: { media: WallMedia[]; topLovedId: string | null; current: WallMedia | null; advance: () => void }) {
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
