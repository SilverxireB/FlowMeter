/**
 * Yetki tablosu YAPIŞIK BAŞLIK sınavı — `node tests/yetki-tablosu.test.mjs`
 * (önce `npm run build`; playwright yoksa sessizce atlanır).
 *
 * NEDEN ÖLÇÜLÜYOR: `position: sticky` bir `<thead>` üzerinde SESSİZCE çalışmaz.
 * İki koşulu birden ister ve ikisi de koddan bakınca doğru görünür:
 *  - kaydırılan kutu thead'in ATASI olmalı (tablo değil, saran div),
 *  - tablo `border-collapse: separate` olmalı — `collapse` ile tarayıcı
 *    başlığı yapıştırmaz (bizim tabloda `border-separate` var, ama biri
 *    "sadeleştirirken" kaldırırsa hiçbir uyarı çıkmaz).
 *
 * Bozulduğunda görünen şey: kırk satırlık tabloda aşağı inince hangi sütunun
 * "Düzenle" hangisinin "Sil" olduğu kaybolur. Yanlış tik atmak sessizdir ve
 * sonucu bir kişinin ekranı silebilmesidir — bu yüzden gözle kontrole
 * bırakılmıyor.
 *
 * Sınav ÇİFT YÖNLÜ: sticky'siz sürümün başlığı kaydırma ile kayboluyor mu, o da
 * ölçülür. Yoksa "geçti" satırı bir şey kanıtlamaz.
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

const PERMS = ["Görüntüle", "Düzenle", "Kopyala", "Sil"];
// Gerçek kurulumdaki ölçek: kırk ekran.
const EKRANLAR = Array.from({ length: 40 }, (_, i) => `ekran_${String(i + 1).padStart(2, "0")}`);

const tablo = (sticky) => `
<style>${fs.readFileSync(css, "utf8")}</style>
<div style="width:760px;padding:16px" class="bg-white">
  <div id="kutu" class="overflow-x-auto max-h-[26rem] overflow-y-auto rounded-xl">
    <table class="w-full text-sm border-separate border-spacing-y-1">
      <thead id="bas" class="${sticky ? "sticky top-0 z-10 bg-paper" : ""}">
        <tr class="text-muted text-[11px] uppercase tracking-wider">
          <th class="text-left font-bold py-1.5">Ekran</th>
          ${PERMS.map((p) => `<th class="font-bold px-2 py-1.5 whitespace-nowrap">${p}</th>`).join("")}
          <th class="font-bold px-2 py-1.5 whitespace-nowrap">Hepsi</th>
        </tr>
      </thead>
      <tbody>
        ${EKRANLAR.map(
          (e) => `<tr class="bg-white">
            <td class="rounded-l-xl px-3 py-2">${e}</td>
            ${PERMS.map(() => `<td class="text-center px-2 py-2"><input type="checkbox" class="w-4 h-4"/></td>`).join("")}
            <td class="text-center px-2 py-2 rounded-r-xl border-l border-line"><input type="checkbox" class="w-4 h-4"/></td>
          </tr>`
        ).join("")}
      </tbody>
    </table>
  </div>
</div>`;

const tarayici = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
});

/** Sonuna kadar kaydır, sonra başlığın kutunun üstünde kalıp kalmadığını ölç. */
async function olc(sticky) {
  const sayfa = await tarayici.newPage({ viewport: { width: 900, height: 700 } });
  await sayfa.setContent(tablo(sticky));
  await sayfa.waitForTimeout(200);
  const o = await sayfa.evaluate(() => {
    const kutu = document.getElementById("kutu");
    const bas = document.getElementById("bas");
    const kaydirilabilir = kutu.scrollHeight > kutu.clientHeight + 10;
    const kutuUst = kutu.getBoundingClientRect().top;
    const onceki = bas.getBoundingClientRect().top;
    kutu.scrollTop = kutu.scrollHeight; // sonuna in
    return new Promise((c) =>
      requestAnimationFrame(() => {
        const sonraki = bas.getBoundingClientRect();
        c({
          kaydirilabilir,
          // Yapışıksa başlık kutunun üst kenarında KALIR (fark ~0);
          // yapışık değilse yukarı kayıp görünmez olur (negatif, çok büyük fark).
          sapma: Math.round(sonraki.top - kutuUst),
          gorunur: sonraki.bottom > kutuUst + 1,
          basUstteydi: Math.round(onceki - kutuUst),
        });
      })
    );
  });
  await sayfa.close();
  return o;
}

let hata = 0;
const kontrol = (gecti, yazi) => {
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

const ile = await olc(true);
const siz = await olc(false);

kontrol(ile.kaydirilabilir, `40 ekranlık tablo gerçekten kaydırılıyor (kutu sınırı çalışıyor)`);
kontrol(Math.abs(ile.sapma) <= 2, `yapışık başlık kaydırdıktan SONRA da kutunun üstünde (sapma ${ile.sapma}px)`);
kontrol(ile.gorunur, "yapışık başlık görünür kalıyor");
// ÇİFT YÖNLÜ: sticky sınıfları olmadan başlık kayıp gitmeli.
kontrol(!siz.gorunur, `sticky OLMADAN başlık kayboluyor (sapma ${siz.sapma}px) — sınav gerçekten ölçüyor`);

await tarayici.close();
console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
