"use client";

/**
 * FlowSign — video-wall listesi + oluştur. YETKİ GÖRÜNÜMÜ: senin duvarların
 * PARLAK (tam yetki: düzenle/yayınla/kopyala/sil), diğer kullanıcılarınki SÖNÜK
 * bilgi kartı (yalnız izleme — yayın linki zaten public). Self-host'ta fabrika
 * rolleriyle eşlenecek. Online: Firestore videowalls/.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import { useAuthUser } from "@/lib/hooks";
import { clampScreens, createVideowall, deleteVideowall, duplicateVideowall, listAllVideowalls, slugify } from "@/lib/videowalls";
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
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (user) setWalls(await listAllVideowalls());
  }, [user]);

  const mine = useMemo(() => walls.filter((v) => v.ownerId === user?.uid), [walls, user]);
  const others = useMemo(() => walls.filter((v) => v.ownerId !== user?.uid), [walls, user]);

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
    setErr(null);
    try {
      const id = await createVideowall(user.uid, name.trim() || "Yeni duvar", w, h, cols, rows, user.displayName || user.email || "");
      router.push(`/videowall/${id}/edit`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Duvar oluşturulamadı, tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: Videowall) {
    if (!confirm(`"${v.name}" ve yüklenmiş medyası silinsin mi? Bu işlem geri alınamaz.`)) return;
    setErr(null);
    try {
      const idToken = user ? await user.getIdToken().catch(() => undefined) : undefined;
      await deleteVideowall(v, idToken);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Silme başarısız, tekrar dene.");
    }
  }

  async function duplicate(v: Videowall) {
    if (!user) return;
    setErr(null);
    try {
      await duplicateVideowall(user.uid, v);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kopyalanamadı, tekrar dene.");
    }
  }

  if (loading || !user) {
    return <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white/60">Yükleniyor…</main>;
  }

  return (
    <main className="min-h-screen bg-[#0d102f] text-white">
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

        {err && <div className="mb-5 rounded-2xl bg-[#ff6b6b]/15 border border-[#ff6b6b]/30 text-[#ffb4b4] px-4 py-3 text-sm font-semibold">{err}</div>}

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
              <button type="button" key={i} onClick={() => applyPreset(i)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === i ? "bg-white text-[#0d102f] border-white" : "border-white/20 text-white/70"}`}>
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
                <div key={`c${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-[#6366f1]/40" style={{ left: `${((i + 1) / cols) * 100}%` }} />
              ))}
              {Array.from({ length: Math.max(0, rows - 1) }).map((_, i) => (
                <div key={`r${i}`} className="absolute left-0 right-0 border-t border-dashed border-[#6366f1]/40" style={{ top: `${((i + 1) / rows) * 100}%` }} />
              ))}
              <div className="absolute inset-0 grid place-items-center text-[#6366f1]/70 text-xs font-semibold tabular-nums">{cols}×{rows}</div>
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
              <input type="number" value={cols} onChange={(e) => setCols(clampScreens(Number(e.target.value)))} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Dikey ekran</span>
              <input type="number" value={rows} onChange={(e) => setRows(clampScreens(Number(e.target.value)))} className="w-20 rounded-lg bg-white/10 border border-white/15 px-3 py-2" />
            </label>
            <button type="submit" disabled={busy} className="ml-auto rounded-xl bg-[#6366f1] text-white px-6 py-2.5 font-semibold disabled:opacity-50">
              ＋ Oluştur
            </button>
          </div>
        </form>

        {/* Senin duvarların — tam yetki (parlak) */}
        {mine.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-5xl mb-4" aria-hidden>🖥️</p>
            <p>Henüz duvarın yok. Yukarıdan ilkini oluştur.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {mine.map((v) => (
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
                  <a href={`/flowsign/${v.slug ?? slugify(v.name)}`} target="_blank" className="rounded-lg bg-[#6366f1] text-white px-4 py-2 text-sm font-semibold">▶ Yayınla ↗</a>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Diğer kullanıcıların duvarları — yetkisiz (sönük, bilgi + izleme) */}
        {others.length > 0 && (
          <div className="mt-10">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Diğer duvarlar <span className="normal-case tracking-normal">(yetkin yok — yalnız izleme)</span></p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {others.map((v) => (
                <li key={v.id} className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex flex-col gap-3 opacity-60 hover:opacity-80 transition-opacity">
                  <div className="min-w-0">
                    <p className="font-display font-semibold truncate text-white/70">{v.name}</p>
                    <p className="text-white/35 text-xs mt-0.5 tabular-nums">
                      {v.width}×{v.height} · {v.cols}×{v.rows} ekran
                      {v.ownerName ? <span> · 👤 {v.ownerName}</span> : null}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/flowsign/${v.slug ?? slugify(v.name)}`} target="_blank" className="rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-sm font-semibold text-white/60">▶ İzle ↗</a>
                    <span className="rounded-lg px-3 py-2 text-xs text-white/30 self-center">🔒 Düzenleme sahibinde</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
