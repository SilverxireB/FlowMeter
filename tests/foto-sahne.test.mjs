/**
 * Foto sahne sınavı — `node tests/foto-sahne.test.mjs`
 *
 * ÇİZİM ARTIK WALL'DAN TAŞINDI (kullanıcı kararı: "yeni bir şey yazma — aynı
 * ürünü taşıyacaktın; anons yok, QR yok, sevilen yok"). Dolayısıyla sınavın işi
 * değişti: yerleşim matematiğini değil, TAŞIMANIN SÖZLERİNİ tutmak.
 *
 *  1. Mod listesi Wall'ın perde modlarıyla örtüşür; zaman tüneli BİLEREK yok.
 *  2. Etkinlik süsleri sahneye SIZMAZ: beğeni/rumuz/taç/QR/anons/çekiliş —
 *     fabrika panosunda anlamları yok, biri "Wall'dan kopyalarken" getirirse
 *     derleme kırılmaz, gözle de kolay kaçar.
 *  3. Taşınan animasyon dili Wall'a BAĞ KURMAZ (ayrı paket kuralı): sahne kendi
 *     `fs-` kopyasını taşır, `components/wall/`den import etmez.
 *  4. `seritlereBol` Wall'ın `splitStrips`iyle aynı kuralı uygular (determinist,
 *     dengeli, 24 sınırı).
 */
import fs from "node:fs";

const libSrc = fs.readFileSync("src/lib/fotoSahne.ts", "utf8");
const kod = libSrc
  .replace(/export type [\s\S]*?;\n/g, "")
  .replace(/export interface [\s\S]*?\n\}\n/g, "")
  .replace(/export const SAHNE_MODLARI: SahneModuBilgi\[\] =/, "const SAHNE_MODLARI =")
  .replace(/export const SAHNE_MODU_VARSAYILAN: SahneModu =/, "const SAHNE_MODU_VARSAYILAN =")
  // Dönüş tipi süslü parantezli — satır bazlı değiştir.
  .replace(/export function seritlereBol[^\n]*\n/, "function seritlereBol(fotolar) {\n")
  .replace(/const son = \[\.\.\.fotolar\]/, "const son = [...fotolar]")
  .replace(/const sol: string\[\] = \[\];/, "const sol = [];")
  .replace(/const sag: string\[\] = \[\];/, "const sag = [];");
const { SAHNE_MODLARI, SAHNE_MODU_VARSAYILAN, seritlereBol } = new Function(
  `${kod}; return { SAHNE_MODLARI, SAHNE_MODU_VARSAYILAN, seritlereBol };`
)();

let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

// ── 1. Mod listesi ──────────────────────────────────────────────────────────
const MODLAR = SAHNE_MODLARI.map((m) => m.id);
kontrol(
  JSON.stringify([...MODLAR].sort()) === JSON.stringify(["mozaik", "polaroid", "sahne", "sinema", "spot"]),
  `beş mod: ${MODLAR.join(", ")}`
);
kontrol(!libSrc.includes("zamanTuneli") && !libSrc.includes("timeline"), "zaman tüneli YOK (fotoğrafın zamanı yok — uydurma sıra gösterilmez)");
kontrol(MODLAR.includes(SAHNE_MODU_VARSAYILAN), `varsayılan mod listede: ${SAHNE_MODU_VARSAYILAN}`);

