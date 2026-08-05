/**
 * Foto sahne sınavı — `node tests/foto-sahne.test.mjs`
 *
 * ÇİZİM WALL'DAN TAŞINDI (kullanıcı kararı: "yeni bir şey yazma — aynı ürünü
 * taşıyacaktın; anons yok, QR yok, sevilen yok"). Sınavın işi TAŞIMANIN
 * SÖZLERİNİ tutmak:
 *
 *  1. Mod listesi Wall'ın perde modlarıyla örtüşür; zaman tüneli BİLEREK yok.
 *  2. Etkinlik süsleri sahneye SIZMAZ: beğeni/rumuz/taç/anons/çekiliş —
 *     fabrika panosunda anlamları yok; biri "Wall'dan kopyalarken" getirirse
 *     derleme kırılmaz, gözle de kolay kaçar.
 *  3. Taşınan animasyon dili Wall'a BAĞ KURMAZ (ayrı paket kuralı): sahne kendi
 *     `fs-` kopyasını taşır, `components/wall/`den import etmez.
 *  4. `seritlereBol` Wall'ın `splitStrips`iyle aynı kuralı uygular (determinist,
 *     dengeli, 24 sınırı).
 *  5. Sahne LİNK modelidir: perde linki TANIR ve iframe AÇMAZ (gömülü ekran
 *     dersi); ortak raf uçlarında da taşıma/rename yoktur (kopya ilkesi).
 */
import fs from "node:fs";

let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};
const yorumsuz = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ── 1. Mod listesi (lib kaynaktan) ──────────────────────────────────────────
const libSrc = fs.readFileSync("src/lib/fotoSahne.ts", "utf8");
const modBlok = libSrc.slice(libSrc.indexOf("SAHNE_MODLARI"), libSrc.indexOf("];", libSrc.indexOf("SAHNE_MODLARI")));
const MODLAR = [...modBlok.matchAll(/id: "(\w+)"/g)].map((m) => m[1]);
kontrol(
  JSON.stringify([...MODLAR].sort()) === JSON.stringify(["mozaik", "polaroid", "sahne", "sinema", "spot"]),
  `beş mod: ${MODLAR.join(", ")}`
);
kontrol(!libSrc.includes("zamanTuneli") && !libSrc.includes("timeline"), "zaman tüneli YOK (fotoğrafın zamanı yok — uydurma sıra gösterilmez)");
const varsayilan = /SAHNE_MODU_VARSAYILAN: SahneModu = "(\w+)"/.exec(libSrc)?.[1];
kontrol(MODLAR.includes(varsayilan), `varsayılan mod listede: ${varsayilan}`);

