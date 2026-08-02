/**
 * KANTİN — veri modeli.
 *
 * İki KÖK koleksiyon (kaldırması kolay olsun diye):
 *   kantinUsers/{uid}                  → kişi + rol
 *   kantin/{kantinId}                  → kantin tanımı
 *   kantin/{kantinId}/menu/{urunId}    → ürünler
 *   kantin/{kantinId}/siparisler/{id}  → siparişler
 *
 * SİPARİŞ NUMARASI YOK: kişi zaten kimlikli. Tezgâh ekranı ad + sicil gösterir,
 * telefon da kendi siparişini canlı izler. Numara üretmek (sayaç dokümanı, yarış
 * durumu) hiçbir işe yaramadan karmaşıklık ekliyordu.
 */
import { Timestamp } from "firebase/firestore";

export type KantinRol = "admin" | "kantinci" | "personel";

export interface KantinKisi {
  id: string; // = uid
  ad: string;
  sicil: string;
  email: string;
  rol: KantinRol;
  /** kantinci ise hangi kantin (personel/admin için boş) */
  kantinId?: string;
  /** Geçici yasak bitişi — sipariş alıp gelmeyenler için (kurallar da bakar). */
  yasakBitis?: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface Kantin {
  id: string;
  ad: string;
  /** Nerede olduğu — "B blok zemin kat" gibi; kişi hangisini seçeceğini bilsin. */
  yer?: string;
  /** Sipariş alınıyor mu (kantinci anında kapatabilsin). */
  acik: boolean;
  /** Kaç sipariş aynı anda hazırlanabilir — bekleme süresi tahmini bundan çıkar. */
  kapasite: number;
  /** Tek siparişin ortalama hazırlanma süresi (dk). */
  hazirlikDk: number;
  /** Kişi başına aynı anda açık sipariş sayısı. */
  kisiBasiLimit: number;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface MenuUrun {
  id: string;
  ad: string;
  aciklama?: string;
  /** Ödeme YOK — fiyat yalnız bilgi (tezgâhta ödenir). 0/boş = gösterme. */
  fiyat?: number;
  kategori?: string;
  aktif: boolean;
  /** Günlük stok (boş = sınırsız). Bugünkü satış sayılıp düşülür. */
  gunlukStok?: number;
  sira: number;
}

export type SiparisDurum = "yeni" | "hazirlaniyor" | "hazir" | "alindi" | "alinmadi" | "iptal";

export const DURUM_ETIKET: Record<SiparisDurum, string> = {
  yeni: "Alındı",
  hazirlaniyor: "Hazırlanıyor",
  hazir: "Hazır",
  alindi: "Teslim edildi",
  alinmadi: "Gelinmedi",
  iptal: "İptal",
};

export interface SiparisSatir {
  urunId: string;
  ad: string;
  adet: number;
}

export interface Siparis {
  id: string;
  uid: string;
  ad: string;
  sicil: string;
  satirlar: SiparisSatir[];
  toplamAdet: number;
  durum: SiparisDurum;
  /** yyyy-mm-dd — günlük liste/rapor tek alan filtresiyle çıksın (index yok). */
  gun: string;
  not?: string;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/** Kişinin işini bitirmemiş (hâlâ kantinde işlem gören) siparişleri. */
export const ACIK_DURUMLAR: SiparisDurum[] = ["yeni", "hazirlaniyor", "hazir"];
