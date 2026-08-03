/**
 * Sunum menüsü yığın sınavı — `node tests/menu-yigin.test.mjs` (önce `npm run build`).
 *
 * NEDEN VAR: menü telefonda slayt kartının ARKASINDA kalıyordu; "Kumanda"nın
 * yarısı görünüyor, "Moderasyon" hiç görünmüyordu. Sebep menünün z-40'ı küçük
 * olması DEĞİL:
 *   - editör başlığındaki `backdrop-blur` kendi yığın bağlamını açar, yani
 *     içerideki `z-40` yalnız başlığın içinde bir anlam taşır,
 *   - başlığın kendisi konumlandırılmamıştı; boyama sırasında filtreli öğe
 *     "z-index:0 konumlandırılmış" gibi davranır,
 *   - slayt önizlemesinin kökü `relative` (konumlandırılmış, z-auto) ve DOM'da
 *     SONRA gelir → aynı katmanda, ağaç sırasıyla üste biner.
 * Çözüm başlığı `relative z-40` ile pozitif katmana almak.
 *
 * Sınav bunu iki yönlü doğrular: sınıf kaldırılırsa kart menüyü ÖRTMELİ,
 * konulunca menü ÜSTTE olmalı. Yani bir gün biri o sınıfı "gereksiz" diye
 * silerse burada patlar.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// Playwright depoya bağımlılık olarak EKLENMEDİ (üretim paketini şişirmesin);
// küresel kurulumdan çözülür. Yoksa sınav sessizce atlanır — CI'sız bir depoda
// "çalıştıramadım" ile "başarısız" birbirine karışmasın.
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
// Tailwind paketi en büyük CSS dosyasıdır; rota parçaları küçük olur.
const css = fs
  .readdirSync(cssDizin)
  .map((f) => path.join(cssDizin, f))
  .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];

const HTML = (baslikSinifi) => `
<style>${fs.readFileSync(css, "utf8")}</style>
<main style="height:620px;display:flex;flex-direction:column">
  <header id="bas" class="${baslikSinifi}" style="padding:12px;flex-shrink:0">
    <div style="position:relative;height:24px">
      <div id="menu" class="z-40 card" style="position:absolute;right:0;top:100%;width:224px;height:300px"></div>
    </div>
  </header>
  <section style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:12px">
    <div id="kart" class="card animate-pop relative" style="width:100%;height:420px"></div>
  </section>
</main>`;

const tarayici = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
});

async function menuUsttemi(baslikSinifi) {
  const sayfa = await tarayici.newPage({ viewport: { width: 412, height: 620 } });
  await sayfa.setContent(HTML(baslikSinifi));
  await sayfa.waitForTimeout(400); // animate-pop bitsin
  const sonuc = await sayfa.evaluate(() => {
    const m = document.getElementById("menu").getBoundingClientRect();
    const ust = document.elementFromPoint(m.left + m.width / 2, m.bottom - 20);
    return ust?.id ?? "?";
  });
  await sayfa.close();
  return sonuc === "menu";
}

const sinavlar = [
  ["bg-white/80 backdrop-blur", false, "sınıf yokken kart menüyü örtmeli (hatanın kendisi)"],
  ["relative z-40 bg-white/80 backdrop-blur", true, "relative z-40 ile menü üstte olmalı"],
];

let hata = 0;
for (const [sinif, beklenen, aciklama] of sinavlar) {
  const oldu = await menuUsttemi(sinif);
  const gecti = oldu === beklenen;
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${aciklama}`);
}
await tarayici.close();

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
