/**
 * Türkçe arama sınavı — `node tests/arama.test.mjs`
 *
 * NEDEN: `toLowerCase().includes()` Türkçede SESSİZCE yanlış çalışır.
 * `"İSTANBUL".toLowerCase()` → `"i̇stanbul"` (i + AYRI bir birleşen nokta,
 * U+0307), yani "istanbul" yazan kişi onu bulamaz — ve iki metin ekranda
 * BİREBİR AYNI görünür. Arama sonuç getirmeyince kullanıcı "yok galiba" der,
 * hataya yormaz. Bu yüzden sınav ÇİFT YÖNLÜ: saf yöntemin düştüğü yerleri de
 * ölçer, yoksa "geçti" satırı hiçbir şey kanıtlamaz.
 */
import fs from "node:fs";

const src = fs.readFileSync("src/lib/arama.ts", "utf8");
const kod = src
  .replace(/const TR: Record<string, string> =/, "const TR =")
  .replace(/export function nrm\([^)]*\)[^{]*\{/, "function nrm(s) {")
  .replace(/export function eslesir\([^)]*\)[^{]*\{/, "function eslesir(metin, sorgu) {")
  .replace(/TR\[m\] \?\? m/, "TR[m] ?? m");
const { nrm, eslesir } = new Function(`${kod}; return { nrm, eslesir };`)();

/** Karşılaştırma tabanı: düzeltmeden önceki saf yöntem. */
const saf = (metin, sorgu) => String(metin ?? "").toLowerCase().includes(String(sorgu).toLowerCase());

let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

// ── Eşleşmesi GEREKENLER (gerçek ekran adlarıyla) ───────────────────────────
const bulmali = [
  ["Giriş Ekranları", "giris", "noktalı harf → ASCII"],
  ["GİRİŞ EKRANLARI", "giris", "BÜYÜK İ tuzağı (asıl hata)"],
  ["giriş ekranları", "GIRIS", "kullanıcı büyük I yazdı"],
  ["Üretim Panelleri", "uretim", "Ü → u"],
  ["ÜRETİM PANELLERİ", "URETIM", "hepsi büyük"],
  ["Şoför Ekranı", "sofor", "Ş ve ö"],
  ["Çağrı Merkezi", "cagri", "Ç ve ğ"],
  ["Ağır Bakım", "agir", "ğ ortada"],
  ["montaj2_paneller", "MONTAJ2", "ASCII ad, büyük sorgu"],
  ["AGV_DASH_TTR1", "ttr1", "alt çizgili teknik ad"],
  ["Ambar Panel", "  ambar  ", "sorgunun boşlukları kırpılır"],
  ["Sorter Panel", "", "boş sorgu her şeyi eşler (süzgeç kapalı)"],
  ["Sorter Panel", "   ", "yalnız boşluk da süzgeç kapalı sayılır"],
  ["İç Üretim Gövde", "ic uretim", "iki kelime, ikisi de Türkçe"],
];
for (const [metin, sorgu, aciklama] of bulmali)
  kontrol(eslesir(metin, sorgu) === true, `"${sorgu || "(boş)"}" → "${metin}" bulunur — ${aciklama}`);

// ── Eşleşmemesi gerekenler (arama gerçekten süzüyor mu) ─────────────────────
for (const [metin, sorgu] of [
  ["Ambar Panel", "sorter"],
  ["Giriş Ekranları", "montaj"],
  ["M1_Cycle", "m2"],
])
  kontrol(eslesir(metin, sorgu) === false, `"${sorgu}" → "${metin}" EŞLEŞMEZ`);

// ── Boş/eksik girdi çökertmemeli ────────────────────────────────────────────
kontrol(nrm(null) === "" && nrm(undefined) === "", "null/undefined → boş metin");
kontrol(eslesir(null, "a") === false, "adı olmayan kayıt eşleşmez, çökmez");
kontrol(eslesir(null, "") === true, "boş sorgu adsız kaydı da geçirir");

// ── ÇİFT YÖNLÜ: saf yöntem gerçekten düşüyor mu? ────────────────────────────
// Bu blok olmasaydı yukarıdaki "geçti"ler düzeltmeyi değil, sınavın hiçbir şey
// ölçmediğini gösterirdi.
const safinDustugu = bulmali.filter(([m, q]) => q.trim() && !saf(m, q));
kontrol(
  safinDustugu.length >= 8,
  `saf toLowerCase() bu senaryoların ${safinDustugu.length} tanesinde DÜŞÜYOR (ör. ${safinDustugu
    .slice(0, 3)
    .map(([m, q]) => `"${q}"→"${m}"`)
    .join(", ")})`
);
// İ tuzağı somut olarak: saf yöntemde görünmez bir birleşen karakter kalıyor.
kontrol(
  "İSTANBUL".toLowerCase().includes("istanbul") === false && eslesir("İSTANBUL", "istanbul") === true,
  "İ tuzağı: saf yöntem BULAMIYOR, bizimki buluyor"
);

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
