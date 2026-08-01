"use client";

/**
 * FlowSign yerleşim editörü (v2). Fiziksel ekran ızgarası (cols×rows) üstünde:
 *  - hücrelere SÜRÜKLE → dikdörtgen alanları birleştir
 *  - alana TIKLA → seç (içerik paneli için)
 * Etkileşim pointer-capture + koordinat matematiğiyle (fare VE dokunmatik çalışır;
 * hücre başına DOM yok). Alanlar oransal (0–1) → yayın çözünürlükten bağımsız.
 */
import { useRef, useState } from "react";
import { cldFit } from "@/lib/cloudinary";
import { CellBox, contentZonesIn, layoutColsOf, layoutRowsOf, mergeCells, zoneCells, ZONE_BG_DEFAULT } from "@/lib/videowalls";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

/** Video ilk-kare posteri (kırpmasız). Cloudinary değilse "" → 🎬 yer tutucuya düşer
 * (self-host'ta yerel video URL'sini .jpg'ye çevirip kırık görsel üretmesin). */
function videoStill(src: string): string {
  if (!src.includes("res.cloudinary.com")) return "";
  return cldFit(src, 320).replace(/\.(mp4|mov|webm|m4v)$/i, ".jpg");
}

/**
 * Alan önizleme arka planı — ilk öğenin gerçek gösterimi (perde ile birebir:
 * içerik alana STRETCH edilir → editörde ne görüyorsan duvarda o).
 */
function ZonePreview({ item }: { item?: ZoneItem }) {
  if (!item) return null;
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cldFit(item.src, 320)} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} />;
  if (item.kind === "video" && item.src) {
    const still = videoStill(item.src);
    // eslint-disable-next-line @next/next/no-img-element
    return still ? <img src={still} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} /> : <div className="absolute inset-0 grid place-items-center bg-black/40 text-lg">🎬</div>;
  }
  if (item.kind === "text") return <div className="absolute inset-0" style={{ background: item.bg ?? "#312e81" }} />;
  if (item.kind === "clock") return <div className="absolute inset-0 grid place-items-center text-lg" style={{ background: item.bg ?? "#0d102f" }}>🕐</div>;
  if (item.kind === "url") {
    // Gerçek sayfanın minyatürü (4× sanal pencere → 0.25 ölçek; salt-görüntü).
    // Site iframe'i reddederse (X-Frame-Options) boş kalır → alttaki 🔗 görünür.
    const src = /^https?:\/\//i.test(item.src ?? "") ? item.src : undefined;
    let host = "";
    try {
      host = src ? new URL(src).hostname : "";
    } catch {}
    if (!src) return <div className="absolute inset-0 grid place-items-center bg-black/40 text-lg">🔗</div>;
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 grid place-items-center bg-black/40 text-lg">🔗</div>
        <iframe
          src={src}
          title={item.name || "sayfa"}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          loading="lazy"
          className="absolute top-0 left-0 border-0 pointer-events-none"
          style={{ width: "400%", height: "400%", transform: "scale(0.25)", transformOrigin: "top left" }}
        />
        {host && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">{host}</span>}
      </div>
    );
  }
  return null;
}

type Cell = { c: number; r: number };

function boxOf(a: Cell, b: Cell): CellBox {
  return { c0: Math.min(a.c, b.c), r0: Math.min(a.r, b.r), c1: Math.max(a.c, b.c), r1: Math.max(a.r, b.r) };
}

