"use client";

/**
 * FlowSign — ekran listesi + oluştur (self-host).
 *
 * YETKİ GÖRÜNÜMÜ üç grup: SAHİBİ olduklarım · bana YETKİ verilenler (düzenler
 * ve yayınlarım, silemem) · diğerleri (yalnız izleme). Yönetici tüm ekranlarda
 * sahip yetkisindedir. Terminoloji: FlowSign varlığı = "ekran".
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/icons";
import WallThumb from "@/components/WallThumb";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { useSession } from "@/lib/useSession";
import { canCopyWall, canDeleteWall, canEditWall, canViewWall, createWall, deleteWall, duplicateWall, listWalls } from "@/lib/client";
import { clampScreens } from "@/lib/zones";
import { PublicUser, Videowall } from "@/lib/types";

// DİKKAT: preset çözünürlükleri fiziksel gerçek — 3 dikey (portre) TV yan yana
// 3×(1080×1920) = 3240×1920'dir (1920×3240 DEĞİL).
const PRESETS: { label: string; w: number; h: number; cols: number; rows: number }[] = [
  { label: "3 dikey TV yan yana (3240×1920)", w: 3240, h: 1920, cols: 3, rows: 1 },
  { label: "2 yatay TV yan yana (3840×1080)", w: 3840, h: 1080, cols: 2, rows: 1 },
  { label: "2×2 ızgara (3840×2160)", w: 3840, h: 2160, cols: 2, rows: 2 },
  { label: "Tek ekran (1920×1080)", w: 1920, h: 1080, cols: 1, rows: 1 },
];

const inputCls =
  "input-base !py-2 !px-3 !rounded-lg";

/** Yayın linki: slug kayıtlıysa kolay link; değilse id (ölü link vermesin). */
const playHref = (v: Videowall) => `/play/${v.slug ?? v.id}`;

