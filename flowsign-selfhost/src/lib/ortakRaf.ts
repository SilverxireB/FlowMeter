/**
 * ORTAK RAF — kurumun paylaşılan medyası (self-host).
 *
 * NEDEN VAR: kütüphane bir depo değil, bir DAĞITIM aracı. Kurumsaldan gelen
 * "bekofilmi" videosu bir ekranda açılıyor, sonra "sen de şurada aç" deniyor.
 * Ortak raf olmadan ikinci kişi dosyayı arıyor ya da USB'yle taşıyor.
 *
 * NEDEN OTOMATİK DEĞİL: her yüklenen dosya ortak havuza akarsa havuz bir yıl
 * içinde çöplüğe döner. Paylaşmak bir EYLEMDİR — rafta yalnız birinin bilerek
 * koyduğu şey bulunur, yani raf kendiliğinden küratörlü kalır.
 *
 * YETKİ (kullanıcı kararı): rafa HERKES koyar, raftan YALNIZ YÖNETİCİ siler.
 * Koymak ucuz ve geri alınabilir; silmek başkasının ekranını karartabilir.
 *
 * DEPOLAMA — yapısal güvence: raf dosyaları `data/media/_ortak/` altında,
 * ekranlarınki `data/media/{ekranId}/`. Ekran silme o ekranın klasörünü
 * topluca kaldırıyor; raf BAŞKA bir klasörde olduğu için o silme rafa
 * ULAŞAMAZ. "Unutmayalım" cinsinden bir söz değil, klasör yapısının garantisi.
 *
 * PAYLAŞMAK = TAŞIMAK (kopyalamak değil): aynı dosya iki yerde durup diski iki
 * kez yemesin ve "hangisi gitti" karışmasın.
 *
 * Sınav: `node tests/ortak-raf.test.mjs`
 */
import { Zone } from "./types";

/** Raf klasörü — ekran klasörlerinden AYRI. Ekran kimlikleri `vw-…` olduğu
 *  için çakışamaz; alttaki kontrol bu güvenceyi sınavlanabilir kılar. */
export const ORTAK_KLASOR = "_ortak";

export interface RafOgesi {
  id: string;
  kind: "image" | "video";
  src: string;
  name: string;
  /** Denetim izi: rafa kim koydu, ne zaman. */
  by?: string;
  at?: number;
  /** Hangi ekrandan paylaşıldı (bilgi; ekran silinse de raf etkilenmez). */
  fromWall?: string;
}

/** Ekran klasörü raf klasörüyle çakışıyor mu? (Çakışsaydı silme rafı süpürürdü.) */
export function klasorCakisiyorMu(wallId: string): boolean {
  return wallId === ORTAK_KLASOR;
}

/**
 * Bir öğe rafa taşındıktan sonra ekranın kendi listelerini yeni adrese çevir.
 * SAF işlev. Aynı dosya birden çok alanda kullanılıyor olabilir — hepsi
 * çevrilmeli, yoksa bir alan çalışır diğeri kırık kalır (ancak perdede belli olur).
 */
export function adresDegistir(zones: Zone[] | undefined, eski: string, yeni: string): Zone[] {
  return (zones ?? []).map((z) => ({
    ...z,
    items: (z.items ?? []).map((it) => (it.src === eski ? { ...it, src: yeni } : it)),
  }));
}

/** Ekranın taslak + yayın kopyalarında toplam kaç öğe bu adresi kullanıyor. */
export function adresKullanimSayisi(
  vw: { zones?: Zone[]; live?: { zones?: Zone[] } | null },
  src: string
): number {
  const say = (zones: Zone[] | undefined) =>
    (zones ?? []).reduce((n, z) => n + (z.items ?? []).filter((it) => it.src === src).length, 0);
  return say(vw.zones) + say(vw.live?.zones);
}

/** `/media/{ekran}/{dosya}` → dosya adı (taşıma/silme bunu ister). */
export function medyaDosyaAdi(src: string): string {
  const parcalar = src.split("/").filter(Boolean);
  return parcalar[parcalar.length - 1] ?? "";
}

/** Adres raf klasöründe mi? (Silme ucu yalnız rafa dokunabilsin.) */
export function raftaMi(src: string): boolean {
  return src.startsWith(`/media/${ORTAK_KLASOR}/`);
}