// ── 2. Etkinlik süsleri sahneye sızmadı ─────────────────────────────────────
// Wall'dan kopyalanırken beğeni pili / rumuz / taç / QR / anons gelirse bunu
// derleme yakalamaz. İki uygulamanın sahne bileşeni de temiz olmalı.
const YASAK = [
  ["beğeni", /LikePill|likes/],
  ["rumuz", /nickname/],
  ["en sevilen tacı", /LovedRibbon|topLoved|👑/],
  ["yeni anı rozeti", /WallNewMemory|Yeni anı/],
  ["QR", /QrCode|\bQR\b/],  // /qr/i "Math.sqrt"i yakalıyordu
  ["anons/çekiliş", /Announcement|Raffle|Contest|Milestone/],
];
for (const [uygulama, yol] of [
  ["online", "src/components/videowall/FotoSahne.tsx"],
  ["self-host", "flowsign-selfhost/src/components/FotoSahne.tsx"],
]) {
  const k = fs.readFileSync(yol, "utf8");
  // Yorumlar taramaya GİRMEZ: başlıkta kullanıcının sözü ("QR yok") geçiyor ve
  // Wall'a atıf var — süs/bağ araması yalnız gerçek koda bakmalı.
  const kod2 = k.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const sizan = YASAK.filter(([, r]) => r.test(kod2)).map(([ad]) => ad);
  kontrol(sizan.length === 0, `${uygulama}: etkinlik süsü sızmamış${sizan.length ? ` — SIZAN: ${sizan.join(", ")}` : ""}`);
  // 3. Wall'a bağ yok — sahne kendi kopyasını taşır (ayrı paket kuralı).
  kontrol(!/from ["'][^"']*components\/wall\//.test(kod2), `${uygulama}: Wall koduna import YOK (kopya taşır, bağ kurmaz)`);
  // Taşınan dil gerçekten orada: marquee + ken burns + polaroid düşüşü.
  const dil = ["fs-marquee", "fs-ken", "fs-drop", "fs-float", "fs-spot", "fs-fade"].filter((c) => !kod2.includes(c));
  kontrol(dil.length === 0, `${uygulama}: Wall animasyon dili taşınmış${dil.length ? ` — eksik: ${dil.join(", ")}` : ""}`);
  // Beş modun beşi de çiziliyor.
  const modEksik = ["Mozaik", "Sahne", "Spot", "Polaroid", "Sinema"].filter((m) => !k.includes(`function ${m}(`));
  kontrol(modEksik.length === 0, `${uygulama}: beş modun beşi de çiziliyor${modEksik.length ? ` — eksik: ${modEksik.join(", ")}` : ""}`);
}

// ── 4. seritlereBol — Wall splitStrips kuralları ────────────────────────────
const F = Array.from({ length: 30 }, (_, i) => `f${i + 1}`);
const s1 = seritlereBol(F);
kontrol(s1.sol.length + s1.sag.length === 24, `en fazla 24 şerit karesi (ölçülen ${s1.sol.length + s1.sag.length})`);
kontrol(Math.abs(s1.sol.length - s1.sag.length) <= 1, "sol/sağ dengeli");
kontrol(s1.sol[0] === "f30", "en yeni fotoğraf şeridin başında (Wall ile aynı: reverse)");
kontrol(JSON.stringify(seritlereBol(F)) === JSON.stringify(seritlereBol(F)), "determinist");
kontrol(seritlereBol([]).sol.length === 0 && seritlereBol([]).sag.length === 0, "boş liste çökertmiyor");
const kucukListe = seritlereBol(["a", "b", "c"]);
kontrol(kucukListe.sol.length === 2 && kucukListe.sag.length === 1, "üç fotoğraf: 2 sol + 1 sağ");

// ── 5. Rafa taşıma diğer ekranları da çeviriyor (kaynak koruması) ───────────
// GERÇEK HATA (canlı): dosya rafa taşınınca yalnız o anki ekran çevriliyordu;
// aynı dosyayı kullanan DİĞER ekranlar ölü adreste kalıp kararıyordu.
for (const [uygulama, yol] of [
  ["online", "src/components/videowall/ZonePanel.tsx"],
  ["self-host", "flowsign-selfhost/src/components/ZonePanel.tsx"],
]) {
  const k = fs.readFileSync(yol, "utf8");
  const bas = k.indexOf("async function rafaKoy");
  const govde = bas < 0 ? "" : k.slice(bas, bas + 3600);
  kontrol(
    /digerleri/.test(govde) && /kullaniyor/.test(govde) && /fixLiveSrc\(w\.id/.test(govde),
    `${uygulama}: rafa taşıma DİĞER ekranların taslak+yayınını da çeviriyor`
  );
}

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
