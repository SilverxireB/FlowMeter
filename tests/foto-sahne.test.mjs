/**
 * Foto sahne sınavı — `node tests/foto-sahne.test.mjs`
 *
 * Yerleşim hatası ekranda "biraz değişik" görünür, HATA VERMEZ — üstelik bu
 * ekran 7/24 duvarda asılı. Buradaki değişmezler gözle kaçırılan şeyleri tutar:
 *
 *  1. Kareler alanın DIŞINA taşmaz (taşarsa fotoğraf TV çerçevesinden kesilir).
 *  2. Mozaikte boşluk kalmaz (hücreler alanı tam kaplar).
 *  3. Aynı fotoğraf aynı anda İKİ karede durmaz (çirkin ve kafa karıştırıcı).
 *  4. Yerleşim DETERMİNİSTİK — aynı girdi hep aynı çıktı. Polaroid'in dağınıklığı
 *     rastgele olsaydı her çizimde kartlar zıplardı (7/24 ekranda işkence).
 *  5. Fotoğraf sayısı kare sayısından AZSA dönecek bir şey yoktur; sahne
 *     boşuna titrememelidir.
 */
import fs from "node:fs";

const src = fs.readFileSync("src/lib/fotoSahne.ts", "utf8");
const kod = src
  .replace(/export type [\s\S]*?;\n/g, "")
  .replace(/export interface [\s\S]*?\n\}\n/g, "")
  .replace(/export const SAHNE_MODLARI: SahneModuBilgi\[\] =/, "const SAHNE_MODLARI =")
  .replace(/export const SAHNE_MODU_VARSAYILAN: SahneModu =/, "const SAHNE_MODU_VARSAYILAN =")
  // Dönüş tipi süslü parantez içeriyor (`{ sutun; satir }`) — satır bazlı değiştir.
  .replace(/export function izgaraOlcu[^\n]*\n/, "function izgaraOlcu(adet, oran, yogunluk = 1) {\n")
  .replace(/function tohum\(i: number\): number \{/, "function tohum(i) {")
  .replace(/export function sahneKareleri\([\s\S]*?\): SahneKaresi\[\] \{/, "function sahneKareleri(mod, adet, oran, kaydir = 0) {")
  .replace(/export function adimMs\([^)]*\)[^{]*\{/, "function adimMs(toplamSn, adet, kareAdedi) {")
  .replace(/const kareler: SahneKaresi\[\] = \[/g, "const kareler = [")
  .replace(/const kareler: SahneKaresi\[\] = \[\];/g, "const kareler = [];")
  .replace(/: SahneKaresi\[\]/g, "")
  .replace(/const don = \(i: number\)/, "const don = (i)");
const { SAHNE_MODLARI, SAHNE_MODU_VARSAYILAN, izgaraOlcu, sahneKareleri, adimMs } = new Function(
  `${kod}; return { SAHNE_MODLARI, SAHNE_MODU_VARSAYILAN, izgaraOlcu, sahneKareleri, adimMs };`
)();

let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

const MODLAR = SAHNE_MODLARI.map((m) => m.id);
kontrol(MODLAR.length === 5 && !MODLAR.includes("zamanTuneli"), `beş mod var, zaman tüneli YOK: ${MODLAR.join(", ")}`);
kontrol(MODLAR.includes(SAHNE_MODU_VARSAYILAN), `varsayılan mod listede: ${SAHNE_MODU_VARSAYILAN}`);

// Gerçek alan oranları: geniş duvar, tek TV, dikey totem, dar şerit.
const ORANLAR = [3840 / 2160, 16 / 9, 1080 / 1920, 4, 0.5];
const ADETLER = [1, 2, 3, 5, 8, 12, 40];

// ── 1. Alan dışına taşma yok ────────────────────────────────────────────────
let tasma = 0;
for (const mod of MODLAR)
  for (const oran of ORANLAR)
    for (const adet of ADETLER)
      for (const k of sahneKareleri(mod, adet, oran, 3))
        if (k.x < -0.01 || k.y < -0.01 || k.x + k.w > 100.01 || k.y + k.h > 100.01) tasma++;
kontrol(tasma === 0, `hiçbir kare alan dışına taşmıyor (${MODLAR.length}×${ORANLAR.length}×${ADETLER.length} birleşim)`);

// ── 2. Mozaik boşluk bırakmıyor ─────────────────────────────────────────────
let bosluk = 0;
for (const oran of ORANLAR)
  for (const adet of ADETLER) {
    const alan = sahneKareleri("mozaik", adet, oran).reduce((t, k) => t + (k.w * k.h) / 100, 0);
    if (Math.abs(alan - 100) > 0.01) bosluk++;
  }
kontrol(bosluk === 0, "mozaikte hücreler alanı TAM kaplıyor (boşluk/çakışma yok)");

// ── 3. Aynı fotoğraf iki karede durmuyor ────────────────────────────────────
let cift = 0;
for (const mod of MODLAR)
  for (const oran of ORANLAR)
    for (const adet of ADETLER) {
      const kareler = sahneKareleri(mod, adet, oran, 2);
      // Kare sayısı fotoğraf sayısını aşamaz — aşarsa tekrar KAÇINILMAZ olurdu.
      if (kareler.length > adet) {
        cift++;
        continue;
      }
      const indeksler = kareler.map((k) => k.indeks);
      if (new Set(indeksler).size !== indeksler.length) cift++;
    }
kontrol(cift === 0, "aynı fotoğraf aynı anda iki karede DURMUYOR (kare sayısı fotoğrafı aşmıyor)");

// ── 4. Determinizm ──────────────────────────────────────────────────────────
const a = JSON.stringify(sahneKareleri("polaroid", 9, 1.78, 0));
const b = JSON.stringify(sahneKareleri("polaroid", 9, 1.78, 0));
kontrol(a === b, "polaroid dağınıklığı DETERMİNİSTİK (7/24 ekranda kartlar zıplamaz)");
kontrol(
  JSON.stringify(sahneKareleri("polaroid", 9, 1.78, 1)) !== a,
  "kaydırınca içerik değişiyor (sahne gerçekten dönüyor)"
);
kontrol(
  sahneKareleri("polaroid", 9, 1.78, 0).some((k) => k.aci !== 0),
  "polaroid kartları eğik (mozaikten ayırt edilebiliyor)"
);
kontrol(
  sahneKareleri("mozaik", 9, 1.78, 0).every((k) => k.aci === 0),
  "mozaik kareleri düz"
);

// ── 5. Öne çıkan kare ───────────────────────────────────────────────────────
for (const mod of ["sahne", "spot", "sinema"]) {
  const one = sahneKareleri(mod, 6, 1.78).filter((k) => k.one);
  kontrol(one.length === 1, `${mod}: tam olarak BİR kare öne çıkıyor`);
}
for (const mod of ["mozaik", "polaroid"])
  kontrol(sahneKareleri(mod, 6, 1.78).every((k) => !k.one), `${mod}: öne çıkan kare yok (eşit pano)`);
// Öne çıkan kare, spot'ta diğerlerinin ÜSTÜNDE olmalı.
{
  const kareler = sahneKareleri("spot", 6, 1.78);
  const onKare = kareler.find((k) => k.one);
  kontrol(kareler.every((k) => k.one || k.z < onKare.z), "spot: öne çıkan kare diğerlerinin üstünde");
}

// ── 6. Tek fotoğraf / boş liste ─────────────────────────────────────────────
for (const mod of MODLAR) {
  const tek = sahneKareleri(mod, 1, 1.78);
  kontrol(tek.length === 1 && tek[0].indeks === 0, `${mod}: tek fotoğrafta tek kare`);
  kontrol(sahneKareleri(mod, 0, 1.78).length === 0, `${mod}: fotoğraf yoksa kare de yok`);
}

// ── 7. Izgara ölçüsü alanın oranını takip ediyor ────────────────────────────
kontrol(izgaraOlcu(4, 4).sutun >= izgaraOlcu(4, 4).satir, "geniş alanda sütun ≥ satır");
kontrol(izgaraOlcu(4, 0.25).satir >= izgaraOlcu(4, 0.25).sutun, "dikey alanda satır ≥ sütun");
kontrol(izgaraOlcu(1, 1.78).sutun * izgaraOlcu(1, 1.78).satir === 1, "tek fotoğrafa tek hücre");

// ── 8. Adım süresi ──────────────────────────────────────────────────────────
// Görünmeyen fotoğraf yoksa yenilenecek bir şey de yok: sahne DONUK durmalı,
// boşuna titrememeli.
kontrol(adimMs(300, 4, 4) === 300_000, "hepsi görünüyorsa tek adım (titremiyor)");
kontrol(adimMs(300, 40, 4) >= 4000 && adimMs(300, 40, 4) <= 12_000, `çok fotoğrafta adım 4–12 sn (${adimMs(300, 40, 4)}ms)`);
kontrol(adimMs(30, 40, 4) >= 4000, `kısa sürede bile adım 4 sn'nin altına inmiyor (${adimMs(30, 40, 4)}ms)`);

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
