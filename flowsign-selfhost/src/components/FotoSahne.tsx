"use client";

/**
 * FOTO SAHNE — bir alandaki fotoğrafları "duvar" gibi çizen görüntüleyici.
 *
 * Yerleşim hesabı `lib/fotoSahne.ts`te SAF ve sınavlı; burası yalnız çizim.
 * (Self-host kopyası: medya yerel diskten geldiği için dönüşüm/ölçekleme yok.)
 *
 * 7/24 DİSİPLİNİ:
 *  - Düğüm sayısı SABİT. Kareler her adımda yeniden hesaplanmıyor; yalnız hangi
 *    fotoğrafın hangi karede olduğu kayıyor. Aylarca açık kalan bir ekranda her
 *    turda düğüm ekleyip çıkarmak belleği şişirir.
 *  - Hareket CSS geçişiyle (GPU); JS animasyon döngüsü yok.
 *  - Zamanlayıcı TEK ve sahne değişince temizleniyor.
 *
 * KIRPARAK SIĞDIR (stretch DEĞİL): ürünün standardı stretch ama o karar
 * TASARLANMIŞ tam-alan içerik içindi. Sahne hücresinde stretch açıkça yanlış —
 * telefondan gelen dikey fotoğraf kare hücrede eziliyor, yüzler bozuluyor.
 * Burada `object-fit: cover` bilinçli bir istisnadır.
 */
import { useEffect, useMemo, useState } from "react";
import { adimMs, sahneKareleri, SAHNE_MODU_VARSAYILAN, SahneModu } from "@/lib/fotoSahne";
import { ZoneItem } from "@/lib/types";

export default function FotoSahne({
  item,
  box,
  /** Editör önizlemesinde zamanlayıcı çalışmaz — kokpit sessiz kalsın. */
  durgun = false,
}: {
  item: ZoneItem;
  box: { w: number; h: number };
  durgun?: boolean;
}) {
  const fotolar = useMemo(() => (item.fotolar ?? []).filter(Boolean), [item.fotolar]);
  const mod: SahneModu = (item.sahneModu as SahneModu) ?? SAHNE_MODU_VARSAYILAN;
  const oran = box.h > 0 ? box.w / box.h : 16 / 9;

  const [kaydir, setKaydir] = useState(0);
  // Kareler kaydırmadan BAĞIMSIZ hesaplanır (yerleşim sabit; yalnız hangi
  // fotoğrafın nerede olduğu değişir) → düğümler yerinde kalır, CSS geçişi
  // görüntüyü yumuşatır.
  const yerlesim = useMemo(() => sahneKareleri(mod, fotolar.length, oran, 0), [mod, fotolar.length, oran]);
  const kareler = useMemo(
    () => sahneKareleri(mod, fotolar.length, oran, kaydir),
    [mod, fotolar.length, oran, kaydir]
  );

  const adim = adimMs(item.durationSec ?? 60, fotolar.length, yerlesim.length);
  useEffect(() => {
    // Görünmeyen fotoğraf yoksa dönecek bir şey de yok: sahne DURUR.
    // Zamanlayıcı kurmak boşuna titremeye yol açardı.
    if (durgun || fotolar.length <= yerlesim.length) return;
    const t = window.setInterval(() => setKaydir((k) => k + 1), adim);
    return () => window.clearInterval(t);
  }, [durgun, adim, fotolar.length, yerlesim.length]);

  if (!fotolar.length)
    return (
      <div className="w-full h-full grid place-items-center bg-black/40 text-white/35 text-xs text-center px-3">
        Foto sahne — henüz fotoğraf seçilmedi
      </div>
    );

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {yerlesim.map((y, i) => {
        const k = kareler[i] ?? y;
        const src = fotolar[k.indeks] ?? fotolar[0];
        const soluk = mod === "spot" && !k.one;
        return (
          <div
            key={i}
            className="absolute transition-opacity duration-700"
            style={{
              left: `${y.x}%`,
              top: `${y.y}%`,
              width: `${y.w}%`,
              height: `${y.h}%`,
              zIndex: y.z,
              transform: y.aci ? `rotate(${y.aci.toFixed(2)}deg)` : undefined,
              padding: mod === "polaroid" ? "0.6%" : mod === "mozaik" ? "0" : "0.4%",
            }}
          >
            <div
              className="w-full h-full overflow-hidden"
              style={{
                // Polaroid kartı: beyaz çerçeve + hafif gölge. Diğer modlarda
                // sade — çerçeve içeriğin önüne geçmemeli.
                background: mod === "polaroid" ? "#fff" : undefined,
                borderRadius: mod === "mozaik" ? 0 : 4,
                boxShadow: mod === "polaroid" ? "0 2px 10px rgba(0,0,0,.45)" : undefined,
                padding: mod === "polaroid" ? "4%" : undefined,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={src}
                src={src}
                alt=""
                className="w-full h-full transition-opacity duration-700"
                style={{ objectFit: "cover", opacity: soluk ? 0.28 : 1 }}
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
