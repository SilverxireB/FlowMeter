"use client";

/**
 * FlowSign içerik paneli — self-host kopyası. Seçili alana içerik ata:
 * görsel/video (sunucu diskine yüklenir, sürükle-bırak da çalışır), URL
 * (inline form, http(s) doğrulamalı — iç ağ adresleri serbest), METİN, SAAT +
 * medya kütüphanesinden tekrar kullan. Öğe başına süre + saat aralığı + günler;
 * "takvim dışı" rozeti; ⇄ Değiştir; sürükle VE ▲▼ ile sıralama (dokunmatik).
 * İçerik alana STRETCH edilir. Yazım → updateZones (taslak).
 */
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { uploadMedia } from "@/lib/media";
import { itemInWindow } from "@/lib/zones";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

const iid = () => `it-${Math.random().toString(36).slice(2, 9)}`;
const KIND_LABEL = { image: "Görsel", video: "Video", url: "URL", text: "Metin", clock: "Saat" } as const;
const DAYS = [
  { v: 1, l: "Pzt" }, { v: 2, l: "Sal" }, { v: 3, l: "Çar" }, { v: 4, l: "Per" },
  { v: 5, l: "Cum" }, { v: 6, l: "Cmt" }, { v: 0, l: "Paz" },
];
// Yerel disk sınırları (sunucu da aynı sınırı uygular) — aşan dosya yüklemeden
// ÖNCE insanca reddedilir.
const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 500;

const inputCls = "input-base !rounded-lg";

function ItemThumb({ item }: { item: ZoneItem }) {
  const base = "w-14 h-14 rounded-lg overflow-hidden shrink-0 grid place-items-center";
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.src} alt="" className={`${base} object-cover`} />;
  if (item.kind === "video" && item.src) return <div className={`${base} bg-ink/80 text-xl`}>🎬</div>;
  if (item.kind === "text")
    return <div className={`${base} font-bold text-sm`} style={{ background: item.bg ?? "#312e81", color: item.color ?? "#fff" }}>Aa</div>;
  if (item.kind === "clock")
    return <div className={`${base} text-xl`} style={{ background: item.bg ?? "#0d102f", color: item.color ?? "#fff" }}>🕐</div>;
  return <div className={`${base} bg-paper border border-line text-xl`}>🔗</div>;
}

