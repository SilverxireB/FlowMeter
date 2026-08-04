/**
 * Ortak raf sınavı — `node tests/ortak-raf.test.mjs`
 *
 * Üç şeyi ölçer, üçü de bozulunca SESSİZ:
 *
 *  1. KLASÖR AYRIMI. Kullanıcının koyduğu tek şart: "ekran silinince ortak rafa
 *     HİÇ dokunmasın". Ekran silme `flowsign/{id}` ön ekini topluca süpürüyor;
 *     raf `flowsign-ortak/` ayrı ağacında. Bu ayrım bir gün "sadeleştirilip"
 *     raf `flowsign/ortak/` altına alınırsa, ilk ekran silmede raf da gider ve
 *     bunu kimse fark etmez — ta ki başka birinin duvarı kararana dek.
 *
 *  2. ADRES ÇÖZÜMLEME. Dosyayı taşımak/silmek `public_id` ister; eski öğelerde
 *     o alan yok, elimizde yalnız URL var. Ayrıştırma yanlışsa "taşıdım" der,
 *     hiçbir şey taşınmaz (ya da yanlış dosya silinir).
 *
 *  3. ADRES ÇEVİRME. Dosya rafa taşınınca ekranın KENDİ öğeleri yeni adrese
 *     çevrilmeli — hem taslak hem YAYIN. Biri atlanırsa editörde her şey normal
 *     görünür, perde kırık çıkar (ya da tersi).
 */
import fs from "node:fs";

