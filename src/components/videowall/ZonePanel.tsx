"use client";

/**
 * FlowSign içerik paneli. Seçili alana içerik ata: görsel/video (Cloudinary,
 * sürükle-bırak da yüklenir), URL, METİN, SAAT + medya kütüphanesinden tekrar
 * kullan. Öğe başına süre + saat aralığı + haftanın günleri. Alan: geçiş efekti +
 * arka plan rengi. İçerik alana STRETCH edilir (sığdır/doldur YOK). Öğeler
 * sürükle-bırak sıralanır. Yazım → updateZones (realtime).
 */
import { useMemo, useRef, useState } from "react";
import { cldFit, isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

const iid = () => `it-${Math.random().toString(36).slice(2, 9)}`;
const KIND_LABEL = { image: "Görsel", video: "Video", url: "URL", text: "Metin", clock: "Saat" } as const;
const DAYS = [
  { v: 1, l: "Pzt" }, { v: 2, l: "Sal" }, { v: 3, l: "Çar" }, { v: 4, l: "Per" },
  { v: 5, l: "Cum" }, { v: 6, l: "Cmt" }, { v: 0, l: "Paz" },
];
const stillOf = (src: string) => cldFit(src, 160).replace(/\.(mp4|mov|webm|m4v)$/i, ".jpg");

function ItemThumb({ item }: { item: ZoneItem }) {
  const base = "w-14 h-14 rounded-lg overflow-hidden shrink-0 grid place-items-center";
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cldFit(item.src, 160)} alt="" className={`${base} object-cover`} />;
  if (item.kind === "video" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={stillOf(item.src)} alt="" className={`${base} object-cover bg-black`} />;
  if (item.kind === "text")
    return <div className={`${base} font-bold text-sm`} style={{ background: item.bg ?? "#0c3b3b", color: item.color ?? "#fff" }}>Aa</div>;
  if (item.kind === "clock")
    return <div className={`${base} text-xl`} style={{ background: item.bg ?? "#041a1a", color: item.color ?? "#fff" }}>🕐</div>;
  return <div className={`${base} bg-white/10 text-xl`}>🔗</div>;
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
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<Zone>) => onZones((vw.zones ?? []).map((z) => (z.id === zone.id ? { ...z, ...p } : z)));
  const setItems = (items: ZoneItem[]) => patch({ items });

  // Duvar genelindeki tüm medya (kütüphane) — src'ye göre tekilleştir.
  const library = useMemo(() => {
    const seen = new Set<string>();
    const out: ZoneItem[] = [];
    for (const z of vw.zones ?? [])
      for (const it of z.items ?? [])
        if ((it.kind === "image" || it.kind === "video") && it.src && !seen.has(it.src)) {
          seen.add(it.src);
          out.push(it);
        }
    return out;
  }, [vw.zones]);

  async function uploadFiles(files: File[]) {
    setErr(null);
    if (!isCloudinaryConfigured()) {
      setErr("Cloudinary yapılandırılmadı — görsel/video yüklenemez (URL/metin/saat ekleyebilirsin).");
      return;
    }
    const media = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!media.length) return;
    const added: ZoneItem[] = [];
    for (let i = 0; i < media.length; i++) {
      try {
        setQueue({ done: i, total: media.length, pct: 0 });
        const res = await uploadToCloudinary(media[i], `flowsign/${vw.id}`, (pct) => setQueue({ done: i, total: media.length, pct }), { keepOriginal: true });
        added.push({ id: iid(), kind: res.type, src: res.url, name: media[i].name.replace(/\.[^.]+$/, ""), durationSec: res.type === "image" ? 8 : undefined });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Yükleme başarısız.");
      }
    }
    setQueue(null);
    if (added.length) setItems([...zone.items, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    const src = prompt("Sayfa/dashboard URL'si (https://…):")?.trim();
    if (!src) return;
    const name = prompt("Ad (opsiyonel):", "")?.trim() || "Sayfa";
    setItems([...zone.items, { id: iid(), kind: "url", src, name, durationSec: 15 }]);
  }
  const addText = () => setItems([...zone.items, { id: iid(), kind: "text", title: "Başlık", text: "", bg: "#0c3b3b", color: "#ffffff", durationSec: 10 }]);
  const addClock = () => setItems([...zone.items, { id: iid(), kind: "clock", bg: "#041a1a", color: "#ffffff", durationSec: 10 }]);
  const addFromLib = (src: ZoneItem) => {
    setItems([...zone.items, { ...src, id: iid() }]);
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
    if (from === to || from < 0 || to < 0) return;
    const arr = [...zone.items];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setItems(arr);
  };

  const cells = Math.round(zone.w * vw.cols) * Math.round(zone.h * vw.rows);
  const transition = zone.transition ?? "fade";

  const ADD_BTNS: { label: string; icon: string; fn: () => void; disabled?: boolean }[] = [
    { label: "Görsel / Video", icon: "🖼", fn: () => fileRef.current?.click(), disabled: queue !== null },
    { label: "Kütüphane", icon: "🗂", fn: () => setLibOpen(true), disabled: library.length === 0 },
    { label: "URL", icon: "🔗", fn: addUrl },
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
      className={`relative rounded-2xl border p-5 transition-colors ${fileOver ? "border-[#2dd4bf] bg-[#2dd4bf]/10" : "border-white/10 bg-white/[0.06]"}`}
    >
      {fileOver && (
        <div className="absolute inset-0 z-40 rounded-2xl border-2 border-dashed border-[#2dd4bf] bg-[#041a1a]/70 grid place-items-center pointer-events-none">
          <p className="text-[#7ff0e4] font-semibold">Bırak → bu alana yükle</p>
        </div>
      )}

      {/* Başlık: alan adı + böl + kapat */}
      <div className="flex items-center gap-2 mb-4">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-[#2dd4bf]/20 text-[#7ff0e4] grid place-items-center text-sm font-bold">{index + 1}</span>
        <input
          defaultValue={zone.name ?? ""}
          placeholder={`Alan ${index + 1} — ad ver (ör. Giriş)`}
          onBlur={(e) => patch({ name: e.target.value.trim() || undefined })}
          className="flex-1 min-w-0 bg-transparent border-b border-white/15 focus:border-[#2dd4bf] focus:outline-none px-1 py-1.5 font-display font-semibold"
        />
        {cells > 1 && (
          <button onClick={onSplit} className="shrink-0 rounded-lg border border-white/15 text-white/70 hover:border-white/40 px-3 py-1.5 text-xs font-semibold">⛶ Böl</button>
        )}
        <button onClick={onClose} className="shrink-0 text-white/40 hover:text-white text-sm px-1">✕</button>
      </div>

      {/* Alan ayarları: geçiş + arka plan */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-xs text-white/60">
        <span className="flex items-center gap-2">
          Geçiş:
          {(["fade", "cut", "slide"] as const).map((tr) => (
            <button
              key={tr}
              onClick={() => patch({ transition: tr })}
              className={`px-2.5 py-1 rounded-full font-semibold border ${transition === tr ? "bg-white text-[#041a1a] border-white" : "border-white/20 text-white/70"}`}
            >
              {tr === "fade" ? "Yumuşak" : tr === "cut" ? "Kesme" : "Kaydır"}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-1.5">Alan zemini <input type="color" defaultValue={zone.bg ?? "#000000"} onChange={(e) => patch({ bg: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-white/15 p-0.5 cursor-pointer" /></label>
      </div>

      {/* İçerik ekle */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {ADD_BTNS.map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            disabled={b.disabled}
            className="rounded-xl bg-white/[0.06] border border-white/10 hover:border-[#2dd4bf]/50 hover:bg-white/10 px-2 py-3 text-sm font-semibold flex flex-col items-center gap-1 transition-colors disabled:opacity-40"
          >
            <span className="text-lg" aria-hidden>{b.icon}</span>
            {b.label}
          </button>
        ))}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && uploadFiles(Array.from(e.target.files))} />
      </div>

      {queue && (
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[#2dd4bf] transition-[width]" style={{ width: `${queue.pct}%` }} />
          </div>
          <p className="text-white/50 text-xs mt-1 tabular-nums">Yükleniyor… {queue.done + 1}/{queue.total} · {queue.pct}%</p>
        </div>
      )}
      {err && <p className="text-[#ffb4b4] text-xs mb-3">{err}</p>}

      {/* Öğe listesi (sürükle-bırak) */}
      {zone.items.length === 0 ? (
        <div className="text-center py-10 text-white/35 border border-dashed border-white/10 rounded-xl">
          <p className="text-3xl mb-2" aria-hidden>📺</p>
          <p className="text-sm">Bu alan boş. İçerik ekle ya da dosyayı buraya sürükle.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {zone.items.map((it, i) => (
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
              className={`rounded-xl bg-black/25 border p-2.5 flex flex-col gap-2 transition-colors ${
                overIdx === i && dragIdx !== null ? "border-[#2dd4bf]" : "border-white/10"
              } ${dragIdx === i ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  className="shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 px-0.5 text-lg leading-none select-none"
                  title="Sürükle sırala"
                  aria-label="Sürükle sırala"
                >⠿</span>
                <ItemThumb item={it} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{it.kind === "text" ? it.title || "Metin" : it.kind === "clock" ? "Saat" : it.name || it.src}</p>
                  <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wider text-[#7ff0e4]/80 bg-[#2dd4bf]/10 rounded px-1.5 py-0.5">{KIND_LABEL[it.kind]}</span>
                </div>
                <button onClick={() => removeItem(it.id)} className="shrink-0 text-white/40 hover:text-[#ff6b6b] px-1" aria-label="Sil">🗑</button>
              </div>

              {it.kind === "text" && (
                <div className="flex flex-col gap-2 pl-8">
                  <input defaultValue={it.title ?? ""} placeholder="Başlık" onBlur={(e) => patchItem(it.id, { title: e.target.value })} className="rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-[#2dd4bf]" />
                  <textarea defaultValue={it.text ?? ""} placeholder="Mesaj (opsiyonel)" rows={2} onBlur={(e) => patchItem(it.id, { text: e.target.value })} className="rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm resize-y focus:outline-none focus:border-[#2dd4bf]" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 text-xs text-white/60">
                {(it.kind === "text" || it.kind === "clock") && (
                  <>
                    <label className="flex items-center gap-1.5">Zemin <input type="color" defaultValue={it.bg ?? "#0c3b3b"} onChange={(e) => patchItem(it.id, { bg: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-white/15 p-0.5 cursor-pointer" /></label>
                    <label className="flex items-center gap-1.5">Yazı <input type="color" defaultValue={it.color ?? "#ffffff"} onChange={(e) => patchItem(it.id, { color: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-white/15 p-0.5 cursor-pointer" /></label>
                  </>
                )}
                {it.kind !== "video" && (
                  <label className="flex items-center gap-1.5">Süre <input type="number" min={2} defaultValue={it.durationSec ?? 8} onBlur={(e) => patchItem(it.id, { durationSec: Math.max(2, Number(e.target.value) || 8) })} className="w-14 rounded bg-white/10 border border-white/15 px-2 py-1 tabular-nums focus:outline-none focus:border-[#2dd4bf]" /> sn</label>
                )}
                <label className="flex items-center gap-1.5">Saat
                  <input type="time" defaultValue={it.from ?? ""} onBlur={(e) => patchItem(it.id, { from: e.target.value || undefined })} className="rounded bg-white/10 border border-white/15 px-2 py-1 focus:outline-none focus:border-[#2dd4bf]" />–
                  <input type="time" defaultValue={it.to ?? ""} onBlur={(e) => patchItem(it.id, { to: e.target.value || undefined })} className="rounded bg-white/10 border border-white/15 px-2 py-1 focus:outline-none focus:border-[#2dd4bf]" />
                </label>
              </div>

              {/* Günler (boşsa her gün) */}
              <div className="flex items-center gap-1 pl-8 flex-wrap">
                <span className="text-xs text-white/45 mr-1">Gün:</span>
                {DAYS.map((d) => {
                  const active = it.days?.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      onClick={() => toggleDay(it, d.v)}
                      className={`text-[10px] font-semibold rounded px-1.5 py-1 border ${active ? "bg-[#2dd4bf] text-[#04231f] border-[#2dd4bf]" : "border-white/15 text-white/55"}`}
                    >{d.l}</button>
                  );
                })}
                {!it.days?.length && <span className="text-[10px] text-white/35 ml-1">her gün</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-white/35 text-[11px] mt-3">İçerik alana tam oturur (stretch). Dosyayı panele sürükleyip bırakarak da yükleyebilirsin.</p>

      {/* Medya kütüphanesi */}
      {libOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setLibOpen(false)}>
          <div className="bg-[#0a2422] border border-white/10 rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">🗂 Medya kütüphanesi</p>
              <button onClick={() => setLibOpen(false)} className="text-white/40 hover:text-white text-sm">Kapat ✕</button>
            </div>
            <p className="text-white/45 text-xs mb-3">Bu duvara daha önce yüklediğin medya — tıkla, bu alana ekle.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {library.map((it) => (
                <button key={it.src} onClick={() => addFromLib(it)} className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#2dd4bf] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.kind === "video" ? stillOf(it.src!) : cldFit(it.src!, 200)} alt="" className="w-full h-full object-cover bg-black" />
                  {it.kind === "video" && <span className="absolute bottom-1 right-1 text-xs">🎬</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
