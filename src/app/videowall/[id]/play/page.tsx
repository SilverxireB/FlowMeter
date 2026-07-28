"use client";

/**
 * FlowSign — yayın (perde) ekranı. Duvar tam ekran (100vw×100vh) açılır; alanlar
 * oransal (0–1) konumlandığı için fiziksel çözünürlük ne olursa olsun ekranı
 * doğru böler (OS/tarayıcı ölçekler). v1 iskelet: alan yerleşimi + içerik varsa
 * ilk uygun öğeyi gösterir; tam oynatma motoru (oynatma listesi, geçişler, 7/24
 * sağlamlık) v4'te bunun üstüne gelir. auth YOK — link herkese açık.
 */
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { watchVideowall } from "@/lib/videowalls";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

/** "HH:MM" saat aralığı filtresi — boşsa hep göster. */
function inWindow(item: ZoneItem, now: Date): boolean {
  if (!item.from && !item.to) return true;
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (item.from && hm < item.from) return false;
  if (item.to && hm > item.to) return false;
  return true;
}

function ZoneView({ zone }: { zone: Zone }) {
  const [now, setNow] = useState(() => new Date());
  // Saat aralığı filtresi için dakikada bir tazele (7/24 tabela).
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const item = useMemo(() => zone.items.find((it) => inWindow(it, now)), [zone.items, now]);
  const fit = zone.fit === "contain" ? "contain" : "cover";

  return (
    <div
      className="absolute overflow-hidden bg-black"
      style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.w * 100}%`, height: `${zone.h * 100}%` }}
    >
      {!item ? (
        <div className="w-full h-full grid place-items-center text-white/15 text-sm select-none">FlowSign</div>
      ) : item.kind === "video" ? (
        <video
          src={item.src}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full"
          style={{ objectFit: fit }}
        />
      ) : item.kind === "url" ? (
        <iframe src={item.src} title={item.name || "sayfa"} className="w-full h-full border-0" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.src} alt={item.name || ""} className="w-full h-full" style={{ objectFit: fit }} />
      )}
    </div>
  );
}

export default function VideowallPlayPage() {
  const { id } = useParams<{ id: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);

  useEffect(() => watchVideowall(id, setVw), [id]);

  // Tam ekran tabela: gövde kaydırmasını kapat, imleci gizle.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Duvar bulunamadı.</main>;

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden cursor-none">
      {vw.zones?.map((z) => (
        <ZoneView key={z.id} zone={z} />
      ))}
    </main>
  );
}
