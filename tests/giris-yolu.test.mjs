/**
 * Giriş kapısı sınavı — `node tests/giris-yolu.test.mjs` (depo kökünden).
 *
 * Neden var: `?next=` iki şeyi birden yapmak zorunda — hedefi kaybetmemek VE
 * dışarı açılmamak. `//baska.site` protokole-göreli bir adrestir ve tarayıcı
 * onu DIŞ siteye götürür; kimlik avı bağlantısı tam olarak böyle kurulur.
 * Bu yüzden koruma bir yorum satırı değil, sınav olarak duruyor.
 */
import fs from "node:fs";
const kaynak = fs.readFileSync("src/lib/girisYolu.ts", "utf8").replace(/: string/g, "").replace(/export /g, "");
const yap = new Function("window", `${kaynak}; return { loginYolu, girisSonrasi };`);

const senaryolar = [
  ["/edit/abc", "", "/login?next=%2Fedit%2Fabc"],
  ["/results/x", "?p=1", "/login?next=%2Fresults%2Fx%3Fp%3D1"],
  ["/", "", "/login"],
  ["/login", "?next=/a", "/login"],
];
let hata = 0;
for (const [yol, ara, bekle] of senaryolar) {
  const { loginYolu } = yap({ location: { pathname: yol, search: ara } });
  const c = loginYolu();
  const ok = c === bekle;
  if (!ok) hata++;
  console.log(`${ok ? "✓" : "✗"} loginYolu ${yol}${ara} → ${c}`);
}

const donus = [
  ["?next=%2Fedit%2Fabc", "/edit/abc"],
  ["", "/dashboard"],
  ["?next=%2F%2Fkotu.site%2Fcal", "/dashboard"],      // protokole-göreli → DIŞ site, engellenmeli
  ["?next=https%3A%2F%2Fkotu.site", "/dashboard"],     // mutlak adres → engellenmeli
  ["?next=%2Fwall%2Fx%2Fmanage%3Ft%3D1", "/wall/x/manage?t=1"],
];
for (const [ara, bekle] of donus) {
  const { girisSonrasi } = yap({ location: { search: ara } });
  const c = girisSonrasi();
  const ok = c === bekle;
  if (!ok) hata++;
  console.log(`${ok ? "✓" : "✗"} girisSonrasi ${ara || "(bos)"} → ${c}`);
}
console.log(hata ? `\n${hata} SINAV BAŞARISIZ` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
