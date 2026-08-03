/**
 * Gömülü ekran YERLEŞİM sınavı — `node tests/gomulu-yerlesim.test.mjs`
 * (önce `npm run build`; playwright yoksa sessizce atlanır).
 *
 * Gömülü ekran artık iframe değil: bağlı ekranın alanları AYNI DOM ağacında,
 * üst alanın kutusu içinde çiziliyor. Bunun dayandığı varsayım şu — alan
 * koordinatları oransal (%) olduğu için iç içe geçtiklerinde kendiliğinden
 * doğru yere düşerler.
 *
 * Varsayım sessizce bozulabilir: üst alana `position: relative` unutulursa iç
 * alanlar EKRANIN tamamına göre konumlanır ve içerik alanın dışına taşar —
 * üstelik `overflow:hidden` yüzünden bu hata "içerik hiç görünmüyor" diye
 * ortaya çıkar, "yanlış yerde" diye değil. Bu yüzden ölçüyoruz.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

let chromium;
try {
  const kok = execSync("npm root -g", { encoding: "utf8" }).trim();
  chromium = createRequire(path.join(kok, "x.js"))("playwright").chromium;
} catch {
  console.log("Atlandı: playwright bulunamadı (`npm i -g playwright`).");
  process.exit(0);
}

const cssDizin = ".next/static/css";
if (!fs.existsSync(cssDizin)) {
  console.log("Atlandı: önce `npm run build` çalıştır.");
  process.exit(0);
}
const css = fs
  .readdirSync(cssDizin)
  .map((f) => path.join(cssDizin, f))
  .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];

/**
 * Sahne 1200×600. Üst alan: sağ yarı (x .5, w .5, tam yükseklik) → 600×600 @ (600,0).
 * Gömülü ekranın alanı: alt yarı (y .5, h .5, tam genişlik) → 600×300 @ (600,300).
 */
const HTML = `
<style>${fs.readFileSync(css, "utf8")}</style>
<main style="position:relative;width:1200px;height:600px;background:#000">
  <div id="ustAlan" class="absolute overflow-hidden" style="left:50%;top:0;width:50%;height:100%;background:#001e64">
    <div class="absolute inset-0">                        <!-- Layer -->
      <div class="absolute inset-0">                      <!-- GomuluEkran -->
        <div id="icAlan" class="absolute overflow-hidden" style="left:0;top:50%;width:100%;height:50%;background:#312e81"></div>
      </div>
    </div>
  </div>
</main>`;

const tarayici = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const sayfa = await tarayici.newPage({ viewport: { width: 1300, height: 700 } });
await sayfa.setContent(HTML);
await sayfa.waitForTimeout(200);

const olcum = await sayfa.evaluate(() => {
  const r = (id) => {
    const b = document.getElementById(id).getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  return { ust: r("ustAlan"), ic: r("icAlan") };
});
await tarayici.close();

const sinavlar = [
  [olcum.ust.w === 600 && olcum.ust.h === 600, `üst alan 600×600 (ölçülen ${olcum.ust.w}×${olcum.ust.h})`],
  [olcum.ic.w === 600 && olcum.ic.h === 300, `iç alan 600×300 (ölçülen ${olcum.ic.w}×${olcum.ic.h})`],
  [olcum.ic.x === olcum.ust.x, `iç alan üst alanla aynı x'te — sahneye göre değil (${olcum.ic.x} / ${olcum.ust.x})`],
  [olcum.ic.y === olcum.ust.y + 300, `iç alan üst alanın ortasından başlıyor (${olcum.ic.y})`],
  [
    olcum.ic.x >= olcum.ust.x && olcum.ic.y + olcum.ic.h <= olcum.ust.y + olcum.ust.h,
    "iç alan üst alanın SINIRLARI içinde kalıyor",
  ],
];

let hata = 0;
for (const [gecti, aciklama] of sinavlar) {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${aciklama}`);
}
console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
