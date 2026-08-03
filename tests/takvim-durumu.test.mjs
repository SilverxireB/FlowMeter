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


// ── SÜZGEÇ KOMBİNASYONLARI ───────────────────────────────────────────────────
// Rehberde yazılı davranışın kaynağı burasıdır. Üç süzgeç (tarih · gün · saat)
// bağımsızdır ve HEPSİ birden tutmalıdır; boş bırakılan hiç kısıtlamaz.
// Kullanıcı bunları tek tek sordu; cevap tahminle değil ölçümle verildi ve
// buraya kilitlendi — biri "iyileştirirken" sessizce değiştirmesin.
const an = (gun, saat) => new Date(`${gun}T${saat}:00`);
const kombinasyonlar = [
  ["hiçbir süzgeç yok", {}, "2026-08-03", "03:00", true],
  ["yalnız saat başlangıcı 09:00 → gece yarısına kadar", { from: "09:00" }, "2026-08-03", "23:50", true],
  ["yalnız saat başlangıcı 09:00 → öncesinde dönmez", { from: "09:00" }, "2026-08-03", "08:59", false],
  ["yalnız saat bitişi 17:00 → gece yarısından başlar", { to: "17:00" }, "2026-08-03", "00:10", true],
  ["yalnız saat bitişi 17:00 → sonrasında dönmez", { to: "17:00" }, "2026-08-03", "17:30", false],
  ["gece aşan 22:00–06:00 → akşam", { from: "22:00", to: "06:00" }, "2026-08-03", "23:00", true],
  ["gece aşan 22:00–06:00 → ertesi sabah", { from: "22:00", to: "06:00" }, "2026-08-04", "02:00", true],
  ["gece aşan 22:00–06:00 → gündüz dönmez", { from: "22:00", to: "06:00" }, "2026-08-03", "12:00", false],
  // REHBERDEKİ UYARININ KAYNAĞI: gün süzgeci O ANKİ güne bakar.
  ["PZT + 22:00–06:00 → pazartesi gecesi döner", { days: [1], from: "22:00", to: "06:00" }, "2026-08-03", "23:00", true],
  ["PZT + 22:00–06:00 → SALI 02:00'de DÖNMEZ", { days: [1], from: "22:00", to: "06:00" }, "2026-08-04", "02:00", false],
  // İKİNCİ UYARI: aynı saati iki yana yazmak tek dakikaya indirir.
  ["10:00–10:00 → yalnız o dakika", { from: "10:00", to: "10:00" }, "2026-08-03", "10:00", true],
  ["10:00–10:00 → bir dakika sonra dönmez", { from: "10:00", to: "10:00" }, "2026-08-03", "10:01", false],
  ["yalnız başlangıç tarihi → sonrasında süresiz", { fromDate: "2026-08-05" }, "2027-01-01", "12:00", true],
  ["yalnız bitiş tarihi → o gün DAHİL", { toDate: "2026-08-05" }, "2026-08-05", "23:00", true],
  ["yalnız bitiş tarihi → ertesi gün düşer", { toDate: "2026-08-05" }, "2026-08-06", "00:01", false],
  ["üçü birden tutuyor", { fromDate: "2026-08-01", toDate: "2026-08-15", days: [1], from: "09:00", to: "17:00" }, "2026-08-03", "10:00", true],
  ["üçü birden — gün tutmuyor", { fromDate: "2026-08-01", toDate: "2026-08-15", days: [1], from: "09:00", to: "17:00" }, "2026-08-04", "10:00", false],
  ["üçü birden — saat tutmuyor", { fromDate: "2026-08-01", toDate: "2026-08-15", days: [1], from: "09:00", to: "17:00" }, "2026-08-03", "18:00", false],
];
for (const [aciklama, oge, gun, saat, bekle] of kombinasyonlar) {
  const c = itemInWindow(oge, an(gun, saat));
  const gecti = c === bekle;
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${aciklama} → ${c ? "döner" : "dönmez"}`);
}

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
