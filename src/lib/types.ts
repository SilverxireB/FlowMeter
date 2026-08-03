import { Timestamp } from "firebase/firestore";
import { PresentationTheme } from "./themes";

export type SlideType =
  | "multiple-choice"
  | "word-cloud"
  | "open-ended"
  | "scales"
  | "ranking"
  | "qna"
  | "quiz"
  | "quiz-type"
  | "pin-on-image"
  | "guess-number"
  | "hundred-points"
  | "grid-2x2"
  | "content"
  | "image"
  | "video"
  | "instructions"
  | "leaderboard";

export type PresentationMode = "presenter-pace" | "audience-pace";

export interface Presentation {
  id: string;
  ownerId: string;
  title: string;
  joinCode: string;
  mode: PresentationMode;
  currentSlideIndex: number;
  isLive: boolean;
  /** true iken izleyiciler yeni cevap gönderemez */
  votingClosed?: boolean;
  /** Sunum "Bitir" ile kapatıldı mı (izleyiciye teşekkür ekranı) */
  ended?: boolean;
  /** Canlı sohbet (izleyici mesajları) açık mı */
  chatEnabled?: boolean;
  /** Q&A moderasyonu: açıkken sorular önce /moderate ekranında onay bekler */
  qnaModeration?: boolean;
  /** Açık metin moderasyonu: açıkken open-ended/word-cloud cevapları perdeye
   *  düşmeden /moderate "Cevaplar" kuyruğunda onay bekler */
  textModeration?: boolean;
  /** Katılımcı yüzeyi dili (telefon): "en" seçilirse izleyici ekranları İngilizce; kokpit hep Türkçe */
  language?: "tr" | "en";
  /** Dashboard klasörü (boş = klasörsüz) */
  folder?: string;
  /**
   * Oturum kimliği — "Yeni oturum" her başlatıldığında değişir. İzleyici
   * telefonu bunun değiştiğini görünce yerel oylarını + kimliğini sıfırlar
   * (aynı 6 haneli kod, yeni grup → taze başlangıç).
   */
  sessionId?: string;
  /** Aktif oturumun başlangıcı (arşivde tarih aralığı için) */
  sessionStartedAt?: Timestamp | null;
  /** Görsel kimlik: hazır tema + arka plan görseli + logo */
  theme?: PresentationTheme;
  createdAt: Timestamp | null;
  /** Son düzenleme (dashboard sıralaması) */
  updatedAt?: Timestamp | null;
}

/**
 * Geçmiş oturum kaydı (presentations/{id}/sessions/{sessionId}).
 * "Yeni oturum" başlatılınca biten oturum buraya yazılır; cevap/katılımcı
 * verileri Firestore'da sessionId etiketiyle saklı kalır ve sonuçlar
 * sayfasındaki oturum seçiciyle geri çağrılır.
 */
export interface SessionRecord {
  /** Doküman ID = oturumun sessionId'si */
  id: string;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
}

// ── Kullanıcı kayıtları / yönetici ──────────────────────────────────────────

/**
 * users/{uid}: her girişte güncellenen kullanıcı kaydı (Auth listesi istemciden
 * okunamaz; kayıt defteri budur). role'ü sadece yönetici değiştirebilir (rules).
 */
export interface UserRecord {
  /** Doküman ID = Firebase Auth uid */
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: "admin" | "user";
  /** FlowSign: yeni ekran açabilir mi? Yoksa AÇABİLİR sayılır — yönetici
   *  "Sign yetkileri" sayfasından tiki kaldırarak kapatır (kapatma açık kayıttır). */
  canCreateSign?: boolean;
  /** Erişimi kapatılmış kişi: kokpite giremez (ayrılan personel).
   *  Kapı İSTEMCİDE — kuralları her yazımda ekstra okuma yapmaya zorlamamak
   *  için bilerek böyle; içerik silme yetkisiyle karıştırılmamalı. */
  blocked?: boolean;
  createdAt?: Timestamp | null;
  lastSeenAt?: Timestamp | null;
}

// ── FlowWall (canlı etkinlik foto/video duvarı) ──────────────────────────────

