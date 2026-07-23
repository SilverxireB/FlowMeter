"use client";

/** Perde modu: ZAMAN TÜNELİ — kronolojik akış, saat damgalı. */
import { cldFit, cldVideoPoster } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";
import { LikePill } from "./shared";

export default function TimelineMode({ media, themeDark }: { media: WallMedia[]; themeDark: boolean }) {
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
