"use client";

/**
 * Liste kartı önizlemesi — YAYINDAKİ yerleşimin minyatürü: her alanda ilk
 * öğenin gerçek görüntüsü (perdeyle aynı STRETCH mantığı; metin/saat/URL
 * yer tutucuyla). Self-host: görsel yerel yolundan gösterilir, video 🎬.
 */
import { Videowall, ZoneItem } from "@/lib/types";
import { ZONE_BG_DEFAULT } from "@/lib/zones";

function ItemFace({ item }: { item?: ZoneItem }) {
  if (!item) return <div className="absolute inset-0 grid place-items-center text-white/15 text-[10px]">boş</div>;
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.src} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} />;
  if (item.kind === "video" && item.src) {
    return <div className="absolute inset-0 grid place-items-center bg-black/40 text-base">🎬</div>;
  }
  if (item.kind === "text")
    return (
      <div className="absolute inset-0 grid place-items-center px-1 text-center" style={{ background: item.bg ?? "#312e81", color: item.color ?? "#fff" }}>
        <span className="text-[9px] font-bold truncate max-w-full">{item.title || "Metin"}</span>
      </div>
    );
  if (item.kind === "clock")
    return <div className="absolute inset-0 grid place-items-center text-base" style={{ background: item.bg ?? "#0d102f" }}>🕐</div>;
  // URL: gerçek sayfanın minyatürü (lazy). Site iframe'i reddederse 🔗 kalır.
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
  const zones = stage.zones ?? [];
  // KART SABİT ORANDA, DUVAR İÇİNE SIĞDIRILIR.
  //
  // Eskiden duvarın oranı 1.6–2.2 arasına SIKIŞTIRILIYOR ve kartı o oranda
  // dolduruyordu: 1080×1920 bir totem kartta YATAY çiziliyordu ve içindeki
  // alanlar tamamen yanlış oranlarda görünüyordu — dikey tabela kuran kişi
  // kendi tasarımını tanıyamıyordu. Sign'ın kendi işareti dikey totem;
  // ürünün bu kullanımı yalan söyleyemez.
  //
  // Çözüm: kart ızgarada aynı boyda kalsın diye DIŞ kutu sabit orandadır,
  // duvar İÇİNE gerçek oranıyla sığdırılır (letterbox). Yatay duvarlarda
  // görüntü pratikte eskisiyle aynı; dikey duvarlarda artık doğru.
  const ar = stage.width / Math.max(1, stage.height);
  return (
    <div className="relative w-full bg-black overflow-hidden grid place-items-center" style={{ aspectRatio: "1.6" }}>
      <div className="relative" style={{ aspectRatio: `${ar}`, maxWidth: "100%", maxHeight: "100%", width: ar >= 1.6 ? "100%" : "auto", height: ar >= 1.6 ? "auto" : "100%" }}>
        {zones.map((z) => (
          <div
            key={z.id}
            className="absolute overflow-hidden border border-white/15"
            style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, background: z.bg ?? ZONE_BG_DEFAULT }}
          >
            <ItemFace item={z.items?.[0]} />
          </div>
        ))}
      </div>
      {zones.length === 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-sign-white.png" alt="" aria-hidden className="absolute max-w-[30%] max-h-[30%] opacity-20" />
      )}
    </div>
  );
}
