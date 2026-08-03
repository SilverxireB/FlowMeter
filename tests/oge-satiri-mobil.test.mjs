/**
 * Öğe satırı MOBİL sınavı — `node tests/oge-satiri-mobil.test.mjs`
 * (önce `npm run build`; playwright yoksa sessizce atlanır).
 *
 * NE OLMUŞTU: dar telefonda alan panelindeki öğe satırı okunamaz hâle geliyordu.
 * Sabit kontroller (▲▼ + sıra no + minyatür + ayar + sil ≈ 236px) 360px'lik
 * ekranda ada ve rozetlere ~120px bırakıyordu; rozetlerin `whitespace-nowrap`ı
 * olmadığı için içerik KARAKTER KARAKTER sarıyordu — "⏱ 9 sn" iki satır,
 * "🗓 08-04 – 08-07" DÖRT satır, "VİDEO" rozeti ortadan kesik.
 *
 * Sınav iki şeyi ölçer, ikisi de gözle kolayca kaçırılır:
 *  1. Hiçbir rozet iki satıra taşmıyor (yükseklik tek satır kadar).
 *  2. Rozet şeridi satırın kutusundan taşmıyor.
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

// Panelin gerçek yapısı: kart → satır → [kontroller][ad+rozetler][ayar][sil]
const HTML = `
<style>${fs.readFileSync(css, "utf8")}</style>
<!-- gerçek yerleşim: section px-4 (16) + kart p-5 (20) = her yandan 36px -->
<div style="width:100%;padding:36px" class="bg-white">
  <div id="kart" class="rounded-xl bg-paper border border-line p-2.5 flex flex-col gap-2">
    <div class="flex items-start gap-2 flex-wrap sm:flex-nowrap">
      <span class="shrink-0 flex flex-col">
        <button class="w-9 h-7"></button><button class="w-9 h-7"></button>
      </span>
      <span class="shrink-0 w-6 h-6 rounded-full bg-wash border border-line"></span>
      <span class="w-14 h-14 rounded-lg shrink-0 bg-line"></span>
      <div id="metin" class="order-last basis-full sm:order-none sm:basis-auto flex-1 min-w-0">
        <p class="text-sm font-semibold truncate">278185-uzun-dosya-adi-ornegi.mp4</p>
        <span id="serit" class="flex items-center gap-1.5 mt-1 flex-wrap min-w-0">
          <span class="rozet text-[10px] uppercase tracking-wider text-accent-dark bg-accent-soft rounded px-1.5 py-0.5 truncate max-w-full shrink-0">VİDEO</span>
          <span class="rozet text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5 tabular-nums truncate max-w-full shrink-0">⏱ 9 sn</span>
          <span class="rozet text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5 tabular-nums truncate max-w-full shrink-0">🗓 08-04 – 08-07</span>
          <span class="rozet text-[10px] rounded px-1.5 py-0.5 truncate max-w-full shrink-0 bg-[#eda100]/12 text-[#8a6100] font-bold">süresi doldu</span>
        </span>
      </div>
      <button class="shrink-0 w-9 h-9"></button>
      <button class="shrink-0 w-9 h-9"></button>
    </div>
  </div>
</div>`;

const tarayici = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
});

let hata = 0;
for (const genislik of [320, 360, 412]) {
  const sayfa = await tarayici.newPage({ viewport: { width: genislik, height: 800 } });
  await sayfa.setContent(HTML);
  await sayfa.waitForTimeout(250);
  const o = await sayfa.evaluate(() => {
    const rozetler = [...document.querySelectorAll(".rozet")].map((e) => {
      const r = e.getBoundingClientRect();
      const satir = parseFloat(getComputedStyle(e).lineHeight) || 14;
      return { metin: e.textContent.trim(), h: Math.round(r.height), tekSatir: r.height < satir * 1.9, sag: r.right };
    });
    const serit = document.getElementById("serit").getBoundingClientRect();
    return { rozetler, seritSag: serit.right, kartSag: document.getElementById("kart").getBoundingClientRect().right };
  });
  const sarma = o.rozetler.filter((r) => !r.tekSatir);
  const tasma = o.rozetler.filter((r) => r.sag > o.kartSag + 1);
  const gecti = sarma.length === 0 && tasma.length === 0;
  if (!gecti) hata++;
  console.log(
    `${gecti ? "✓" : "✗"} ${genislik}px — rozetler tek satır${sarma.length ? `, SARAN: ${sarma.map((r) => `"${r.metin}" (${r.h}px)`).join(", ")}` : ""}${
      tasma.length ? `, TAŞAN: ${tasma.map((r) => r.metin).join(", ")}` : ""
    }`
  );
  await sayfa.close();
}
await tarayici.close();

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
