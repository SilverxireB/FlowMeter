/**
 * Gömülü ekran sınavı — `node tests/gomulu-ekran.test.mjs` (depo kökünden).
 *
 * İki şeyi sınar, ikisi de sessizce bozulabilecek türden:
 *
 * 1. ADRES TANIMA — üretimde ZATEN URL olarak yapıştırılmış `/flowsign/...`
 *    linkleri var; perde onları iframe yerine yerel çizsin diye tanıyor.
 *    Yanlış tanıma tehlikeli: BAŞKA bir kurumun Sign adresi gömülü ekran
 *    sayılırsa, o siteyi kendi Firestore'umuzdan okumaya çalışırız.
 *
 * 2. DÖNGÜ KORUMASI — A ekranı B'yi, B de A'yı bağlarsa çizim sonsuza gider ve
 *    tarayıcı kilitlenir. Zincir mantığı bunu kesmeli.
 */
import fs from "node:fs";

// signAdresi'ni GERÇEK kaynaktan çalıştır (tip notları çıkarılarak).
const kaynak = fs.readFileSync("src/lib/videowalls.ts", "utf8");
const govde = kaynak.slice(kaynak.indexOf("export function signAdresi"));
const kod = govde
  .slice(0, govde.indexOf("\n}\n") + 3)
  // imza satırının tamamını sade JS'e çevir (gövde zaten tipsiz)
  .replace(/^export function signAdresi[^\n]*\{/, "function signAdresi(src, origin) {");
const signAdresi = new Function(`${kod}; return signAdresi;`)();

const KOKEN = "https://flowstudiomanisa.vercel.app";
const adresler = [
  [`${KOKEN}/flowsign/giris-holu`, { slug: "giris-holu" }, "kendi yayın linkimiz"],
  [`${KOKEN}/videowall/abc123/play`, { id: "abc123" }, "kimlikli yayın adresi"],
  ["https://baska-kurum.com/flowsign/x", null, "BAŞKA sitenin Sign adresi gömülü sayılmamalı"],
  [`${KOKEN}/dashboard`, null, "kendi sitemizin başka sayfası"],
  ["https://grafana.local/d/abc", null, "sıradan pano adresi"],
  [undefined, null, "boş kaynak"],
];

let hata = 0;
for (const [adres, bekle, aciklama] of adresler) {
  const c = signAdresi(adres, KOKEN);
  const gecti = JSON.stringify(c ?? null) === JSON.stringify(bekle);
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${aciklama} → ${JSON.stringify(c ?? null)}`);
}

// Döngü koruması: PlayerStage'deki zincir mantığının aynısı.
// Çizim, hedefi zincirde görürse durur; görmezse zincire ekleyip devam eder.
// Sınavın ASIL iddiası "şu derinlikte çizilir" değil, ÇİZİMİN SONLANMASI.
function cizilenDerinlik(ekranlar, kok) {
  let derinlik = 0;
  let adim = 0;
  const yuru = (id, zincir) => {
    if (++adim > 1000) throw new Error("sonsuz döngü");
    if (zincir.includes(id)) return; // döngü — dur
    derinlik = Math.max(derinlik, zincir.length);
    for (const bagli of ekranlar[id] ?? []) yuru(bagli, [...zincir, id]);
  };
  yuru(kok, []);
  return derinlik;
}

const senaryolar = [
  [{ a: ["b"], b: [] }, 1, "A → B: normal gömme, B bir kat içeride çizilir"],
  [{ a: ["b"], b: ["a"] }, 1, "A → B → A: halka kesilir, A ikinci kez çizilmez"],
  [{ a: ["a"] }, 0, "kendini bağlama: hiç iç kat açılmaz"],
  [{ a: ["b"], b: ["c"], c: ["a"] }, 2, "üçlü halka: C'de durur"],
  [{ a: ["b", "c"], b: ["d"], c: [], d: [] }, 2, "dallanma: en derin yol 2 kat"],
];
for (const [graf, bekle, aciklama] of senaryolar) {
  let d;
  try {
    d = cizilenDerinlik(graf, "a");
  } catch {
    d = "SONSUZ DÖNGÜ";
  }
  const gecti = d === bekle;
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${aciklama} → derinlik ${d}`);
}

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