/** Perde gösterim modları (kokpit seçer, /wall/[id] uygular). "auto" = karışık. */
export type WallScreenMode = "stage" | "mosaic" | "spotlight" | "polaroid" | "cinema" | "timeline" | "auto";

interface WallModeMeta { id: WallScreenMode; name: string; icon: string; hint: string }

/** Tekil perde modları — otomatik rotasyonda da bunlar arasından seçilir. */
export const BASE_WALL_SCREEN_MODES: WallModeMeta[] = [
  { id: "stage", name: "Sahne", icon: "🎭", hint: "Ortada büyük anı + yanlarda akan şeritler" },
  { id: "mosaic", name: "Mozaik", icon: "🧩", hint: "Tüm anılar canlı bir ızgarada" },
  { id: "spotlight", name: "Spot", icon: "🔦", hint: "Rastgele bir anı öne çıkar, diğerleri soluk" },
  { id: "polaroid", name: "Polaroid", icon: "📸", hint: "Arkada saçılan kartlar + önde tek büyük polaroid" },
  { id: "cinema", name: "Sinema", icon: "🎬", hint: "Tam ekran tek anı + altta akan film şeridi" },
  { id: "timeline", name: "Zaman tüneli", icon: "🕰", hint: "Anılar kronolojik akar, saat damgalı" },
];

/** Kokpit seçici — tekil modlar + Otomatik (karışık). */
export const WALL_SCREEN_MODES: WallModeMeta[] = [
  ...BASE_WALL_SCREEN_MODES,
  { id: "auto", name: "Otomatik", icon: "🔀", hint: "Seçtiğin modlar arasında, belirlediğin aralıkla kendiliğinden geçer" },
];

/** Perde ambient efekti — temadan bağımsız, kokpitten seçilir. */
export type WallEffect = "none" | "snow" | "confetti" | "fireworks" | "hearts" | "balloons" | "bubbles" | "stars";

export const WALL_EFFECTS: { id: WallEffect; name: string; icon: string }[] = [
  { id: "none", name: "Yok", icon: "🚫" },
  { id: "snow", name: "Kar", icon: "❄️" },
  { id: "confetti", name: "Konfeti", icon: "🎊" },
  { id: "fireworks", name: "Havai fişek", icon: "🎆" },
  { id: "hearts", name: "Kalp", icon: "💗" },
  { id: "balloons", name: "Balon", icon: "🎈" },
  { id: "bubbles", name: "Kabarcık", icon: "🫧" },
  { id: "stars", name: "Yıldız", icon: "✨" },
];

/** Efekt temadan bağımsız — kokpitten açıkça seçilir (varsayılan: yok). */
export function wallEffectOf(wall?: { effect?: WallEffect } | null): WallEffect {
  return wall?.effect ?? "none";
}

