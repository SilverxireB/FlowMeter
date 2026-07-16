import { Timestamp } from "firebase/firestore";

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
  createdAt: Timestamp | null;
}

export interface SlideSettings {
  /** word-cloud: kişi başı kaç kelime gönderilebilir (varsayılan 3) */
  maxEntries?: number;
  /** multiple-choice: birden fazla seçenek işaretlenebilir mi */
  allowMultiple?: boolean;
}

export interface Slide {
  id: string;
  type: SlideType;
  question: string;
  options: string[];
  order: number;
  settings: SlideSettings;
}

export interface ResponseDoc {
  id: string;
  voterId: string;
  /** multiple-choice: seçenek index'i (number) — word-cloud/open-ended: metin (string) */
  value: string | number;
  createdAt: Timestamp | null;
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

/** Faz 1'de editörden eklenebilen slayt tipleri */
export const AVAILABLE_SLIDE_TYPES: SlideType[] = ["multiple-choice", "word-cloud"];
