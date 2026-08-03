"use client";

/**
 * FlowSign yerleşim editörü — self-host kopyası. Fiziksel ekran ızgarası
 * (cols×rows) üstünde: hücrelere SÜRÜKLE → alanları birleştir; alana TIKLA → seç.
 * Pointer-capture + koordinat matematiği (fare VE dokunmatik). Tek fark:
 * Cloudinary boyutlandırma yok — görsel yerel yolundan olduğu gibi gösterilir,
 * video minyatürü 🎬 yer tutucudur.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { watchWall } from "@/lib/client";
import { CellBox, contentZonesIn, itemInWindow, layoutColsOf, layoutRowsOf, mergeCells, normalizeGrid, zoneCells, ZONE_BG_DEFAULT, snapBoxToZones } from "@/lib/zones";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

/**
 * Alan önizleme arka planı — ilk öğenin gerçek gösterimi (perde ile birebir:
 * içerik alana STRETCH edilir → editörde ne görüyorsan duvarda o).
 */
/**
 * Bağlı ekranın editördeki minyatürü — o ekranın YAYINI, kendi alanlarıyla.
 *
 * `WallThumb` yeniden kullanılmadı: o, liste kartı estetiği için en-boy oranını
 * 1.6–2.2'ye sıkıştırıyor; burada minyatür ALANIN kendi şekline uymalı, yoksa
 * editörde gördüğün oran perdedekiyle tutmaz.
 *
 * Yalnız `live` çizilir — perde de öyle yapıyor (delege edilen kişinin
 * yayınlamadığı taslağı senin tuvaline düşürmeyiz).
 */