/** Bir FlowWall duvarı (walls/{id}). FlowMeter sunumlarından bağımsız koleksiyon. */
export interface Wall {
  id: string;
  ownerId: string;
  title: string;
  joinCode: string;
  /** Açıkken yüklenen medya önce onay bekler (status=pending) */
  moderation?: boolean;
  /** Video yüklemeye izin ver (varsayılan açık; kapalıysa yalnız fotoğraf) */
  allowVideo?: boolean;
  /** Dilek bırakmayı aç (varsayılan açık; kapalıysa misafirde dilek sekmesi yok) */
  wishesEnabled?: boolean;
  /** Orijinal çözünürlükte sakla (küçültme kapalı). Varsayılan kapalı → görseller
   *  yüklenirken ~1920px'e küçültülür (depolama tasarrufu). Açıksa tam boyut saklanır. */
  keepOriginal?: boolean;
  /** Perde arka planı üst yazısı (opsiyonel) */
  headline?: string;
  /** Duvar görsel teması (FlowMeter PresentationTheme ile aynı yapı) */
  theme?: PresentationTheme;
  /** Perde ambient efekti (temadan bağımsız; yoksa temadan türetilir) */
  effect?: WallEffect;
  /** Perde gösterim modu — kokpitten seçilir (varsayılan: stage) */
  screenMode?: WallScreenMode;
  /** "auto" modda dönecek modlar (boş/yoksa hepsi) */
  autoModes?: WallScreenMode[];
  /** "auto" modda modlar arası geçiş aralığı (saniye; varsayılan 30) */
  autoIntervalSec?: number;
  /** Canlı anons (moderasyondan yayınlanır; `until`e kadar perdede durur) */
  announcement?: { text: string; until: Timestamp | null } | null;
  /** "En Sevilenler" turu sıklığı (saniye; 0 = kapalı, yoksa 120) */
  topLovedEverySec?: number;
  /** Milestone kutlamaları (10/25/50/100… anı → konfeti). Varsayılan açık. */
  milestones?: boolean;
  /** Anı Filmi'ni perdede canlı oynat (kokpitten tetiklenir; startedAt taze
   *  olduğunda perde filmi büyük ekranda gösterir). length/musicId film ayarı. */
  filmPlay?: { startedAt: Timestamp | null; length?: string; musicId?: string } | null;
  /** Duvar kapalı — yükleme durur, perde "teşekkürler" gösterir. Yeni oturum açar. */
  closed?: boolean;
  /** Etkinlik sonrası galeri linki (/g/{id}) açık — misafirler onaylı medyayı
   *  görüp indirebilir ("fotoğraflar nerede?" sorusunun cevabı). */
  galleryOpen?: boolean;
  /** Sabitlenen anı — kokpitten 📌; kaldırılana dek perdede büyük gösterilir */
  pinnedMediaId?: string | null;
  /** Etkinlik çerçevesi (şeffaf PNG URL'si) — yeni yüklenen FOTOLARIN üstüne
   *  yükleme öncesi bindirilir; indirilen kare de markalı olur */
  frameUrl?: string | null;
  /** Kişi başı en fazla foto (aktif oturum). 0 = sınırsız; yoksa varsayılan 20. */
  maxPerPerson?: number;
  /** Video süre limiti (sn). 0 = kapalı; yoksa allowVideo'dan türetilir (varsayılan 30). */
  videoLimitSec?: number;
  /** Çekiliş (moderasyondan kurulur; perdede animasyonlu çekilir). type "registration"
   *  = misafir isim+sicil girer; "number" = organizatör aralık verir. draw taze
   *  startedAt olduğunda perde tüm ekranı kaplayan çekilişi oynatır. */
  raffle?: {
    type: "registration" | "number";
    registerOpen?: boolean; // kayıt türünde misafirler girebilir mi
    registerUntil?: Timestamp | null; // kayıt penceresi sonu (varsa geri sayım); null = süresiz
    min?: number;
    max?: number;
    prize?: string;
    winnersCount?: number; // varsayılan 1
    suspenseSec?: number; // perde animasyon süresi (varsayılan 7)
    draw?: { startedAt: Timestamp | null; winners: RaffleWinner[]; nonce?: string } | null;
  } | null;
  /** Foto yarışması (moderasyondan başlatılır; kazanan perdede taçlanır) */
  contest?: {
    id: string;
    title: string;
    status: "running" | "ended";
    startedAt: Timestamp | null;
    /** Opsiyonel geri sayım sonu; dolunca kokpit otomatik bitirir. */
    endsAt?: Timestamp | null;
    endedAt?: Timestamp | null;
    winnerMediaId?: string;
  } | null;
  sessionId?: string;
  sessionStartedAt?: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/** Çekiliş kazananı (perdede gösterime hazır): label = isim ya da numara, sub = sicil. */
export interface RaffleWinner {
  label: string;
  sub?: string;
}

/** Çekiliş kaydı (walls/{id}/raffleEntries/{sicil}) — misafir isim+sicil girer. */
export interface RaffleEntry {
  id: string;
  name: string;
  sicil: string;
  voterId: string;
  createdAt: Timestamp | null;
}

/** Çekim kayıt defteri (walls/{id}/draws/{autoId}) — kalıcı "çekiliş sonuçları". */
export interface RaffleDraw {
  id: string;
  type?: string;
  prize?: string;
  poolSize?: number;
  winners: RaffleWinner[];
  createdAt: Timestamp | null;
}

/** Duvara yüklenen medya (walls/{id}/media/{autoId}). Byte'lar Cloudinary'de. */
export interface WallMedia {
  id: string;
  voterId: string;
  nickname?: string;
  type: "image" | "video";
  /** Cloudinary public_id (silme/dönüşüm için) */
  cloudinaryId: string;
  /** Cloudinary secure_url (asıl dosya) */
  url: string;
  w?: number;
  h?: number;
  durationMs?: number;
  status: "pending" | "approved" | "rejected";
  /** Misafir beğenileri (❤ ile +1; perdede "en sevilen" anı) */
  likes?: number;
  sessionId?: string;
  createdAt: Timestamp | null;
}

/** Yarışma oyu (walls/{id}/contestVotes/{voterId}) — kişi başı tek. */
export interface ContestVote {
  id: string;
  mediaId: string;
  contestId: string;
  createdAt: Timestamp | null;
}

/** Duvara bırakılan yazılı dilek/not (walls/{id}/wishes/{autoId}). */
export interface WallWish {
  id: string;
  text: string;
  nickname?: string;
  voterId: string;
  /** Moderasyon açıkken 'pending'; kapalıyken 'approved'. */
  status?: "pending" | "approved" | "rejected";
  createdAt: Timestamp | null;
}

export interface SlideSettings {
  /** word-cloud / open-ended: kişi başı kaç cevap gönderilebilir */
  maxEntries?: number;
  /** multiple-choice: birden fazla seçenek işaretlenebilir mi */
  allowMultiple?: boolean;
  /** İzleyici cihazında soru altında gösterilen açıklama (tüm tipler) */
  description?: string;
  /** Başlık üstündeki küçük etiket (eyebrow) — boşsa slayt tipi yazılır */
  label?: string;
  /** Konuşmacı notu — yalnız sahibi görür (telefon kumandası /remote) */
  notes?: string;
  /** quiz: doğru seçeneğin index'i */
  correctIndex?: number;
  /** quiz / quiz-type: cevap süresi (saniye, varsayılan 20) */
  timeLimit?: number;
  /** quiz / quiz-type: puanlama — "time" hıza göre (500–1000), "fixed" sabit 1000 */
  scoreMode?: "time" | "fixed";
  /** quiz / quiz-type: geri sayım sırasında gerilim müziği (WebAudio, dış servis yok) */
  music?: boolean;
  /**
   * pin-on-image: puanlı "doğru alan" — normalize daire [x, y, yarıçap] (0–1).
   * Tanımlıysa pin bu daireye düşen izleyiciler puan kazanır.
   */
  correctArea?: [number, number, number];
  /** guess-number: doğru sayı (tahmine en yakınlık ödüllendirilir) */
  correctNumber?: number;
  /** guess-number: izin verilen alt/üst sınır ve birim etiketi */
  min?: number;
  max?: number;
  unit?: string;
  /** grid-2x2: eksen uçları [sol, sağ, alt, üst] */
  gridLabels?: [string, string, string, string];
  /** Soru yanında gösterilen görsel (sıkıştırılmış data-URI) — pin-on-image'da zorunlu */
  image?: string;
  /** video: mp4/webm dosya URL'i (kurumsal ağlarda dış host engellenebilir) */
  videoUrl?: string;
  /** true = sunumda atlanır (gezinme üzerinden geçer) */
  skipped?: boolean;
}

export interface Slide {
  id: string;
  type: SlideType;
  question: string;
  options: string[];
  order: number;
  settings: SlideSettings;
  /** quiz: sunucu slaytı açınca yazılır — geri sayım bundan hesaplanır */
  quizStartedAt?: Timestamp | null;
}

/** Q&A sorusu (sunum geneli havuz — Menti gibi) */
export interface AudienceQuestion {
  id: string;
  text: string;
  voterId: string;
  upvotes: number;
  hidden?: boolean;
  /** Sunucu "cevaplandı" olarak işaretledi (listede ayrı bölümde, soluk) */
  answered?: boolean;
  /** Moderasyon onayı (qnaModeration açıkken onaysızlar herkese görünmez) */
  approved?: boolean;
  createdAt: Timestamp | null;
}

/** Canlı sohbet mesajı (presentations/{id}/messages) */
export interface ChatMessage {
  id: string;
  text: string;
  voterId: string;
  nickname: string;
  createdAt: Timestamp | null;
}

/**
 * Cevap değeri, slayt tipine göre:
 * - multiple-choice: seçenek index'i (number) veya çoklu seçimde number[]
 * - word-cloud / open-ended: metin (string)
 * - scales: ifade başına 1–5 puanlar (number[], options ile aynı sırada)
 * - ranking: sıralanmış seçenek index'leri (number[], ilk eleman = 1. sıra)
 * - quiz: [seçenekIndex, geçenMs]
 * - quiz-type: [yazılanCevap, geçenMs]
 * - pin-on-image: [x, y] (0–1 normalize koordinat)
 */
export type ResponseValue = string | number | (string | number)[];

export interface ResponseDoc {
  id: string;
  voterId: string;
  value: ResponseValue;
  /** Yazıldığı oturum — canlı sonuçlar bununla filtrelenir (eski oturumlar saklı) */
  sessionId?: string;
  /** Açık metin moderasyonu: pending → perde/sonuçlarda GİZLİ, onay bekler.
   *  Alan yoksa (eski kayıt / moderasyon kapalı) onaylı sayılır. */
  status?: "pending" | "approved";
  createdAt: Timestamp | null;
}

export interface Participant {
  /** Doküman ID = voterId (cihaz başına tek kayıt) */
  id: string;
  nickname: string;
  /** DiceBear avatar seed'i (yeni); eski kayıtlarda emoji olabilir */
  avatarSeed?: string;
  emoji?: string;
  /** Katıldığı oturum — katılımcı listesi/sayacı bununla filtrelenir */
  sessionId?: string;
  joinedAt: Timestamp | null;
}

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  "multiple-choice": "Çoktan Seçmeli",
  "word-cloud": "Kelime Bulutu",
  "open-ended": "Açık Uçlu",
  scales: "Derecelendirme",
  ranking: "Sıralama",
  qna: "Soru & Cevap",
  quiz: "Quiz",
  "quiz-type": "Quiz (Yazarak)",
  "pin-on-image": "Görselde İşaretle",
  "guess-number": "Sayı Tahmini",
  "hundred-points": "100 Puan",
  "grid-2x2": "2x2 Izgara",
  content: "Metin",
  image: "Görsel",
  video: "Video",
  instructions: "Yönergeler",
  leaderboard: "Skor Tablosu",
};

