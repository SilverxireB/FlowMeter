"use client";

/**
 * FlowSign — video-wall editörü. TASLAK üzerinde çalışır: yerleşim/içerik
 * değişiklikleri anında CANLI ekrana GİTMEZ — "Önizle" taslağı gösterir,
 * "Kaydet & Yayınla" yayına alır. Config + LayoutEditor + ZonePanel + yayın linki.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import LayoutEditor from "@/components/videowall/LayoutEditor";
import ZonePanel from "@/components/videowall/ZonePanel";
import QrCode from "@/components/present/QrCode";
import { useAuthUser } from "@/lib/hooks";
import { clampScreens, ensureSlug, publishVideowall, renameVideowall, resetGrid, slugify, splitZone, updateZones, watchVideowall } from "@/lib/videowalls";
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
  // Eski (slug'sız) duvara isimden slug doldur → kolay link çalışsın (yalnız sahibi yazabilir).
  useEffect(() => {
    if (vw && !vw.slug && user && vw.ownerId === user.uid) ensureSlug(vw).catch(() => {});
  }, [vw, user]);
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

  // Taslak ≠ yayın mı? (kaydedilmemiş değişiklik göstergesi)
  const dirty = useMemo(() => {
    if (!vw) return false;
    if (!vw.live) return true; // eski duvar: hiç yayınlanmamış
    const pick = (s: { zones?: Videowall["zones"]; cols: number; rows: number; width: number; height: number }) =>
      JSON.stringify({ z: s.zones ?? [], c: s.cols, r: s.rows, w: s.width, h: s.height });
    return pick(vw) !== pick(vw.live);
  }, [vw]);
  const [publishing, setPublishing] = useState(false);
  const publish = async () => {
    if (!vw || publishing) return;
    setPublishing(true);
    try {
      await publishVideowall(vw);
    } catch (e) {
      console.error(e);
      alert("Yayınlama başarısız — tekrar dene.");
    } finally {
      setPublishing(false);
    }
  };

  if (vw === undefined || loading) return <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white/60">Yükleniyor…</main>;
  if (vw === null) return <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white/60">Duvar bulunamadı.</main>;

  // Yetki: düzenleme yalnız sahibinde — başkası açarsa bilgi + izleme.
  if (user && vw.ownerId !== user.uid) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white px-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4" aria-hidden>🔒</p>
          <h1 className="font-display text-xl font-semibold mb-2">Bu duvarda düzenleme yetkin yok</h1>
          <p className="text-white/50 text-sm mb-6">
            &ldquo;{vw.name}&rdquo;{vw.ownerName ? ` ${vw.ownerName} kullanıcısına ait` : " başka bir kullanıcıya ait"}. Yayını izleyebilirsin.
          </p>
          <div className="flex gap-2 justify-center">
            <a href={`/flowsign/${slug}`} target="_blank" className="rounded-xl bg-[#6366f1] text-white px-5 py-2.5 text-sm font-semibold">▶ İzle ↗</a>
            <Link href="/videowall" className="rounded-xl bg-white/10 border border-white/15 px-5 py-2.5 text-sm font-semibold">← Duvarlar</Link>
          </div>
        </div>
      </main>
    );
  }

  const saveZones = (zones: Videowall["zones"]) => updateZones(id, zones).catch(console.error);

  return (
    <main className="min-h-screen bg-[#0d102f] text-white">
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
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/videowall/${id}/play?draft=1`} target="_blank" className="rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/15">👁 Önizle ↗</a>
          <button
            onClick={publish}
            disabled={!dirty || publishing}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${dirty ? "bg-[#6366f1] text-white" : "bg-white/10 border border-white/15 text-white/50"} disabled:opacity-70`}
          >
            {publishing ? "Yayınlanıyor…" : dirty ? "💾 Kaydet & Yayınla" : "✓ Yayında"}
          </button>
        </div>
      </header>

      {/* Kaydedilmemiş değişiklik şeridi */}
      {dirty && (
        <div className="bg-[#6366f1]/10 border-b border-[#6366f1]/20 px-4 sm:px-6 py-2 text-xs text-[#a5b4fc]">
          Kaydedilmemiş değişiklikler var — canlı ekran son yayınlanan hâli oynatmaya devam ediyor. <b>Kaydet & Yayınla</b> ile ekrana gönder.
        </div>
      )}

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* İlk kullanım rehberi */}
        {guide && (
          <div className="rounded-2xl bg-[#6366f1]/10 border border-[#6366f1]/30 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-display font-semibold text-[#a5b4fc]">👋 FlowSign — 4 adımda tabelan hazır</p>
              <button onClick={dismissGuide} className="text-white/40 hover:text-white text-sm shrink-0">Anladım ✕</button>
            </div>
            <ol className="text-sm text-white/75 space-y-1.5 list-decimal list-inside">
              <li><b>Yerleşim:</b> hücrelere sürükle → alanları birleştir, tıkla → seç, gerekirse böl.</li>
              <li><b>İçerik:</b> seçili alana görsel/video/URL/metin/saat ekle (dosyayı sürükleyip de bırakabilirsin).</li>
              <li><b>Önizle:</b> 👁 ile taslağı gör — canlı ekran bozulmaz, değişiklikler yayına gitmez.</li>
              <li><b>Kaydet & Yayınla:</b> hazır olunca bas → aşağıdaki link/QR bu hâli oynatır. Ekran uyumaz.</li>
            </ol>
          </div>
        )}

        {/* Yayın linki + QR */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col sm:flex-row items-start gap-5">
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Yayın linki</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm bg-black/30 rounded-lg px-3 py-2 text-[#a5b4fc] break-all min-w-0">{playUrl}</code>
              <button onClick={copyLink} className="rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/15">{copied ? "✓ Kopyalandı" : "Kopyala"}</button>
              <a href={playUrl} target="_blank" className="rounded-lg bg-[#6366f1] text-white px-3 py-2 text-sm font-semibold">Aç ↗</a>
            </div>
            <p className="text-white/40 text-xs mt-2">Bu linki tabela/ekran bilgisayarında Chrome ile aç, tam ekran yap. Telefonla QR&apos;ı okutup da açabilirsin. Link her zaman <b>son yayınlanan</b> hâli oynatır.</p>
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
              <input key={`c${vw.cols}`} type="number" min={1} max={24} defaultValue={vw.cols} onBlur={(e) => { const c = clampScreens(Number(e.target.value)); if (c !== vw.cols && confirm("Izgarayı değiştirmek TASLAK yerleşimi sıfırlar (yayın etkilenmez). Devam?")) { resetGrid(id, c, vw.rows).catch(console.error); setSelectedId(null); } else e.target.value = String(vw.cols); }} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Dikey ekran</span>
              <input key={`r${vw.rows}`} type="number" min={1} max={24} defaultValue={vw.rows} onBlur={(e) => { const rr = clampScreens(Number(e.target.value)); if (rr !== vw.rows && confirm("Izgarayı değiştirmek TASLAK yerleşimi sıfırlar (yayın etkilenmez). Devam?")) { resetGrid(id, vw.cols, rr).catch(console.error); setSelectedId(null); } else e.target.value = String(vw.rows); }} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
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
            onSplit={() => {
              if (selected.items.length > 0 && !confirm(`"${selected.name || `Alan ${selectedIndex + 1}`}" hücrelere bölünecek; içeriği sol-üst hücrede kalır. Bölünsün mü?`)) return;
              saveZones(splitZone(vw.zones ?? [], vw.cols, vw.rows, selected.id));
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </section>
    </main>
  );
}
