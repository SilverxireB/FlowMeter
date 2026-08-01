"use client";

/**
 * FlowSign — ekran listesi + oluştur. YETKİ GÖRÜNÜMÜ: senin ekranların PARLAK
 * (tam yetki: düzenle/aç/kopyala/sil), diğer kullanıcılarınki SÖNÜK bilgi kartı
 * (yalnız izleme — yayın linki zaten public). Self-host'ta fabrika rolleriyle
 * eşlenecek. Terminoloji: FlowSign varlığı = "ekran" (FlowWall'ın "duvar"ı ile
 * karışmasın). Online: Firestore videowalls/.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import WallThumb from "@/components/videowall/WallThumb";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { useAuthUser } from "@/lib/hooks";
import { clampScreens, createVideowall, deleteVideowall, duplicateVideowall, fetchScreenSummaries, listAllVideowalls } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

// DİKKAT: preset çözünürlükleri fiziksel gerçek — 3 dikey (portre) TV yan yana
// 3×(1080×1920) = 3240×1920'dir (1920×3240 DEĞİL; o hata ilk izlenimi bozuyordu).
const PRESETS: { label: string; w: number; h: number; cols: number; rows: number }[] = [
  { label: "3 dikey TV yan yana (3240×1920)", w: 3240, h: 1920, cols: 3, rows: 1 },
  { label: "2 yatay TV yan yana (3840×1080)", w: 3840, h: 1080, cols: 2, rows: 1 },
  { label: "2×2 ızgara (3840×2160)", w: 3840, h: 2160, cols: 2, rows: 2 },
  { label: "Tek ekran (1920×1080)", w: 1920, h: 1080, cols: 1, rows: 1 },
];

const inputCls =
  "rounded-lg bg-white/10 border border-white/15 px-3 py-2 focus:outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30";

/** Yayın linki: slug kayıtlıysa kolay link; değilse id rotası (eski ekranlar ölü link vermesin). */
const playHref = (v: Videowall) => (v.slug ? `/flowsign/${v.slug}` : `/videowall/${v.id}/play`);

