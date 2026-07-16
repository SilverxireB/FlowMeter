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
  | "content";

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
  /** Görsel kimlik: hazır tema + arka plan görseli + logo */
  theme?: PresentationTheme;
  createdAt: Timestamp | null;
}

export interface SlideSettings {
  /** word-cloud / open-ended: kişi başı kaç cevap gönderilebilir */
  maxEntries?: number;
  /** multiple-choice: birden fazla seçenek işaretlenebilir mi */
  allowMultiple?: boolean;
  /** content: başlık altındaki açıklama metni */
  description?: string;
}

export interface Slide {
  id: string;
  type: SlideType;
  question: string;
  options: string[];
  order: number;
  settings: SlideSettings;
}

/**
 * Cevap değeri, slayt tipine göre:
 * - multiple-choice: seçenek index'i (number) veya çoklu seçimde number[]
 * - word-cloud / open-ended: metin (string)
 * - scales: ifade başına 1–5 puanlar (number[], options ile aynı sırada)
 * - ranking: sıralanmış seçenek index'leri (number[], ilk eleman = 1. sıra)
 */
export type ResponseValue = string | number | number[];

export interface ResponseDoc {
  id: string;
  voterId: string;
  value: ResponseValue;
  createdAt: Timestamp | null;
}

export interface Participant {
  /** Doküman ID = voterId (cihaz başına tek kayıt) */
  id: string;
  nickname: string;
  /** DiceBear avatar seed'i (yeni); eski kayıtlarda emoji olabilir */
  avatarSeed?: string;
  emoji?: string;
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
  content: "İçerik",
};

/** Editörden eklenebilen slayt tipleri (qna ve quiz Faz 3'te) */
export const AVAILABLE_SLIDE_TYPES: SlideType[] = [
  "multiple-choice",
  "word-cloud",
  "open-ended",
  "scales",
  "ranking",
  "content",
];
