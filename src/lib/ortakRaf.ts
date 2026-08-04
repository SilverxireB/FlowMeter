/**
 * ORTAK RAF — kurumun paylaşılan medyası.
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
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Videowall, Zone } from "./types";

/** Raf dosyalarının Cloudinary klasörü — ekran klasörlerinden AYRI ağaç. */
export const ORTAK_KLASOR = "flowsign-ortak";
/** Ekran medyasının klasörü (silme bu ön eki süpürür). */
export const EKRAN_KLASOR = "flowsign";

export interface RafOgesi {
  id: string;
  kind: "image" | "video";
  src: string;
  /** Cloudinary public_id — silme ve taşıma için gerekir. */
  publicId?: string;
  name: string;
  /** Denetim izi: rafa kim koydu, ne zaman. */
  by?: string;
  at?: Timestamp | null;
  /** Hangi ekrandan paylaşıldı (bilgi; ekran silinse de raf etkilenmez). */
  fromWall?: string;
}

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

// ── Firestore ────────────────────────────────────────────────────────────────

const rafRef = () => collection(db(), "signOrtak");

/** Rafı dinle (realtime — polling yok). En yeni üstte. */
export function watchOrtakRaf(cb: (items: RafOgesi[]) => void): () => void {
  return onSnapshot(
    query(rafRef(), orderBy("at", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RafOgesi)),
    // Kurallar henüz yayınlanmamışsa raf boş görünür, kokpit çökmez.
    () => cb([])
  );
}

/** Rafa kayıt ekle (dosya SUNUCUDA taşındıktan sonra çağrılır). */
export async function rafaEkle(o: Omit<RafOgesi, "id" | "at">): Promise<void> {
  await addDoc(rafRef(), { ...o, at: serverTimestamp() });
}

/** Raftan kaldır (yalnız yönetici — kurallar da öyle diyor). */
export async function raftanSil(id: string): Promise<void> {
  await deleteDoc(doc(db(), "signOrtak", id));
}
