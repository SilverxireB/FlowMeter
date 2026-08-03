/**
 * SIGN EŞİTLİK SINAVI — `node tests/sign-esitlik.test.mjs`
 *
 * Sign iki yerde yaşıyor: online (`src/`) ve müşteriye teslim edilen self-host
 * paketi (`flowsign-selfhost/`). Kural, ürün davranışı değişince İKİSİNİN de
 * güncellenmesi. Pratikte bu kural elle tutuluyordu ve tutmadı:
 *
 *  - "Ekran bağla" düğmesi self-host'a hiç eklenmemişti; seçici penceresi
 *    oradaydı ama onu AÇAN düğme yoktu — özellik ulaşılamaz durumdaydı.
 *  - Bağlı ekranın editör önizlemesi self-host'ta hiç yoktu (alan boş görünürdü).
 *  - İkon seti ayrışmıştı (biri SVG, diğeri emoji).
 *
 * Hiçbiri derlemeyi kırmıyor; yalnızca self-host müşterisi eksik ürün alıyor.
 * Bu sınav, ürünün ayırt edici izlerini iki ağaçta da arar.
 */
import fs from "node:fs";

const IZLER = [
  ["gömülü ekran çizimi", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "function GomuluEkran"],
  ["döngü koruması", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "zincirKey"],
  ["yalnız yayın çizilir", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "vw?.live ?? null"],
  ["önden indirme disiplini", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", 'preload={designPx.w >= 900'],
  ["eski gömme linklerini tanıma", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "gomuluHedef"],
  ["editör minyatürü", "src/components/videowall/LayoutEditor.tsx", "flowsign-selfhost/src/components/LayoutEditor.tsx", "GomuluOnizleme"],
  ["metin önizlemesi", "src/components/videowall/LayoutEditor.tsx", "flowsign-selfhost/src/components/LayoutEditor.tsx", "11cqw"],
  ["saat önizlemesi", "src/components/videowall/LayoutEditor.tsx", "flowsign-selfhost/src/components/LayoutEditor.tsx", "toLocaleTimeString"],
  ["Ekran bağla düğmesi", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", 'label: "Ekran"'],
  ["ekran seçici penceresi", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "EKRAN SEÇİCİ"],
  ["içerik düğmeleri SVG ikon", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "icon: IconName"],
  ["screen öğe tipi", "src/lib/types.ts", "flowsign-selfhost/src/lib/types.ts", 'clock" | "screen"'],
  ["screenId alanı", "src/lib/types.ts", "flowsign-selfhost/src/lib/types.ts", "screenId?: string"],
  ["adres tanıyıcı", "src/lib/videowalls.ts", "flowsign-selfhost/src/lib/zones.ts", "function signAdresi"],
  ["toplam yayın süresi", "src/lib/types.ts", "flowsign-selfhost/src/lib/types.ts", "totalMs"],
  ["ekran süre sütunu", "src/components/videowall/ScreensCard.tsx", "flowsign-selfhost/src/components/ScreensCard.tsx", "function sure"],
  ["rehber çekmecesi", "src/components/Rehber.tsx", "flowsign-selfhost/src/components/Rehber.tsx", "rehber-yazdir"],
  ["rehber yapı taşları", "src/components/RehberParcalari.tsx", "flowsign-selfhost/src/components/RehberParcalari.tsx", "export function Dugme"],
  ["rehberde Ekran türü", "src/components/videowall/signRehberIcerik.tsx", "flowsign-selfhost/src/components/signRehberIcerik.tsx", "başkasına yönettirmenin yolu"],
  ["yazdırma düzeni", "src/styles/globals.css", "flowsign-selfhost/src/styles/globals.css", "rehber-yazdir"],
  ["boş alanda logo (yazı değil)", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "function BosAlan"],
  ["dikey duvar kartta doğru oranda", "src/components/videowall/WallThumb.tsx", "flowsign-selfhost/src/components/WallThumb.tsx", 'aspectRatio: "1.6"'],
  ["yayınlanmamış çipi", "src/app/videowall/page.tsx", "flowsign-selfhost/src/app/screens/page.tsx", "henüz yayınlanmamış"],
  ["yayın öncesi boş alan özeti", "src/app/videowall/[id]/edit/page.tsx", "flowsign-selfhost/src/app/screens/[id]/edit/page.tsx", "alan boş"],
  ["bağlı ekran kayıpsa uyarı", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "bağlı ekran bulunamadı"],
  ["takvim durumu ayrımı", "src/lib/videowalls.ts", "flowsign-selfhost/src/lib/zones.ts", "itemTakvimDurumu"],
  ["süresi doldu rozeti", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "süresi doldu"],
  ["mobilde rozet kırılmaz", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "truncate max-w-full shrink-0"],
  ["mobilde ad kendi satırında", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "order-last basis-full"],
];

const oku = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);

let hata = 0;
for (const [ad, onlineYol, selfYol, iz] of IZLER) {
  const o = oku(onlineYol);
  const s = oku(selfYol);
  const durum = o === null ? "online dosya YOK" : s === null ? "self-host dosya YOK" : !o.includes(iz) ? "online'da iz yok" : !s.includes(iz) ? "SELF-HOST'ta eksik" : null;
  if (durum) hata++;
  console.log(`${durum ? "✗" : "✓"} ${ad}${durum ? ` — ${durum}` : ""}`);
}

// İkon seti: self-host, online'da kullanılan her ikonu tanımalı.
const online = oku("src/components/Icon.tsx") ?? "";
const self = oku("flowsign-selfhost/src/components/icons.tsx") ?? "";
const selfAdlar = new Set([...self.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
const signDosyalari = [
  "flowsign-selfhost/src/components/ZonePanel.tsx",
  "flowsign-selfhost/src/components/LayoutEditor.tsx",
  "flowsign-selfhost/src/components/ScreensCard.tsx",
  "flowsign-selfhost/src/components/Rehber.tsx",
  "flowsign-selfhost/src/components/RehberParcalari.tsx",
  "flowsign-selfhost/src/components/signRehberIcerik.tsx",
];
const kullanilan = new Set();
for (const d of signDosyalari)
  for (const m of (oku(d) ?? "").matchAll(/(?:name|icon)=?[:{]?\s*"([a-z0-9-]+)"/g)) kullanilan.add(m[1]);
const eksikIkon = [...kullanilan].filter((i) => online.includes(`\n  ${i}: `) && !selfAdlar.has(i));
if (eksikIkon.length) hata++;
console.log(`${eksikIkon.length ? "✗" : "✓"} self-host ikon seti eksiksiz${eksikIkon.length ? ` — eksik: ${eksikIkon.join(", ")}` : ""}`);

console.log(hata ? `\n${hata} SINAV BAŞARISIZ — self-host paketi eksik ürün taşıyor` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
