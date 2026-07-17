/**
 * Bir Firestore yazması `ms` içinde dönmezse anlaşılır bir hatayla reddeder.
 *
 * Neden: Günlük yazma kotası dolunca (ör. Spark planında) Firestore yazmaları
 * reddetmez, askıya alır → promise hiç dönmez → buton sonsuza kadar "gönderiliyor"
 * kalır. Bu sarmalayıcı ile yazma en fazla `ms` bekler, sonra çağıran yerdeki
 * mevcut try/catch tetiklenip kullanıcıya "tekrar dene" mesajı gösterilir.
 */
export const WRITE_TIMEOUT_MESSAGE =
  "Sunucuya ulaşılamadı (bağlantı veya günlük kota sorunu olabilir). Lütfen biraz sonra tekrar dene.";

export function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(WRITE_TIMEOUT_MESSAGE)), ms)
    ),
  ]);
}