export default function VideowallListPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const playTarget = usePlayTarget();
  const { confirm, dialog } = useConfirm({ tone: "dark" });
  const [walls, setWalls] = useState<Videowall[]>([]);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(0);
  // number | "" — yazarken alan BOŞ kalabilsin ("1'i silemiyorum, 12 yazıp
  // baştan siliyorum" derdi); değer blur'da ve oluştururken toparlanır.
  const [w, setW] = useState<number | "">(3240);
  const [h, setH] = useState<number | "">(1920);
  const [cols, setCols] = useState<number | "">(3);
  const [rows, setRows] = useState<number | "">(1);
  const numOr = (v: number | "", fallback: number) => (v === "" ? fallback : v);
  const [busy, setBusy] = useState(false);
  /** ÇİFT TIKLAMA KİLİDİ — ref, state DEĞİL: state bir sonraki çizimde geçerli
   *  olduğundan hızlı iki dokunuş ikisi de "boşta" görüp iki kayıt açıyordu. */
  const creatingRef = useRef(false);

  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Kart canlılığı: ekran başına çevrimiçi cihaz sayısı + son görülme (heartbeat)
  const [beats, setBeats] = useState<Record<string, { online: number; lastSeen: number }>>({});
  const refresh = useCallback(async () => {
    if (!user) return;
    const list = await listAllVideowalls();
    setWalls(list);
    setBeats(await fetchScreenSummaries(list.map((v) => v.id)));
  }, [user]);

  // Canlılık rozeti — HER kartta görünür ki canlı/çevrimdışı ayrımı net olsun.
  const beatLabel = (id: string) => {
    const b = beats[id];
    if (b?.online) return { text: `● CANLI${b.online > 1 ? ` · ${b.online}` : ""}`, cls: "bg-emerald-500 text-white" };
    if (b?.lastSeen) {
      const d = Date.now() - b.lastSeen;
      const ago = d < 3600_000 ? `${Math.max(1, Math.round(d / 60_000))} dk` : d < 86_400_000 ? `${Math.round(d / 3600_000)} sa` : `${Math.round(d / 86_400_000)} gün`;
      return { text: `○ ${ago} önce`, cls: "bg-black/60 text-white/70" };
    }
    return { text: "○ çevrimdışı", cls: "bg-black/60 text-white/50" };
  };

  const mine = useMemo(() => walls.filter((v) => v.ownerId === user?.uid), [walls, user]);
  const others = useMemo(() => walls.filter((v) => v.ownerId !== user?.uid), [walls, user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  // Editörden geri dönüşte kartlar bayat kalmasın: mobil Chrome geri tuşu
  // sayfayı önbellekten (bfcache) geri getirir — veri çekilmez, yayınlanan
  // değişiklik kartta görünmezdi. Sekme geri görünür olunca da tazele.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);
  // Hub'daki "＋ Yeni" → oluşturma alanına odaklan (Meter/Wall kartlarıyla aynı davranış).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      window.setTimeout(() => nameRef.current?.focus(), 120);
    }
  }, []);

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
    if (!user || creatingRef.current) return;
    creatingRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      const id = await createVideowall(user.uid, name.trim() || "Yeni ekran", Math.max(1, numOr(w, 1920)), Math.max(1, numOr(h, 1080)), clampScreens(numOr(cols, 1)), clampScreens(numOr(rows, 1)), user.displayName || user.email || "");
      router.push(`/videowall/${id}/edit`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ekran oluşturulamadı, tekrar dene.");
      creatingRef.current = false; // hata → tekrar denenebilsin
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: Videowall) {
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
    if (!user || creatingRef.current) return; // çift tıklama iki kopya üretmesin
    creatingRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      await duplicateVideowall(user.uid, v);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kopyalanamadı, tekrar dene.");
    } finally {
      creatingRef.current = false;
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white/60 animate-pulse">Yükleniyor…</main>;
  }

  return (
    <main className="min-h-screen bg-[#0d102f] text-white" style={{ colorScheme: "dark" }}>
      <header className="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-white/50 hover:text-white shrink-0 text-lg" aria-label="Panele dön">←</Link>
          <Logo variant="sign" onDark />
        </div>
        <span className="text-white/45 text-sm truncate max-w-[45vw]">{user.email}</span>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Ekranların</h1>
        <p className="text-white/50 text-sm mb-6">Çözünürlük + ekran ızgarası tanımla, alanlara içerik yerleştir, tam ekran yayınla.</p>

        {err && <div className="mb-5 rounded-2xl bg-rose-400/15 border border-rose-400/30 text-rose-300 px-4 py-3 text-sm font-semibold">{err}</div>}

        {/* Oluştur */}
        <form onSubmit={create} className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-8 flex flex-col gap-4">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ekran adı (ör. Giriş Holü)"
            className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 focus:outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30 font-semibold placeholder:font-normal placeholder:text-white/30"
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button type="button" key={i} onClick={() => applyPreset(i)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === i ? "bg-white text-[#0d102f] border-white" : "border-white/20 text-white/70 hover:border-white/40"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Canlı ızgara önizleme — tanımladığın duvarı burada gör */}
          <div className="flex items-center gap-4">
            <div
              className="relative bg-black rounded-lg border border-white/15 overflow-hidden shrink-0"
              style={{ width: numOr(w, 1920) >= numOr(h, 1080) ? 200 : 200 * (numOr(w, 1920) / numOr(h, 1080)), height: numOr(w, 1920) >= numOr(h, 1080) ? 200 * (numOr(h, 1080) / numOr(w, 1920)) : 200, maxWidth: 200, maxHeight: 200 }}
            >
              {Array.from({ length: Math.max(0, numOr(cols, 1) - 1) }).map((_, i) => (
                <div key={`c${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-[#6366f1]/40" style={{ left: `${((i + 1) / numOr(cols, 1)) * 100}%` }} />
              ))}
              {Array.from({ length: Math.max(0, numOr(rows, 1) - 1) }).map((_, i) => (
                <div key={`r${i}`} className="absolute left-0 right-0 border-t border-dashed border-[#6366f1]/40" style={{ top: `${((i + 1) / numOr(rows, 1)) * 100}%` }} />
              ))}
              <div className="absolute inset-0 grid place-items-center text-[#a5b4fc]/80 text-xs font-semibold tabular-nums">{numOr(cols, 1)}×{numOr(rows, 1)}</div>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">
              <span className="text-white/70 font-semibold tabular-nums">{numOr(cols, 1) * numOr(rows, 1)} fiziksel ekran</span> · {numOr(w, 1920)}×{numOr(h, 1080)}px<br />
              Oluşturunca alanları sürükle-birleştir ile düzenler, içerik eklersin.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-white/50 text-xs">Genişlik (px)</span>
                <input type="number" min={1} value={w} onChange={(e) => setW(e.target.value === "" ? "" : Math.max(1, Math.round(Number(e.target.value) || 0)))} onBlur={() => w === "" && setW(1920)} className={`w-28 ${inputCls}`} />
              </label>
              <span className="pb-2 text-white/40">×</span>
              <label className="flex flex-col gap-1">
                <span className="text-white/50 text-xs">Yükseklik (px)</span>
                <input type="number" min={1} value={h} onChange={(e) => setH(e.target.value === "" ? "" : Math.max(1, Math.round(Number(e.target.value) || 0)))} onBlur={() => h === "" && setH(1080)} className={`w-28 ${inputCls}`} />
              </label>
            </div>
            {/* "Yatay/Dikey ekran" TV yönü sanılıyordu → eksen sorusu olarak yazıldı */}
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Yan yana kaç ekran?</span>
              <input type="number" min={1} max={24} value={cols} onChange={(e) => setCols(e.target.value === "" ? "" : clampScreens(Number(e.target.value)))} onBlur={() => cols === "" && setCols(1)} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Üst üste kaç ekran?</span>
              <input type="number" min={1} max={24} value={rows} onChange={(e) => setRows(e.target.value === "" ? "" : clampScreens(Number(e.target.value)))} onBlur={() => rows === "" && setRows(1)} className={`w-24 ${inputCls}`} />
            </label>
            <button type="submit" disabled={busy} className="w-full sm:w-auto sm:ml-auto rounded-xl bg-accent hover:bg-accent-dark text-white px-6 py-2.5 font-semibold disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#a5b4fc]/60">
              ＋ Oluştur
            </button>
          </div>
        </form>

        {/* Senin ekranların — tam yetki (parlak) */}
        {mine.length === 0 ? (
          <div className="text-center py-16 text-white/50">
            <p className="text-5xl mb-4" aria-hidden>🖥️</p>
            <p>Henüz ekranın yok. Yukarıdan ilkini oluştur.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* Telefonda TEK sıra (dar kartta aksiyonlar eziliyordu); sm+ çoklu */}
            {mine.map((v) => (
              <li key={v.id} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col">
                {/* Önizleme = yayındaki yerleşim; tıkla → editör */}
                <Link href={`/videowall/${v.id}/edit`} className="relative block group" aria-label={`${v.name} — düzenle`}>
                  <WallThumb vw={v} />
                  <span className="absolute inset-0 ring-1 ring-inset ring-white/10 group-hover:ring-[#6366f1]/60 transition" aria-hidden />
                  <span className={`absolute top-1.5 right-1.5 rounded-full backdrop-blur px-2 py-0.5 text-[10px] font-bold tracking-wide ${beatLabel(v.id).cls}`}>
                    {beatLabel(v.id).text}
                  </span>
                </Link>
                <div className="p-3 flex flex-col gap-2.5 flex-1">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm truncate">{v.name}</p>
                    <p className="text-white/50 text-[11px] mt-0.5 tabular-nums">{v.width}×{v.height} · {v.cols}×{v.rows} · {v.zones?.length ?? 0} alan</p>
                  </div>
                  <div className="flex items-center gap-1 mt-auto">
                    <Link href={`/videowall/${v.id}/edit`} className="flex-1 text-center rounded-lg bg-white/10 border border-white/15 px-2 py-1.5 text-xs font-semibold hover:bg-white/15">Düzenle</Link>
                    {/* "Yayınla" değil — editördeki Kaydet & Yayınla ile karışıyordu */}
                    <a href={playHref(v)} target={playTarget} title="Ekranı aç" aria-label="Ekranı aç" className="shrink-0 w-7 h-7 grid place-items-center rounded-lg bg-accent hover:bg-accent-dark text-white">
                      <Icon name="play" size={12} />
                    </a>
                    <button onClick={() => duplicate(v)} disabled={busy} className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30" title="Kopyala" aria-label="Kopyala">
                      <Icon name="copy" size={13} />
                    </button>
                    <button
                      onClick={() =>
                        confirm(
                          { title: "Ekranı sil", message: `"${v.name}" ekranı ve yüklenmiş medyası silinecek. Bu işlem geri alınamaz.`, confirmLabel: "Sil", danger: true },
                          () => remove(v)
                        )
                      } className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-white/40 hover:text-rose-400 hover:bg-white/10" title="Sil" aria-label="Sil">
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Diğer kullanıcıların ekranları — yetkisiz (sönük, bilgi + izleme) */}
        {others.length > 0 && (
          <div className="mt-10">
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.14em] mb-3">
              Diğer ekranlar <span className="normal-case tracking-normal font-normal">(yetkin yok — yalnız izleme)</span>
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {others.map((v) => (
                <li key={v.id} className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden flex flex-col">
                  <div className="relative opacity-60">
                    <WallThumb vw={v} />
                    <span className={`absolute top-1.5 right-1.5 rounded-full backdrop-blur px-2 py-0.5 text-[10px] font-bold tracking-wide ${beatLabel(v.id).cls}`}>
                      {beatLabel(v.id).text}
                    </span>
                  </div>
                  <div className="p-3 flex flex-col gap-2.5 flex-1">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm truncate text-white/60">{v.name}</p>
                      <p className="text-white/50 text-[11px] mt-0.5 tabular-nums">
                        {v.width}×{v.height} · {v.cols}×{v.rows}
                        {v.ownerName ? <span> · 👤 {v.ownerName}</span> : null}
                      </p>
                    </div>
                    <div className="flex gap-1.5 items-center mt-auto">
                      <a href={playHref(v)} target={playTarget} className="flex-1 text-center rounded-lg bg-white/10 border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/15">▶ İzle{playTarget ? " ↗" : ""}</a>
                      <span className="shrink-0 text-xs text-white/45" title="Düzenleme sahibinde">🔒</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {dialog}
    </main>
  );
}
