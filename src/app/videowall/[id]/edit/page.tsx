"use client";

/**
 * FlowSign — video-wall editörü. Çözünürlük/ızgara config + yerleşim editörü
 * (birleştir/böl, LayoutEditor) + seçili alanın içerik paneli (ZonePanel) +
 * yayın linki. Yazımlar realtime Firestore'a (updateZones/resetGrid).
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import LayoutEditor from "@/components/videowall/LayoutEditor";
import ZonePanel from "@/components/videowall/ZonePanel";
import QrCode from "@/components/present/QrCode";
import { useAuthUser } from "@/lib/hooks";
import { ensureSlug, renameVideowall, resetGrid, slugify, splitZone, updateZones, watchVideowall } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function VideowallEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => watchVideowall(id, setVw), [id]);
  useEffect(() => setOrigin(window.location.origin), []);
  // Eski (slug'sız) duvara isimden slug doldur → kolay link çalışsın.
  useEffect(() => {
    if (vw && !vw.slug) ensureSlug(vw).catch(() => {});
  }, [vw]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const slug = vw ? vw.slug ?? slugify(vw.name) : "";
  const playUrl = origin ? `${origin}/flowsign/${slug}` : "";
  // İlk kullanım rehberi (bir kez).
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("flowsign-onboarded")) setGuide(true);
  }, []);
  const dismissGuide = () => {
    setGuide(false);
    try {
      localStorage.setItem("flowsign-onboarded", "1");
    } catch {}
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(playUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const selected = useMemo(() => (vw?.zones ?? []).find((z) => z.id === selectedId) ?? null, [vw, selectedId]);
  const selectedIndex = useMemo(() => (vw?.zones ?? []).findIndex((z) => z.id === selectedId), [vw, selectedId]);

  if (vw === undefined) return <main className="min-h-screen grid place-items-center bg-[#041a1a] text-white/60">Yükleniyor…</main>;
  if (vw === null) return <main className="min-h-screen grid place-items-center bg-[#041a1a] text-white/60">Duvar bulunamadı.</main>;

  const saveZones = (zones: Videowall["zones"]) => updateZones(id, zones).catch(console.error);

  return (
    <main className="min-h-screen bg-[#041a1a] text-white">
      <header className="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/videowall" className="text-white/50 hover:text-white shrink-0 text-lg">←</Link>
          <input
            key={vw.name}
            defaultValue={vw.name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== vw.name && renameVideowall(id, e.target.value).catch(console.error)}
            className="bg-transparent font-display font-semibold text-lg focus:outline-none border-b border-transparent focus:border-white/30 min-w-0"
          />
        </div>
        <a href={`/flowsign/${slug}`} target="_blank" className="rounded-xl bg-[#2dd4bf] text-[#04231f] px-4 py-2 text-sm font-semibold shrink-0">▶ Yayınla ↗</a>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* İlk kullanım rehberi */}
        {guide && (
          <div className="rounded-2xl bg-[#2dd4bf]/10 border border-[#2dd4bf]/30 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-display font-semibold text-[#7ff0e4]">👋 FlowSign — 4 adımda tabelan hazır</p>
              <button onClick={dismissGuide} className="text-white/40 hover:text-white text-sm shrink-0">Anladım ✕</button>
            </div>
            <ol className="text-sm text-white/75 space-y-1.5 list-decimal list-inside">
              <li><b>Yerleşim:</b> hücrelere sürükle → alanları birleştir, tıkla → seç, gerekirse böl.</li>
              <li><b>İçerik:</b> seçili alana görsel/video/URL/metin/saat ekle (dosyayı sürükleyip de bırakabilirsin).</li>
              <li><b>Ayar:</b> öğe başına süre, saat aralığı, günler; alan başına geçiş efekti.</li>
              <li><b>Yayınla:</b> aşağıdaki linki tabela PC'sinde aç → ⛶ tam ekran. Ekran uyumaz.</li>
            </ol>
          </div>
        )}

        {/* Yayın linki + QR */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col sm:flex-row items-start gap-5">
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Yayın linki</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm bg-black/30 rounded-lg px-3 py-2 text-[#7ff0e4] break-all min-w-0">{playUrl}</code>
              <button onClick={copyLink} className="rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/15">{copied ? "✓ Kopyalandı" : "Kopyala"}</button>
              <a href={playUrl} target="_blank" className="rounded-lg bg-[#2dd4bf] text-[#04231f] px-3 py-2 text-sm font-semibold">Aç ↗</a>
            </div>
            <p className="text-white/40 text-xs mt-2">Bu linki tabela/ekran bilgisayarında Chrome ile aç, tam ekran yap. Telefonla QR'ı okutup da açabilirsin.</p>
          </div>
          {playUrl && (
            <div className="shrink-0 bg-white rounded-xl p-2">
              <QrCode text={playUrl} size={104} />
            </div>
          )}
        </div>

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
              <input key={`c${vw.cols}`} type="number" defaultValue={vw.cols} onBlur={(e) => { const c = Math.max(1, Number(e.target.value) || 1); if (c !== vw.cols && confirm("Izgarayı değiştirmek yerleşimi sıfırlar. Devam?")) { resetGrid(id, c, vw.rows).catch(console.error); setSelectedId(null); } else e.target.value = String(vw.cols); }} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Dikey ekran</span>
              <input key={`r${vw.rows}`} type="number" defaultValue={vw.rows} onBlur={(e) => { const rr = Math.max(1, Number(e.target.value) || 1); if (rr !== vw.rows && confirm("Izgarayı değiştirmek yerleşimi sıfırlar. Devam?")) { resetGrid(id, vw.cols, rr).catch(console.error); setSelectedId(null); } else e.target.value = String(vw.rows); }} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <span className="text-white/40 text-xs pb-2">{vw.zones?.length ?? 0} alan</span>
          </div>
        </div>

        {/* Yerleşim editörü */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Yerleşim</p>
          <LayoutEditor vw={vw} selectedId={selectedId} onSelect={setSelectedId} onZones={saveZones} />
        </div>

        {/* İçerik paneli (seçili alan) */}
        {selected && selectedIndex >= 0 && (
          <ZonePanel
            key={selected.id} /* alan değişince panel remount → input'lar taze */
            vw={vw}
            zone={selected}
            index={selectedIndex}
            onZones={saveZones}
            onSplit={() => { saveZones(splitZone(vw.zones ?? [], vw.cols, vw.rows, selected.id)); setSelectedId(null); }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </section>
    </main>
  );
}