export default function ZonePanel({
  vw,
  zone,
  index,
  onZones,
  onSplit,
  onClose,
}: {
  vw: Videowall;
  zone: Zone;
  index: number;
  onZones: (zones: Zone[]) => void;
  onSplit: () => void;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libFilter, setLibFilter] = useState<"all" | "image" | "video">("all");
  const [urlForm, setUrlForm] = useState<{ src: string; name: string } | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  // Sadeleştirme: süre/takvim/gün ayarları öğe başına AÇILIR (⚙) — panel
  // varsayılanda kompakt liste gösterir.
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const now = new Date();

  // Uzun yükleme sırasında kullanıcı sıralama/silme yapabilir → bitişte GÜNCEL
  // listeye ekle (bayat closure ile eski listeyi ezme).
  const zoneRef = useRef(zone);
  zoneRef.current = zone;

  const patch = (p: Partial<Zone>) => onZones((vw.zones ?? []).map((z) => (z.id === zone.id ? { ...z, ...p } : z)));
  const setItems = (items: ZoneItem[]) => patch({ items });

  // Kütüphane: TASLAK + YAYIN medyası (ızgara sıfırlansa da yüklenenler kaybolmaz).
  const library = useMemo(() => {
    const seen = new Set<string>();
    const out: ZoneItem[] = [];
    const pools = [...(vw.zones ?? []), ...(vw.live?.zones ?? [])];
    for (const z of pools)
      for (const it of z.items ?? [])
        if ((it.kind === "image" || it.kind === "video") && it.src && !seen.has(it.src)) {
          seen.add(it.src);
          out.push(it);
        }
    return out;
  }, [vw.zones, vw.live?.zones]);

  /** Boyut/tür ön-kontrolü: geçenler + insanca ret nedenleri. */
  function precheck(files: File[]): { ok: File[]; rejected: string[] } {
    const ok: File[] = [];
    const rejected: string[] = [];
    for (const f of files) {
      const mb = f.size / (1024 * 1024);
      if (f.type.startsWith("image/")) {
        if (mb > MAX_IMAGE_MB) rejected.push(`${f.name} (görsel için sınır ~${MAX_IMAGE_MB} MB)`);
        else ok.push(f);
      } else if (f.type.startsWith("video/")) {
        if (mb > MAX_VIDEO_MB) rejected.push(`${f.name} (video için sınır ~${MAX_VIDEO_MB} MB)`);
        else ok.push(f);
      } else rejected.push(`${f.name} (desteklenmeyen tür)`);
    }
    return { ok, rejected };
  }

  async function uploadFiles(files: File[]) {
    setErr(null);
    const { ok, rejected } = precheck(files);
    const failed: string[] = [...rejected];
    const added: ZoneItem[] = [];
    for (let i = 0; i < ok.length; i++) {
      try {
        setQueue({ done: i, total: ok.length, pct: 0 });
        const res = await uploadMedia(ok[i], vw.id, (pct) => setQueue({ done: i, total: ok.length, pct }));
        added.push({ id: iid(), kind: res.type, src: res.url, name: ok[i].name.replace(/\.[^.]+$/, ""), durationSec: res.type === "image" ? 8 : undefined });
      } catch (e) {
        failed.push(`${ok[i].name} (${e instanceof Error ? e.message : "yükleme hatası"})`);
      }
    }
    setQueue(null);
    if (added.length) setItems([...zoneRef.current.items, ...added]);
    if (failed.length)
      setErr(`${added.length}/${added.length + failed.length} dosya yüklendi. Yüklenemeyenler: ${failed.join(" · ")}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  /** ⇄ Değiştir: yeni dosya AYNI öğenin yerine geçer — sıra/takvim/süre korunur. */
  async function replaceFile(itemId: string, file: File) {
    setErr(null);
    const { ok, rejected } = precheck([file]);
    if (!ok.length) {
      setErr(`Değiştirilemedi: ${rejected[0]}`);
      return;
    }
    try {
      setQueue({ done: 0, total: 1, pct: 0 });
      const res = await uploadMedia(ok[0], vw.id, (pct) => setQueue({ done: 0, total: 1, pct }));
      setItems(
        zoneRef.current.items.map((it) =>
          it.id === itemId
            ? { ...it, kind: res.type, src: res.url, name: ok[0].name.replace(/\.[^.]+$/, ""), durationSec: res.type === "video" ? it.durationSec : it.durationSec ?? 8 }
            : it
        )
      );
    } catch (e) {
      setErr(`Değiştirilemedi: ${e instanceof Error ? e.message : "yükleme hatası"}`);
    } finally {
      setQueue(null);
      setReplacingId(null);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  // Gömülebilirlik kontrolü: site iframe'i reddediyorsa kullanıcıyı EKLERKEN uyar.
  async function warnIfNotEmbeddable(src: string) {
    try {
      const r = await fetch(`/api/embed-check?url=${encodeURIComponent(src)}`);
      const d = (await r.json()) as { verdict: string; host?: string };
      if (d.verdict === "blocked") {
        setErr(`⚠ ${d.host ?? "Bu site"} başka sayfaya gömülmeye izin vermiyor — tabelada boş görünür. (Google/YouTube gibi büyük siteler bunu yasaklar; pano/dashboard siteleri genelde izin verir.)`);
      }
    } catch {}
  }

  function submitUrl() {
    if (!urlForm) return;
    const src = urlForm.src.trim();
    // Güvenlik: yalnız http(s) — javascript:/data: perde iframe'inde script çalıştırır.
    if (!/^https?:\/\//i.test(src)) {
      setErr("URL http:// veya https:// ile başlamalı.");
      return;
    }
    setErr(null);
    setItems([...zone.items, { id: iid(), kind: "url", src, name: urlForm.name.trim() || "Sayfa", durationSec: 15 }]);
    setUrlForm(null);
    void warnIfNotEmbeddable(src);
  }

  const addText = () => setItems([...zone.items, { id: iid(), kind: "text", title: "Başlık", text: "", bg: "#312e81", color: "#ffffff", durationSec: 10 }]);
  const addClock = () => setItems([...zone.items, { id: iid(), kind: "clock", bg: "#0d102f", color: "#ffffff", durationSec: 10 }]);
  const addFromLib = (src: ZoneItem) => {
    // Yalnız dosyanın kendisi kopyalanır — eski öğenin takvimi/süresi GİZLİCE taşınmaz.
    setItems([
      ...zone.items,
      { id: iid(), kind: src.kind, src: src.src, name: src.name, durationSec: src.kind === "image" ? 8 : undefined },
    ]);
    setLibOpen(false);
  };

  const patchItem = (id: string, p: Partial<ZoneItem>) => setItems(zone.items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const removeItem = (id: string) => setItems(zone.items.filter((it) => it.id !== id));
  const toggleDay = (it: ZoneItem, d: number) => {
    const cur = it.days ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    patchItem(it.id, { days: next.length ? next : undefined });
  };
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= zone.items.length) return;
    const arr = [...zone.items];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setItems(arr);
  };

  const cells = Math.round(zone.w * vw.cols) * Math.round(zone.h * vw.rows);
  const transition = zone.transition ?? "fade";
  const allOutOfWindow = zone.items.length > 0 && zone.items.every((it) => !itemInWindow(it, now));

  const ADD_BTNS: { label: string; icon: string; fn: () => void; disabled?: boolean; title?: string }[] = [
    { label: "Görsel / Video", icon: "🖼", fn: () => fileRef.current?.click(), disabled: queue !== null },
    { label: "Kütüphane", icon: "🗂", fn: () => setLibOpen(true), disabled: library.length === 0 },
    { label: "URL", icon: "🔗", fn: () => setUrlForm({ src: "", name: "" }) },
    { label: "Metin", icon: "📝", fn: addText },
    { label: "Saat", icon: "🕐", fn: addClock },
  ];

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setFileOver(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          setFileOver(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }
      }}
      className={`relative rounded-2xl border p-5 transition-colors ${fileOver ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
    >
      {fileOver && (
        <div className="absolute inset-0 z-40 rounded-2xl border-2 border-dashed border-accent bg-white/80 grid place-items-center pointer-events-none">
          <p className="text-accent-dark font-semibold">Bırak → bu alana yükle</p>
        </div>
      )}

      {/* Başlık: alan adı + böl + kapat */}
      <div className="flex items-center gap-2 mb-4">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-accent-soft text-accent-dark grid place-items-center text-sm font-bold">{index + 1}</span>
        <input
          defaultValue={zone.name ?? ""}
          placeholder={`Alan ${index + 1} — ad ver (ör. Giriş)`}
          onBlur={(e) => patch({ name: e.target.value.trim() || undefined })}
          className="flex-1 min-w-0 bg-transparent border-b border-line focus:border-accent focus:outline-none px-1 py-1.5 font-display font-semibold"
        />
        {cells > 1 && (
          <button onClick={onSplit} className="shrink-0 rounded-xl border border-line bg-white text-muted hover:text-ink hover:border-muted px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5">
            <Icon name="split" size={14} /> Böl
          </button>
        )}
        <button onClick={onClose} className="shrink-0 w-9 h-9 grid place-items-center rounded-xl text-muted hover:text-ink hover:bg-paper" aria-label="Paneli kapat">
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Alan ayarları: geçiş + arka plan */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-xs text-muted">
        <span className="flex items-center gap-2">
          Geçiş:
          {(["fade", "cut", "slide"] as const).map((tr) => (
            <button
              key={tr}
              onClick={() => patch({ transition: tr })}
              className={`px-2.5 py-1.5 rounded-full font-semibold border ${transition === tr ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"}`}
            >
              {tr === "fade" ? "Yumuşak" : tr === "cut" ? "Kesme" : "Kaydır"}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-1.5">Alan zemini <input type="color" defaultValue={zone.bg ?? "#000000"} onChange={(e) => patch({ bg: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-line p-0.5 cursor-pointer" /></label>
      </div>

      {/* Hedef çözünürlük: içerik alana tam yayılır (stretch) → doğru boyutta
          hazırlansın diye alanın gerçek piksel ölçüsü söylenir */}
      <div className="mb-4 rounded-xl bg-accent-soft border border-accent/25 px-3 py-2 text-xs text-accent-dark">
        📐 Bu alanın hedef çözünürlüğü:{" "}
        <b className="tabular-nums">{Math.round(vw.width * zone.w)} × {Math.round(vw.height * zone.h)} px</b>
        {" "}— görsel/videoyu bu boyutta hazırla; içerik alana tam yayılır.
      </div>

      {/* Tüm içerik takvim dışıysa uyarı — ekran boş görünür */}
      {allOutOfWindow && (
        <div className="mb-4 rounded-xl bg-brand-soft text-brand px-3 py-2 text-xs font-semibold">
          ⚠ Bu alanın tüm içeriği şu an takvim dışı — ekran bu alanda boş görünür.
        </div>
      )}

      {/* İçerik ekle */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {ADD_BTNS.map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            disabled={b.disabled}
            title={b.title}
            className="rounded-xl bg-paper border border-line hover:border-accent/60 hover:bg-accent-soft/40 px-2 py-3 text-sm font-semibold flex flex-col items-center gap-1 transition-colors disabled:opacity-40"
          >
            <span className="text-lg" aria-hidden>{b.icon}</span>
            {b.label}
          </button>
        ))}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && uploadFiles(Array.from(e.target.files))} />
        <input ref={replaceRef} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && replacingId && replaceFile(replacingId, e.target.files[0])} />
      </div>

      {/* URL inline formu (prompt yerine — doğrulama gözünün önünde) */}
      {urlForm && (
        <div className="mb-4 rounded-xl bg-paper border border-accent/40 p-3 flex flex-col gap-2">
          <input
            autoFocus
            value={urlForm.src}
            onChange={(e) => setUrlForm({ ...urlForm, src: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submitUrl()}
            placeholder="https://… (sayfa/dashboard adresi — iç ağ adresi de olur)"
            className={`${inputCls} px-3 py-2 text-sm`}
          />
          <input
            value={urlForm.name}
            onChange={(e) => setUrlForm({ ...urlForm, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submitUrl()}
            placeholder="Ad (opsiyonel)"
            className={`${inputCls} px-3 py-2 text-sm`}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={submitUrl} className="rounded-xl bg-accent hover:bg-accent-dark text-white px-4 py-2 text-sm font-semibold">Ekle</button>
            <button onClick={() => { setUrlForm(null); setErr(null); }} className="rounded-xl bg-white border border-line px-4 py-2 text-sm font-semibold hover:border-muted">Vazgeç</button>
            <span className="text-muted text-[11px]">Bazı siteler gömülmeye izin vermez, boş görünür — Önizle ile kontrol et.</span>
          </div>
        </div>
      )}

      {queue && (
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${queue.pct}%` }} />
          </div>
          <p className="text-muted text-xs mt-1 tabular-nums">Yükleniyor… {queue.done + 1}/{queue.total} · {queue.pct}%</p>
        </div>
      )}
      {err && <p className="text-brand text-xs mb-3 font-semibold">{err}</p>}

      {/* Öğe listesi (sürükle-bırak + ▲▼) */}
      {zone.items.length === 0 ? (
        <div className="text-center py-10 text-muted border border-dashed border-line rounded-xl">
          <p className="text-3xl mb-2" aria-hidden>📺</p>
          <p className="text-sm">Bu alan boş. İçerik ekle ya da dosyayı buraya sürükle.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {zone.items.map((it, i) => {
            const outOfWindow = !itemInWindow(it, now);
            return (
              <li
                key={it.id}
                onDragOver={(e) => {
                  if (dragIdx === null) return;
                  e.preventDefault();
                  setOverIdx(i);
                }}
                onDrop={(e) => {
                  if (dragIdx === null) return;
                  e.preventDefault();
                  reorder(dragIdx, i);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={`rounded-xl bg-paper border p-2.5 flex flex-col gap-2 transition-colors ${
                  overIdx === i && dragIdx !== null ? "border-accent" : "border-line"
                } ${dragIdx === i ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                    className="shrink-0 cursor-grab active:cursor-grabbing text-muted hover:text-ink px-1 py-2 select-none hidden sm:block"
                    title="Sürükle sırala"
                    aria-label="Sürükle sırala"
                  >
                    <Icon name="grip" size={16} />
                  </span>
                  {/* ▲▼ — dokunmatikte HTML5 sürükleme çalışmaz; tek dokunuşla sırala */}
                  <span className="shrink-0 flex flex-col">
                    <button onClick={() => reorder(i, i - 1)} disabled={i === 0} className="w-7 h-5 grid place-items-center text-muted hover:text-ink disabled:opacity-20" aria-label="Yukarı taşı"><Icon name="up" size={13} /></button>
                    <button onClick={() => reorder(i, i + 1)} disabled={i === zone.items.length - 1} className="w-7 h-5 grid place-items-center text-muted hover:text-ink disabled:opacity-20" aria-label="Aşağı taşı"><Icon name="down" size={13} /></button>
                  </span>
                  <ItemThumb item={it} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{it.kind === "text" ? it.title || "Metin" : it.kind === "clock" ? "Saat" : it.name || it.src}</p>
                    <span className="inline-flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider text-accent-dark bg-accent-soft rounded px-1.5 py-0.5">{KIND_LABEL[it.kind]}</span>
                      {/* Kompakt özet: ayrıntılar ⚙ ile açılır */}
                      <span className="text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5 tabular-nums">
                        ⏱ {it.kind === "video" && !it.durationSec ? "video sonu" : `${it.durationSec ?? 8} sn`}
                      </span>
                      {(it.from || it.to || it.days?.length || it.fromDate || it.toDate) && (
                        <span className="text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5 tabular-nums">
                          🗓 {it.fromDate || it.toDate ? `${(it.fromDate ?? "…").slice(5)} – ${(it.toDate ?? "…").slice(5)}` : "takvimli"}
                        </span>
                      )}
                      {it.kind === "url" && (it.zoom ?? 100) !== 100 && (
                        <span className="text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5">🔍 %{it.zoom}</span>
                      )}
                      {outOfWindow && <span className="text-[10px] text-ink/70 bg-line/60 rounded px-1.5 py-0.5">şu an takvim dışı</span>}
                    </span>
                  </div>
                  <button
                    onClick={() => setOpenItemId(openItemId === it.id ? null : it.id)}
                    className={`shrink-0 w-9 h-9 grid place-items-center rounded-lg hover:bg-white ${openItemId === it.id ? "text-accent-dark bg-white" : "text-muted hover:text-ink"}`}
                    title="Süre / takvim / ayarlar"
                    aria-label="Öğe ayarları"
                    aria-expanded={openItemId === it.id}
                  >
                    <Icon name="settings" size={15} />
                  </button>
                  {(it.kind === "image" || it.kind === "video") && (
                    <button
                      onClick={() => {
                        setReplacingId(it.id);
                        replaceRef.current?.click();
                      }}
                      disabled={queue !== null}
                      className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-white disabled:opacity-30"
                      title="Dosyayı değiştir (sıra ve takvim korunur)"
                      aria-label="Dosyayı değiştir"
                    >
                      <Icon name="swap" size={15} />
                    </button>
                  )}
                  <button onClick={() => removeItem(it.id)} className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50" aria-label="Sil">
                    <Icon name="trash" size={15} />
                  </button>
                </div>

                {/* Ayrıntılar yalnız ⚙ ile açılınca — panel kompakt kalır */}
                {openItemId === it.id && (
                  <>
                    {(it.kind === "image" || it.kind === "video" || it.kind === "url") && (
                      <div className="pl-9 flex flex-col gap-2">
                        {/* Yeniden adlandırma: kütüphanede/listede ayırt etmek için */}
                        <input
                          defaultValue={it.name ?? ""}
                          placeholder="Ad (ör. Yaz Kampanyası Afişi)"
                          onBlur={(e) => patchItem(it.id, { name: e.target.value.trim().slice(0, 60) || undefined })}
                          className={`${inputCls} px-3 py-2 text-sm w-full`}
                          aria-label="Öğe adı"
                        />
                        {/* Adres de düzenlenebilir — geçersizse eski değere döner */}
                        {it.kind === "url" && (
                          <input
                            defaultValue={it.src ?? ""}
                            placeholder="https://…"
                            inputMode="url"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (/^https?:\/\//i.test(v) && v !== it.src) {
                                patchItem(it.id, { src: v });
                                void warnIfNotEmbeddable(v);
                              } else e.target.value = it.src ?? "";
                            }}
                            className={`${inputCls} px-3 py-2 text-xs w-full font-mono`}
                            aria-label="Sayfa adresi (URL)"
                          />
                        )}
                      </div>
                    )}
                    {it.kind === "text" && (
                      <div className="flex flex-col gap-2 pl-9">
                        <input defaultValue={it.title ?? ""} placeholder="Başlık" onBlur={(e) => patchItem(it.id, { title: e.target.value })} className={`${inputCls} px-3 py-2 text-sm`} />
                        <textarea defaultValue={it.text ?? ""} placeholder="Mesaj (opsiyonel)" rows={2} onBlur={(e) => patchItem(it.id, { text: e.target.value })} className={`${inputCls} px-3 py-2 text-sm resize-y`} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-9 text-xs text-muted">
                      {(it.kind === "text" || it.kind === "clock") && (
                        <>
                          <label className="flex items-center gap-1.5">Zemin <input type="color" defaultValue={it.bg ?? "#312e81"} onChange={(e) => patchItem(it.id, { bg: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-line p-0.5 cursor-pointer" /></label>
                          <label className="flex items-center gap-1.5">Yazı <input type="color" defaultValue={it.color ?? "#ffffff"} onChange={(e) => patchItem(it.id, { color: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-line p-0.5 cursor-pointer" /></label>
                        </>
                      )}
                      {it.kind === "url" && (
                        <label className="flex items-center gap-1.5" title="Sayfa daha büyük sanal pencerede açılıp ölçeklenir — dashboard grafikleri elle zoom gerekmeden sığar">
                          Yakınlaştırma
                          <select
                            defaultValue={it.zoom ?? 100}
                            onChange={(e) => patchItem(it.id, { zoom: Number(e.target.value) === 100 ? undefined : Number(e.target.value) })}
                            className={`${inputCls} px-2 py-1`}
                          >
                            {[25, 33, 50, 67, 75, 100, 125, 150].map((z) => (
                              <option key={z} value={z}>%{z}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {it.kind === "url" && it.src && (
                        <a href={it.src} target="_blank" rel="noreferrer" className="text-accent hover:underline font-semibold" title="Sayfanın kendisi açılıyor mu diye hızlı kontrol">
                          Sayfayı yeni sekmede aç ↗
                        </a>
                      )}
                      <label className="flex items-center gap-1.5" title={it.kind === "video" ? "Boş bırakılırsa video sonuna kadar oynar" : undefined}>
                        {it.kind === "video" ? "Maks süre" : "Süre"}
                        <input
                          type="number"
                          min={2}
                          defaultValue={it.durationSec ?? (it.kind === "video" ? undefined : 8)}
                          placeholder={it.kind === "video" ? "video sonu" : "8"}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            patchItem(it.id, { durationSec: v >= 2 ? Math.round(v) : undefined });
                          }}
                          className={`w-20 ${inputCls} !px-2 !py-1 tabular-nums`}
                        />
                        sn
                      </label>
                      <label className="flex items-center gap-1.5">
                        Saat
                        <input type="time" defaultValue={it.from ?? ""} onBlur={(e) => patchItem(it.id, { from: e.target.value || undefined })} className={`${inputCls} px-2 py-1`} />
                        –
                        <input type="time" defaultValue={it.to ?? ""} onBlur={(e) => patchItem(it.id, { to: e.target.value || undefined })} className={`${inputCls} px-2 py-1`} />
                      </label>
                      {/* Kampanya aralığı: bitiş günü DAHİL; boş uç = sınırsız o yönde */}
                      <label className="flex items-center gap-1.5" title="Bu tarihler arasında döner, bitince kendiliğinden düşer (bitiş günü dahil)">
                        Tarih
                        <input type="date" defaultValue={it.fromDate ?? ""} onBlur={(e) => patchItem(it.id, { fromDate: e.target.value || undefined })} className={`${inputCls} px-2 py-1`} />
                        –
                        <input type="date" defaultValue={it.toDate ?? ""} onBlur={(e) => patchItem(it.id, { toDate: e.target.value || undefined })} className={`${inputCls} px-2 py-1`} />
                      </label>
                    </div>

                    {/* Günler (boşsa her gün) */}
                    <div className="flex items-center gap-1.5 pl-9 flex-wrap">
                      <span className="text-xs text-muted mr-1">Gün:</span>
                      {DAYS.map((d) => {
                        const active = it.days?.includes(d.v);
                        return (
                          <button
                            key={d.v}
                            onClick={() => toggleDay(it, d.v)}
                            className={`text-xs font-semibold rounded-full px-2.5 py-1.5 border ${active ? "bg-accent text-white border-accent" : "bg-white border-line text-muted hover:border-muted"}`}
                          >
                            {d.l}
                          </button>
                        );
                      })}
                      {!it.days?.length && <span className="text-[11px] text-muted ml-1">her gün</span>}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-muted text-[11px] mt-3">İçerik alana tam yayılır — hedef çözünürlük yukarıda 📐 · süre/takvim öğedeki ⚙ ile · dosyayı panele sürükleyip bırakabilirsin.</p>

      {/* Medya kütüphanesi */}
      {libOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setLibOpen(false)}>
          <div className="bg-white border border-line rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">🗂 Medya kütüphanesi</p>
              <button onClick={() => setLibOpen(false)} className="w-9 h-9 grid place-items-center rounded-xl text-muted hover:text-ink hover:bg-paper" aria-label="Kapat"><Icon name="close" size={16} /></button>
            </div>
            <p className="text-muted text-xs mb-3">Bu ekrana daha önce yüklediğin medya (taslak + yayın) — tıkla, bu alana ekle.</p>

            {/* Tür sekmeleri: Tümü / Foto / Video */}
            <div className="flex gap-1.5 mb-3">
              {([
                { v: "all", label: `Tümü (${library.length})` },
                { v: "image", label: `📷 Foto (${library.filter((i) => i.kind === "image").length})` },
                { v: "video", label: `🎬 Video (${library.filter((i) => i.kind === "video").length})` },
              ] as const).map((t) => (
                <button
                  key={t.v}
                  onClick={() => setLibFilter(t.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    libFilter === t.v ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {library
                .filter((it) => libFilter === "all" || it.kind === libFilter)
                .map((it) => (
                  <button key={it.src} onClick={() => addFromLib(it)} className="rounded-lg overflow-hidden border border-line hover:border-accent text-left">
                    <span className="block aspect-square relative">
                      {it.kind === "video" ? (
                        <span className="w-full h-full grid place-items-center bg-black text-2xl">🎬</span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.src} alt="" className="w-full h-full object-cover bg-black" />
                      )}
                    </span>
                    {/* Dosya adı — hangi dosya olduğu görünsün */}
                    <span className="block px-1.5 py-1 text-[10px] text-muted truncate bg-paper">
                      {it.name || "adsız"}
                    </span>
                  </button>
                ))}
            </div>
            {library.filter((it) => libFilter === "all" || it.kind === libFilter).length === 0 && (
              <p className="text-muted text-sm text-center py-8">Bu türde medya yok.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
