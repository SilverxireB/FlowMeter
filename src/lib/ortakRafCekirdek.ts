/**
 * ORTAK RAF — ÇEKİRDEK (sabitler + saf işlevler).
 *
 * NEDEN VAR: kütüphane bir depo değil, bir DAĞITIM aracı. Kurumsaldan gelen
 * "bekofilmi" videosu bir ekranda açılıyor, sonra "sen de şurada aç" deniyor.
 * Ortak raf olmadan ikinci kişi dosyayı arıyor ya da USB'yle taşıyor.
 *
 * NEDEN OTOMATİK DEĞİL: her yüklenen dosya ortak havuza akarsa havuz bir yıl
 * içinde çöplüğe döner (mevcut .NET uygulamasında olan tam olarak bu).
 * Paylaşmak bir EYLEMDİR — rafta yalnız birinin bilerek koyduğu şey bulunur,
 * yani raf kendiliğinden küratörlü kalır.
 *
 * YETKİ (kullanıcı kararı): rafa HERKES koyar, raftan YALNIZ YÖNETİCİ siler.
 * Koymak ucuz ve geri alınabilir; silmek başkasının ekranını karartabilir.
 *
 * DEPOLAMA — yapısal güvence: raf dosyaları AYRI bir üst klasörde durur
 * (`flowsign-ortak/`), ekranların klasörü `flowsign/{ekranId}/`. Ekran silme
 * akışı `flowsign/{id}` ön ekini topluca temizliyor; raf BAŞKA bir ağaçta
 * olduğu için o temizlik rafa ULAŞAMAZ. Bu, "unutmayalım" cinsinden bir söz
 * değil, klasör yapısının kendisinden gelen bir garanti.
 *
 * PAYLAŞMAK = TAŞIMAK (kopyalamak değil). Kopyalasaydık aynı dosya iki yerde
 * durur, kota iki kez yenir ve ekran silinince "hangisi gitti" karışırdı.
 * Taşıma sonrası paylaşan ekranın kendi öğeleri yeni adrese çevrilir.
 *
 * Sınav: `node tests/ortak-raf.test.mjs`
 *
 * NEDEN AYRI DOSYA: bu sabitleri SUNUCU rotası da kullanıyor
 * (`/api/sign/ortak-raf`). Hepsi tek dosyadayken rota, tek bir metin sabiti için
 * TÜM istemci Firebase SDK'sını içeri çekiyordu — `firebase/firestore` +
 * `lib/firebase` (tarayıcıya özel kalıcı önbellek dahil) sunucu işlevine
 * giriyordu ve uç patlıyordu. Burada Firebase'e dokunan HİÇBİR ŞEY olmamalı;
 * yalnız tip importu serbest.
 */
import { Videowall, Zone } from "./types";

/** Raf dosyalarının Cloudinary klasörü — ekran klasörlerinden AYRI ağaç. */
export const ORTAK_KLASOR = "flowsign-ortak";
/** Ekran medyasının klasörü (silme bu ön eki süpürür). */
export const EKRAN_KLASOR = "flowsign";

/**
 * Ekran klasörü ile raf klasörü ASLA çakışamaz.
 *
 * Neden ayrı bir işlev: çakışma tek bir yerde ve sessizce felaket olurdu —
 * `flowsign/{id}` süpürülürken raf da silinirdi. Ayrı üst klasör bunu zaten
 * imkânsız kılıyor, bu işlev o güvenceyi SINAVLANABİLİR hâle getiriyor.
 */
export function klasorCakisiyorMu(wallId: string): boolean {
  const ekran = `${EKRAN_KLASOR}/${wallId}`;
  return ekran === ORTAK_KLASOR || ekran.startsWith(`${ORTAK_KLASOR}/`) || ORTAK_KLASOR.startsWith(`${ekran}/`);
}

/**
 * Bir öğe rafa taşındıktan sonra ekranın kendi listelerini yeni adrese çevir.
 *
 * SAF işlev: taslak ve yayın alanlarını birlikte alır, hiçbir yere yazmaz.
 * Aynı dosya birden çok alanda kullanılıyor olabilir — hepsi çevrilmeli, yoksa
 * bir alan çalışır diğeri kırık kalır ve bu ancak perdede fark edilir.
 */
export function adresDegistir(zones: Zone[] | undefined, eski: string, yeni: string): Zone[] {
  return (zones ?? []).map((z) => ({
    ...z,
    items: (z.items ?? []).map((it) => (it.src === eski ? { ...it, src: yeni } : it)),
  }));
}

/** Ekranın taslak + yayın kopyalarında toplam kaç öğe bu adresi kullanıyor. */
export function adresKullanimSayisi(vw: Pick<Videowall, "zones" | "live">, src: string): number {
  const say = (zones: Zone[] | undefined) =>
    (zones ?? []).reduce((n, z) => n + (z.items ?? []).filter((it) => it.src === src).length, 0);
  return say(vw.zones) + say(vw.live?.zones);
}
