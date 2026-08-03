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
import { CellBox, contentZonesIn, layoutColsOf, layoutRowsOf, mergeCells, normalizeGrid, zoneCells, ZONE_BG_DEFAULT, snapBoxToZones } from "@/lib/videowalls";
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
  onLayout,
  onResize,
  onConfirm,
}: {
  vw: Videowall;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onZones: (zones: Zone[]) => void;
  /** Birleştirme ızgarayı da sadeleştirir — ızgara + alanlar TEK yazımda. */
  onLayout?: (r: { zones: Zone[]; cols: number; rows: number }) => void;
  /** Kenar çekme: iki komşunun paylaştığı sınırı oransal konuma taşı. */
  onResize?: (zoneId: string, edge: "l" | "r" | "t" | "b", oran: number) => void;
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
  // Kenar çekme: sürüklerken YALNIZ kılavuz çizgi oynar, yazım bırakınca
  // yapılır — her fare hareketinde Firestore'a yazmak kotayı da ekranı da yorar.
  const [cek, setCek] = useState<{ zoneId: string; edge: "l" | "r" | "t" | "b"; oran: number } | null>(null);
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
    // Kutu, dokundugu alanlari TAMAMEN kapsayacak sekilde buyutulur: kismi
    // kesisme kalmayinca birlestirme artik hicbir alani parcalamaz.
    const box = snapBoxToZones(vw.zones ?? [], cols, rows, boxOf(d.anchor, d.hover));
    const doMerge = () => {
      // Birleştirmeden SONRA ızgara sadeleştirilir. Eskiden yalnız alanlar
      // yazılıyor, layoutCols/layoutRows olduğu gibi kalıyordu: bölme ızgarayı
      // katlıyor ama hiçbir şey küçültmüyordu (tek yönlü mandal). Bu yüzden
      // "önce birkaç parçayı birleştir" tavsiyesi de işe yaramıyordu — kullanıcı
      // ne kadar birleştirse aynı duvara tosluyordu.
      const birlesmis = mergeCells(vw.zones ?? [], cols, rows, box);
      const sade = normalizeGrid(birlesmis, cols, rows);
      if (onLayout && sade) onLayout(sade);
      else onZones(birlesmis);
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

  // Onizleme de kilitli kutuyu gosterir — ne birlesecegi surukleerken gorunur.
  const selBox = drag ? snapBoxToZones(vw.zones ?? [], cols, rows, boxOf(drag.anchor, drag.hover)) : null;
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
                sel ? "ring-2 ring-accent z-10" : "border border-accent/40"
              } ${z.items.length ? "" : "bg-accent/5"}`}
              /* Alan zemini önizlemede de görünür: kullanıcı renk seçiyor ama
                 editörde hiçbir şey değişmiyordu (perde ve liste minyatürü
                 z.bg'yi çiziyor, yalnız burası çizmiyordu). */
              style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, background: z.bg ?? undefined }}
            >
              <ZonePreview item={z.items[0]} />
              {/* KENAR TUTAMAKLARI — yalnız seçili alanda ve yalnız duvarın DIŞ
                  kenarı olmayan yönlerde. Bölme yalnız eşit parça verdiği için
                  70/30 gibi bir yerleşim başka türlü kurulamıyordu. */}
              {sel && onResize && (
                <>
                  {([
                    { e: "l", göster: z.x > 0.001, cls: "left-0 top-0 h-full w-2 cursor-col-resize" },
                    { e: "r", göster: z.x + z.w < 0.999, cls: "right-0 top-0 h-full w-2 cursor-col-resize" },
                    { e: "t", göster: z.y > 0.001, cls: "top-0 left-0 w-full h-2 cursor-row-resize" },
                    { e: "b", göster: z.y + z.h < 0.999, cls: "bottom-0 left-0 w-full h-2 cursor-row-resize" },
                  ] as const)
                    .filter((h) => h.göster)
                    .map((h) => (
                      <span
                        key={h.e}
                        role="separator"
                        aria-label="Kenarı çek"
                        className={`absolute z-[30] ${h.cls} bg-accent/0 hover:bg-accent/40 touch-none`}
                        onPointerDown={(ev) => {
                          // Tuvalin birleştirme sürüklemesi TETİKLENMESİN.
                          ev.stopPropagation();
                          ev.preventDefault();
                          (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
                          setCek({ zoneId: z.id, edge: h.e, oran: h.e === "l" ? z.x : h.e === "r" ? z.x + z.w : h.e === "t" ? z.y : z.y + z.h });
                        }}
                        onPointerMove={(ev) => {
                          if (!cek || cek.zoneId !== z.id || cek.edge !== h.e) return;
                          const r = gridRef.current?.getBoundingClientRect();
                          if (!r) return;
                          const dikey = h.e === "l" || h.e === "r";
                          const o = dikey ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height;
                          setCek({ ...cek, oran: Math.max(0.02, Math.min(0.98, o)) });
                        }}
                        onPointerUp={() => {
                          if (cek && cek.zoneId === z.id && cek.edge === h.e) onResize(cek.zoneId, cek.edge, cek.oran);
                          setCek(null);
                        }}
                        onPointerCancel={() => setCek(null)}
                      />
                    ))}
                </>
              )}
              <span className="relative z-[1] text-white text-[11px] font-semibold leading-tight pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {z.name || `Alan ${i + 1}`}
                {z.items.length > 0 && <span className="block text-white/70 font-normal">{z.items.length} içerik</span>}
              </span>
            </div>
          );
        })}

        {/* Çekme kılavuzu — bırakınca uygulanacak sınır */}
        {cek && (
          <div
            className="absolute z-[28] bg-accent pointer-events-none"
            style={
              cek.edge === "l" || cek.edge === "r"
                ? { left: `${cek.oran * 100}%`, top: 0, bottom: 0, width: 2 }
                : { top: `${cek.oran * 100}%`, left: 0, right: 0, height: 2 }
            }
          />
        )}

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
            className="absolute z-[25] bg-accent/20 border-2 border-accent pointer-events-none"
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
        <b>Tıkla</b> → seç · <b>kenarından çek</b> → oranı değiştir · <b>sürükle</b> → birleştir
        {screenCols * screenRows > 1 ? " · kesik çizgi = ekran çerçevesi" : ""}
      </p>
    </div>
  );
}
