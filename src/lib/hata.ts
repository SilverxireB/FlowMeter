/**
 * Firebase hatalarını kullanıcıya anlatılabilir Türkçeye çevirir (kokpit geneli).
 *
 * Neden gerekli: kokpit ekranları `e.message`'ı olduğu gibi basıyordu ve kullanıcı
 * kırmızı bir kutuda "Missing or insufficient permissions." görüyordu. Bu cümle
 * hem İngilizce hem de yanıltıcı: çoğu zaman yetki YOKTUR anlamına gelmez —
 * oturum jetonu tazelenemediği için istek KİMLİKSİZ gitmiştir. Fabrika iç ağında
 * bunun sebebi ağın Google uç noktalarını kapatması oluyor ve ekranda bunu
 * söyleyen tek kelime yoktu.
 */
export function studioHata(e: unknown, yedek = "İşlem tamamlanamadı."): string {
  const kod = (e as { code?: string } | null)?.code ?? "";
  const mesaj = e instanceof Error ? e.message : "";

  if (kod === "permission-denied" || /insufficient permissions/i.test(mesaj))
    return "Sunucu isteği kabul etmedi. En sık sebebi oturumun tazelenememesi: ağ Google adreslerini engelliyorsa istek kimliksiz gider. Çıkış yapıp yeniden gir; sürerse başka bir ağda dene.";
  if (kod === "unavailable" || /offline|network/i.test(mesaj))
    return "Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dene.";
  if (kod === "unauthenticated") return "Oturumun düşmüş. Çıkış yapıp yeniden gir.";
  if (kod === "failed-precondition" && /index/i.test(mesaj))
    return "Bu sorgu için veritabanı dizini eksik (geliştiriciye bildir).";
  if (kod === "resource-exhausted") return "Günlük kota doldu — yarın tekrar dene.";
  return mesaj || yedek;
}
