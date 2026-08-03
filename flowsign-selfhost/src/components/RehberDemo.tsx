"use client";

/**
 * Rehberdeki CANLI örnek — ekran görüntüsü değil, yerleşim editörünün KENDİSİ.
 *
 * Neden böyle: ekran görüntüsü çekildiği gün doğrudur, ilk tasarım değişikliğinde
 * yalan söylemeye başlar ve kimse fark etmez. Burada gerçek `LayoutEditor`
 * bellekteki sahte bir ekranla çalışıyor — tuvalin rengi, kesik çerçeve çizgisi,
 * seçim halkası, dönen içerik önizlemesi neyse rehberde de o. Ürün değişince
 * rehber kendiliğinden değişir.
 *
 * Hiçbir yere yazmaz: değişiklikler yalnız bu bileşenin state'inde durur
 * (`saveLayout`/`updateZones` çağrılmaz), ağ isteği yoktur. Öğeler bilerek
 * metin/saat — dış görsel indirmesin.
 */
import { useState } from "react";
import LayoutEditor from "./LayoutEditor";
import { Icon } from "@/components/icons";
import { layoutColsOf, layoutRowsOf, splitZoneInto } from "@/lib/zones";
import { Videowall, Zone } from "@/lib/types";

const BASLANGIC: Zone[] = [
  {
    id: "d1",
    x: 0,
    y: 0,
    w: 2 / 3,
    h: 1,
    name: "Karşılama",
    transition: "fade",
    bg: "#001e64",
    items: [
      { id: "i1", kind: "text", title: "Hoş geldiniz", text: "Giriş Holü", bg: "#001e64", color: "#ffffff", durationSec: 6 },
      { id: "i2", kind: "text", title: "Güvenlik önce", text: "Baret zorunludur", bg: "#312e81", color: "#ffffff", durationSec: 6 },
    ],
  },
  {
    id: "d2",
    x: 2 / 3,
    y: 0,
    w: 1 / 3,
    h: 1,
    name: "Saat",
    transition: "fade",
    bg: "#0d102f",
    items: [{ id: "i3", kind: "clock", bg: "#0d102f", color: "#ffffff" }],
  },
];

const DEMO: Videowall = {
  id: "rehber-demo",
  ownerId: "rehber",
  name: "Giriş Holü",
  width: 3240,
  height: 1920,
  cols: 3,
  rows: 1,
  layoutCols: 3,
  layoutRows: 1,
  zones: BASLANGIC,
  createdAt: null,
};

export default function RehberDemo() {
  const [zones, setZones] = useState<Zone[]>(BASLANGIC);
  const [grid, setGrid] = useState({ cols: 3, rows: 1 });
  const [secili, setSecili] = useState<string | null>("d1");

  const vw: Videowall = { ...DEMO, zones, layoutCols: grid.cols, layoutRows: grid.rows };

  const bol = () => {
    const hedef = secili ?? zones[0]?.id;
    if (!hedef) return;
    const r = splitZoneInto(zones, layoutColsOf(vw), layoutRowsOf(vw), hedef, 1, 2);
    if (!r) return;
    setZones(r.zones);
    setGrid({ cols: r.cols, rows: r.rows });
    setSecili(null);
  };

  const sifirla = () => {
    setZones(BASLANGIC);
    setGrid({ cols: 3, rows: 1 });
    setSecili("d1");
  };

  return (
    <div className="rounded-2xl border border-line bg-paper p-3">
      <LayoutEditor
        vw={vw}
        selectedId={secili}
        onSelect={setSecili}
        onZones={setZones}
        onLayout={(r) => {
          setZones(r.zones);
          setGrid({ cols: r.cols, rows: r.rows });
        }}
        /* Demoda onay sorulmaz: birleştirme burada zaten geri alınabilir. */
        onConfirm={(c) => c.run()}
      />
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={bol} className="rounded-lg bg-white border border-line px-3 py-1.5 text-xs font-semibold hover:border-muted inline-flex items-center gap-1.5">
          <Icon name="split" size={13} /> Seçili alanı alt alta böl
        </button>
        <button onClick={sifirla} className="rounded-lg bg-white border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink hover:border-muted inline-flex items-center gap-1.5">
          <Icon name="undo" size={13} /> Baştan
        </button>
        <span className="text-muted text-[11px]">Burada denediklerin hiçbir yere kaydedilmez.</span>
      </div>
    </div>
  );
}