// ── 2+3. Süs sızmadı, Wall'a bağ yok, dil taşınmış (iki ağaçta da) ─────────
const YASAK = [
  ["beğeni", /LikePill|likes/],
  ["rumuz", /nickname/],
  ["en sevilen tacı", /LovedRibbon|topLoved|👑/],
  ["yeni anı rozeti", /WallNewMemory|Yeni anı/],
  ["QR", /QrCode|\bQR\b/], // /qr/i "Math.sqrt"i yakalıyordu
  ["anons/çekiliş", /Announcement|Raffle|Contest|Milestone/],
];
for (const [uygulama, yol] of [
  ["online", "src/components/videowall/FotoSahne.tsx"],
  ["self-host", "flowsign-selfhost/src/components/FotoSahne.tsx"],
]) {
  const k = fs.readFileSync(yol, "utf8");
  // Yorumlar taramaya GİRMEZ: başlıkta kullanıcının sözü ("QR yok") geçiyor ve
  // Wall'a atıf var — süs/bağ araması yalnız gerçek koda bakmalı.
  const kod2 = yorumsuz(k);
  const sizan = YASAK.filter(([, r]) => r.test(kod2)).map(([ad]) => ad);
  kontrol(sizan.length === 0, `${uygulama}: etkinlik süsü sızmamış${sizan.length ? ` — SIZAN: ${sizan.join(", ")}` : ""}`);
  kontrol(!/from ["'][^"']*components\/wall\//.test(kod2), `${uygulama}: Wall koduna import YOK (kopya taşır, bağ kurmaz)`);
  const dil = ["fs-marquee", "fs-ken", "fs-drop", "fs-float", "fs-spot", "fs-fade"].filter((c) => !kod2.includes(c));
  kontrol(dil.length === 0, `${uygulama}: Wall animasyon dili taşınmış${dil.length ? ` — eksik: ${dil.join(", ")}` : ""}`);
  const modEksik = ["Mozaik", "Sahne", "Spot", "Polaroid", "Sinema"].filter((m) => !k.includes(`function ${m}(`));
  kontrol(modEksik.length === 0, `${uygulama}: beş modun beşi de çiziliyor${modEksik.length ? ` — eksik: ${modEksik.join(", ")}` : ""}`);
  // Sign'a özel ekleme: foto yazısı ("Ahmet Bey'e teşekkürler") çiziliyor.
  kontrol(k.includes("FotoYazi"), `${uygulama}: foto yazısı destekli`);
}
// Efekt katmanı da Wall'a bağ kurmaz (kendi sfx- kopyası).
for (const [uygulama, yol] of [
  ["online", "src/components/videowall/SahneEfektleri.tsx"],
  ["self-host", "flowsign-selfhost/src/components/SahneEfektleri.tsx"],
]) {
  const k = yorumsuz(fs.readFileSync(yol, "utf8"));
  kontrol(!/from ["'][^"']*components\/wall\/|from ["']@\/components\/(Snowflakes|Hearts|Confetti)/.test(k), `${uygulama}: efekt katmanı kendi kopyası (Wall'a bağ yok)`);
}

// ── 4. seritlereBol — Wall splitStrips kuralları ────────────────────────────
const fnBas = libSrc.indexOf("export function seritlereBol");
const fnSon = libSrc.indexOf("\n}", fnBas) + 2;
const fnKod = libSrc
  .slice(fnBas, fnSon)
  .replace(/export function seritlereBol[^\n]*\n/, "function seritlereBol(fotolar) {\n")
  .replace(/const sol: string\[\] = \[\];/, "const sol = [];")
  .replace(/const sag: string\[\] = \[\];/, "const sag = [];");
const { seritlereBol } = new Function(`${fnKod}; return { seritlereBol };`)();
const F = Array.from({ length: 30 }, (_, i) => `f${i + 1}`);
const s1 = seritlereBol(F);
kontrol(s1.sol.length + s1.sag.length === 24, `en fazla 24 şerit karesi (ölçülen ${s1.sol.length + s1.sag.length})`);
kontrol(Math.abs(s1.sol.length - s1.sag.length) <= 1, "sol/sağ dengeli");
kontrol(s1.sol[0] === "f30", "en yeni fotoğraf şeridin başında (Wall ile aynı: reverse)");
kontrol(JSON.stringify(seritlereBol(F)) === JSON.stringify(seritlereBol(F)), "determinist");
kontrol(seritlereBol([]).sol.length === 0 && seritlereBol([]).sag.length === 0, "boş liste çökertmiyor");
const kucukListe = seritlereBol(["a", "b", "c"]);
kontrol(kucukListe.sol.length === 2 && kucukListe.sag.length === 1, "üç fotoğraf: 2 sol + 1 sağ");

// ── 5. LİNK MODELİ: perde sahne linkini tanır, iframe AÇMAZ ─────────────────
// Gömülü ekran dersi: URL öğesi iframe'le çizilirse alanın içinde ikinci
// uygulama çalışır ve tasarım çözünürlüğünde çizilip küçültülür (kekeme video).
// Sahne linki de aynı kapıdan yerel çizilmeli.
for (const [uygulama, yol] of [
  ["online", "src/components/videowall/PlayerStage.tsx"],
  ["self-host", "flowsign-selfhost/src/components/PlayerStage.tsx"],
]) {
  const k = fs.readFileSync(yol, "utf8");
  kontrol(k.includes("GomuluSahne") && k.includes("sahneAdresi("), `${uygulama}: perde sahne linkini tanıyıp YEREL çizer (iframe değil)`);
}
// sahneAdresi yalnız AYNI köken kabul eder (başkasının /sahne yolu bizim değil).
kontrol(/u\.origin !== o/.test(libSrc), "sahneAdresi yalnız aynı kökeni kabul eder (açık gömme kapısı yok)");

// ── 6. Ortak raf v2 sözü: TAŞIMA YOK, KOPYA VAR (rename yasağı) ─────────────
const rafOnline = yorumsuz(fs.readFileSync("src/app/api/sign/ortak-raf/route.ts", "utf8"));
kontrol(!/rename/.test(rafOnline), "online raf ucunda rename YOK (kopya, taşıma değil)");
kontrol(/auto\/upload/.test(rafOnline) && /f\.set\("file", src\)/.test(rafOnline), "online rafa koy = sunucuda kopya upload");
const rafSelf = yorumsuz(fs.readFileSync("flowsign-selfhost/src/app/api/ortak-raf/route.ts", "utf8"));
kontrol(/copyFile/.test(rafSelf) && !/\brename\(/.test(rafSelf), "self-host rafa koy = fs.copyFile (taşıma değil)");

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
