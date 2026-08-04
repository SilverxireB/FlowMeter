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
  if (item.kind === "fotoSahne" && item.fotolar?.length)
    // Liste kartında sahnenin İLK fotoğrafı: boş kutu "içerik yok" derdi, oysa var.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cldFit(item.fotolar[0], 320)} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} />;
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

/**
 * FİZİKSEL EKRAN SINIRLARI — TV çerçevelerinin (bezel) düştüğü yerler.
 *
 * Neden minyatürde de olmalı: karttaki "3×2" yazısı bilgiyi VERİYOR ama
 * göstermiyor. İçeriği yerleştiren kişinin sorduğu soru "yüz ikiye bölünüyor
 * mu" ve buna ancak çizgiyi görerek cevap verilebilir. Editörde zaten kesik
 * çizgi dili var (fiziksel ızgara = kesik çizgi); minyatür aynı dili taşır.
 *
 * Tek ekranlı duvarda (1×1) hiç çizilmez — çizecek sınır yok, gürültü olurdu.
 */
function BezelCizgileri({ cols, rows }: { cols: number; rows: number }) {
  const dikey = Array.from({ length: Math.max(0, cols - 1) }, (_, i) => ((i + 1) / cols) * 100);
  const yatay = Array.from({ length: Math.max(0, rows - 1) }, (_, i) => ((i + 1) / rows) * 100);
  if (!dikey.length && !yatay.length) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {dikey.map((p) => (
        <span key={`d${p}`} className="absolute top-0 bottom-0 border-l border-dashed border-white/45" style={{ left: `${p}%` }} />
      ))}
      {yatay.map((p) => (
        <span key={`y${p}`} className="absolute left-0 right-0 border-t border-dashed border-white/45" style={{ top: `${p}%` }} />
      ))}
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
        {/* Bezel çizgileri alanların ÜSTÜNDE: sınır içeriğin neresinden
            geçiyor, ancak öyle görünür. */}
        <BezelCizgileri cols={Math.max(1, vw.cols || 1)} rows={Math.max(1, vw.rows || 1)} />
      </div>
      {zones.length === 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-o-sign-white.png" alt="" aria-hidden className="absolute max-w-[30%] max-h-[30%] opacity-20" />
      )}
    </div>
  );
}
