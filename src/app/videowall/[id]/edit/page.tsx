"use client";

/**
 * FlowSign — video-wall editörü (v1). Çözünürlük/ızgara config + ölçekli grid
 * önizleme (drag-drop layout editörü v2'de bunun üstüne gelir) + yayın linki.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/hooks";
import { renameVideowall, resetGrid, watchVideowall } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function VideowallEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const [playUrl, setPlayUrl] = useState("");

  useEffect(() => watchVideowall(id, setVw), [id]);
  useEffect(() => setPlayUrl(`${window.location.origin}/videowall/${id}/play`), [id]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (vw === undefined) return <main className="min-h-screen grid place-items-center bg-[#041a1a] text-white/60">Yükleniyor…</main>;
  if (vw === null) return <main className="min-h-screen grid place-items-center bg-[#041a1a] text-white/60">Duvar bulunamadı.</main>;

  const aspect = vw.width / vw.height;

  return (
    <main className="min-h-screen bg-[#041a1a] text-white">
      <header className="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/videowall" className="text-white/50 hover:text-white shrink-0 text-lg">←</Link>
          <input
            defaultValue={vw.name}
            onBlur={(e) => e.target.value.trim() && renameVideowall(id, e.target.value).catch(console.error)}
            className="bg-transparent font-display font-semibold text-lg focus:outline-none border-b border-transparent focus:border-white/30 min-w-0"
          />
        </div>
        <a href={playUrl} target="_blank" className="rounded-xl bg-[#2dd4bf] text-[#04231f] px-4 py-2 text-sm font-semibold shrink-0">▶ Yayınla ↗</a>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Config */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Duvar tanımı</p>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <div>
              <p className="text-white/50 text-xs mb-1">Çözünürlük</p>
              <p className="font-semibold tabular-nums">{vw.width} × {vw.height}</p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Yatay ekran</span>
              <input type="number" defaultValue={vw.cols} onBlur={(e) => { const c = Math.max(1, Number(e.target.value) || 1); if (c !== vw.cols && confirm("Izgarayı değiştirmek yerleşimi sıfırlar. Devam?")) resetGrid(id, c, vw.rows).catch(console.error); else e.target.value = String(vw.cols); }} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Dikey ekran</span>
              <input type="number" defaultValue={vw.rows} onBlur={(e) => { const rr = Math.max(1, Number(e.target.value) || 1); if (rr !== vw.rows && confirm("Izgarayı değiştirmek yerleşimi sıfırlar. Devam?")) resetGrid(id, vw.cols, rr).catch(console.error); else e.target.value = String(vw.rows); }} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <span className="text-white/40 text-xs pb-2">{vw.zones?.length ?? 0} alan</span>
          </div>
        </div>

        {/* Ölçekli önizleme (grid) — v2'de sürükle-bırak editör buraya gelir */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Yerleşim önizleme</p>
          <div className="relative mx-auto bg-black rounded-lg overflow-hidden border border-white/15" style={{ width: "100%", maxWidth: aspect >= 1 ? 900 : 900 * aspect, aspectRatio: `${vw.width} / ${vw.height}` }}>
            {/* Fiziksel ekran çizgileri */}
            {Array.from({ length: vw.cols - 1 }).map((_, i) => (
              <div key={`c${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-white/20" style={{ left: `${((i + 1) / vw.cols) * 100}%` }} />
            ))}
            {Array.from({ length: vw.rows - 1 }).map((_, i) => (
              <div key={`r${i}`} className="absolute left-0 right-0 border-t border-dashed border-white/20" style={{ top: `${((i + 1) / vw.rows) * 100}%` }} />
            ))}
            {/* Zone'lar */}
            {vw.zones?.map((z, i) => (
              <div
                key={z.id}
                className="absolute border border-[#2dd4bf]/50 bg-[#2dd4bf]/5 grid place-items-center text-[#7ff0e4] text-xs font-semibold"
                style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` }}
              >
                Alan {i + 1}
                {z.items.length > 0 && <span className="text-white/40"> · {z.items.length} içerik</span>}
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-3">Sıradaki: alanları sürükle-bırak ile böl/birleştir + içerik (video/görsel/URL) atama.</p>
        </div>
      </section>
    </main>
  );
}
