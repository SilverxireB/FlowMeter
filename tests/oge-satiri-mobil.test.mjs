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

// ── AYAR SATIRI (⚙ ile açılan Saat / Tarih) ─────────────────────────────────
// İKİNCİ TAŞMA: `<input type="time">` ve `<input type="date">` yerel girdiler,
// kendi ASGARİ genişlikleri var (Chromium'da tarih ~120px) ve `min-width:auto`
// ile flex kutusundan küçülmezler. "Tarih [girdi] – [girdi]" tek satırda ~380px
// istiyor; 360px telefonda ikinci girdi ekranın dışında kalıyor, takvim oku
// kesiliyordu. Çözüm: etiket ayrı satırda kalsın, girdi çifti `basis-full` ile
// TAM satır alsın ve girdiler `min-w-0 flex-1` ile küçülebilsin.
// `min-w-0` ETİKETTE de gerekiyor: etiketin kendisi de bir flex öğesi ve
// varsayılan `min-width:auto` ile içeriğinin altına inemiyor — 320px'de girdiler
// tam satırı alsa bile etiket kutusu dışarı taşıyordu (ölçüldü: 2 girdi taşkın).
const ayarSatiri = (yeni) => `
<style>${fs.readFileSync(css, "utf8")}</style>
<div style="width:100%;padding:36px" class="bg-white">
  <div id="kart" class="rounded-xl bg-paper border border-line p-2.5">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pl-9 text-xs text-muted">
      <label class="flex items-center gap-1.5">Süre
        <input type="number" value="8" class="w-20 input-base !rounded-lg !px-2 !py-1 tabular-nums" /> sn
      </label>
      ${["time", "date"]
        .map((t) =>
          yeni
            ? `<label class="flex flex-wrap items-center gap-1.5 min-w-0">
                 <span class="shrink-0">${t === "time" ? "Saat" : "Tarih"}</span>
                 <span class="flex items-center gap-1.5 basis-full sm:basis-auto min-w-0">
                   <input class="girdi input-base !rounded-lg px-2 py-1 min-w-0 flex-1" type="${t}" />
                   –
                   <input class="girdi input-base !rounded-lg px-2 py-1 min-w-0 flex-1" type="${t}" />
                 </span>
               </label>`
            : `<label class="flex items-center gap-1.5">${t === "time" ? "Saat" : "Tarih"}
                 <input class="girdi input-base !rounded-lg px-2 py-1" type="${t}" />
                 –
                 <input class="girdi input-base !rounded-lg px-2 py-1" type="${t}" />
               </label>`
        )
        .join("")}
    </div>
  </div>
</div>`;

/** Kart kutusundan taşan girdi sayısı. */
async function tasanGirdi(genislik, html) {
  const sayfa = await tarayici.newPage({ viewport: { width: genislik, height: 900 } });
  await sayfa.setContent(html);
  await sayfa.waitForTimeout(250);
  const n = await sayfa.evaluate(() => {
    const sag = document.getElementById("kart").getBoundingClientRect().right;
    return [...document.querySelectorAll(".girdi")].filter((e) => e.getBoundingClientRect().right > sag + 1).length;
  });
  await sayfa.close();
  return n;
}

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

// Sınav ÇİFT YÖNLÜ: eski yapının dar ekranda taştığını da ölçer. Yoksa "geçti"
// satırı düzeltmeyi değil, ölçümün hiçbir şeye bakmadığını gösterirdi.
for (const genislik of [320, 360]) {
  const eski = await tasanGirdi(genislik, ayarSatiri(false));
  const yeni = await tasanGirdi(genislik, ayarSatiri(true));
  const gecti = yeni === 0 && eski > 0;
  if (!gecti) hata++;
  console.log(
    `${gecti ? "✓" : "✗"} ${genislik}px — Saat/Tarih girdileri karta sığıyor (eski yapıda taşan: ${eski}, yeni: ${yeni})${
      eski === 0 ? "  ⚠ eski yapı da taşmıyor: sınav bir şey ölçmüyor" : ""
    }`
  );
}
await tarayici.close();

console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