export default function ScreensPage() {
  const router = useRouter();
  const { loading, authed } = useSession();
  const playTarget = usePlayTarget();
  const [walls, setWalls] = useState<Videowall[]>([]);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(0);
  // number | "" — yazarken alan BOŞ kalabilsin; değer blur'da ve oluştururken toparlanır.
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
  const [confirmDel, setConfirmDel] = useState<Videowall | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Kart canlılığı: ekran başına çevrimiçi cihaz sayısı + son görülme (heartbeat)
  const [beats, setBeats] = useState<Record<string, { online: number; lastSeen: number }>>({});
  const [me, setMe] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const refresh = useCallback(async () => {
    try {
      const d = await listWalls();
      setWalls(d.walls);
      setBeats(d.beats);
      setMe(d.me);
      setUsers(d.users);
    } catch {}
  }, []);

  /** Kart altındaki "sahibi" satırı için kişi adı (defterden). */
  const ownerLabel = (v: Videowall) => {
    const u = users.find((x) => x.id === v.ownerId);
    return u ? u.label || u.name : "yönetici";
  };

  // Canlılık rozeti — HER kartta görünür ki canlı/çevrimdışı ayrımı net olsun.
  const beatLabel = (id: string) => {
    const b = beats[id];
    if (b?.online) return { text: `● CANLI${b.online > 1 ? ` · ${b.online}` : ""}`, cls: "bg-emerald-500 text-white" };
    if (b?.lastSeen) {
      const d = Date.now() - b.lastSeen;
      const ago = d < 3600_000 ? `${Math.max(1, Math.round(d / 60_000))} dk` : d < 86_400_000 ? `${Math.round(d / 3600_000)} sa` : `${Math.round(d / 86_400_000)} gün`;
      return { text: `○ ${ago} önce`, cls: "bg-black/55 text-white/80" };
    }
    return { text: "○ çevrimdışı", cls: "bg-black/55 text-white/60" };
  };

  useEffect(() => {
    if (!loading && !authed) router.replace("/login");
  }, [loading, authed, router]);
  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);
  // Editörden geri dönüşte kartlar bayat kalmasın (bfcache + sekme görünürlüğü).
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
    if (creatingRef.current) return;
    creatingRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      const wall = await createWall(name.trim() || "Yeni ekran", Math.max(1, numOr(w, 1920)), Math.max(1, numOr(h, 1080)), clampScreens(numOr(cols, 1)), clampScreens(numOr(rows, 1)));
      router.push(`/screens/${wall.id}/edit`);
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
      await deleteWall(v.id);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Silme başarısız, tekrar dene.");
    }
  }

  async function duplicate(v: Videowall) {
    if (creatingRef.current) return; // çift tıklama iki kopya üretmesin
    creatingRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      await duplicateWall(v.id);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kopyalanamadı, tekrar dene.");
    } finally {
      creatingRef.current = false;
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  // Yetki grupları (istemcide yalnız GÖRÜNÜM; asıl kapı sunucuda — serverAuth.ts).
  // Yetkiler yöneticinin "Sign yetkileri" sekmesinden gelir.
  const mine = walls.filter((v) => v.ownerId === me?.id || (me?.role === "admin" && !v.ownerId));
  const shared = walls.filter((v) => v.ownerId !== me?.id && canViewWall(v, me));
  const others = walls.filter((v) => v.ownerId !== me?.id && !canViewWall(v, me));

  /** Kart gövdesi TEK yerde; düğmeler kişinin YETKİSİNE göre çizilir. */
  const wallCard = (v: Videowall, owned: boolean) => {
    const mayCopy = canCopyWall(v, me);
    const mayDelete = canDeleteWall(v, me);
    const mayEdit = canEditWall(v, me);
    return (
    <li key={v.id} className="card overflow-hidden flex flex-col">
      {/* Önizleme = yayındaki yerleşim; tıkla → editör */}
      <Link href={`/screens/${v.id}/edit`} className="relative block group" aria-label={`${v.name} — düzenle`}>
        <WallThumb vw={v} />
        <span className="absolute inset-0 ring-1 ring-inset ring-ink/10 group-hover:ring-accent/60 transition" aria-hidden />
        <span className={`absolute top-1.5 right-1.5 rounded-full backdrop-blur px-2 py-0.5 text-[10px] font-bold tracking-wide ${beatLabel(v.id).cls}`}>
          {beatLabel(v.id).text}
        </span>
      </Link>
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm truncate">{v.name}</p>
          {!owned && <p className="text-muted text-[11px] mt-0.5 truncate">Sahibi: {ownerLabel(v)}</p>}
          <p className="text-muted text-[11px] mt-0.5 tabular-nums">
            {v.width}×{v.height} · {v.cols}×{v.rows} · {v.zones?.length ?? 0} alan
          </p>
        </div>
        <div className="flex items-center gap-1 mt-auto">
          <Link href={`/screens/${v.id}/edit`} className="flex-1 text-center rounded-lg bg-paper border border-line px-2 py-1.5 text-xs font-semibold hover:border-muted">
            {mayEdit ? "Düzenle" : "Aç"}
          </Link>
          <a href={playHref(v)} target={playTarget} title="Ekranı aç" aria-label="Ekranı aç" className="shrink-0 w-7 h-7 grid place-items-center rounded-lg bg-accent hover:bg-accent-dark text-white">
            <Icon name="play" size={12} />
          </a>
          {mayCopy && (
            <>
              <button onClick={() => duplicate(v)} disabled={busy} className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-paper disabled:opacity-30" title="Kopyala" aria-label="Kopyala">
                <Icon name="copy" size={13} />
              </button>
            </>
          )}
          {mayDelete && (
            <>
              <button onClick={() => setConfirmDel(v)} className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50" title="Sil" aria-label="Sil">
                <Icon name="trash" size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </li>
    );
  };

  if (loading || !authed) {
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  }

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 shrink-0" role="img" aria-label="FlowSign">
          <Image src="/logo.png" alt="" width={140} height={40} className="h-7 w-auto" priority />
          <span aria-hidden className="font-display font-semibold text-[26px] leading-none tracking-[0.03em] text-[#001e64]">SIGN</span>
        </span>
        <div className="flex items-center gap-2 min-w-0">
          {me?.role === "admin" && (
            <Link href="/users" className="chip !py-1.5 text-xs text-muted hover:border-muted shrink-0 inline-flex items-center gap-1.5" title="Kullanıcılar ve yetkiler">
              <Icon name="users" size={14} /> <span className="hidden sm:inline">Kullanıcılar</span>
            </Link>
          )}
          <span className="chip text-muted text-xs min-w-0 max-w-[35vw] hidden sm:inline-flex">
            <span className="truncate min-w-0">{me?.label || me?.name}</span>
          </span>
          <button onClick={logout} className="text-muted hover:text-ink text-sm font-semibold shrink-0">Çıkış</button>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Ekranların</h1>
        <p className="text-muted text-sm mb-6">Çözünürlük + ekran ızgarası tanımla, alanlara içerik yerleştir, tam ekran yayınla.</p>

        {err && <div className="mb-5 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        {/* Oluştur */}
        <form onSubmit={create} className="card p-5 mb-8 flex flex-col gap-4">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ekran adı (ör. Giriş Holü)"
            className="input-base font-semibold placeholder:font-normal"
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button type="button" key={i} onClick={() => applyPreset(i)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === i ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Canlı ızgara önizleme — tanımladığın duvarı burada gör */}
          <div className="flex items-center gap-4">
            <div
              className="relative bg-ink rounded-lg border border-line overflow-hidden shrink-0"
              style={{ width: numOr(w, 1920) >= numOr(h, 1080) ? 200 : 200 * (numOr(w, 1920) / numOr(h, 1080)), height: numOr(w, 1920) >= numOr(h, 1080) ? 200 * (numOr(h, 1080) / numOr(w, 1920)) : 200, maxWidth: 200, maxHeight: 200 }}
            >
              {Array.from({ length: Math.max(0, numOr(cols, 1) - 1) }).map((_, i) => (
                <div key={`c${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-white/30" style={{ left: `${((i + 1) / numOr(cols, 1)) * 100}%` }} />
              ))}
              {Array.from({ length: Math.max(0, numOr(rows, 1) - 1) }).map((_, i) => (
                <div key={`r${i}`} className="absolute left-0 right-0 border-t border-dashed border-white/30" style={{ top: `${((i + 1) / numOr(rows, 1)) * 100}%` }} />
              ))}
              <div className="absolute inset-0 grid place-items-center text-white/70 text-xs font-semibold tabular-nums">{numOr(cols, 1)}×{numOr(rows, 1)}</div>
            </div>
            <p className="text-muted text-xs leading-relaxed">
              <span className="text-ink font-semibold tabular-nums">{numOr(cols, 1) * numOr(rows, 1)} fiziksel ekran</span> · {numOr(w, 1920)}×{numOr(h, 1080)}px<br />
              Oluşturunca alanları sürükle-birleştir ile düzenler, içerik eklersin.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Genişlik (px)</span>
                <input type="number" min={1} value={w} onChange={(e) => setW(e.target.value === "" ? "" : Math.max(1, Math.round(Number(e.target.value) || 0)))} onBlur={() => w === "" && setW(1920)} className={`w-28 ${inputCls}`} />
              </label>
              <span className="pb-2 text-muted">×</span>
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Yükseklik (px)</span>
                <input type="number" min={1} value={h} onChange={(e) => setH(e.target.value === "" ? "" : Math.max(1, Math.round(Number(e.target.value) || 0)))} onBlur={() => h === "" && setH(1080)} className={`w-28 ${inputCls}`} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Yan yana kaç ekran?</span>
              <input type="number" min={1} max={24} value={cols} onChange={(e) => setCols(e.target.value === "" ? "" : clampScreens(Number(e.target.value)))} onBlur={() => cols === "" && setCols(1)} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Üst üste kaç ekran?</span>
              <input type="number" min={1} max={24} value={rows} onChange={(e) => setRows(e.target.value === "" ? "" : clampScreens(Number(e.target.value)))} onBlur={() => rows === "" && setRows(1)} className={`w-24 ${inputCls}`} />
            </label>
            <button type="submit" disabled={busy} className="w-full sm:w-auto sm:ml-auto btn-primary !py-2.5">
              ＋ Oluştur
            </button>
          </div>
        </form>

        {/* Üç grup: sahibi olduklarım · bana yetki verilenler · diğerleri */}
        {walls.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p className="text-5xl mb-4" aria-hidden>🖥️</p>
            <p>Henüz ekran yok. Yukarıdan ilkini oluştur.</p>
          </div>
        ) : (
          <>
            {mine.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
                {/* Telefonda TEK sıra (dar kartta aksiyonlar eziliyordu); sm+ çoklu */}
                {mine.map((v) => wallCard(v, true))}
              </ul>
            )}

            {shared.length > 0 && (
              <div className={mine.length > 0 ? "mt-10" : ""}>
                <p className="eyebrow mb-3">
                  Sana yetki verilenler{" "}
                  <span className="normal-case tracking-normal font-normal text-muted">(düzenler ve yayınlarsın)</span>
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
                  {shared.map((v) => wallCard(v, false))}
                </ul>
              </div>
            )}

            {others.length > 0 && (
              <div className="mt-10">
                <p className="eyebrow mb-3">
                  Diğer ekranlar{" "}
                  <span className="normal-case tracking-normal font-normal text-muted">(yetkin yok — yalnız izleme)</span>
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
                  {others.map((v) => (
                    <li key={v.id} className="rounded-2xl bg-white/60 border border-line overflow-hidden flex flex-col">
                      <div className="relative opacity-60">
                        <WallThumb vw={v} />
                        <span className={`absolute top-1.5 right-1.5 rounded-full backdrop-blur px-2 py-0.5 text-[10px] font-bold tracking-wide ${beatLabel(v.id).cls}`}>
                          {beatLabel(v.id).text}
                        </span>
                      </div>
                      <div className="p-3 flex flex-col gap-2.5 flex-1">
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-sm truncate text-ink/60">{v.name}</p>
                          <p className="text-muted text-[11px] mt-0.5 truncate">Sahibi: {ownerLabel(v)}</p>
                        </div>
                        <div className="flex gap-1.5 items-center mt-auto">
                          <a href={playHref(v)} target={playTarget} className="flex-1 text-center rounded-lg bg-paper border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-muted">
                            ▶ İzle{playTarget ? " ↗" : ""}
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {confirmDel && (
        <ConfirmDialog
          title="Ekranı sil"
          message={`"${confirmDel.name}" ekranı ve yüklenmiş medyası silinecek. Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          danger
          onConfirm={() => {
            remove(confirmDel);
            setConfirmDel(null);
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </main>
  );
}
