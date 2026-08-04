/**
 * FOTO SAHNE — sabitler + saf yardımcılar.
 *
 * NE: `Görsel · Video · URL · Metin · Saat · Ekran` yanına yeni içerik türü.
 * Alana eklenir, içine fotoğraflar dizilir, mod ve toplam süre verilir; sıra
 * ona gelince o süre boyunca döner.
 *
 * ÇİZİM BURADA DEĞİL (kullanıcı kararı: "yeni bir şey yazma — aynı ürünü
 * taşıyacaktın"). Sahnenin görüntüsü FlowWall perde modlarının Sign'a taşınmış
 * kopyasıdır (`FotoSahne.tsx`); etkinlik süsleri (beğeni/rumuz/taç/QR/anons)
 * bilerek yoktur. Bu dosyada yalnız mod listesi ve saf yardımcılar durur.
 *
 * "Zaman tüneli" BİLEREK YOK: Wall'daki karşılığı fotoğrafın zaman damgasını
 * ister; Sign'da fotoğrafın zamanı yok. Uydurma sıra göstermektense mod olmasın.
 *
 * Sınav: `node tests/foto-sahne.test.mjs`
 */

export type SahneModu = "mozaik" | "polaroid" | "sahne" | "spot" | "sinema";

export interface SahneModuBilgi {
  id: SahneModu;
  ad: string;
  ipucu: string;
}

/**
 * Modlar TEK KAYNAK: panel seçicisi ve rehber tablosu buradan türer — yeni mod
 * eklenince ikisi de kendiliğinden güncellenir. Adlar ve davranış Wall'ın perde
 * modlarıyla birebir (Sahne/Mozaik/Spot/Polaroid/Sinema).
 */
export const SAHNE_MODLARI: SahneModuBilgi[] = [
  { id: "mozaik", ad: "Mozaik", ipucu: "Tüm fotoğraflar canlı, kayan sütunlarda" },
  { id: "sahne", ad: "Sahne", ipucu: "Ortada büyük kare + yanlarda akan şeritler" },
  { id: "spot", ad: "Spot", ipucu: "Biri öne çıkar, diğerleri soluk arkada" },
  { id: "polaroid", ad: "Polaroid", ipucu: "Saçılmış eğik kartlar; sırayla biri tepeye düşer" },
  { id: "sinema", ad: "Sinema", ipucu: "Tam alanda tek kare, sinematik geçiş" },
];

export const SAHNE_MODU_VARSAYILAN: SahneModu = "mozaik";

/**
 * Sahne modunun yan şeritleri — Wall `splitStrips` ile AYNI kural: son 24
 * fotoğraf, sırayla sol/sağ. SAF işlev; sınav determinizmini ve dengeyi ölçer.
 */
export function seritlereBol(fotolar: string[]): { sol: string[]; sag: string[] } {
  const son = [...fotolar].reverse().slice(0, 24);
  const sol: string[] = [];
  const sag: string[] = [];
  son.forEach((m, i) => (i % 2 === 0 ? sol : sag).push(m));
  return { sol, sag };
}