/** İzleyicinin cevap verdiği (etkileşimli) slayt tipleri */
export const INTERACTIVE_SLIDE_TYPES: SlideType[] = [
  "multiple-choice",
  "word-cloud",
  "open-ended",
  "scales",
  "ranking",
  "quiz",
  "quiz-type",
  "pin-on-image",
  "guess-number",
  "hundred-points",
  "grid-2x2",
  "qna",
];

/** Cevap toplamayan içerik slaytları */
export const CONTENT_SLIDE_TYPES: SlideType[] = [
  "content",
  "image",
  "video",
  "instructions",
  "leaderboard",
];

/** Editörden eklenebilen slayt tipleri */
export const AVAILABLE_SLIDE_TYPES: SlideType[] = [
  ...INTERACTIVE_SLIDE_TYPES,
  ...CONTENT_SLIDE_TYPES,
];

/** Quiz puanına katılan tipler */
export const QUIZ_SLIDE_TYPES: SlideType[] = ["quiz", "quiz-type"];

// ── FlowSign (VideoWall) — dijital tabela / video-wall CMS ────────────────────
/** Bir yerleşim alanının içeriği (playlist öğesi). */
export interface ZoneItem {
  id: string;
  kind: "image" | "video" | "url" | "text" | "clock";
  src?: string; // image/video/url için kaynak; text/clock'ta yok
  name?: string;
  durationSec?: number; // image/url/text/clock için gösterim süresi; video kendi süresi (ya da cap)
  from?: string; // "HH:MM" saat aralığı başı (boşsa hep)
  to?: string; // "HH:MM" saat aralığı sonu
  days?: number[]; // haftanın günleri (0=Paz..6=Cmt); boş/yoksa her gün
  fromDate?: string; // "YYYY-MM-DD" kampanya başlangıcı (boşsa hep) — yerel tarih
  toDate?: string; // "YYYY-MM-DD" kampanya bitişi (o gün DAHİL)
  // url öğesi: iframe yakınlaştırma yüzdesi (25–150; boşsa 100). Şirket
  // dashboard'ları tabela ekranında ancak %25–50 zoom'la sığıyor — Chrome'da
  // elle zoom ayarlama yerine ekran başına kalıcı ayar.
  zoom?: number;
  // text öğesi:
  title?: string; // büyük başlık
  text?: string; // gövde metni
  bg?: string; // arka plan rengi (hex); text/clock
  color?: string; // metin rengi (hex); text/clock
}

