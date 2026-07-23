"use client";

/** Perde modu: SPOTLIGHT — bir anı öne çıkar, diğerleri arkada soluk halkada. */
import { useMemo } from "react";
import { cldFit } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";
import { LikePill, LovedRibbon, mediaPoster } from "./shared";

export default function SpotlightMode({ media, themeDark, topLovedId, hero }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null; hero: WallMedia | null }) {
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
