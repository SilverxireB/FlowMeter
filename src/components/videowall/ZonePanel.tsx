"use client";

/**
 * FlowSign içerik paneli (v3). Seçili alana içerik ata: görsel/video (Cloudinary'ye
 * yükle) veya URL (dashboard/sayfa). Öğe başına: gösterim süresi, saat aralığı,
 * sıralama. Sığdır (cover/contain) alan bazında. Yazım → updateZones (realtime).
 */
import { useRef, useState } from "react";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

const iid = () => `it-${Math.random().toString(36).slice(2, 9)}`;
const KIND_ICON = { image: "🖼", video: "🎬", url: "🔗" } as const;

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
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<Zone>) => onZones((vw.zones ?? []).map((z) => (z.id === zone.id ? { ...z, ...p } : z)));
  const setItems = (items: ZoneItem[]) => patch({ items });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    if (!isCloudinaryConfigured()) {
      setErr("Cloudinary yapılandırılmadı — görsel/video yüklenemez (URL öğesi ekleyebilirsin).");
      return;
    }
    const added: ZoneItem[] = [];
    for (const file of Array.from(files)) {
      try {
        setProgress(0);
        const res = await uploadToCloudinary(file, `flowsign/${vw.id}`, setProgress, { keepOriginal: true });
        added.push({
          id: iid(),
          kind: res.type, // "image" | "video"
          src: res.url,
          name: file.name.replace(/\.[^.]+$/, ""),
          durationSec: res.type === "image" ? 8 : undefined,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Yükleme başarısız.");
      }
    }
    setProgress(null);
    if (added.length) setItems([...zone.items, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    const src = prompt("Sayfa/dashboard URL'si (https://…):")?.trim();
    if (!src) return;
    const name = prompt("Ad (opsiyonel):", "")?.trim() || "Sayfa";
    setItems([...zone.items, { id: iid(), kind: "url", src, name, durationSec: 15 }]);
  }

  const patchItem = (id: string, p: Partial<ZoneItem>) => setItems(zone.items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const removeItem = (id: string) => setItems(zone.items.filter((it) => it.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= zone.items.length) return;
    const arr = [...zone.items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setItems(arr);
  };

  const cells = Math.round(zone.w * vw.cols) * Math.round(zone.h * vw.rows);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="font-display font-semibold">Alan {index + 1} · içerik</p>
        <button onClick={onClose} className="text-white/40 hover:text-white text-sm">Kapat ✕</button>
      </div>

      {/* Alan araçları */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <span className="text-white/45 text-xs">Sığdır:</span>
        {(["cover", "contain"] as const).map((f) => (
          <button
            key={f}
            onClick={() => patch({ fit: f })}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              (zone.fit ?? "cover") === f ? "bg-white text-[#041a1a] border-white" : "border-white/20 text-white/70"
            }`}
          >
            {f === "cover" ? "Doldur" : "Sığdır"}
          </button>
        ))}
        {cells > 1 && (
          <button onClick={onSplit} className="ml-auto px-3 py-1 rounded-full text-xs font-semibold border border-white/20 text-white/70 hover:border-white/40">
            ⛶ Alanı böl
          </button>
        )}
      </div>

      {/* Ekle */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => fileRef.current?.click()} disabled={progress !== null} className="rounded-xl bg-[#2dd4bf] text-[#04231f] px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {progress !== null ? `Yükleniyor… ${progress}%` : "＋ Görsel / Video"}
        </button>
        <button onClick={addUrl} className="rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/15">＋ URL / Sayfa</button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
      {err && <p className="text-[#ffb4b4] text-xs mb-3">{err}</p>}

      {/* Öğe listesi */}
      {zone.items.length === 0 ? (
        <p className="text-white/40 text-sm py-4 text-center">Henüz içerik yok. Görsel/video yükle ya da URL ekle.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {zone.items.map((it, i) => (
            <li key={it.id} className="rounded-xl bg-black/30 border border-white/10 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden>{KIND_ICON[it.kind]}</span>
                <span className="text-sm font-semibold truncate flex-1 min-w-0">{it.name || it.src}</span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-white/40 hover:text-white disabled:opacity-20 px-1" aria-label="Yukarı">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === zone.items.length - 1} className="text-white/40 hover:text-white disabled:opacity-20 px-1" aria-label="Aşağı">↓</button>
                <button onClick={() => removeItem(it.id)} className="text-white/40 hover:text-[#ff6b6b] px-1" aria-label="Sil">🗑</button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                {it.kind !== "video" && (
                  <label className="flex items-center gap-1">
                    Süre
                    <input
                      type="number"
                      min={2}
                      defaultValue={it.durationSec ?? 8}
                      onBlur={(e) => patchItem(it.id, { durationSec: Math.max(2, Number(e.target.value) || 8) })}
                      className="w-14 rounded bg-white/10 border border-white/15 px-2 py-1 tabular-nums"
                    />
                    sn
                  </label>
                )}
                <label className="flex items-center gap-1">
                  Saat
                  <input type="time" defaultValue={it.from ?? ""} onBlur={(e) => patchItem(it.id, { from: e.target.value || undefined })} className="rounded bg-white/10 border border-white/15 px-2 py-1" />
                  –
                  <input type="time" defaultValue={it.to ?? ""} onBlur={(e) => patchItem(it.id, { to: e.target.value || undefined })} className="rounded bg-white/10 border border-white/15 px-2 py-1" />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-white/35 text-[11px] mt-3">Saat aralığı boşsa öğe hep döner. Video kendi süresince oynar; birden çok öğe sırayla döner.</p>
    </div>
  );
}
