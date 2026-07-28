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

export const SLIDE_TYPE_ICONS: Record<SlideType, string> = {
  "multiple-choice": "📊",
  "word-cloud": "☁️",
  "open-ended": "💬",
  scales: "🎚️",
  ranking: "🏆",
  qna: "🙋",
  quiz: "⚡",
  "quiz-type": "✍️",
  "pin-on-image": "📍",
  "guess-number": "🔢",
  "hundred-points": "💯",
  "grid-2x2": "🔲",
  content: "📄",
  image: "🖼️",
  video: "🎬",
  instructions: "📋",
  leaderboard: "🏅",
};

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
  kind: "image" | "video" | "url";
  src: string;
  name?: string;
  durationSec?: number; // image/url için gösterim süresi; video kendi süresi (ya da cap)
  from?: string; // "HH:MM" saat aralığı başı (boşsa hep)
  to?: string; // "HH:MM" saat aralığı sonu
}

/** Duvar üzerinde bir yerleşim alanı (konum 0–1 oran; duvar pikseline çarpılır). */
export interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fit?: "cover" | "contain";
  items: ZoneItem[];
}

/** Video-wall tanımı (videowalls/{id}). */
export interface Videowall {
  id: string;
  ownerId: string;
  name: string;
  width: number; // toplam çözünürlük px
  height: number;
  cols: number; // fiziksel ekran ızgarası
  rows: number;
  zones: Zone[];
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}
