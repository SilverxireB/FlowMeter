"use client";

/**
 * FlowSign — video-wall listesi + oluştur. Sahibinin duvarları (yetkili = parlak;
 * ileride paylaşılan/rol → sönük bilgi kartları). Online: Firestore videowalls/.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { useAuthUser } from "@/lib/hooks";
import { createVideowall, deleteVideowall, duplicateVideowall, listVideowalls, slugify } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

const PRESETS: { label: string; w: number; h: number; cols: number; rows: number }[] = [
  { label: "3 dikey TV yan yana (1920×3240)", w: 1920, h: 3240, cols: 3, rows: 1 },
  { label: "2 yatay TV yan yana (3840×1080)", w: 3840, h: 1080, cols: 2, rows: 1 },
  { label: "2×2 ızgara (3840×2160)", w: 3840, h: 2160, cols: 2, rows: 2 },
  { label: "Tek ekran (1920×1080)", w: 1920, h: 1080, cols: 1, rows: 1 },
];

export default function VideowallListPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [walls, setWalls] = useState<Videowall[]>([]);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(0);
  const [w, setW] = useState(1920);
  const [h, setH] = useState(3240);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(1);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (user) setWalls(await listVideowalls(user.uid));
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  function applyPreset(i: number) {
    setPreset(i);
    const p = PRESETS[i];
    setW(p.w);
    setH(p.h);
    setCols(p.cols);
    setRows(p.rows);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    try {
      const id = await createVideowall(user.uid, name.trim() || "Yeni duvar", w, h, cols, rows);
      router.push(`/videowall/${id}/edit`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: Videowall) {
    if (!confirm(`"${v.name}" silinsin mi?`)) return;
    await deleteVideowall(v);
    refresh();
  }

  async function duplicate(v: Videowall) {
    if (!user) return;
    await duplicateVideowall(user.uid, v);
    refresh();
  }

  if (loading || !user) {
    return <main className="min-h-screen grid place-items-center bg-[#05201f] text-white/60">Yükleniyor…</main>;
  }

  return (
    <main className="min-h-screen bg-[#041a1a] text-white">
      <header className="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-white/50 hover:text-white shrink-0 text-lg">←</Link>
          <Logo variant="sign" onDark />
        </div>
        <span className="text-white/45 text-sm truncate max-w-[45vw]">{user.email}</span>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Video duvarların</h1>
        <p className="text-white/50 text-sm mb-6">Çözünürlük + ekran ızgarası tanımla, alanlara içerik yerleştir, tam ekran yayınla.</p>

        {/* Oluştur */}
        <form onSubmit={create} className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-8 flex flex-col gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Duvar adı (ör. Giriş Holü)"
            className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 focus:outline-none focus:border-white/40 font-semibold placeholder:font-normal placeholder:text-white/30"
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button type="button" key={i} onClick={() => applyPreset(i)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === i ? "bg-white text-[#041a1a] border-white" : "border-white/20 text-white/70"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Canlı ızgara önizleme — tanımladığın duvarı burada gör */}
          <div className="flex items-center gap-4">
            <div
              className="relative bg-black rounded-lg border border-white/15 overflow-hidden shrink-0"
              style={{ width: w >= h ? 200 : 200 * (w / h), height: w >= h ? 200 * (h / w) : 200, maxWidth: 200, maxHeight: 200 }}
            >
              {Array.from({ length: Math.max(0, cols - 1) }).map((_, i) => (
                <div key={`c${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-[#2dd4bf]/40" style={{ left: `${((i + 1) / cols) * 100}%` }} />
              ))}
              {Array.from({ length: Math.max(0, rows - 1) }).map((_, i) => (
                <div key={`r${i}`} className="absolute left-0 right-0 border-t border-dashed border-[#2dd4bf]/40" style={{ top: `${((i + 1) / rows) * 100}%` }} />
              ))}
              <div className="absolute inset-0 grid place-items-center text-[#2dd4bf]/70 text-xs font-semibold tabular-nums">{cols}×{rows}</div>
            </div>
            <p className="text-white/45 text-xs leading-relaxed">
              <span className="text-white/70 font-semibold tabular-nums">{cols * rows} ekran</span> · {w}×{h}px<br />
              Oluşturunca alanları sürükle-birleştir ile düzenler, içerik eklersin.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Genişlik</span>
              <input type="number" value={w} onChange={(e) => setW(Math.max(1, Number(e.target.value) || 0))} className="w-28 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <span className="pb-2 text-white/40">×</span>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Yükseklik</span>
              <input type="number" value={h} onChange={(e) => setH(Math.max(1, Number(e.target.value) || 0))} className="w-28 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Yatay ekran</span>
              <input type="number" value={cols} onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Dikey ekran</span>
              <input type="number" value={rows} onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <button type="submit" disabled={busy} className="ml-auto rounded-xl bg-[#2dd4bf] text-[#04231f] px-6 py-2.5 font-semibold disabled:opacity-50">
              ＋ Oluştur
            </button>
          </div>
        </form>

        {/* Liste */}
        {walls.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-5xl mb-4" aria-hidden>🖥️</p>
            <p>Henüz duvar yok. Yukarıdan ilkini oluştur.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {walls.map((v) => (
              <li key={v.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-semibold truncate">{v.name}</p>
                    <p className="text-white/45 text-xs mt-0.5 tabular-nums">{v.width}×{v.height} · {v.cols}×{v.rows} ekran · {v.zones?.length ?? 0} alan</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => duplicate(v)} className="text-white/40 hover:text-white" title="Kopyala" aria-label="Kopyala">⧉</button>
                    <button onClick={() => remove(v)} className="text-white/40 hover:text-[#ff6b6b]" title="Sil" aria-label="Sil">🗑</button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/videowall/${v.id}/edit`} className="rounded-lg bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/15">Düzenle</Link>
                  <a href={`/flowsign/${v.slug ?? slugify(v.name)}`} target="_blank" className="rounded-lg bg-[#2dd4bf] text-[#04231f] px-4 py-2 text-sm font-semibold">▶ Yayınla ↗</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
