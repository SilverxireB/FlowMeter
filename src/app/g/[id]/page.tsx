"use client";

/**
 * Etkinlik sonrası galeri (/g/{id}) — "fotoğraflar nerede?" sorusunun cevabı.
 * Auth'suz, salt-okunur: onaylı medya ızgarası + büyüt/indir. Kota dostu:
 * canlı dinleme YOK (etkinlik bitti, veri durağan) — tek okuma yeter.
 * Sahibi kokpitten "Galeri linki"ni açıp linki dağıtır; kapatınca kararır.
 */
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { useParams } from "next/navigation";
import { cldFit, cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { fetchApprovedMedia, getWall } from "@/lib/walls";
import { Wall, WallMedia } from "@/lib/types";

/** İndirme linki: tarayıcı görüntülemek yerine dosya olarak indirsin. */
const dlUrl = (url: string) => url.replace("/upload/", "/upload/fl_attachment/");

export default function GalleryPage() {
  const { id } = useParams<{ id: string }>();
  const [wall, setWall] = useState<Wall | null | undefined>(undefined);
  const [media, setMedia] = useState<WallMedia[]>([]);
  const [open, setOpen] = useState<WallMedia | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const w = await getWall(id).catch(() => null);
      if (!alive) return;
      setWall(w);
      if (w?.galleryOpen) {
        const m = await fetchApprovedMedia(id).catch(() => []);
        if (alive) setMedia(m);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (wall === undefined) {
    return <main className="min-h-screen grid place-items-center bg-[#001e64] text-white/60 animate-pulse">Yükleniyor…</main>;
  }
  if (!wall || !wall.galleryOpen) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#001e64] text-center px-6" style={{ colorScheme: "dark" }}>
        <div>
          <p className="text-5xl mb-4" aria-hidden>🖼️</p>
          <p className="text-white font-display text-xl font-semibold mb-1">Galeri şu an kapalı</p>
          <p className="text-white/60 text-sm">Etkinlik sahibi galeriyi açtığında fotoğraflar burada olacak.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#001e64] text-white" style={{ colorScheme: "dark" }}>
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3 border-b border-white/10">
        <Logo variant="wall" onDark />
        <span className="text-white/50 text-sm truncate">{wall.title}</span>
      </header>

      <section className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-1">📸 Etkinlik galerisi</h1>
        <p className="text-white/50 text-sm mb-6">
          {media.length} anı · dokunup büyüt, ⬇ ile indir.
        </p>

        {media.length === 0 ? (
          <p className="text-white/40 text-center py-16">Henüz onaylı medya yok.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {media.map((m) => (
              <button
                key={m.id}
                onClick={() => setOpen(m)}
                className="relative aspect-square rounded-xl overflow-hidden bg-white/5 group"
                aria-label="Medyayı büyüt"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.type === "video" ? cldVideoPoster(m.url, 480, 480) : cldThumb(m.url, 480, 480)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {m.type === "video" && (
                  <span className="absolute inset-0 grid place-items-center text-3xl drop-shadow" aria-hidden>▶</span>
                )}
                {(m.likes ?? 0) > 0 && (
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 backdrop-blur px-2 py-0.5 text-[11px] font-semibold">❤ {m.likes}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Büyütme katmanı */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/60 text-sm truncate">{open.nickname ? `📷 ${open.nickname}` : " "}</span>
            <div className="flex items-center gap-2">
              <a
                href={dlUrl(open.url)}
                download
                className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                ⬇ İndir
              </a>
              <button onClick={() => setOpen(null)} className="w-10 h-10 grid place-items-center rounded-xl bg-white/10 border border-white/20 text-lg" aria-label="Kapat">
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 grid place-items-center p-3" onClick={(e) => e.stopPropagation()}>
            {open.type === "video" ? (
              <video src={open.url} controls autoPlay playsInline className="max-w-full max-h-full rounded-xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cldFit(open.url, 1600)} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
