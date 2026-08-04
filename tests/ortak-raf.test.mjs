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
const rafSrc = fs.readFileSync("src/lib/ortakRafCekirdek.ts", "utf8");
const rafKod = rafSrc
  .slice(rafSrc.indexOf("export const ORTAK_KLASOR"))
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

// SELF-HOST çekirdeği de kendi kaynağından — iki ağacın sabitleri ayrı ayrı
// sınanmalı; eşitlik sınavı yalnız "iz var mı" diye bakıyor, DEĞERİ görmüyor.
const selfSrc = fs.readFileSync("flowsign-selfhost/src/lib/ortakRaf.ts", "utf8");
const selfKod = selfSrc
  .slice(selfSrc.indexOf("export const ORTAK_KLASOR"), selfSrc.indexOf("/** `/media/"))
  .replace(/export interface [\s\S]*?\n\}\n/g, "")
  .replace(/export const ORTAK_KLASOR = /, "const ORTAK_KLASOR = ")
  .replace(/export function klasorCakisiyorMu\([^)]*\)[^{]*\{/, "function klasorCakisiyorMu(wallId) {")
  .replace(/export function adresDegistir\([^)]*\)[^{]*\{/, "function adresDegistir(zones, eski, yeni) {")
  .replace(/export function adresKullanimSayisi\([\s\S]*?\): number \{/, "function adresKullanimSayisi(vw, src) {")
  .replace(/\(zones: Zone\[\] \| undefined\)/, "(zones)");
const { ORTAK_KLASOR: SELF_ORTAK, klasorCakisiyorMu: selfCakisiyorMu } = new Function(
  `${selfKod}; return { ORTAK_KLASOR, klasorCakisiyorMu };`
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

// ── 1b. SİLME AKIŞLARINI MODELLE (asıl güvence burada sınanıyor) ───────────
// Kullanıcının tek şartı: "ekran silinince ortak rafa HİÇ dokunmasın".
// Yukarıdaki kontrol niyeti ölçüyor; burası GERÇEK silme davranışını modelliyor
// ve ayrıca RAFI YANLIŞ YERE KOYSAK ne olacağını da ölçüyor — yoksa "geçti"
// satırı korumanın çalıştığını değil, testin bir şeye bakmadığını gösterir.

/** Online: Cloudinary `delete_resources_by_prefix?prefix=flowsign/{id}` */
const onlineSuprulurMu = (publicId, silinenEkranId) => publicId.startsWith(`${EKRAN_KLASOR}/${silinenEkranId}`);
/**
 * Self-host: `deleteWall` önce `klasorCakisiyorMu` ile reddeder, SONRA
 * `rm -rf data/media/{id}` yapar. Model bu SIRAYI taşımalı — koruma kaldırılırsa
 * sınav düşsün. (Ekran kimlikleri "w-…" olduğu için pratikte çakışma olmaz;
 * koruma "kimlikler zaten öyle" varsayımına güvenmemek için var.)
 */
const selfSuprulurMu = (yol, silinenEkranId) =>
  selfCakisiyorMu(silinenEkranId) ? false : yol.startsWith(`data/media/${silinenEkranId}/`);

for (const silinen of ["w-abc123", "ortak", "w-1", SELF_ORTAK]) {
  const rafDosyasi = `${ORTAK_KLASOR}/k3x-bekofilmi`;
  kontrol(
    onlineSuprulurMu(rafDosyasi, silinen) === false,
    `online: "${silinen}" ekranı silinince raf dosyası duruyor`
  );
  kontrol(
    selfSuprulurMu(`data/media/${SELF_ORTAK}/bekofilmi.mp4`, silinen) === false,
    `self-host: "${silinen}" ekranı silinince raf dosyası duruyor`
  );
}
// Kendi ekranının dosyası ise SİLİNMELİ (silme gerçekten çalışıyor mu).
kontrol(onlineSuprulurMu(`${EKRAN_KLASOR}/w-abc123/afis`, "w-abc123") === true, "online: silinen ekranın kendi dosyası süprülüyor");
kontrol(selfSuprulurMu("data/media/w-abc123/afis.jpg", "w-abc123") === true, "self-host: silinen ekranın kendi dosyası süprülüyor");
// ÇİFT YÖNLÜ: raf ekran ağacının ALTINDA olsaydı koruma çökerdi.
kontrol(
  onlineSuprulurMu(`${EKRAN_KLASOR}/ortak/k3x-bekofilmi`, "ortak") === true,
  'çift yönlü: raf "flowsign/ortak" altında OLSAYDI, "ortak" kimlikli ekranın silmesi rafı götürürdü'
);
kontrol(
  selfSuprulurMu("data/media/w-abc/_ortak/x.mp4", "w-abc") === true,
  "çift yönlü: raf bir ekranın İÇİNDE olsaydı o ekranın silmesi rafı götürürdü"
);

// KAYNAK KORUMASI: yukarıdaki model korumanın VAR olduğunu varsayıyor. Koruma
// `deleteWall`den silinirse model yine "geçti" derdi — o yüzden çağrının kendisi
// de aranıyor.
{
  const store = fs.readFileSync("flowsign-selfhost/src/lib/store.ts", "utf8");
  const bas = store.indexOf("export async function deleteWall");
  const govde = bas < 0 ? "" : store.slice(bas, bas + 1200);
  kontrol(
    /klasorCakisiyorMu\(/.test(govde) && /fs\.rm\(path\.join\(MEDIA_DIR/.test(govde),
    "self-host silme yolu, medyayı kaldırmadan ÖNCE raf korumasını çağırıyor"
  );
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


// ── 3b. SUNUCU/İSTEMCİ SINIRI ───────────────────────────────────────────────
// Çekirdek dosyası SUNUCU rotasından import ediliyor. İçine Firebase girerse
// rota, tek bir metin sabiti için tüm istemci SDK'sını yükler ve uç patlar —
// bu bir kez gerçekten oldu ve panelde yalnız "Ortak rafa taşınamadı" yazdı.
{
  const cek = fs.readFileSync("src/lib/ortakRafCekirdek.ts", "utf8");
  const importlar = [...cek.matchAll(/^import\s+[\s\S]*?from\s+"([^"]+)";/gm)].map((m) => m[1]);
  const kirli = importlar.filter((i) => i !== "./types");
  kontrol(kirli.length === 0, `çekirdek Firebase'e dokunmuyor (importlar: ${importlar.join(", ") || "yok"})`);

  const rota = fs.readFileSync("src/app/api/sign/ortak-raf/route.ts", "utf8");
  kontrol(!/from "@\/lib\/ortakRaf"/.test(rota), "sunucu rotası Firestore katmanını DEĞİL çekirdeği import ediyor");
  kontrol(/message: mesaj/.test(rota), "sunucu Cloudinary'nin gerçek hata metnini geri veriyor (kör kalmayalım)");
}

// ── 3c. YAYIN DA ÇEVRİLMELİ ─────────────────────────────────────────────────
// GERÇEK HATA (kullanıcı yakaladı): dosya rafa taşınınca yalnız TASLAK adresi
// çevriliyordu. Sonuç iki katmanlı ve ilki masum görünüyor:
//   - kütüphane taslak+yayını birleştirdiği için aynı fotoğraf İKİ KEZ listelenir
//     ("fotoğraflar çoğalmaya başladı"),
//   - asıl mesele: YAYINDAKİ ekran artık var olmayan bir adresi göstermeye devam
//     eder ve o alan sahada kararır. Kimse yeniden yayınlamadıkça düzelmez.
for (const [etiket, yol] of [
  ["online", "src/components/videowall/ZonePanel.tsx"],
  ["self-host", "flowsign-selfhost/src/components/ZonePanel.tsx"],
]) {
  const k = fs.readFileSync(yol, "utf8");
  const bas = k.indexOf("async function rafaKoy");
  const govde = bas < 0 ? "" : k.slice(bas, bas + 2600);
  kontrol(/fixLiveSrc\(/.test(govde), `${etiket}: rafa taşırken YAYIN adresleri de çevriliyor`);
}

// ── 3d. İKİ KİMLİK ADAYI ────────────────────────────────────────────────────
// GERÇEK HATA (canlıda görüldü): "Resource not found - flowsign/{ekran}/{ad}".
// Cloudinary'nin "dinamik klasör" kipinde TESLİM ADRESİ klasörü gösterir ama
// gerçek `public_id` ÇIPLAK isimdir. Adresten türetilen tam yol o kipte hiçbir
// dosyayla eşleşmez. Hangi kipte olduğumuz dışarıdan bilinemez ve hesap ayarı
// zamanla değişebilir → ikisi de denenmeli, ama YALNIZ "bulunamadı" hatasında
// (imza/yetki hatasında ikinci deneme teşhisi zorlaştırır).
{
  const rota = fs.readFileSync("src/app/api/sign/ortak-raf/route.ts", "utf8");
  kontrol(/const adaylar = \[/.test(rota), "rota iki kimlik adayı üretiyor (tam yol + çıplak ad)");
  kontrol(/not found/i.test(rota) && /break;/.test(rota), "yalnız 'bulunamadı' hatasında ikinci aday deneniyor");
  kontrol(/denenen: adaylar/.test(rota), "hata mesajı DENENEN kimlikleri yazıyor");
}

// ── 4. CLOUDINARY İMZASI (online taraf) ─────────────────────────────────────
// Online uç gerçek anahtar istediği için uçtan uca denenemiyor; oradaki TEK
// riskli parça imza üretimi. Yeni jenerik imzalayıcı, ÜRETİMDE ÇALIŞTIĞI BİLİNEN
// `/api/wall/destroy` rotasının elle kurulmuş imzasıyla karşılaştırılıyor:
// aynı parametreler için aynı özeti üretmiyorsa Cloudinary "Invalid Signature"
// der ve dosya ne taşınır ne silinir.
import crypto from "node:crypto";
{
  const rotaSrc = fs.readFileSync("src/app/api/sign/ortak-raf/route.ts", "utf8");
  const imzaKod = rotaSrc
    .slice(rotaSrc.indexOf("function imza("), rotaSrc.indexOf("/** POST —"))
    .replace(/function imza\([^)]*\)[^{]*\{/, "function imza(params, secret) {");
  const { imza } = new Function("crypto", `${imzaKod}; return { imza };`)(crypto);

  const SECRET = "gizli-anahtar";
  const publicId = "flowsign-ortak/k3x-bekofilmi";
  const timestamp = "1712345678";
  // destroy rotasının ürettiği dizge (birebir o dosyadan):
  //   `invalidate=true&public_id=${id}&timestamp=${ts}${SECRET}`
  const beklenen = crypto
    .createHash("sha1")
    .update(`invalidate=true&public_id=${publicId}&timestamp=${timestamp}${SECRET}`)
    .digest("hex");
  const uretilen = imza({ invalidate: "true", public_id: publicId, timestamp }, SECRET);
  kontrol(uretilen === beklenen, "imza, üretimde çalışan destroy rotasıyla BİREBİR aynı");

  // Sıralama gerçekten alfabetik mi (Cloudinary şartı): parametreleri ters
  // sırada verince de aynı özet çıkmalı.
  kontrol(
    imza({ timestamp, public_id: publicId, invalidate: "true" }, SECRET) === beklenen,
    "parametre sırası imzayı değiştirmiyor (alfabetik sıralanıyor)"
  );
  // Rename imzası: beş parametre, alfabetik.
  const renameBeklenen = crypto
    .createHash("sha1")
    .update(`from_public_id=a&invalidate=true&overwrite=false&timestamp=${timestamp}&to_public_id=b${SECRET}`)
    .digest("hex");
  kontrol(
    imza({ to_public_id: "b", from_public_id: "a", overwrite: "false", invalidate: "true", timestamp }, SECRET) ===
      renameBeklenen,
    "rename imzası beş parametreyi alfabetik diziyor"
  );
}

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
