"use client";

/** Perde modu: SAHNE — ortada büyük anı (Ken Burns) + yanlarda akan şeritler. */
import { cldFit } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";
import { LikePill, LovedRibbon, mediaPoster, splitStrips } from "./shared";

export default function StageMode({ media, themeDark, topLovedId, current, advance }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null; current: WallMedia | null; advance: () => void }) {
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
