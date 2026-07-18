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
