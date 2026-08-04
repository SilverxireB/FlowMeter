/**
 * FlowSign self-host — veri tipleri. Online (Firestore) sürümden tek fark:
 * zaman damgaları düz milisaniye sayısıdır (Timestamp nesnesi yok) ve
 * kullanıcı/owner alanları yoktur (tek yönetici parolası modeli).
 */

/** Bir yerleşim alanının içeriği (playlist öğesi). */
export interface ZoneItem {
  id: string;
  /**
   * `screen` = BAŞKA BİR EKRANI bu alana bağla (yetki devri). Ekranın bir
   * bölümünü başkasına yönettirmenin yolu: o kişi kendi ekranını düzenler,
   * sen onu buraya bağlarsın. Perde bağlı ekranın YAYININI çizer.
   */
  kind: "image" | "video" | "url" | "text" | "clock" | "screen";
  src?: string; // image/video: yerel /media/... yolu; url: http(s) — iç ağ adresleri dahil
  /** screen öğesi: bağlanan ekranın KİMLİĞİ (adres değil — ad değişse de kopmaz). */
  screenId?: string;
  name?: string;
  durationSec?: number; // image/url/text/clock için gösterim süresi; video kendi süresi (ya da cap)
  from?: string; // "HH:MM" saat aralığı başı (boşsa hep)
  to?: string; // "HH:MM" saat aralığı sonu
  days?: number[]; // haftanın günleri (0=Paz..6=Cmt); boş/yoksa her gün
  fromDate?: string; // "YYYY-MM-DD" kampanya başlangıcı (boşsa hep) — yerel tarih
  toDate?: string; // "YYYY-MM-DD" kampanya bitişi (o gün DAHİL)
  zoom?: number; // url öğesi: iframe yakınlaştırma yüzdesi (25–150; boşsa 100)
  // text öğesi:
  title?: string;
  text?: string;
  bg?: string; // arka plan rengi (hex); text/clock
  color?: string; // metin rengi (hex); text/clock
}

/** Oynatma modu: "auto" = tabela (kendiliğinden döner); "manual" = sunum (kumanda). */
export type VideowallPlayMode = "auto" | "manual";

/** Duvar üzerinde bir yerleşim alanı (konum 0–1 oran; duvar pikseline çarpılır). */
export interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  transition?: "fade" | "cut" | "slide";
  bg?: string;
  items: ZoneItem[];
}

/** Perde cihazının "canlıyım" kaydı. Perde ~2dk'da bir yazar; kokpit 5dk eşiğiyle çevrimiçi der. */
export interface ScreenBeat {
  id: string;
  ua?: string;
  vwPx?: number;
  vhPx?: number;
  startedAt?: number | null; // ms
  lastSeenAt?: number | null; // ms
  totalMs?: number; // bu cihazın TOPLAM yayın süresi (oturumlar boyunca birikir)
}

/** Yayındaki (kaydedilmiş) yerleşim anlık görüntüsü — perde BUNU oynatır. */
export interface VideowallLive {
  zones: Zone[];
  cols: number;
  rows: number;
  width: number;
  height: number;
  publishedAt?: number | null; // ms
}

/**
 * Bir kişinin BİR ekran üzerindeki yetkileri.
 *
 * DENETİM İZİ (`by`/`at`): fabrikada personel değişiyor ve sorulan soru hep
 * aynı — "bu kişiye bu ekranı kim, ne zaman açtı?". Yetkinin kendisi kadar
 * kimin verdiği de kayıt altında olmalı; yoksa yıllar sonra kimse silmeye
 * cesaret edemiyor (belki gerekiyordur) ve yetkiler birikiyor.
 */
export interface SignPerms {
  view?: boolean; // listede görsün / editörü açsın
  edit?: boolean; // içerik + yerleşim değiştirsin ve YAYINLASIN
  copy?: boolean; // kendine kopyasını çıkarsın
  delete?: boolean; // ekranı silsin
}
/**
 * Yetki bitleri AYRI tip (`SignPerms`): "bu kişi ne yapabilir" sorusunun cevabı
 * yalnız dört tik. Denetim izi cevabın parçası değil, cevabın GEÇMİŞİ — aynı
 * tipte olsaydı `Required<SignGrant>` gibi yerlerde "by/at zorunlu" diye
 * sızardı (nitekim sızdı).
 */
export interface SignGrant extends SignPerms {
  by?: string; // yetkiyi son değiştiren kişinin giriş adı
  at?: number; // ms
}

/** Video-wall tanımı. zones = TASLAK (editör); live = YAYIN. */
export interface Videowall {
  id: string;
  name: string;
  /**
   * YETKİ — TEK yerden yönetilir: Kullanıcılar → "Sign yetkileri" sekmesi.
   * Ekran sayfalarında yetki kutusu YOKTUR (kullanıcı kararı).
   *  - ownerId : ekranı OLUŞTURAN. Açık kaydı yoksa tam yetkilidir.
   *  - grants  : userId → {view, edit, copy, delete}; açık kayıt varsayılanı ezer.
   * Yönetici her ekranda tam yetkilidir. Kararlar SUNUCUDA (serverAuth.ts);
   * istemci yalnız düğmeleri gizler.
   */
  ownerId?: string;
  grants?: Record<string, SignGrant>;
  slug?: string; // yayın linki: /play/{slug} — ad değişince yenilenir
  slugHistory?: string[]; // eski sluglar — eski linkler kararmasın
  width: number;
  height: number;
  cols: number; // FİZİKSEL ekran ızgarası (kaç TV yan yana / üst üste)
  rows: number;
  /**
   * YERLEŞİM ızgarası — fiziksel ekran ızgarasından BAĞIMSIZ (yoksa = cols/rows).
   * Tek TV'yi 3 alana bölmek layoutCols=3 demek; fiziksel 1 kalır, editörde
   * olmayan çerçeve (bezel) çizgisi çizilmez.
   */
  layoutCols?: number;
  layoutRows?: number;
  zones: Zone[];
  live?: VideowallLive;
  playMode?: VideowallPlayMode;
  createdAt: number | null; // ms
  updatedAt?: number | null; // ms
}

/** Kullanıcı defterinin İSTEMCİYE giden hâli (parola özeti/tuz asla gelmez). */
export interface PublicUser {
  id: string;
  name: string;
  label?: string;
  role: "admin" | "user";
  /** Yeni ekran açabilir mi? (yoksa AÇABİLİR sayılır — yönetici kapatabilir) */
  canCreate?: boolean;
  createdAt: number;
  /** Denetim izi — hesabı son değiştiren kişi ve zamanı (ms). */
  updatedBy?: string;
  updatedAt?: number;
}
