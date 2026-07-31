"use client";

/**
 * FlowSign — ekran editörü. TASLAK üzerinde çalışır: yerleşim/içerik değişiklikleri
 * anında CANLI ekrana GİTMEZ — "Önizle" taslağı gösterir, "Kaydet & Yayınla"
 * yayına alır, "Yayındaki hâle dön" taslağı geri sarar. Taslak yazım hataları
 * görünür (banner) — sessiz kayıp yok. Config + LayoutEditor + ZonePanel + link.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/videowall/ConfirmDialog";
import LayoutEditor from "@/components/videowall/LayoutEditor";
import ZonePanel from "@/components/videowall/ZonePanel";
import QrCode from "@/components/present/QrCode";
import { Icon } from "@/components/videowall/icons";
import { useAuthUser } from "@/lib/hooks";
import {
  clampScreens,
  ensureSlug,
  publishVideowall,
  renameVideowall,
  resetGrid,
  slugify,
  splitZone,
  updateVideowall,
  updateZones,
  watchVideowall,
} from "@/lib/videowalls";
import { Videowall } from "@/lib/types";
import { withTimeout } from "@/lib/withTimeout";

const inputCls =
  "rounded-lg bg-white/10 border border-white/15 px-3 py-2 focus:outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30";

type Confirm = { title: string; message: string; confirmLabel?: string; danger?: boolean; run: () => void };

export default function VideowallEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guide, setGuide] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmBox, setConfirmBox] = useState<Confirm | null>(null);
  // Tek adım Geri Al: her yerleşim/içerik yazımından önceki taslak anlık görüntüsü.
  // Yanlış birleştirme/silme artık telafisiz değil ("Yayındaki hâle dön" nükleer kalır).
  const [undoZones, setUndoZones] = useState<Videowall["zones"] | null>(null);

  useEffect(() => watchVideowall(id, setVw), [id]);
  useEffect(() => setOrigin(window.location.origin), []);
  // Eski (slug'sız) ekrana isimden slug doldur → kolay link çalışsın (yalnız sahibi yazabilir).
  useEffect(() => {
    if (vw && !vw.slug && user && vw.ownerId === user.uid) ensureSlug(vw).catch(() => {});
  }, [vw, user]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const slug = vw ? vw.slug ?? slugify(vw.name) : "";
  const playUrl = origin ? `${origin}/flowsign/${slug}` : "";
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
      JSON.stringify({ z: s.zones ?? [], c: s.cols, r: s.rows, w: s.width, h: s.height });
    return pick(vw) !== pick(vw.live);
  }, [vw]);
  const [publishing, setPublishing] = useState(false);
  const publish = async () => {
    if (!vw || publishing) return;
    setPublishing(true);
    setSaveErr(null);
    try {
      // Çevrimdışıyken sonsuz "Yayınlanıyor…" yerine dürüst mesaj (yazım yerelde
      // kuyruğa girer, bağlantı gelince kendiliğinden yayına gider).
      await withTimeout(publishVideowall(vw));
      flashToast("✓ Yayınlandı — ekranlar birkaç saniye içinde güncellenir.");
    } catch {
      setSaveErr(
        "Yayın sunucuya ulaşmadı (bağlantı yok olabilir). Değişiklik cihazda kaydedildi — bağlantı gelince kendiliğinden yayınlanır; buton \"✓ Yayında\" olunca ekranlar güncellenmiştir."
      );
    } finally {
      setPublishing(false);
    }
  };
  // Tek geri-alma yolu: taslağı yayındaki temiz kopyaya geri sar (bkz. vw.live).
  const revertToLive = () => {
    if (!vw?.live) return;
    const live = vw.live;
    setConfirmBox({
      title: "Yayındaki hâle dön",
      message: "Taslaktaki tüm kaydedilmemiş değişiklikler silinir; ekranın şu an oynattığı yerleşim ve içerik geri gelir.",
      confirmLabel: "Geri dön",
      danger: true,
      run: () => {
        updateVideowall(id, { zones: live.zones, cols: live.cols, rows: live.rows, width: live.width, height: live.height })
          .then(() => flashToast("↩ Taslak, yayındaki hâle döndürüldü."))
          .catch(() => setSaveErr("Geri dönme başarısız — tekrar dene."));
        setSelectedId(null);
      },
    });
  };

  const lastPublished = vw?.live?.publishedAt
    ? vw.live.publishedAt.toDate().toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  if (vw === undefined || loading)
    return <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white/60 animate-pulse">Yükleniyor…</main>;
  if (vw === null) return <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white/60">Ekran bulunamadı.</main>;

  // Yetki: düzenleme yalnız sahibinde — başkası açarsa bilgi + izleme.
  if (user && vw.ownerId !== user.uid) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white px-4" style={{ colorScheme: "dark" }}>
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4" aria-hidden>🔒</p>
          <h1 className="font-display text-xl font-semibold mb-2">Bu ekranda düzenleme yetkin yok</h1>
          <p className="text-white/50 text-sm mb-6">
            &ldquo;{vw.name}&rdquo;{vw.ownerName ? ` ${vw.ownerName} kullanıcısına ait` : " başka bir kullanıcıya ait"}. Yayını izleyebilirsin.
          </p>
          <div className="flex gap-2 justify-center">
            <a href={`/flowsign/${slug}`} target="_blank" className="rounded-xl bg-accent hover:bg-accent-dark text-white px-5 py-2.5 text-sm font-semibold">▶ İzle ↗</a>
            <Link href="/videowall" className="rounded-xl bg-white/10 border border-white/15 px-5 py-2.5 text-sm font-semibold hover:bg-white/15">← Ekranlar</Link>
          </div>
        </div>
      </main>
    );
  }

  // Taslak yazımları: hata SESSİZ geçmez (kullanıcı "kaydoldu" sanıp kapatıyordu).
  // Her yazımdan önce anlık görüntü → tek adım Geri Al.
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
    <main className="min-h-screen bg-[#0d102f] text-white" style={{ colorScheme: "dark" }}>
      <header className="border-b border-white/10 px-4 sm:px-6 py-3 flex items-center flex-wrap gap-x-3 gap-y-2">
        <Link href="/videowall" className="text-white/50 hover:text-white shrink-0 text-lg" aria-label="Ekran listesine dön">←</Link>
        {/* Mobilde isim alta iner (basis-full) — aksiyonlar adı ezmez */}
        <input
          key={vw.name}
          defaultValue={vw.name}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== vw.name && renameVideowall(id, e.target.value).catch(() => setSaveErr("Ad kaydedilemedi — tekrar dene."))}
          className="order-last basis-full sm:order-none sm:basis-auto sm:flex-1 min-w-0 bg-transparent font-display font-semibold text-lg focus:outline-none border-b border-transparent focus:border-[#6366f1]"
          aria-label="Ekran adı"
        />
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button onClick={() => setGuide(true)} className="w-9 h-9 grid place-items-center rounded-xl bg-white/10 border border-white/15 text-white/70 hover:bg-white/15" title="Rehberi aç" aria-label="Rehberi aç">
            <Icon name="help" size={16} />
          </button>
          <a href={`/videowall/${id}/play?draft=1`} target="_blank" className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-sm font-semibold hover:bg-white/15 inline-flex items-center gap-1.5">
            <Icon name="eye" size={15} /> <span className="hidden sm:inline">Önizle</span> ↗
          </a>
          <button
            onClick={publish}
            disabled={!dirty || publishing}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#a5b4fc]/60 ${
              dirty ? "bg-accent hover:bg-accent-dark text-white disabled:opacity-60" : "bg-white/10 border border-white/15 text-white/70"
            }`}
          >
            <Icon name="save" size={15} />
            {publishing ? "Yayınlanıyor…" : dirty ? <span><span className="hidden sm:inline">Kaydet & </span>Yayınla</span> : "✓ Yayında"}
          </button>
        </div>
      </header>

      {/* Hata / kaydedilmemiş değişiklik şeritleri */}
      {saveErr && (
        <div className="bg-rose-400/15 border-b border-rose-400/30 px-4 sm:px-6 py-2.5 text-sm text-rose-300 font-semibold flex items-center justify-between gap-3">
          <span>⚠ {saveErr}</span>
          <button onClick={() => setSaveErr(null)} className="text-rose-300/70 hover:text-rose-300 shrink-0" aria-label="Kapat"><Icon name="close" size={14} /></button>
        </div>
      )}
      {dirty && !saveErr && (
        <div className="bg-[#6366f1]/10 border-b border-[#6366f1]/20 px-4 sm:px-6 py-2 text-xs text-[#a5b4fc] flex items-center flex-wrap gap-x-3 gap-y-1">
          <span>● Taslakta yayınlanmamış değişiklik var — canlı ekran son yayınlanan hâli oynatıyor. <b>Kaydet & Yayınla</b> ile gönder.</span>
          {vw.live && (
            <button onClick={revertToLive} className="inline-flex items-center gap-1 font-semibold underline decoration-[#a5b4fc]/40 hover:decoration-[#a5b4fc]">
              <Icon name="undo" size={12} /> Yayındaki hâle dön
            </button>
          )}
        </div>
      )}
      {/* Pozitif onay: "oldu mu olmadı mı" belirsizliği kalmasın */}
      {!dirty && !saveErr && vw.live && (
        <div className="bg-emerald-400/10 border-b border-emerald-400/20 px-4 sm:px-6 py-2 text-xs text-emerald-300">
          ✓ Yayında — canlı ekran taslağınla birebir aynı{lastPublished ? ` · son yayın: ${lastPublished}` : ""}.
        </div>
      )}

      {/* Yayın sonrası onay balonu */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] rounded-xl bg-[#1e1b4b] border border-[#6366f1]/40 text-white px-5 py-3 text-sm font-semibold shadow-lg animate-pop">
          {toast}
        </div>
      )}

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Rehber (ilk açılışta otomatik; ❓ ile her zaman) */}
        {guide && (
          <div className="rounded-2xl bg-[#6366f1]/10 border border-[#6366f1]/30 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-display font-semibold text-[#a5b4fc]">👋 FlowSign — 5 adımda ekranın hazır</p>
              <button onClick={dismissGuide} className="text-white/50 hover:text-white text-sm shrink-0">Anladım ✕</button>
            </div>
            <ol className="text-sm text-white/75 space-y-1.5 list-decimal list-inside">
              <li><b>Yerleşim:</b> hücrelere sürükle → alanları birleştir, tıkla → seç, gerekirse böl.</li>
              <li><b>İçerik:</b> seçili alana görsel/video/URL/metin/saat ekle (dosyayı sürükleyip de bırakabilirsin).</li>
              <li><b>Önizle:</b> 👁 ile taslağı gör — canlı ekran bozulmaz, değişiklikler yayına gitmez.</li>
              <li><b>Kaydet & Yayınla:</b> hazır olunca bas → aşağıdaki link/QR bu hâli oynatır. Ekran uyumaz.</li>
              <li><b>Çoklu ekran:</b> tabela PC&apos;sinde TV&apos;leri tek birleşik görüntü yap (ekran kartında &ldquo;Surround/Eyefinity&rdquo; ya da video-wall denetleyici). Tarayıcı tek pencerede tüm duvarı kaplar; <b>⊞ Ekranları tanı</b> ile sırayı doğrula.</li>
            </ol>
          </div>
        )}

        {/* Yayın linki + QR */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col sm:flex-row items-start gap-5">
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.14em] mb-2">Yayın linki</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm bg-black/30 rounded-lg px-3 py-2 text-[#a5b4fc] break-all min-w-0">{playUrl}</code>
              <button onClick={copyLink} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/15">{copied ? "✓ Kopyalandı" : "Kopyala"}</button>
              <a href={playUrl} target="_blank" className="rounded-xl bg-accent hover:bg-accent-dark text-white px-3 py-2 text-sm font-semibold">Aç ↗</a>
            </div>
            <p className="text-white/50 text-xs mt-2 leading-relaxed">
              Linki tabela PC&apos;sinde Chrome ile aç, tam ekran yap — her zaman <b>son yayınlanan</b> hâli oynatır ve adı değiştirsen de <b>sabit kalır</b>.
              {lastPublished && <span className="text-white/60"> · Son yayın: {lastPublished}</span>}
              <br />
              Birden çok TV&apos;yi tek duvar yapacaksan: ekran kartında TV&apos;leri <b>tek birleşik görüntü</b> olarak ayarla (Surround/Eyefinity ya da video-wall denetleyici); yayında ⊞ ile sırayı kontrol et.
            </p>
          </div>
          {playUrl && (
            <div className="shrink-0 bg-white rounded-xl p-2">
              <QrCode text={playUrl} size={104} />
            </div>
          )}
        </div>

        {/* Config */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.14em] mb-3">Duvar tanımı</p>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            {/* Çözünürlük artık düzenlenebilir (oluşturmadaki yazım hatası duvarı silmeden düzeltilir) */}
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Genişlik (px)</span>
              <input key={`w${vw.width}`} type="number" min={1} defaultValue={vw.width} onBlur={(e) => { const nw = Math.max(1, Math.round(Number(e.target.value) || 0)); if (nw && nw !== vw.width) updateVideowall(id, { width: nw }).catch(() => setSaveErr("Çözünürlük kaydedilemedi — tekrar dene.")); else e.target.value = String(vw.width); }} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Yükseklik (px)</span>
              <input key={`h${vw.height}`} type="number" min={1} defaultValue={vw.height} onBlur={(e) => { const nh = Math.max(1, Math.round(Number(e.target.value) || 0)); if (nh && nh !== vw.height) updateVideowall(id, { height: nh }).catch(() => setSaveErr("Çözünürlük kaydedilemedi — tekrar dene.")); else e.target.value = String(vw.height); }} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Yan yana kaç ekran?</span>
              <input key={`c${vw.cols}`} type="number" min={1} max={24} defaultValue={vw.cols} onBlur={(e) => { const c = clampScreens(Number(e.target.value)); if (c !== vw.cols) changeGrid(c, vw.rows); e.target.value = String(vw.cols); }} className={`w-24 ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 text-xs">Üst üste kaç ekran?</span>
              <input key={`r${vw.rows}`} type="number" min={1} max={24} defaultValue={vw.rows} onBlur={(e) => { const rr = clampScreens(Number(e.target.value)); if (rr !== vw.rows) changeGrid(vw.cols, rr); e.target.value = String(vw.rows); }} className={`w-24 ${inputCls}`} />
            </label>
            <span className="text-white/50 text-xs pb-2 tabular-nums">{vw.cols * vw.rows} fiziksel ekran · {vw.zones?.length ?? 0} alan</span>
          </div>
        </div>

        {/* Yerleşim editörü */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.14em]">Yerleşim</p>
            {undoZones && (
              <button
                onClick={undoLayout}
                className="rounded-lg bg-white/10 border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/15 inline-flex items-center gap-1"
              >
                <Icon name="undo" size={12} /> Son değişikliği geri al
              </button>
            )}
          </div>
          <LayoutEditor vw={vw} selectedId={selectedId} onSelect={setSelectedId} onZones={saveZones} onConfirm={setConfirmBox} />
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
              const doSplit = () => {
                saveZones(splitZone(vw.zones ?? [], vw.cols, vw.rows, selected.id));
                setSelectedId(null);
              };
              if (selected.items.length > 0) {
                setConfirmBox({
                  title: "Alanı böl",
                  message: `"${selected.name || `Alan ${selectedIndex + 1}`}" hücrelere bölünecek; içeriği sol-üst hücrede kalır (kaybolmaz).`,
                  confirmLabel: "Böl",
                  run: doSplit,
                });
              } else doSplit();
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
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
