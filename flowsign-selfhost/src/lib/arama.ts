/**
 * TÜRKÇE DUYARLI ARAMA — liste/matris süzgeçlerinin tek kaynağı.
 *
 * NEDEN AYRI DOSYA VE NEDEN SINAVLI: `toLowerCase().includes()` Türkçede
 * SESSİZCE yanlış çalışır ve yanlışlığı kimse fark etmez — arama sonuç
 * bulamayınca kullanıcı "yok galiba" der, hataya yormaz.
 *
 * İki ayrı tuzak var:
 *  1. `"İSTANBUL".toLowerCase()` → `"i̇stanbul"` — büyük İ'nin noktası AYRI bir
 *     birleşen karakter (U+0307) olarak kalır. Yani "istanbul" yazan kişi
 *     "İSTANBUL"u BULAMAZ. Gözle bakınca iki metin birebir aynı görünür.
 *  2. `I` ile `ı` JS'te farklı harflere düşer (`"I".toLowerCase()` = `"i"`),
 *     ama kullanıcı "gırış" ya da "GIRIS" yazarak "Giriş"i aramak ister.
 *
 * Çözüm: karşılaştırmadan ÖNCE Türkçe harfleri ASCII karşılığına indir, sonra
 * küçült, sonra artakalan birleşen işaretleri temizle. Ekran adları
 * `montaj2_paneller` gibi ASCII de olabilir, `Üretim Panelleri` gibi de —
 * ikisi de aynı kutudan geçer.
 *
 * Sınav: `node tests/arama.test.mjs`
 */
const TR: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i", i: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u", â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u",
};

/** Aramaya girmeden önce metni sadeleştir (Türkçe → ASCII, küçük harf). */
export function nrm(s: string | null | undefined): string {
  return (s ?? "")
    // Türkçe harfler ÖNCE eşlenir: `toLowerCase()` çalıştıktan sonra İ'nin
    // noktası ayrı karakter olur ve eşleme artık tutmaz.
    .replace(/[çÇğĞıIİiöÖşŞüÜâÂîÎûÛ]/g, (m) => TR[m] ?? m)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Metin sorguyu içeriyor mu? Boş sorgu HER ŞEYİ eşler (süzgeç kapalı demektir). */
export function eslesir(metin: string | null | undefined, sorgu: string): boolean {
  const q = nrm(sorgu);
  return !q || nrm(metin).includes(q);
}
