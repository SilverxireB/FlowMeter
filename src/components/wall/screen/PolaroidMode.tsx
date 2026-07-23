"use client";

/** Perde modu: POLAROID — masaya saçılan eğik kartlar, en yenisi öne düşer. */
import { useMemo } from "react";
import { cldFit } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";
import { hashStr, LikePill, mediaPoster } from "./shared";

export default function PolaroidMode({ media, topLovedId, front }: { media: WallMedia[]; themeDark: boolean; topLovedId: string | null; front: WallMedia | null }) {
  // Arka: saçılan küçük/soluk polaroidler (dağınık masa hissi).
  const back = useMemo(() => [...media].slice(-12), [media]);
  // Ön: ortak oynatmadan gelen current (adil + yeni foto önce; hep aynı resimden başlamaz).

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
