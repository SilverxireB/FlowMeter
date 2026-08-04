/**
 * Yetki dışa aktarma sınavı — `node tests/yetki-csv.test.mjs`
 *
 * Bu dosya bir DENETİM belgesi olarak veriliyor ("kim hangi ekranda ne
 * yapabiliyor"). Buradaki hatalar dosya açılana kadar görünmez ve en kötüsü
 * SESSİZ olanı: ekran adında noktalı virgül varsa sütunlar kayar, tablo
 * yanlış okunur ama hiçbir yerde hata çıkmaz.
 *
 * Üç şey ölçülüyor:
 *  1. Ayırıcı NOKTALI VİRGÜL — Türkçe Windows'ta Excel'in kolon ayırıcısı budur;
 *     virgülle yazılan dosya tek sütun açılır.
 *  2. BOM var — yoksa Excel'de "Üretim" → "Ãœretim".
 *  3. Kaçış — ayırıcı/tırnak/satır sonu içeren ad tabloyu kaydırmaz.
 */
import fs from "node:fs";

const src = fs.readFileSync("src/lib/yetkiCsv.ts", "utf8");
const kod = src
  .replace(/export interface [\s\S]*?\n\}\n/g, "")
  .replace(/export const CSV_AYIRICI = ";";/, 'const CSV_AYIRICI = ";";')
  .replace(/export function csvAlan\([^)]*\)[^{]*\{/, "function csvAlan(v) {")
  .replace(/export function yetkiCsv\([^)]*\)[^{]*\{/, "function yetkiCsv(satirlar) {")
  .replace(/export function yetkiDosyaAdi\([^)]*\)[^{]*\{/, "function yetkiDosyaAdi(now) {")
  // Tarayıcıya bağımlı indirme işlevi sınava girmez (Blob/DOM yok).
  .replace(/\/\*\* Tarayıcıda indir[\s\S]*$/, "")
  .replace(/const BASLIKLAR = \[/, "const BASLIKLAR = [")
  .replace(/const evetHayir = \(b: boolean\)/, "const evetHayir = (b)")
  .replace(/const tarihYaz = \(ms\?: number\)/, "const tarihYaz = (ms)")
  .replace(/const p = \(n: number\)/, "const p = (n)");
const { yetkiCsv, csvAlan, yetkiDosyaAdi, CSV_AYIRICI } = new Function(
  `${kod}; return { yetkiCsv, csvAlan, yetkiDosyaAdi, CSV_AYIRICI };`
)();

let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

const satir = (o) => ({
  kisi: "Gözde Gül", girisAdi: "gozde", ekran: "Üretim Panelleri",
  view: true, edit: false, copy: false, delete: false, kaynak: "açık kayıt", ...o,
});

// ── 1. Biçim temelleri ──────────────────────────────────────────────────────
const csv = yetkiCsv([satir({}), satir({ kisi: "Ömer Karakoç", ekran: "Giriş_VW1", edit: true })]);
kontrol(csv.charCodeAt(0) === 0xfeff, "BOM ile başlıyor (Excel Türkçe harfleri doğru okusun)");
kontrol(CSV_AYIRICI === ";", "ayırıcı noktalı virgül (Türkçe Excel)");
const satirlar = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
kontrol(csv.includes("\r\n"), "satır sonu CRLF");
kontrol(satirlar.length === 3, `başlık + 2 kayıt = 3 satır (ölçülen ${satirlar.length})`);
kontrol(satirlar[0].startsWith("Kişi;Giriş adı;Ekran;Görüntüle;Düzenle;Kopyala;Sil;"), "başlık satırı beklenen sırada");
kontrol(satirlar[1].split(";")[3] === "Evet" && satirlar[1].split(";")[4] === "Hayır", "tikler Evet/Hayır olarak yazılıyor");

// ── 2. KAÇIŞ — asıl sessiz hata ─────────────────────────────────────────────
// Ekran adında ayırıcı varsa kaçırılmazsa sütunlar KAYAR ve kimse fark etmez.
const zor = yetkiCsv([
  satir({ ekran: "Giriş; ana kapı", kisi: 'Ali "Buğra" Şen' }),
  satir({ ekran: "İki\nsatırlı ad" }),
]);
const zorSatirlar = zor.replace(/^﻿/, "").trimEnd().split("\r\n");
kontrol(zor.includes('"Giriş; ana kapı"'), "ayırıcı içeren ad tırnaklanıyor");
kontrol(zor.includes('"Ali ""Buğra"" Şen"'), "içteki tırnak ikileniyor");
kontrol(zor.includes('"İki\nsatırlı ad"'), "satır sonu içeren ad tırnaklanıyor");
// Kaçış olmasaydı ilk kayıt fazladan bir sütun üretirdi — sütun sayısı sabit kalmalı.
const sutunSay = (s) => {
  let n = 1, ic = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') ic = !ic;
    else if (s[i] === ";" && !ic) n++;
  }
  return n;
};
kontrol(sutunSay(zorSatirlar[0]) === 10 && sutunSay(zorSatirlar[1]) === 10, "zorlu adda da sütun sayısı 10 (kaymıyor)");
kontrol(csvAlan("düz metin") === "düz metin", "sade alan gereksiz yere tırnaklanmıyor");
kontrol(csvAlan(undefined) === "" && csvAlan(null) === "", "boş alan çökertmiyor");

// ── 3. Denetim izi sütunları ────────────────────────────────────────────────
const izli = yetkiCsv([satir({ veren: "ayse", tarih: new Date("2026-08-04T13:49:00").getTime() })]);
kontrol(izli.includes(";ayse;"), "yetkilendiren sütunu yazılıyor");
kontrol(/04\.08\.2026 13:49/.test(izli), "tarih Türkçe biçimde yazılıyor");
kontrol(yetkiCsv([satir({})]).trimEnd().endsWith(";;"), "iz yoksa iki sütun boş kalıyor (uydurma yok)");

// ── 4. Dosya adı sıralanabilir olmalı ───────────────────────────────────────
kontrol(
  yetkiDosyaAdi(new Date("2026-08-04T10:00:00")) === "sign-yetkileri-2026-08-04.csv",
  `dosya adı: ${yetkiDosyaAdi(new Date("2026-08-04T10:00:00"))}`
);
kontrol(
  yetkiDosyaAdi(new Date("2026-01-09T10:00:00")) === "sign-yetkileri-2026-01-09.csv",
  "tek haneli ay/gün sıfırla dolduruluyor (alfabetik sıra = tarih sırası)"
);

// ── 5. Boş liste ────────────────────────────────────────────────────────────
const bos = yetkiCsv([]);
kontrol(bos.replace(/^﻿/, "").trimEnd().split("\r\n").length === 1, "kayıt yoksa yalnız başlık satırı (dosya yine geçerli)");

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
