"use client";

/**
 * FlowSign yerleşim editörü (v2). Fiziksel ekran ızgarası (cols×rows) üstünde:
 *  - hücrelere SÜRÜKLE → dikdörtgen alanları birleştir
 *  - alana TIKLA → seç (içerik/böl/sığdır paneli için)
 * Alanlar oransal (0–1) saklanır → yayın perdesi çözünürlükten bağımsız böler.
 */
import { useEffect, useRef, useState } from "react";
import { cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { CellBox, mergeCells, zoneCells } from "@/lib/videowalls";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

/** Alan önizleme arka planı — ilk öğenin küçük gösterimi. */
function ZonePreview({ item }: { item?: ZoneItem }) {
  if (!item) return null;
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cldThumb(item.src, 240, 240)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />;
  if (item.kind === "video" && item.src) {
    const poster = cldVideoPoster(item.src, 240, 240);
    // eslint-disable-next-line @next/next/no-img-element
    return poster ? <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" /> : <div className="absolute inset-0 grid place-items-center bg-black/40 text-lg">🎬</div>;
  }
  if (item.kind === "text") return <div className="absolute inset-0" style={{ background: item.bg ?? "#0c3b3b", opacity: 0.85 }} />;
  if (item.kind === "clock") return <div className="absolute inset-0 grid place-items-center text-lg" style={{ background: item.bg ?? "#041a1a" }}>🕐</div>;
  if (item.kind === "url") return <div className="absolute inset-0 grid place-items-center bg-black/40 text-lg">🔗</div>;
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
}: {
  vw: Videowall;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onZones: (zones: Zone[]) => void;
}) {
  const { cols, rows } = vw;
  const [drag, setDrag] = useState<{ anchor: Cell; hover: Cell } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // Hangi hücre hangi alana ait? (tıklamada alanı bul)
  const owner = new Map<string, Zone>();
  for (const z of vw.zones ?? []) {
    const cb = zoneCells(z, cols, rows);
    for (let r = cb.r0; r <= cb.r1; r++) for (let c = cb.c0; c <= cb.c1; c++) owner.set(`${c},${r}`, z);
  }

  // Pointer serbest bırakıldığında (dışarıda bile) işlemi bitir.
  useEffect(() => {
    function up() {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      if (d.anchor.c === d.hover.c && d.anchor.r === d.hover.r) {
        onSelect(owner.get(`${d.anchor.c},${d.anchor.r}`)?.id ?? null);
      } else {
        onZones(mergeCells(vw.zones ?? [], cols, rows, boxOf(d.anchor, d.hover)));
        onSelect(null);
      }
    }
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vw.zones, cols, rows]);

  const selBox = drag ? boxOf(drag.anchor, drag.hover) : null;
  const inSel = (c: number, r: number) => selBox && c >= selBox.c0 && c <= selBox.c1 && r >= selBox.r0 && r <= selBox.r1;

  const aspect = vw.width / vw.height;

  return (
    <div>
      <div
        className="relative mx-auto bg-black rounded-lg overflow-hidden border border-white/15 select-none touch-none"
        style={{ width: "100%", maxWidth: aspect >= 1 ? 900 : 900 * aspect, aspectRatio: `${vw.width} / ${vw.height}` }}
      >
        {/* Alanlar (görsel) */}
        {(vw.zones ?? []).map((z, i) => {
          const sel = z.id === selectedId;
          return (
            <div
              key={z.id}
              className={`absolute overflow-hidden grid place-items-center text-center px-1 ${
                sel ? "ring-2 ring-[#2dd4bf] z-10" : "border border-[#2dd4bf]/40"
              } ${z.items.length ? "" : "bg-[#2dd4bf]/5"}`}
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

        {/* Fiziksel ekran çizgileri */}
        {Array.from({ length: cols - 1 }).map((_, i) => (
          <div key={`c${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-white/25 pointer-events-none z-20" style={{ left: `${((i + 1) / cols) * 100}%` }} />
        ))}
        {Array.from({ length: rows - 1 }).map((_, i) => (
          <div key={`r${i}`} className="absolute left-0 right-0 border-t border-dashed border-white/25 pointer-events-none z-20" style={{ top: `${((i + 1) / rows) * 100}%` }} />
        ))}

        {/* Hücre etkileşim katmanı (üstte, tüm tıklama/sürükleme burada) */}
        <div className="absolute inset-0 z-30 grid" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${rows},1fr)` }}>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <div
                key={`${c},${r}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDrag({ anchor: { c, r }, hover: { c, r } });
                }}
                onPointerEnter={() => setDrag((d) => (d ? { ...d, hover: { c, r } } : d))}
                className={inSel(c, r) ? "bg-white/25" : "hover:bg-white/5"}
              />
            ))
          )}
        </div>
      </div>
      <p className="text-white/45 text-xs mt-3">
        Hücrelere <b>sürükle</b> → alanları birleştir · alana <b>tıkla</b> → seç (içerik ekle / böl).
      </p>
    </div>
  );
}
