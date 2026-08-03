/**
 * Giriş kapısı — NEREYE gitmek istediğini kaybetmeden.
 *
 * Neden: paylaşılan bir bağlantıyı (ör. `/edit/abc`, `/wall/x/manage`) açan kişi
 * oturumu yoksa `/login`e atılıyordu; giriş yaptıktan sonra da HUB'a düşüyordu.
 * Yani tıkladığı yere hiç varamıyor, aradığı şeyi listeden yeniden bulması
 * gerekiyordu. On yedi sayfa aynı şeyi yapıyordu.
 *
 * Çözüm iki parça: giden sayfa hedefi `?next=` ile taşır, giriş sayfası da
 * dönüşte oraya bırakır.
 */

/** Girişe giderken şu anki adresi taşı: `/login?next=/edit/abc`. */
export function loginYolu(): string {
  if (typeof window === "undefined") return "/login";
  const hedef = window.location.pathname + window.location.search;
  if (!hedef || hedef === "/" || hedef.startsWith("/login")) return "/login";
  return `/login?next=${encodeURIComponent(hedef)}`;
}

/**
 * Giriş sonrası varılacak adres.
 *
 * GÜVENLİK: yalnız KENDİ sitemizin içindeki yollar kabul edilir. `//baska.site`
 * protokole-göreli bir adrestir ve tarayıcı onu DIŞ siteye götürür — kimlik
 * avına açık kapı bırakmamak için tek eğik çizgiyle başlamayan her şey elenir.
 */
export function girisSonrasi(): string {
  if (typeof window === "undefined") return "/dashboard";
  const ham = new URLSearchParams(window.location.search).get("next");
  if (!ham) return "/dashboard";
  const yol = decodeURIComponent(ham);
  if (!yol.startsWith("/") || yol.startsWith("//")) return "/dashboard";
  return yol;
}
