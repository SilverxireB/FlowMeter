/**
 * Kota okuma sınavı — `node tests/kota-okuma.test.mjs`
 *
 * NEDEN AYRI SINAV: Cloudinary `usage` yanıtı PLANA GÖRE farklı şema döndürüyor
 * ve hangisinin geleceğini biz seçmiyoruz:
 *   - kredi tabanlı plan → `credits: {usage, limit, used_percent}`
 *   - eski/kotalı plan   → `credits` YOK, her ölçünün kendi `limit`i var
 *   - bazı planlar       → hiç üst sınır bildirmez (yüzde HESAPLANAMAZ)
 *
 * Yalnız birini tanıyan kod plan değişince sessizce "bilinmiyor" der. Sağlık
 * panelinde sessiz "bilinmiyor", kotanın dolduğunu GÖRMEMEK demektir — yani
 * bu satırın tek işini yapmaması. Üstelik gerçek API'ye burada erişilemiyor,
 * o yüzden şemayı gerçek örneklerle sabitliyoruz.
 *
 * İkinci tuzak: panelin baktığı sayı "kredi yüzdesi" DEĞİL, EN DOLU ölçü.
 * Kredi %8'deyken bant genişliği %95 olabilir ve duracak yer orasıdır.
 */
import fs from "node:fs";

// Gerçek kaynaktan çalıştır (tip notları çıkarılarak) — kopya mantık sınamak
// hiçbir şey sınamaz.
const src = fs.readFileSync("src/lib/kota.ts", "utf8");
const kod = src
  .replace(/export interface [\s\S]*?\n\}\n/g, "")
  .replace(/interface [\s\S]*?\n\}\n/g, "")
  .replace(/export function olcuYuzde[^\n]*\{/, "function olcuYuzde(o) {")
  .replace(/export function kotaOzeti[^\n]*\{/, "function kotaOzeti(u) {")
  .replace(/export function enDoluYuzde[^\n]*\{/, "function enDoluYuzde(o) {")
  .replace(/export function bayt[^\n]*\{/, "function bayt(n) {")
  .replace(/export function kotaDurumu[^\n]*\{/, "function kotaDurumu(yuzde) {")
  .replace(/const al = \(k: string\)[^\n]*/, "const al = (k) => u[k];")
  .replace(/const tanimlar: [^=]*=/, "const tanimlar =")
  .replace(/\(y\): y is number =>/, "(y) =>")
  .replace(/o!\./g, "o.")
  .replace(/x\.o\b/g, "x.o");
const { kotaOzeti, enDoluYuzde, kotaDurumu, bayt } = new Function(
  `${kod}; return { kotaOzeti, enDoluYuzde, kotaDurumu, bayt };`
)();

const GB = 1024 ** 3;
let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

// ── 1. Kredi tabanlı plan (bugünkü ücretsiz plan) ───────────────────────────
const kredili = kotaOzeti({
  plan: "Free",
  last_updated: "2026-08-03",
  credits: { usage: 3.2, limit: 25, used_percent: 12.8 },
  storage: { usage: 1.4 * GB },
  bandwidth: { usage: 2.1 * GB },
  transformations: { usage: 340 },
  resources: 812,
});
kontrol(kredili.kredi?.limit === 25 && kredili.kredi?.yuzde === 12.8, "kredi planı: kredi okundu (%12,8)");
kontrol(enDoluYuzde(kredili) === 12.8, "kredi planı: en dolu ölçü kredi (diğerlerinin sınırı yok)");
kontrol(kredili.olculer.length === 3 && kredili.dosya === 812, "kredi planı: üç ölçü + dosya sayısı");
kontrol(kredili.guncellendi === "2026-08-03", "rakamın TARİHİ taşınıyor (canlı değil, günlük toparlanır)");

// ── 2. Eski/kotalı plan: `credits` yok, ölçülerin kendi limiti var ──────────
const kotali = kotaOzeti({
  plan: "Legacy",
  storage: { usage: 8 * GB, limit: 10 * GB },
  bandwidth: { usage: 19 * GB, limit: 20 * GB },
  transformations: { usage: 1000, limit: 25000 },
});
kontrol(kotali.kredi === null, "kotalı plan: kredi yok, uydurulmuyor");
kontrol(Math.round(enDoluYuzde(kotali)) === 95, "kotalı plan: EN DOLU ölçü kazanıyor (bant %95, depo %80)");

// ── 3. Üst sınır bildirmeyen plan ───────────────────────────────────────────
const sinirsiz = kotaOzeti({ plan: "Enterprise", storage: { usage: 500 * GB }, bandwidth: { usage: 900 * GB } });
kontrol(enDoluYuzde(sinirsiz) === null, "sınır yoksa yüzde NULL — uydurma %0 yazılmaz");

// ── 4. Boş/bozuk yanıt çökertmemeli ─────────────────────────────────────────
const bos = kotaOzeti({});
kontrol(bos.kredi === null && bos.olculer.length === 0 && enDoluYuzde(bos) === null, "boş yanıt: çökmüyor, hepsi null");

// ── 5. Eşikler (panel rengi) ────────────────────────────────────────────────
// Doluluk SKOR DEĞİL: burada büyük sayı KÖTÜ, semantik ters uygulanır.
// Eşik GERÇEK işlevden okunur — kopyasını sınamak hiçbir şey sınamaz.
for (const [y, bekle] of [[0, "ok"], [69.9, "ok"], [70, "uyari"], [89.9, "uyari"], [90, "hata"], [100, "hata"], [null, "bilinmiyor"]])
  kontrol(kotaDurumu(y) === bekle, `eşik: ${y === null ? "sınır yok" : `%${y}`} → ${bekle}`);

// ── 6. Bayt biçimi ──────────────────────────────────────────────────────────
// 800 MB'ı "0,8 GB" diye yazmak küçük hesapları sıfıra yuvarlıyordu.
kontrol(bayt(1.4 * GB) === "1,4 GB", `1,4 GB → ${bayt(1.4 * GB)}`);
kontrol(bayt(800 * 1024 ** 2) === "800 MB", `800 MB GB'a yuvarlanmıyor → ${bayt(800 * 1024 ** 2)}`);
kontrol(bayt(42 * GB) === "42 GB", `büyük değerde ondalık yok → ${bayt(42 * GB)}`);

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
