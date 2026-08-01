"use client";

/**
 * Liste kartı önizlemesi — YAYINDAKİ yerleşimin minyatürü: her alanda ilk
 * öğenin gerçek görüntüsü (perdeyle aynı STRETCH mantığı; metin/saat/URL
 * yer tutucuyla). Aşırı geniş duvarlar kart estetiği için 1.1–2.2 oranına
 * sıkıştırılır (bilgi değil vitrin — gerçek oran editörde).
 */
import { cldFit, cldVideoPoster } from "@/lib/cloudinary";
import { ZONE_BG_DEFAULT } from "@/lib/videowalls";
import { Videowall, ZoneItem } from "@/lib/types";

function ItemFace({ item }: { item?: ZoneItem }) {
  if (!item) return <div className="absolute inset-0 grid place-items-center text-white/15 text-[10px]">boş</div>;
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cldFit(item.src, 320)} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} />;
  if (item.kind === "video" && item.src) {
    const s = cldVideoPoster(item.src, 320, 240);
    return s ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} />
    ) : (
      <div className="absolute inset-0 grid place-items-center bg-black/40 text-base">🎬</div>
    );
  }
  if (item.kind === "text")
    return (
      <div className="absolute inset-0 grid place-items-center px-1 text-center" style={{ background: item.bg ?? "#312e81", color: item.color ?? "#fff" }}>
        <span className="text-[9px] font-bold truncate max-w-full">{item.title || "Metin"}</span>
      </div>
    );
  if (item.kind === "clock")
    return <div className="absolute inset-0 grid place-items-center text-base" style={{ background: item.bg ?? "#0d102f" }}>🕐</div>;
  // URL: gerçek sayfanın minyatürü (editör önizlemesiyle aynı; lazy — görünene
  // kadar yüklenmez). Site iframe'i reddederse alttaki 🔗 kalır.
  const src = /^https?:\/\//i.test(item.src ?? "") ? item.src : undefined;
  if (!src) return <div className="absolute inset-0 grid place-items-center bg-black/40 text-base">🔗</div>;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid place-items-center bg-black/40 text-base">🔗</div>
      <iframe
        src={src}
        title={item.name || "sayfa"}
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        loading="lazy"
        tabIndex={-1}
        className="absolute top-0 left-0 border-0 pointer-events-none"
        style={{ width: "400%", height: "400%", transform: "scale(0.25)", transformOrigin: "top left" }}
      />
    </div>
  );
}

export default function WallThumb({ vw }: { vw: Videowall }) {
  const stage = vw.live ?? vw;
  // Alt sınır 1.6: dikey (portre) duvar bile kartı boyuna uzatmasın — kart kompakt.
  const ar = Math.min(2.2, Math.max(1.6, stage.width / Math.max(1, stage.height)));
  const zones = stage.zones ?? [];
  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ aspectRatio: `${ar}` }}>
      {zones.map((z) => (
        <div
          key={z.id}
          className="absolute overflow-hidden border border-white/15"
          style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, background: z.bg ?? ZONE_BG_DEFAULT }}
        >
          <ItemFace item={z.items?.[0]} />
        </div>
      ))}
      {zones.length === 0 && <div className="absolute inset-0 grid place-items-center text-white/20 text-xs">FlowSign</div>}
    </div>
  );
}