function GomuluOnizleme({ screenId }: { screenId: string }) {
  const [vw, setVw] = useState<Videowall | null>(null);
  useEffect(() => watchWall(screenId, setVw), [screenId]);
  const stage = vw?.live ?? null;
  if (!stage?.zones?.length)
    return (
      <div className="absolute inset-0 grid place-items-center bg-black/40 text-white/45 text-[10px] text-center px-1 leading-tight">
        <span className="truncate max-w-full">{vw ? "henüz yayınlanmamış" : "bağlı ekran"}</span>
      </div>
    );
  return (
    <div className="absolute inset-0">
      {stage.zones.map((z) => (
        <div
          key={z.id}
          className="absolute overflow-hidden"
          style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, background: z.bg ?? ZONE_BG_DEFAULT }}
        >
          <ZonePreview item={z.items?.[0]} ic />
        </div>
      ))}
    </div>
  );
}
function ZonePreview({ item, ic = false }: { item?: ZoneItem; ic?: boolean }) {
  if (!item) return null;
  if (item.kind === "screen")
    // Bağlı ekran: minyatürü GERÇEKTEN çizilir — eskiden bu içerik URL öğesi
    // olarak eklendiği için editörde canlı görünüyordu; statik bir etikete
    // düşürmek geriye gidiş olurdu. `ic` bayrağı bir kat sonra durur: gömülü
    // ekranın içindeki gömülü ekran yeniden çizilmez (sonsuz iniş yok).
    return item.screenId && !ic ? (
      <GomuluOnizleme screenId={item.screenId} />
    ) : (
      <div className="absolute inset-0 grid place-items-center bg-black/40 text-white/70 text-[10px] text-center px-1 leading-tight">
        <span className="truncate max-w-full">▣ {item.name || "bağlı ekran"}</span>
      </div>
    );
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.src} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} />;
  if (item.kind === "video" && item.src) {
    return <div className="absolute inset-0 grid place-items-center bg-black/40 text-lg">🎬</div>;
  }
  // METİN ve SAAT: eskiden yalnız RENKLİ BİR DİKDÖRTGEN çiziliyordu (saat için
  // 🕐 emojisi). Kullanıcı haklı olarak "yerleşimde görünmüyor" dedi: alanda ne
  // yazdığını görmeden tasarım yapılamıyor, üstelik liste kartındaki minyatür
  // (WallThumb) metnin başlığını ZATEN gösteriyordu — iki yüzey ayrışmıştı.
  // Artık ikisi de gerçek içeriğini gösterir; boyut alana göre (cqmin).
  if (item.kind === "text")
    return (
      <div
        className="absolute inset-0 grid place-items-center px-1 text-center"
        style={{ background: item.bg ?? "#312e81", color: item.color ?? "#ffffff", containerType: "size" }}
      >
        <span className="font-bold leading-tight line-clamp-3" style={{ fontSize: "min(11cqw, 22cqh)" }}>
          {item.title || item.text || "Metin"}
        </span>
      </div>
    );
  if (item.kind === "clock")
    return (
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ background: item.bg ?? "#0d102f", color: item.color ?? "#ffffff", containerType: "size" }}
      >
        <span className="font-bold tabular-nums leading-none" style={{ fontSize: "min(20cqw, 34cqh)" }}>
          {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
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

/** Dönen önizlemenin üst katmanı — alanın KENDİ geçişiyle girer. */
function GecisliKare({ item, gecis }: { item: ZoneItem; gecis: "fade" | "cut" | "slide" }) {
  const [on, setOn] = useState(gecis === "cut");
  useEffect(() => {
    if (gecis === "cut") {
      setOn(true);
      return;
    }
    setOn(false);
    const t = window.setTimeout(() => setOn(true), 30);
    return () => window.clearTimeout(t);
  }, [item.id, gecis]);
  const st: React.CSSProperties =
    gecis === "slide"
      ? { transform: on ? "translateX(0)" : "translateX(100%)", transition: "transform 550ms ease" }
      : gecis === "cut"
        ? {}
        : { opacity: on ? 1 : 0, transition: "opacity 500ms ease" };
  return (
    <span className="absolute inset-0 overflow-hidden" style={st}>
      <ZonePreview item={item} />
    </span>
  );
}

/**
 * Alanda 2+ içerik varsa önizleme YAVAŞÇA DÖNER (8 sn).
 *
 * 8 saniye: ilk deneme 3 sn'ydi ve tuvalde sürekli hareket rahatsız ediciydi
 * (kullanıcı). 8, ürünün varsayılan gösterim süresiyle de aynı — önizlemenin
 * temposu perdenin temposuna benziyor.
 *
 * İki işi birden yapıyor:
 *  1. Alanın birden fazla içeriği olduğu tek bakışta görünür (rozetteki sayıyı
 *     okumaya gerek kalmaz).
 *  2. Önizleme DÜRÜST olur. Eskiden hep `items[0]` çiziliyordu; perde ise
 *     takvime uyan ilk öğeyi oynatıyor. İlk öğe takvimliyse editör, ekranda o an
 *     olmayan bir şeyi gösteriyordu. Burada da takvim süzgeci uygulanıyor.
 *
 * Sıralar KAYDIRILARAK başlar (alan sırası kadar gecikme): yedi alan aynı anda
 * değişince tuval yanıp sönüyor gibi duruyordu. Hareket azaltma tercihine
 * saygılıdır — o durumda hiç dönmez.
 */
function ZoneDoner({ items, sira, gecis }: { items: ZoneItem[]; sira: number; gecis: "fade" | "cut" | "slide" }) {
  // Takvim süzgeci dakikada bir tazelenir: "14:00'te düşecek" öğe editörde de
  // o dakikada düşsün, sayfa yenilenmeyi beklemesin.
  const [dakika, setDakika] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => setDakika((d) => d + 1), 60_000);
    return () => window.clearInterval(iv);
  }, []);
  const gosterilecek = useMemo(() => {
    const simdi = new Date();
    const uygun = items.filter((it) => itemInWindow(it, simdi));
    return uygun.length ? uygun : items.slice(0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, dakika]);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (gosterilecek.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let iv = 0;
    const bas = window.setTimeout(() => {
      iv = window.setInterval(() => setI((n) => n + 1), 8000);
    }, (sira % 4) * 500);
    return () => {
      window.clearTimeout(bas);
      window.clearInterval(iv);
    };
  }, [gosterilecek.length, sira]);

  if (!gosterilecek.length) return null;
  const simdiki = gosterilecek[i % gosterilecek.length];
  // Alttaki katman ÖNCEKİ öğe: yumuşama/kaydırma boşluğa değil, gerçekten
  // değişen içeriğin üstüne uygulanıyor — perdede olan da bu.
  const onceki = i > 0 && gosterilecek.length > 1 ? gosterilecek[(i - 1) % gosterilecek.length] : undefined;
  return (
    <>
      {onceki && <ZonePreview item={onceki} />}
      <GecisliKare key={simdiki.id + i} item={simdiki} gecis={gecis} />
    </>
  );
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
  // Sürükleme/birleştirme YERLEŞİM ızgarasında; fiziksel ızgara yalnız çerçeve
  // (bezel) çizgisi — tek TV'yi 3 alana bölmek bu yüzden mümkün.
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
  const seciliAlan = (vw.zones ?? []).find((z) => z.id === selectedId) ?? null;
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
              <ZoneDoner items={z.items} sira={i} gecis={z.transition ?? "fade"} />
              <span className="relative z-[1] text-white text-[11px] font-semibold leading-tight pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {z.name || `Alan ${i + 1}`}
                {z.items.length > 0 && <span className="block text-white/70 font-normal">{z.items.length} içerik</span>}
              </span>
            </div>
          );
        })}

        {/* KENAR TUTAMAKLARI — TUVAL SEVİYESİNDE, alanın içinde DEĞİL.
            İlk deneme tutamakları alanın içine koymuştu: alanda `overflow-hidden`
            olduğu için 8px'lik şerit tamamen içeride kalıyor, saydam duruyor ve
            yalnız üzerine tam gelince beliriyordu — kullanıcı "hiç çıkmıyor"
            dedi, haklıydı. Burada sınırın ÜSTÜNE binebiliyor, kırpılmıyor ve
            seçili alanda GÖRÜNÜR bir tutamak çiziliyor. */}
        {seciliAlan && onResize &&
          ([
            { e: "l", göster: seciliAlan.x > 0.001, dikey: true, konum: { left: `${seciliAlan.x * 100}%`, top: `${seciliAlan.y * 100}%`, height: `${seciliAlan.h * 100}%` } },
            { e: "r", göster: seciliAlan.x + seciliAlan.w < 0.999, dikey: true, konum: { left: `${(seciliAlan.x + seciliAlan.w) * 100}%`, top: `${seciliAlan.y * 100}%`, height: `${seciliAlan.h * 100}%` } },
            { e: "t", göster: seciliAlan.y > 0.001, dikey: false, konum: { top: `${seciliAlan.y * 100}%`, left: `${seciliAlan.x * 100}%`, width: `${seciliAlan.w * 100}%` } },
            { e: "b", göster: seciliAlan.y + seciliAlan.h < 0.999, dikey: false, konum: { top: `${(seciliAlan.y + seciliAlan.h) * 100}%`, left: `${seciliAlan.x * 100}%`, width: `${seciliAlan.w * 100}%` } },
          ] as const)
            .filter((h) => h.göster)
            .map((h) => (
              <span
                key={h.e}
                role="separator"
                aria-label="Kenarı çek"
                title="Kenarı çekerek oranı değiştir"
                className={`absolute z-[35] grid place-items-center touch-none ${
                  h.dikey ? "w-4 -translate-x-1/2 cursor-col-resize" : "h-4 -translate-y-1/2 cursor-row-resize"
                }`}
                style={h.konum}
                onPointerDown={(ev) => {
                  ev.stopPropagation(); // tuvalin birleştirme sürüklemesi tetiklenmesin
                  ev.preventDefault();
                  (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                  setCek({
                    zoneId: seciliAlan.id,
                    edge: h.e,
                    oran: h.e === "l" ? seciliAlan.x : h.e === "r" ? seciliAlan.x + seciliAlan.w : h.e === "t" ? seciliAlan.y : seciliAlan.y + seciliAlan.h,
                  });
                }}
                onPointerMove={(ev) => {
                  if (!cek || cek.edge !== h.e) return;
                  const r = gridRef.current?.getBoundingClientRect();
                  if (!r) return;
                  const o = h.dikey ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height;
                  setCek({ ...cek, oran: Math.max(0.02, Math.min(0.98, o)) });
                }}
                onPointerUp={() => {
                  if (cek && cek.edge === h.e) onResize(cek.zoneId, cek.edge, cek.oran);
                  setCek(null);
                }}
                onPointerCancel={() => setCek(null)}
              >
                {/* Görünür tutamak: seçili alanın kenarında duran kısa çubuk. */}
                <span
                  className={`rounded-full bg-accent ring-2 ring-white/70 pointer-events-none ${
                    h.dikey ? "w-1.5 h-10" : "h-1.5 w-10"
                  }`}
                />
              </span>
            ))}

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