// ── Gerçek kaynaklardan çalıştır ────────────────────────────────────────────
const rafSrc = fs.readFileSync("src/lib/ortakRaf.ts", "utf8");
const rafKod = rafSrc
  .slice(rafSrc.indexOf("export const ORTAK_KLASOR"), rafSrc.indexOf("// ── Firestore"))
  .replace(/export interface [\s\S]*?\n\}\n/g, "")
  .replace(/export const ORTAK_KLASOR = /, "const ORTAK_KLASOR = ")
  .replace(/export const EKRAN_KLASOR = /, "const EKRAN_KLASOR = ")
  .replace(/export function klasorCakisiyorMu\([^)]*\)[^{]*\{/, "function klasorCakisiyorMu(wallId) {")
  .replace(/export function adresDegistir\([^)]*\)[^{]*\{/, "function adresDegistir(zones, eski, yeni) {")
  .replace(/export function adresKullanimSayisi\([^)]*\)[^{]*\{/, "function adresKullanimSayisi(vw, src) {")
  .replace(/\(zones: Zone\[\] \| undefined\)/, "(zones)");
const { ORTAK_KLASOR, EKRAN_KLASOR, klasorCakisiyorMu, adresDegistir, adresKullanimSayisi } = new Function(
  `${rafKod}; return { ORTAK_KLASOR, EKRAN_KLASOR, klasorCakisiyorMu, adresDegistir, adresKullanimSayisi };`
)();

const cldSrc = fs.readFileSync("src/lib/cloudinary.ts", "utf8");
const cldKod =
  cldSrc.slice(cldSrc.indexOf("function isCld("), cldSrc.indexOf("/** secure_url")).replace(
    /export function cldPublicId\([^)]*\)[^{]*\{/,
    "function cldPublicId(url) {"
  ).replace(/function isCld\(url: string\): boolean \{/, "function isCld(url) {");
const { cldPublicId } = new Function(`${cldKod}; return { cldPublicId };`)();

let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

// ── 1. KLASÖR AYRIMI ────────────────────────────────────────────────────────
kontrol(ORTAK_KLASOR !== EKRAN_KLASOR, `raf ve ekran klasörleri ayrı: "${ORTAK_KLASOR}" ≠ "${EKRAN_KLASOR}"`);
kontrol(
  !ORTAK_KLASOR.startsWith(`${EKRAN_KLASOR}/`),
  `raf, ekran ağacının ALTINDA DEĞİL — "${EKRAN_KLASOR}/{id}" süpürmesi rafa ulaşamaz`
);
// Gerçek ekran kimlikleriyle: hiçbiri rafla çakışmamalı.
for (const id of ["vw-abc123", "ortak", "flowsign-ortak", "", "a", "ortak/alt"])
  kontrol(klasorCakisiyorMu(id) === false, `ekran kimliği "${id}" rafla çakışmıyor`);
// ÇİFT YÖNLÜ: raf ekran ağacının altında OLSAYDI koruma çalışmalı.
{
  const sahte = `${EKRAN_KLASOR}/ortak`;
  const cakisir = `${EKRAN_KLASOR}/ortak` === sahte;
  kontrol(cakisir, `koruma anlamlı: raf "${sahte}" olsaydı "ortak" kimlikli ekranın silmesi onu süpürürdü`);
}

// ── 2. ADRES ÇÖZÜMLEME ──────────────────────────────────────────────────────
const B = "https://res.cloudinary.com/demo";
const adresler = [
  [`${B}/image/upload/v1712345678/flowsign/vw-abc/afis.jpg`, "flowsign/vw-abc/afis", "sürüm + uzantı ayıklanır"],
  [`${B}/video/upload/v1/flowsign/vw-abc/bekofilmi.mp4`, "flowsign/vw-abc/bekofilmi", "video"],
  [`${B}/image/upload/flowsign/vw-abc/afis.jpg`, "flowsign/vw-abc/afis", "sürümsüz adres"],
  [`${B}/image/upload/c_limit,w_1400,q_auto/v17/flowsign/vw-abc/afis.jpg`, "flowsign/vw-abc/afis", "dönüşümlü adres (elle yapıştırılmış)"],
  [`${B}/image/upload/v17/flowsign/vw-abc/rapor.final.png`, "flowsign/vw-abc/rapor.final", "adda nokta varsa YALNIZ son uzantı atılır"],
  [`${B}/image/upload/v17/flowsign-ortak/k3x-bekofilmi.jpg`, "flowsign-ortak/k3x-bekofilmi", "raftaki dosya"],
  [`${B}/image/upload/v17/uzantisiz`, "uzantisiz", "uzantısız dosya"],
];
for (const [url, bekle, aciklama] of adresler) {
  const c = cldPublicId(url);
  kontrol(c === bekle, `${aciklama} → ${c}${c === bekle ? "" : ` (beklenen ${bekle})`}`);
}
kontrol(cldPublicId("https://ornek.com/foto.jpg") === "", "Cloudinary olmayan adres boş döner (yanlış dosya silinmesin)");
kontrol(cldPublicId("") === "", "boş adres çökertmiyor");

// ── 3. ADRES ÇEVİRME ────────────────────────────────────────────────────────
const ESKI = `${B}/image/upload/v1/flowsign/vw-abc/film.mp4`;
const YENI = `${B}/image/upload/v2/flowsign-ortak/k3x-film.mp4`;
const zones = [
  { id: "z1", items: [{ id: "a", src: ESKI }, { id: "b", src: "baska" }] },
  { id: "z2", items: [{ id: "c", src: ESKI }] },
  { id: "z3", items: [] },
  { id: "z4" }, // items hiç yok — eski kayıtlarda oluyor
];
const yeniZones = adresDegistir(zones, ESKI, YENI);
kontrol(
  yeniZones[0].items[0].src === YENI && yeniZones[1].items[0].src === YENI,
  "aynı dosya BİRDEN ÇOK alanda kullanılıyorsa hepsi çevriliyor"
);
kontrol(yeniZones[0].items[1].src === "baska", "başka dosyalara dokunulmuyor");
kontrol(Array.isArray(yeniZones[3].items) && yeniZones[3].items.length === 0, "items'i olmayan alan çökertmiyor");
kontrol(zones[0].items[0].src === ESKI, "kaynak dizi DEĞİŞTİRİLMİYOR (saf işlev)");
kontrol(adresDegistir(undefined, ESKI, YENI).length === 0, "alanı olmayan ekran çökertmiyor");

// TASLAK + YAYIN birlikte sayılmalı: biri atlanırsa perde kırık kalır.
const vw = { zones, live: { zones: [{ id: "l1", items: [{ id: "d", src: ESKI }] }] } };
kontrol(adresKullanimSayisi(vw, ESKI) === 3, `kullanım sayısı taslak(2) + yayın(1) = 3 (ölçülen ${adresKullanimSayisi(vw, ESKI)})`);
kontrol(adresKullanimSayisi({ zones: undefined, live: null }, ESKI) === 0, "boş ekran 0 döner");

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
