"use client";

/**
 * FOTO SAHNE yayını — /sahne/{id}. Public, auth YOK (perde auth istemez).
 *
 * İki kullanım:
 *  1. Sign ekranında: bu link bir alana URL olarak eklenir; PERDE linki tanır
 *     ve sahneyi iframe'siz aynı ağaçta çizer — bu sayfa hiç yüklenmez.
 *  2. Tek başına: bir TV'yi komple hatıra köşesi yapmak = bu linki açmak.
 *     O yüzden Wake Lock burada da var (7/24 ekran uyumasın).
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import FotoSahne from "@/components/FotoSahne";
import { watchSahne } from "@/lib/sahneClient";
import { FotoSahneKaydi } from "@/lib/fotoSahne";

export default function SahnePlayPage() {
  const { id } = useParams<{ id: string }>();
  const [sahne, setSahne] = useState<FotoSahneKaydi | null | undefined>(undefined);
  const [box, setBox] = useState({ w: 1920, h: 1080 });

  useEffect(() => watchSahne(decodeURIComponent(id), setSahne), [id]);

  useEffect(() => {
    const olc = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    olc();
    window.addEventListener("resize", olc);
    return () => window.removeEventListener("resize", olc);
  }, []);

  // Ekran uyumasın (perde ile aynı disiplin).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const iste = async () => {
      try {
        type WL = { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        const wl = (navigator as Navigator & { wakeLock?: WL }).wakeLock;
        if (wl) lock = await wl.request("screen");
      } catch {}
    };
    void iste();
    const gorunum = () => {
      if (document.visibilityState === "visible") void iste();
    };
    document.addEventListener("visibilitychange", gorunum);
    return () => {
      document.removeEventListener("visibilitychange", gorunum);
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden [color-scheme:dark]" style={{ background: "#05091c", containerType: "size" }}>
      {sahne === undefined ? (
        <div className="w-full h-full grid place-items-center text-white/40 text-sm">Yükleniyor…</div>
      ) : sahne === null ? (
        <div className="w-full h-full grid place-items-center text-white/50 text-sm text-center px-6">
          Sahne bulunamadı — silinmiş ya da link hatalı olabilir.
        </div>
      ) : (
        <FotoSahne sahne={sahne} box={box} />
      )}
    </main>
  );
}
