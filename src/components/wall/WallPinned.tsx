"use client";

/**
 * Sabitlenen anı — kokpitteki 📌 ile seçilir; kaldırılana dek perdede tüm
 * modların ÜSTÜNDE büyük durur ("ilk dans fotoğrafı ekranda kalsın" anı).
 * Otomatik akış arkada dönmeye devam eder; 📌 kalkınca perde kendine döner.
 */
import { cldFit } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";

export default function WallPinned({ media }: { media?: WallMedia }) {
  if (!media) return null;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 backdrop-blur-sm">
      <figure className="relative max-w-[84vw] max-h-[82vh]">
        {media.type === "video" ? (
          <video src={media.url} autoPlay muted loop playsInline className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldFit(media.url, 1600)} alt="" className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />
        )}
        <figcaption className="absolute -top-3 -left-3 rounded-full bg-white text-[#0d102f] text-sm font-bold px-3 py-1 shadow-lg">
          📌 Sabitlendi
        </figcaption>
        {media.nickname && (
          <figcaption className="absolute bottom-3 left-3 rounded-full bg-black/55 backdrop-blur text-white text-sm px-3 py-1">
            📷 {media.nickname}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
