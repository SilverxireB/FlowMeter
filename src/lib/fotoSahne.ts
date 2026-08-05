/**
 * FOTO SAHNE — sabitler + saf yardımcılar.
 *
 * NE: kendi LİNKİ olan bağımsız bir hatıra köşesi (Wall mantığı, sadeleşmiş).
 * Sahne bir kayıttır: fotoğrafları KENDİNE yüklenir, modu/efekti kendindedir,
 * `/sahne/{id}` linki üretir. Sign ekranına girmesi = o linkin bir alana URL
 * olarak eklenmesi; perde linki TANIR ve sahneyi iframe'siz, aynı ağaçta çizer
 * (gömülü ekran dersinin aynısı — link kullanıcı için, perde için değil).
 *
 * ÇİZİM YENİDEN YAZILMADI (kullanıcı kararı: "yeni bir şey yazma — aynı ürünü
 * taşıyacaktın"): FlowWall perde modlarının Sign'a taşınmış kopyası
 * (`FotoSahne.tsx`). Etkinlik süsleri (beğeni/rumuz/taç/QR/anons/çekiliş/
 * moderasyon) bilerek yok. "Son yüklenen öne çıkar" yok — sıra yükleme sırası.
 *
 * "Zaman tüneli" BİLEREK YOK: Wall'daki karşılığı fotoğrafın zaman damgasını
 * ister; burada uydurma sıra göstermektense mod olmasın.
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
 * Modlar TEK KAYNAK: yönetim seçicisi ve rehber tablosu buradan türer — yeni
 * mod eklenince ikisi de kendiliğinden güncellenir. Adlar ve davranış Wall'ın
 * perde modlarıyla birebir (Sahne/Mozaik/Spot/Polaroid/Sinema).
 */
export const SAHNE_MODLARI: SahneModuBilgi[] = [
  { id: "mozaik", ad: "Mozaik", ipucu: "Tüm fotoğraflar canlı, kayan sütunlarda" },
  { id: "sahne", ad: "Sahne", ipucu: "Ortada büyük kare + yanlarda akan şeritler" },
  { id: "spot", ad: "Spot", ipucu: "Biri öne çıkar, diğerleri soluk arkada" },
  { id: "polaroid", ad: "Polaroid", ipucu: "Saçılmış eğik kartlar; sırayla biri tepeye düşer" },
  { id: "sinema", ad: "Sinema", ipucu: "Tam alanda tek kare, sinematik geçiş" },
];

export const SAHNE_MODU_VARSAYILAN: SahneModu = "mozaik";

/** Sahne zemini — Wall'ın koyu lacivert perde rengi (kullanıcı değiştirebilir). */
export const SAHNE_ZEMIN_VARSAYILAN = "#05091c";

/** Zemin KARTELASI — marka renklerimiz (native renk seçicinin cırtlak seti değil).
 *  "Özel" ile yine her renk seçilebilir; kartela hızlı ve markaya uygun yolu verir. */
export const SAHNE_ZEMINLERI: { renk: string; ad: string }[] = [
  { renk: "#05091c", ad: "Wall laciverti (varsayılan)" },
  { renk: "#001e64", ad: "Logo lacisi" },
  { renk: "#1e1b4b", ad: "Koyu indigo" },
  { renk: "#312e81", ad: "İndigo" },
  { renk: "#000000", ad: "Siyah" },
  { renk: "#101014", ad: "Kömür" },
  { renk: "#4f46e5", ad: "Accent" },
  { renk: "#e11d48", ad: "Gül" },
  { renk: "#ffffff", ad: "Beyaz" },
];

/** Otomatik kipte modlar arası geçiş aralığı (Wall autoIntervalSec varsayılanıyla aynı: 30 sn). */
export const MOD_GECIS_MS = 30_000;

/** Ambient efekt — Wall perdesindeki katmanın Sign kopyası (SahneEfektleri). */
export type SahneEfektAd = "none" | "snow" | "confetti" | "fireworks" | "hearts" | "balloons" | "bubbles" | "stars";

export const SAHNE_EFEKTLERI: { id: SahneEfektAd; ad: string; ikon: string }[] = [
  { id: "none", ad: "Yok", ikon: "🚫" },
  { id: "snow", ad: "Kar", ikon: "❄️" },
  { id: "confetti", ad: "Konfeti", ikon: "🎊" },
  { id: "fireworks", ad: "Havai fişek", ikon: "🎆" },
  { id: "hearts", ad: "Kalp", ikon: "💗" },
  { id: "balloons", ad: "Balon", ikon: "🎈" },
  { id: "bubbles", ad: "Kabarcık", ikon: "🫧" },
  { id: "stars", ad: "Yıldız", ikon: "✨" },
];

/** Sahnedeki tek fotoğraf. `yazi` = fotoğrafın alt yazısı ("Ahmet Bey'e teşekkürler"). */
export interface SahneFoto {
  src: string;
  yazi?: string;
  /** Online: Cloudinary public_id (temizlikte kesin kimlik). Self-host kullanmaz. */
  cloudinaryId?: string;
  at?: number;
}

/** Sahne kaydı — kendi linki olan bağımsız içerik (`/sahne/{id}`). */
export interface FotoSahneKaydi {
  id: string;
  /** Oluşturan (silme yetkisi). Self-host'ta giriş adı. */
  ownerId?: string;
  /**
   * DÜZENLEYEBİLENLER — yetkiyi YÖNETİCİ verir (Sign yetkileri sayfası;
   * kullanıcı kararı: "ayrım istemiyorum, yetkiyi yönetici versin").
   * Online: uid listesi · self-host: giriş adı listesi. Sahibi + yönetici
   * her zaman yetkilidir; listedeki kişi İÇERİĞİ düzenler ama listeyi ve
   * sahipliği DEĞİŞTİREMEZ (kendi yetkisini büyütemez).
   */
  duzenleyenler?: string[];
  ownerName?: string;
  name: string;
  mod?: SahneModu;
  /** Otomatik kip: `modlar` listesindeki modlar 30 sn'de bir sırayla döner. */
  otomatik?: boolean;
  modlar?: SahneModu[];
  efekt?: SahneEfektAd;
  /** Sahne zemin rengi (hex). Yoksa Wall laciverti. */
  zemin?: string;
  /** Sıra = yükleme sırası ("son yüklenen öne çıkar" bilerek yok). */
  fotolar?: SahneFoto[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * URL bir foto sahne linki mi? YALNIZ aynı köken (başkasının sitesindeki
 * /sahne yolu bizim sahnemiz değildir). Perde ve editör bununla tanıyıp
 * sahneyi iframe'siz çizer.
 */
export function sahneAdresi(src?: string, origin?: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src, origin ?? (typeof window !== "undefined" ? window.location.origin : undefined));
    const o = origin ?? (typeof window !== "undefined" ? window.location.origin : null);
    if (!o || u.origin !== o) return null;
    const m = /^\/sahne\/([A-Za-z0-9_-]{4,64})\/?$/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Sahne modunun yan şeritleri — Wall `splitStrips` ile AYNI kural: son 24
 * fotoğraf, sırayla sol/sağ. SAF işlev; sınav determinizmi ve dengeyi ölçer.
 */
export function seritlereBol(fotolar: string[]): { sol: string[]; sag: string[] } {
  const son = [...fotolar].reverse().slice(0, 24);
  const sol: string[] = [];
  const sag: string[] = [];
  son.forEach((m, i) => (i % 2 === 0 ? sol : sag).push(m));
  return { sol, sag };
}