/** Oynatma modu: "auto" = tabela (kendiliğinden döner, varsayılan);
 *  "manual" = SUNUM — içerik kumanda/klavye ile ilerler (→/←/boşluk),
 *  sağ altta sayaç, B = siyah ekran, uçlarda durur (döngü yok).
 *  Ekran başına seçilir; normal tabela ekranlarını etkilemez. */
export type VideowallPlayMode = "auto" | "manual";

/** Duvar üzerinde bir yerleşim alanı (konum 0–1 oran; duvar pikseline çarpılır). */
export interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string; // kullanıcı etiketi (ör. "Giriş", "Menü"); boşsa "Alan N"
  transition?: "fade" | "cut" | "slide"; // öğe geçiş efekti (varsayılan fade)
  bg?: string; // alan arka plan rengi (şeffaf içerik/geçiş arkası); varsayılan siyah
  items: ZoneItem[];
  // Not: içerik alanın çözünürlüğüne STRETCH (object-fit: fill) edilir —
  // kırpma/siyah boşluk yok; kullanıcı alana uygun boyutta içerik koyar.
}

/** Perde cihazının "canlıyım" kaydı (videowalls/{id}/screens/{screenId}).
 *  Perde ~2dk'da bir yazar; kokpit 5dk eşiğiyle "çevrimiçi" sayar. Ana
 *  dokümana YAZILMAZ — heartbeat tüm perdelere snapshot indirmesin. */
