"use client";

/** Perde modu: MOZAİK — tüm anılar canlı, kayan çok sütunlu ızgarada. */
import { useMemo } from "react";
import { cldFit, cldVideoPoster } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";
import { LikePill } from "./shared";

export default function MosaicMode({ media, themeDark, topLovedId }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null }) {
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
