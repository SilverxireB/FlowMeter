/**
 * FlowSign YERLEŞİM sınavı — kenar çekme ve bölme geometrisi.
 *
 * Neden ayrı bir sınav: yerleşim hatası ekranda "biraz değişik" görünür, hata
 * vermez. Bir kez üretimde alanların kendiliğinden kaydığı bir bozulma yaşandı
 * (okuma/yazma/bölme farklı sınırlara bakıyordu) ve fark edilmesi günler aldı.
 * Buradaki değişmezler onu erken yakalar: alanlar ÇAKIŞMAZ, boşluk KALMAZ
 * (toplam alan = 1), dokunulmayan alan AYNI kalır.
 *
 * Çalıştırmak için (depoya bağımlılık eklenmedi — geçici kurulum):
 *   mkdir -p /tmp/sl && cd /tmp/sl
 *   # videowalls.ts'in saf geometri kısmını çıkar (Firebase importları olmadan):
 *   python3 - <<'EOF'
 *   import re
 *   src = open("<depo>/src/lib/videowalls.ts", encoding="utf-8").read()
 *   kes = src[:src.index("export async function")]
 *   kes = re.sub(r'import\s+[\s\S]*?from\s+"[^"]+";\s*', "", kes)
 *   open("geo.ts","w",encoding="utf-8").write(kes)
 *   EOF
 *   npx tsc geo.ts --target ES2020 --module ESNext --skipLibCheck && mv geo.js geo.mjs
 *   cp <depo>/tests/sign-layout.test.mjs run.mjs && node run.mjs
 *
 * Son durum: 17 sınav, hepsi geçiyor.
 */
import { resizeZoneEdge, splitZoneInto, zoneCells, gridZones } from "./geo.mjs";

let ok = 0, bad = 0;
const t = (ad, kosul, ek = "") => { if (kosul) { ok++; console.log("  ok   " + ad); } else { bad++; console.log("  FAIL " + ad + " " + ek); } };
const yakla = (a, b) => Math.abs(a - b) < 1e-9;

// Bir duvarin gecerliligi: alanlar ortusmez, bosluk kalmaz (toplam alan = 1)
function gecerli(zones) {
  const toplam = zones.reduce((a, z) => a + z.w * z.h, 0);
  for (let i = 0; i < zones.length; i++)
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i], b = zones[j];
      const ort = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
                  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (ort > 1e-9) return { ok: false, neden: `ortusme ${i}-${j}` };
    }
  return { ok: yakla(toplam, 1), neden: `toplam=${toplam}` };
}

console.log("\n2 SUTUN — sag kenari %70'e cek");
{
  let g = gridZones(2, 1);           // iki esit sutun
  const r = resizeZoneEdge(g, 2, 1, g[0].id, "r", 0.7);
  t("sonuc dondu", !!r);
  if (r) {
    const v = gecerli(r.zones);
    t("duvar gecerli (bosluk/ortusme yok)", v.ok, v.neden);
    t("sol alan ~%70", Math.abs(r.zones.find(z => z.id === g[0].id).w - 0.7) <= 0.03,
      "w=" + r.zones.find(z => z.id === g[0].id).w);
    t("sag alan kalani aldi", Math.abs(r.zones.find(z => z.id !== g[0].id).w - 0.3) <= 0.03);
  }
}

console.log("\n3 SUTUN — ortadaki alanin sol kenarini cek, ucuncu alan BOZULMASIN");
{
  let g = gridZones(3, 1);
  const ucuncu = { ...g[2] };
  const r = resizeZoneEdge(g, 3, 1, g[1].id, "l", 0.1);
  t("sonuc dondu", !!r);
  if (r) {
    const v = gecerli(r.zones);
    t("duvar gecerli", v.ok, v.neden);
    const u = r.zones.find(z => z.id === ucuncu.id);
    t("dokunulmayan 3. alan AYNI kaldi", yakla(u.x, ucuncu.x) && yakla(u.w, ucuncu.w),
      `x=${u.x} w=${u.w} (beklenen x=${ucuncu.x} w=${ucuncu.w})`);
  }
}

console.log("\nDIS KENAR cekilemez");
{
  let g = gridZones(2, 1);
  t("sol duvarin sol kenari reddedilir", resizeZoneEdge(g, 2, 1, g[0].id, "l", 0.3) === null);
}

console.log("\nDIKEY: 1x2 duvarda alt kenari cek");
{
  let g = gridZones(1, 2);
  const r = resizeZoneEdge(g, 1, 2, g[0].id, "b", 0.25);
  t("sonuc dondu", !!r);
  if (r) {
    const v = gecerli(r.zones);
    t("duvar gecerli", v.ok, v.neden);
    t("ust alan ~%25", Math.abs(r.zones.find(z => z.id === g[0].id).h - 0.25) <= 0.03);
  }
}

console.log("\nBOLME SONRASI cekme (izgara katlanmis durumda)");
{
  let g = gridZones(3, 1);
  const s = splitZoneInto(g, 3, 1, g[0].id, 2, 2);   // ilk alani 2x2 bol
  t("bolme dondu", !!s);
  if (s) {
    const v0 = gecerli(s.zones);
    t("bolme sonrasi duvar gecerli", v0.ok, v0.neden);
    const hedef = s.zones[0];
    const r = resizeZoneEdge(s.zones, s.cols, s.rows, hedef.id, "r", 0.1);
    if (r) {
      const v = gecerli(r.zones);
      t("cekme sonrasi duvar gecerli", v.ok, v.neden);
    } else t("cekme guvenli sekilde reddedildi (sinir temiz degil)", true);
  }
}

console.log("\nSINIRA BINEN alan varsa DOKUNMAZ");
{
  // Ust satirda tek genis alan, alt satirda iki alan -> ortadaki dikey sinir ustte yok
  const zones = [
    { id: "ust", x: 0, y: 0, w: 1, h: 0.5, items: [] },
    { id: "sol", x: 0, y: 0.5, w: 0.5, h: 0.5, items: [] },
    { id: "sag", x: 0.5, y: 0.5, w: 0.5, h: 0.5, items: [] },
  ];
  const r = resizeZoneEdge(zones, 2, 2, "sol", "r", 0.75);
  t("sonuc dondu", !!r);
  if (r) {
    const v = gecerli(r.zones);
    t("duvar gecerli", v.ok, v.neden);
    const u = r.zones.find(z => z.id === "ust");
    t("ust alan tam genislikte kaldi", yakla(u.w, 1), "w=" + u.w);
  }
}

console.log(`\n${ok} gecti, ${bad} kaldi\n`);
process.exit(bad ? 1 : 0);