export interface ScreenBeat {
  id: string;
  ua?: string; // tarayıcı/OS teşhisi (kısaltılmış userAgent)
  vwPx?: number; // cihazın görünür alanı — çözünürlük uyuşmazlığı teşhisi
  vhPx?: number;
  startedAt?: Timestamp | null; // bu sayfa oturumu ne zaman açıldı
  lastSeenAt?: Timestamp | null;
  totalMs?: number; // bu cihazın TOPLAM yayın süresi (oturumlar boyunca birikir)
}

/** Yayındaki (kaydedilmiş) yerleşim anlık görüntüsü — perde BUNU oynatır. */
export interface VideowallLive {
  zones: Zone[];
  cols: number;
  rows: number;
  width: number;
  height: number;
  publishedAt?: Timestamp | null;
}

/** Bir kişinin BİR ekran üzerindeki yetkileri (FlowSign yetki matrisi). */
export interface SignGrant {
  view?: boolean; // kokpit listesinde görsün / editörü açsın (görünürlük)
  edit?: boolean; // içerik + yerleşim değiştirsin ve YAYINLASIN
  copy?: boolean; // kendine kopyasını çıkarsın
  delete?: boolean; // ekranı silsin
}

/** Video-wall tanımı (videowalls/{id}). zones = TASLAK (editör); live = YAYIN. */
export interface Videowall {
  id: string;
  ownerId: string;
  ownerName?: string; // listede "kimin duvarı" (yetkisiz sönük kartlarda bilgi)
  /**
   * YETKİ (yalnız FlowSign) — TEK YERDEN yönetilir: /admin → "Sign yetkileri".
   * Ekran ekranlarında yetki kutusu YOKTUR (kullanıcı kararı: "öyle her sayfada
   * yetki değil"). Matris kişi bazlıdır: yöneticinin açtığı sayfada her kişinin
   * altında tüm ekranlar listelenir, tikler burada saklanır.
   *  - ownerId  : ekranı OLUŞTURAN. Kaydı yoksa varsayılan tam yetkilidir
   *               ("yarattığına zaten yetkili"); yönetici tik kaldırırsa
   *               kendisi için de açık kayıt yazılır ve o kayıt geçerli olur.
   *  - grants   : uid → {view, edit, copy, delete}. Yönetici her ekranda tam
   *               yetkilidir (rules isAdmin()).
   * NOT: `view`/`copy` GÖRÜNÜRLÜK seviyesidir — perde linki herkese açık olmak
   * zorunda olduğundan (tabela cihazı giriş yapamaz) doküman okuması rules ile
   * kısıtlanamaz; `edit`/`delete` gerçek kapıdır.
   */
  grants?: Record<string, SignGrant>;
  name: string;
  slug?: string; // insan-dostu yayın linki: /flowsign/{slug} — ad değişince YENİLENİR
  slugHistory?: string[]; // eski sluglar (yeniden adlandırma) — eski linkler kararmasın
  width: number; // toplam çözünürlük px
  height: number;
  cols: number; // FİZİKSEL ekran ızgarası (kaç TV yan yana / üst üste)
  rows: number;
  /**
   * YERLEŞİM ızgarası — fiziksel ekran ızgarasından BAĞIMSIZ (yoksa = cols/rows).
   * İkisi eskiden tek sayıydı ve bu yüzden TEK ekranlı duvar bölünemiyordu
   * ("Böl" bölecek hücre bulamıyordu). Ayrıldılar çünkü farklı şeyler:
   * fiziksel ızgara ÇERÇEVE (bezel) nerede onu söyler — editördeki kesik
   * çizgiler odur, içerik tasarlanırken uyulması gereken tek donanım gerçeği;
   * yerleşim ızgarası ise içeriği kaç parçaya böldüğündür. Tek TV'yi 3'e bölmek
   * artık layoutCols=3 demek (fiziksel 1 kalır — yalan çerçeve çizilmez).
   */
  layoutCols?: number;
  layoutRows?: number;
  zones: Zone[];
  live?: VideowallLive; // "Kaydet & Yayınla" ile yazılır; yoksa eski duvar → taslak oynar
  // Oynatma modu (yayından bağımsız — değiştirince perde ANINDA uyar; yoksa "auto")
  playMode?: VideowallPlayMode;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// ── FlowPulse (sürekli nabız/geri bildirim) ──────────────────────────────────
/** Soru tipi: smiley 1–5 · nps 0–10 · yesno 0/1 · choice (seçenek index'i). */
export type PulseQuestionType = "smiley" | "nps" | "yesno" | "choice";

/** Bir geri bildirim NOKTASI (pulses/{id}) — ör. "Yemekhane çıkışı". ANONİM:
 *  sicil/kimlik bilerek YOK (dürüst oy için). Kiosk + QR kanallarından oy toplar. */
export interface Pulse {
  id: string;
  ownerId: string;
  title: string;
  question: { type: PulseQuestionType; text: string; options?: string[] };
  /** Kiosk'ta üst üste basmayı frenleme (sn; varsayılan 3) */
  cooldownSec?: number;
  /** Kiosk'tan çıkış PIN'i (köşeye 5 dokunuş → PIN). Boş = PIN'siz çıkış. */
  pin?: string;
  /** Yorum bırakma açık mı (varsayılan açık) + moderasyon (varsayılan açık) */
  commentsEnabled?: boolean;
  moderation?: boolean;
  /** Uyarı eşiği (%0–100; skor altına düşerse kokpitte kırmızı). 0 = kapalı. */
  threshold?: number;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/** Günlük özet (pulses/{id}/days/{yyyy-mm-dd}) — kokpit trendi BUNU okur
 *  (50 bin oy değil, gün başına 1 doküman). Oyla birlikte increment'lenir. */
export interface PulseDay {
  id: string; // yyyy-mm-dd
  total: number;
  sum: number;
  /** Değer dağılımı: {"1":12,"2":4,…} (choice'ta seçenek index'leri) */
  counts?: Record<string, number>;
  /** Saatlik: {"14":{t:5,s:19}} → gün×saat ısı matrisi */
  hours?: Record<string, { t: number; s: number }>;
}
