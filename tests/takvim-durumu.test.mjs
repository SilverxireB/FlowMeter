/**
 * Takvim durumu sınavı — `node tests/takvim-durumu.test.mjs`
 *
 * Neden ayrı sınav: "bitiş günü DAHİL" kuralı klasik bir bir-eksik (off-by-one)
 * tuzağı. Yanlış olursa kampanya bir gün erken düşer ya da bir gün fazla döner;
 * ikisi de ekranda hata vermez, kimse fark etmez, ay sonunda "afiş neden hâlâ
 * dönüyor" diye sorulur.
 *
 * Ayrıca `itemTakvimDurumu`, `itemInWindow` ile AYNI kuralı kullanmak zorunda —
 * biri "içinde" derken diğeri "dışında" derse editör ile perde ayrışır. Sınav
 * ikisini birlikte çalıştırır.
 */
import fs from "node:fs";

// İki işlevi de GERÇEK kaynaktan çalıştır (tip notları çıkarılarak).
const src = fs.readFileSync("src/lib/videowalls.ts", "utf8");
const kes = (baslangic, bitis) => src.slice(src.indexOf(baslangic), src.indexOf(bitis));
const kod = (kes("export function itemInWindow", "\n/**\n * Öğe takvimde değilse") + kes("export function itemTakvimDurumu", "\nconst zid ="))
  .replace(/export function itemInWindow[^\n]*\{/, "function itemInWindow(item, now) {")
  .replace(/export function itemTakvimDurumu[^\n]*\{/, "function itemTakvimDurumu(item, now) {")
  .replace(/export type TakvimDurumu[^\n]*\n/, "");
const { itemInWindow, itemTakvimDurumu } = new Function(`${kod}; return { itemInWindow, itemTakvimDurumu };`)();

const gun = (s) => new Date(`${s}T12:00:00`);

const senaryolar = [
  // [öğe, tarih, beklenen durum, açıklama]
  [{}, "2026-08-03", "icinde", "takvimsiz öğe hep döner"],
  [{ fromDate: "2026-08-01", toDate: "2026-08-15" }, "2026-08-03", "icinde", "aralığın ortası"],
  [{ fromDate: "2026-08-01", toDate: "2026-08-15" }, "2026-08-01", "icinde", "BAŞLANGIÇ günü dahil"],
  [{ fromDate: "2026-08-01", toDate: "2026-08-15" }, "2026-08-15", "icinde", "BİTİŞ günü DAHİL (asıl tuzak)"],
  [{ fromDate: "2026-08-01", toDate: "2026-08-15" }, "2026-08-16", "doldu", "bitişin ertesi günü ölü"],
  [{ fromDate: "2026-08-01", toDate: "2026-08-15" }, "2026-07-31", "baslamadi", "başlangıçtan bir gün önce"],
  [{ toDate: "2026-08-02" }, "2026-08-03", "doldu", "yalnız bitiş verilmiş, geçmiş"],
  [{ fromDate: "2026-09-01" }, "2026-08-03", "baslamadi", "yalnız başlangıç verilmiş, gelecek"],
  [{ days: [0] }, "2026-08-03", "disinda", "yalnız pazar — bugün pazartesi"],
  [{ from: "22:00", to: "06:00" }, "2026-08-03", "disinda", "gece penceresi, saat 12'de dışında"],
  // Süresi dolmuş VE gün süzgeci olan öğe: "doldu" kazanmalı, "disinda" değil —
  // kullanıcıya yapılacak işi söyleyen etiket odur (sil).
  [{ toDate: "2026-08-01", days: [0] }, "2026-08-03", "doldu", "hem ölü hem gün dışı → ÖLÜ kazanır"],
];

let hata = 0;
for (const [oge, tarih, bekle, aciklama] of senaryolar) {
  const d = itemTakvimDurumu(oge, gun(tarih));
  const icinde = itemInWindow(oge, gun(tarih));
  const tutarli = (d === "icinde") === icinde; // iki işlev asla ayrışmamalı
  const gecti = d === bekle && tutarli;
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${aciklama} → ${d}${tutarli ? "" : "  ⚠ itemInWindow ile ÇELİŞİYOR"}`);
}

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
