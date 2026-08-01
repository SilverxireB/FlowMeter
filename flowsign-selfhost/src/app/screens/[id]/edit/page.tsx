"use client";

/**
 * FlowSign — ekran editörü (self-host). TASLAK üzerinde çalışır: yerleşim/içerik
 * değişiklikleri anında CANLI ekrana GİTMEZ — "Önizle" taslağı gösterir,
 * "Kaydet & Yayınla" yayına alır, "Yayındaki hâle dön" taslağı geri sarar.
 * Taslak yazım hataları görünür (banner) — sessiz kayıp yok.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import LayoutEditor from "@/components/LayoutEditor";
import QrCode from "@/components/QrCode";
import ScreensCard from "@/components/ScreensCard";
import ZonePanel from "@/components/ZonePanel";
import { Icon } from "@/components/icons";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { useSession } from "@/lib/useSession";
import {
  canEditWall,
  publishWall,
  renameWall,
  resetGrid,
  saveLayout,
  setScreenGrid,
  setPlayMode,
  updateWall,
  updateZones,
  watchWall,
  withTimeout,
} from "@/lib/client";
import { clampScreens, hasCustomLayout, layoutColsOf, layoutRowsOf, slugify, splitZoneInto } from "@/lib/zones";
import { Videowall } from "@/lib/types";

const inputCls =
  "input-base !py-2 !px-3 !rounded-lg";

// Sıra-bağımsız derin karşılaştırma — içerik AYNIYKEN "yayınlanmamış değişiklik
// var" uyarısı kalıcı görünmesin.
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) o[k] = sortDeep((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}
const stable = (v: unknown) => JSON.stringify(sortDeep(v));

type Confirm = { title: string; message: string; confirmLabel?: string; danger?: boolean; run: () => void };

export default function ScreenEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { loading, authed, me } = useSession();
  const playTarget = usePlayTarget();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guide, setGuide] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmBox, setConfirmBox] = useState<Confirm | null>(null);
  // Tek adım Geri Al: her yerleşim/içerik yazımından önceki taslak anlık görüntüsü.
  const [undoZones, setUndoZones] = useState<Videowall["zones"] | null>(null);

  useEffect(() => watchWall(id, setVw), [id]);
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!loading && !authed) router.replace("/login");
  }, [loading, authed, router]);

  const slug = vw ? vw.slug ?? slugify(vw.name) : "";
  const playUrl = origin ? `${origin}/play/${slug}` : "";
  // İlk kullanım rehberi (bir kez otomatik; ❓ Rehber ile her zaman geri açılır).
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
  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const selected = useMemo(() => (vw?.zones ?? []).find((z) => z.id === selectedId) ?? null, [vw, selectedId]);
  const selectedIndex = useMemo(() => (vw?.zones ?? []).findIndex((z) => z.id === selectedId), [vw, selectedId]);

  // Taslak ≠ yayın mı? (kaydedilmemiş değişiklik göstergesi)
  const dirty = useMemo(() => {
    if (!vw) return false;
    if (!vw.live) return true; // eski ekran: hiç yayınlanmamış
    const pick = (s: { zones?: Videowall["zones"]; cols: number; rows: number; width: number; height: number }) =>
      stable({ z: s.zones ?? [], c: s.cols, r: s.rows, w: s.width, h: s.height });
    return pick(vw) !== pick(vw.live);
  }, [vw]);
  const [publishing, setPublishing] = useState(false);
  const publish = async () => {
    if (!vw || publishing) return;
    setPublishing(true);
    setSaveErr(null);
    try {
      await withTimeout(publishWall(vw.id));
      flashToast("✓ Yayınlandı — ekranlar birkaç saniye içinde güncellenir.");
    } catch {
      setSaveErr("Yayın sunucuya ulaşmadı (bağlantı yok olabilir). Bağlantı gelince tekrar dene; buton \"✓ Yayında\" olunca ekranlar güncellenmiştir.");
    } finally {
      setPublishing(false);
    }
  };
  // Tek geri-alma yolu: taslağı yayındaki temiz kopyaya geri sar.
  const revertToLive = () => {
    if (!vw?.live) return;
    const live = vw.live;
    setConfirmBox({
      title: "Yayındaki hâle dön",
      message: "Taslaktaki tüm kaydedilmemiş değişiklikler silinir; ekranın şu an oynattığı yerleşim ve içerik geri gelir.",
      confirmLabel: "Geri dön",
      danger: true,
      run: () => {
        updateWall(id, { zones: live.zones, cols: live.cols, rows: live.rows, width: live.width, height: live.height })
          .then(() => flashToast("↩ Taslak, yayındaki hâle döndürüldü."))
          .catch(() => setSaveErr("Geri dönme başarısız — tekrar dene."));
        setSelectedId(null);
      },
    });
  };

  const lastPublished = vw?.live?.publishedAt
    ? new Date(vw.live.publishedAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  if (vw === undefined || loading)
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  if (vw === null) return <main className="min-h-screen grid place-items-center bg-wash text-muted">Ekran bulunamadı.</main>;

  // Yetki: SAHİP ya da YETKİLİ düzenler (yönetici hepsinde sahiptir). Başkası
  // açarsa bilgi + izleme — sunucu zaten yazmayı reddeder, burada da yolu kapat
  // ki kullanıcı boşuna düzenleyip "kaydedilemedi" duvarına toslamasın.
  if (!canEditWall(vw, me)) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash px-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4" aria-hidden>🔒</p>
          <h1 className="font-display text-xl font-semibold mb-2">Bu ekranda düzenleme yetkin yok</h1>
          <p className="text-muted text-sm mb-6">
            &ldquo;{vw.name}&rdquo; başka bir kullanıcıya ait. Yayını izleyebilirsin; düzenlemek için sahibinden yetki iste.
          </p>
          <div className="flex gap-2 justify-center">
            <a href={`/play/${vw.slug ?? vw.id}`} target={playTarget} className="btn-primary !py-2.5 text-sm">
              ▶ İzle{playTarget ? " ↗" : ""}
            </a>
            <Link href="/screens" className="btn-ghost !py-2.5 text-sm">← Ekranlar</Link>
          </div>
        </div>
      </main>
    );
  }

  // Taslak yazımları: hata SESSİZ geçmez. Her yazımdan önce anlık görüntü → tek adım Geri Al.
  const saveZones = (zones: Videowall["zones"]) => {
    setUndoZones(vw.zones ?? []);
    setSaveErr(null);
    updateZones(id, zones).catch(() => setSaveErr("Değişiklik kaydedilemedi — bağlantını kontrol edip tekrar dene."));
  };
  const undoLayout = () => {
    if (!undoZones) return;
    updateZones(id, undoZones).catch(() => setSaveErr("Geri alınamadı — tekrar dene."));
    setUndoZones(null);
    setSelectedId(null);
  };

  /** FİZİKSEL ekran sayısı: yerleşim elle ayarlıysa yerleşime DOKUNMA. */
  const changeScreens = (cols: number, rows: number) => {
    if (hasCustomLayout(vw)) {
      setScreenGrid(id, cols, rows).catch(() => setSaveErr("Ekran sayısı kaydedilemedi — tekrar dene."));
      return;
    }
    changeGrid(cols, rows);
  };

  const changeGrid = (cols: number, rows: number) => {
    setConfirmBox({
      title: "Izgarayı değiştir",
      message:
        "Taslak yerleşim taze ızgaraya sıfırlanır; alanlardaki TÜM içerik kaybolmaz — hepsi ilk alana taşınır, oradan dağıtırsın. (Yayın etkilenmez.) Devam?",
      confirmLabel: "Izgarayı değiştir",
      run: () => {
        setUndoZones(null); // ızgara değişince eski anlık görüntü geçersiz (boyutlar farklı)
        resetGrid(id, cols, rows, vw.zones ?? []).catch(() => setSaveErr("Izgara değişikliği kaydedilemedi — tekrar dene."));
        setSelectedId(null);
      },
    });
  };

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center flex-wrap gap-x-3 gap-y-2">
        <Link href="/screens" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Ekran listesine dön">←</Link>
        {/* Mobilde isim alta iner (basis-full) — aksiyonlar adı ezmez */}
        <input
          key={vw.name}
          defaultValue={vw.name}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== vw.name && renameWall(id, e.target.value).catch(() => setSaveErr("Ad kaydedilemedi — tekrar dene."))}
          className="order-last basis-full sm:order-none sm:basis-auto sm:flex-1 min-w-0 bg-transparent font-display font-semibold text-lg focus:outline-none border-b border-transparent focus:border-accent"
          aria-label="Ekran adı"
        />
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button onClick={() => setGuide(true)} className="w-9 h-9 grid place-items-center rounded-xl bg-white border border-line text-muted hover:text-ink hover:border-muted" title="Rehberi aç" aria-label="Rehberi aç">
            <Icon name="help" size={16} />
          </button>
          <a href={`/play/${id}?draft=1`} target={playTarget} className="rounded-xl bg-white border border-line px-3.5 py-2 text-sm font-semibold hover:border-muted inline-flex items-center gap-1.5">
            <Icon name="eye" size={15} /> <span className="hidden sm:inline">Önizle</span>{playTarget ? " ↗" : ""}
          </a>
          <button
            onClick={publish}
            disabled={!dirty || publishing}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5 focus-visible:ring-4 focus-visible:ring-accent-soft ${
              dirty ? "bg-accent hover:bg-accent-dark text-white disabled:opacity-60" : "bg-white border border-line text-muted"
            }`}
          >
            <Icon name="save" size={15} />
            {publishing ? "Yayınlanıyor…" : dirty ? <span><span className="hidden sm:inline">Kaydet & </span>Yayınla</span> : "✓ Yayında"}
          </button>
        </div>
      </header>

      {/* Hata / kaydedilmemiş değişiklik şeritleri */}
      {saveErr && (
        <div className="bg-brand-soft border-b border-brand/20 px-4 sm:px-6 py-2.5 text-sm text-brand font-semibold flex items-center justify-between gap-3">
          <span>⚠ {saveErr}</span>
          <button onClick={() => setSaveErr(null)} className="text-brand/70 hover:text-brand shrink-0" aria-label="Kapat"><Icon name="close" size={14} /></button>
        </div>
      )}
      {dirty && !saveErr && (
        <div className="bg-accent-soft border-b border-accent/20 px-4 sm:px-6 py-2 text-xs text-accent-dark flex items-center flex-wrap gap-x-3 gap-y-1">
          <span>● Taslakta yayınlanmamış değişiklik var — canlı ekran son yayınlanan hâli oynatıyor. <b>Kaydet & Yayınla</b> ile gönder.</span>
          {vw.live && (
            <button onClick={revertToLive} className="inline-flex items-center gap-1 font-semibold underline decoration-accent/40 hover:decoration-accent">
              <Icon name="undo" size={12} /> Yayındaki hâle dön
            </button>
          )}
        </div>
      )}
      {/* Pozitif onay: "oldu mu olmadı mı" belirsizliği kalmasın */}
      {!dirty && !saveErr && vw.live && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-2 text-xs text-emerald-700">
          ✓ Yayında — canlı ekran taslağınla birebir aynı{lastPublished ? ` · son yayın: ${lastPublished}` : ""}.
        </div>
      )}

      {/* Yayın sonrası onay balonu */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] rounded-xl bg-ink border border-ink text-white px-5 py-3 text-sm font-semibold shadow-lg animate-pop">
          {toast}
        </div>
      )}

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Rehber (ilk açılışta otomatik; ❓ ile her zaman) */}
        {guide && (
          <div className="rounded-2xl bg-accent-soft border border-accent/25 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-display font-semibold text-accent-dark">👋 FlowSign — 5 adımda ekranın hazır</p>
              <button onClick={dismissGuide} className="text-muted hover:text-ink text-sm shrink-0">Anladım ✕</button>
            </div>
            <ol className="text-sm text-ink/75 space-y-1 list-decimal list-inside">
              <li><b>Yerleşim:</b> alana tıkla → seç; sürükle → birleştir; panelden böl.</li>
              <li><b>İçerik:</b> seçili alana görsel/video/URL/metin/saat ekle.</li>
              <li><b>Önizle:</b> 👁 taslağı gösterir, canlı ekran bozulmaz.</li>
              <li><b>Kaydet &amp; Yayınla:</b> aşağıdaki link bu hâli oynatır.</li>
              <li><b>Çoklu TV:</b> ekran kartında tek birleşik görüntü yap (Surround/Eyefinity); yayında ⊞ ile sırayı doğrula.</li>
            </ol>
          </div>
        )}

        {/* Config */}
        <div className="card p-5">
          <p className="eyebrow mb-3">Duvar tanımı</p>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            {/* Çözünürlük düzenlenebilir (oluşturmadaki yazım hatası duvarı silmeden düzeltilir) */}
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Genişlik (px)</span>
              <input key={`w${vw.width}`} type="number" min={1} defaultValue={vw.width} onBlur={(e) => { const nw = Math.max(1, Math.round(Number(e.target.value) || 0)); if (nw && nw !== vw.width) updateWall(id, { width: nw }).catch(() => setSaveErr("Çözünürlük kaydedilemedi — tekrar dene.")); else e.target.value = String(vw.width); }} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Yükseklik (px)</span>
              <input key={`h${vw.height}`} type="number" min={1} defaultValue={vw.height} onBlur={(e) => { const nh = Math.max(1, Math.round(Number(e.target.value) || 0)); if (nh && nh !== vw.height) updateWall(id, { height: nh }).catch(() => setSaveErr("Çözünürlük kaydedilemedi — tekrar dene.")); else e.target.value = String(vw.height); }} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Yan yana kaç ekran?</span>
              <input key={`c${vw.cols}`} type="number" min={1} max={24} defaultValue={vw.cols} onBlur={(e) => { const c = clampScreens(Number(e.target.value)); if (c !== vw.cols) changeScreens(c, vw.rows); e.target.value = String(vw.cols); }} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Üst üste kaç ekran?</span>
              <input key={`r${vw.rows}`} type="number" min={1} max={24} defaultValue={vw.rows} onBlur={(e) => { const rr = clampScreens(Number(e.target.value)); if (rr !== vw.rows) changeScreens(vw.cols, rr); e.target.value = String(vw.rows); }} className={`w-24 ${inputCls}`} />
            </label>
            <span className="text-muted text-xs pb-2 tabular-nums">{vw.cols * vw.rows} fiziksel ekran · {vw.zones?.length ?? 0} alan</span>
          </div>
        </div>

        {/* Yerleşim editörü */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="eyebrow">Yerleşim</p>
            {undoZones && (
              <button
                onClick={undoLayout}
                className="rounded-lg bg-white border border-line px-2.5 py-1 text-xs font-semibold text-ink/80 hover:border-muted inline-flex items-center gap-1"
              >
                <Icon name="undo" size={12} /> Son değişikliği geri al
              </button>
            )}
          </div>
          <LayoutEditor vw={vw} selectedId={selectedId} onSelect={setSelectedId} onZones={saveZones} onConfirm={setConfirmBox} />

          {/* Oynatma modu — YERLEŞİMİN ALTINDA (kullanıcı isteği): içeriğin nasıl
              aktığı yerleşimle birlikte düşünülür, duvar tanımıyla değil.
              Tabela (otomatik) / sunum (kumanda); yayından BAĞIMSIZ — seçim
              perdeye ANINDA gider (Kaydet & Yayınla gerekmez). */}
          <div className="mt-4 pt-4 border-t border-line">
            <span className="text-muted text-xs block mb-2">Oynatma modu</span>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {([
                { v: "auto", label: "🔁 Tabela — otomatik akış" },
                { v: "manual", label: "🎮 Sunum — kumanda ile" },
              ] as const).map((m) => {
                const active = (vw.playMode ?? "auto") === m.v;
                return (
                  <button
                    key={m.v}
                    onClick={() => !active && setPlayMode(id, m.v).catch(() => setSaveErr("Mod kaydedilemedi — tekrar dene."))}
                    className={`px-3.5 py-2 rounded-xl font-semibold border ${active ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-muted text-xs mt-2">
              {(vw.playMode ?? "auto") === "manual"
                ? "Kumandayla ilerler (→ ← boşluk); süre/otomatik geçiş çalışmaz."
                : "İçerik süre ve takvime göre kendiliğinden döner."}
            </p>
          </div>
        </div>

        {/* İçerik paneli (seçili alan) */}
        {selected && selectedIndex >= 0 && (
          <ZonePanel
            key={selected.id} /* alan değişince panel remount → input'lar taze */
            vw={vw}
            zone={selected}
            index={selectedIndex}
            onZones={saveZones}
            onSplit={(parts, axis) => {
              const doSplit = () => {
                const next = splitZoneInto(vw.zones ?? [], layoutColsOf(vw), layoutRowsOf(vw), selected.id, parts, axis);
                if (!next) {
                  setSaveErr("Bu alan daha fazla bölünemez — önce birkaç parçayı birleştir.");
                  return;
                }
                setUndoZones(vw.zones ?? []);
                setSaveErr(null);
                saveLayout(id, next).catch(() => setSaveErr("Bölme kaydedilemedi — tekrar dene."));
                setSelectedId(null);
              };
              if (selected.items.length > 0) {
                setConfirmBox({
                  title: "Alanı böl",
                  message: `"${selected.name || `Alan ${selectedIndex + 1}`}" ${parts} parçaya bölünecek; içeriği İLK parçada kalır (kaybolmaz).`,
                  confirmLabel: "Böl",
                  run: doSplit,
                });
              } else doSplit();
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
        {/* Yayın linki + QR + ekran sağlığı EN ALTTA: önce tasarla (tanım →
            yerleşim → içerik), sonra yayınla/izle. */}
        <div className="card p-5 flex flex-col sm:flex-row items-start gap-5">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-2">Yayın linki</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm bg-paper border border-line rounded-lg px-3 py-2 text-accent-dark break-all min-w-0">{playUrl}</code>
              <button onClick={copyLink} className="rounded-xl bg-white border border-line px-3 py-2 text-sm font-semibold hover:border-muted">{copied ? "✓ Kopyalandı" : "Kopyala"}</button>
              <a href={playUrl} target={playTarget} className="rounded-xl bg-accent hover:bg-accent-dark text-white px-3 py-2 text-sm font-semibold">Aç{playTarget ? " ↗" : ""}</a>
            </div>
            <p className="text-muted text-xs mt-2">
              Tabela PC&apos;sinde Chrome ile aç, tam ekran yap. Eski linkler çalışmaya devam eder.
              {lastPublished && <span className="text-ink/70"> · Son yayın: {lastPublished}</span>}
            </p>
          </div>
          {playUrl && (
            <div className="shrink-0 bg-white border border-line rounded-xl p-2">
              <QrCode text={playUrl} size={104} />
            </div>
          )}
        </div>

        {/* Ekran sağlığı: bu yayını açık tutan cihazlar (heartbeat) */}
        <ScreensCard id={id} />

      </section>

      {confirmBox && (
        <ConfirmDialog
          title={confirmBox.title}
          message={confirmBox.message}
          confirmLabel={confirmBox.confirmLabel}
          danger={confirmBox.danger}
          onConfirm={() => {
            confirmBox.run();
            setConfirmBox(null);
          }}
          onCancel={() => setConfirmBox(null)}
        />
      )}
    </main>
  );
}