export default function LayoutEditor({
  vw,
  selectedId,
  onSelect,
  onZones,
  onConfirm,
}: {
  vw: Videowall;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onZones: (zones: Zone[]) => void;
  /** Markalı onay penceresi (edit sayfası sağlar) — native confirm yerine. */
  onConfirm: (c: { title: string; message: string; confirmLabel?: string; danger?: boolean; run: () => void }) => void;
}) {
  // Sürükleme/birleştirme YERLEŞİM ızgarasında olur; fiziksel ızgara yalnız
  // çerçeve (bezel) çizgilerini çizer — tek TV'yi 3 alana bölmek bu yüzden mümkün.
  const cols = layoutColsOf(vw);
  const rows = layoutRowsOf(vw);
  const screenCols = vw.cols;
  const screenRows = vw.rows;
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ anchor: Cell; hover: Cell } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // Hangi hücre hangi alana ait? (tıklamada alanı bul)
  const owner = new Map<string, Zone>();
  for (const z of vw.zones ?? []) {
    const cb = zoneCells(z, cols, rows);
    for (let r = cb.r0; r <= cb.r1; r++) for (let c = cb.c0; c <= cb.c1; c++) owner.set(`${c},${r}`, z);
  }

  // Koordinat → hücre (pointer-capture sayesinde dışarı taşsa da kenara kilitlenir).
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  const cellAt = (clientX: number, clientY: number): Cell | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      c: clamp(Math.floor(((clientX - rect.left) / rect.width) * cols), cols - 1),
      r: clamp(Math.floor(((clientY - rect.top) / rect.height) * rows), rows - 1),
    };
  };

  const finish = () => {
    const d = dragRef.current;
    if (!d) return;
    setDrag(null);
    if (d.anchor.c === d.hover.c && d.anchor.r === d.hover.r) {
      onSelect(owner.get(`${d.anchor.c},${d.anchor.r}`)?.id ?? null);
      return;
    }
    const box = boxOf(d.anchor, d.hover);
    const doMerge = () => {
      onZones(mergeCells(vw.zones ?? [], cols, rows, box));
      onSelect(null);
    };
    // İçerikli alanlar etkileniyorsa ONAY sor — yanlışlıkla birleştirme faciası yok.
    const withContent = contentZonesIn(vw.zones ?? [], cols, rows, box);
    if (withContent.length === 0) {
      doMerge();
      return;
    }
    const label = (z: Zone) => z.name || `Alan ${(vw.zones ?? []).indexOf(z) + 1}`;
    onConfirm({
      title: "Alanları birleştir",
      message:
        (withContent.length === 1
          ? `"${label(withContent[0])}" içeriği yeni alana taşınır (kaybolmaz).`
          : `Yalnız "${label(withContent[0])}" içeriği yeni alana taşınır; diğer ${withContent.length - 1} alanın içeriği SİLİNİR.`) +
        "\nSonradan alana tıklayıp “Böl” ile geri ayırabilirsin.",
      confirmLabel: "Birleştir",
      danger: withContent.length > 1,
      run: doMerge,
    });
  };

  const selBox = drag ? boxOf(drag.anchor, drag.hover) : null;
  const aspect = vw.width / vw.height;

  return (
    <div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-line select-none touch-none"
        style={{
          width: "100%",
          maxWidth: aspect >= 1 ? 900 : 900 * aspect,
          aspectRatio: `${vw.width} / ${vw.height}`,
          background: ZONE_BG_DEFAULT,
        }}
      >
        {/* Alanlar (görsel) */}
        {(vw.zones ?? []).map((z, i) => {
          const sel = z.id === selectedId;
          return (
            <div
              key={z.id}
              className={`absolute overflow-hidden grid place-items-center text-center px-1 ${
                sel ? "ring-2 ring-[#6366f1] z-10" : "border border-[#6366f1]/40"
              } ${z.items.length ? "" : "bg-[#6366f1]/5"}`}
              style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` }}
            >
              <ZonePreview item={z.items[0]} />
              <span className="relative z-[1] text-white text-[11px] font-semibold leading-tight pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {z.name || `Alan ${i + 1}`}
                {z.items.length > 0 && <span className="block text-white/70 font-normal">{z.items.length} içerik</span>}
              </span>
            </div>
          );
        })}

        {/* Fiziksel ekran (çerçeve/bezel) çizgileri — yerleşimden BAĞIMSIZ */}
        {Array.from({ length: screenCols - 1 }).map((_, i) => (
          <div key={`c${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-white/25 pointer-events-none z-20" style={{ left: `${((i + 1) / screenCols) * 100}%` }} />
        ))}
        {Array.from({ length: screenRows - 1 }).map((_, i) => (
          <div key={`r${i}`} className="absolute left-0 right-0 border-t border-dashed border-white/25 pointer-events-none z-20" style={{ top: `${((i + 1) / screenRows) * 100}%` }} />
        ))}

        {/* Sürükleme seçim kutusu */}
        {selBox && (
          <div
            className="absolute z-[25] bg-[#6366f1]/20 border-2 border-[#6366f1] pointer-events-none"
            style={{
              left: `${(selBox.c0 / cols) * 100}%`,
              top: `${(selBox.r0 / rows) * 100}%`,
              width: `${((selBox.c1 - selBox.c0 + 1) / cols) * 100}%`,
              height: `${((selBox.r1 - selBox.r0 + 1) / rows) * 100}%`,
            }}
          />
        )}

        {/* Etkileşim katmanı — tek yüzey, pointer-capture (fare + dokunmatik) */}
        <div
          ref={gridRef}
          className="absolute inset-0 z-30 cursor-crosshair"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const cell = cellAt(e.clientX, e.clientY);
            if (cell) setDrag({ anchor: cell, hover: cell });
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const cell = cellAt(e.clientX, e.clientY);
            if (cell) setDrag((d) => (d ? { ...d, hover: cell } : d));
          }}
          onPointerUp={finish}
          onPointerCancel={() => setDrag(null)}
        />
      </div>
      <p className="text-muted text-xs mt-3">
        <b>Sürükle</b> → birleştir · <b>tıkla</b> → seç
        {screenCols * screenRows > 1 ? " · kesik çizgi = ekran çerçevesi" : ""}
      </p>
    </div>
  );
}
