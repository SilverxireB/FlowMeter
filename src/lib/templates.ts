import { Slide } from "./types";

/** Bir şablon slaytı: id/order hariç slayt tanımı. */
export type TemplateSlide = Pick<Slide, "type" | "question" | "options" | "settings">;

export interface PresentationTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  themePreset?: string;
  slides: TemplateSlide[];
}

/** Hazır sunum şablonları (Menti "Templates"). Tamamı repo içi, dış servis yok. */
export const TEMPLATES: PresentationTemplate[] = [
  {
    id: "buzkirici",
    name: "Buz Kırıcı",
    emoji: "🧊",
    description: "Toplantı/ders açılışı için ısınma soruları",
    themePreset: "morsis",
    slides: [
      { type: "word-cloud", question: "Bugün kendini tek kelimeyle nasıl tanımlarsın?", options: [], settings: { maxEntries: 2 } },
      { type: "scales", question: "Bu hafta enerjin nasıl?", options: ["Motivasyon", "Yorgunluk", "Heyecan"], settings: {} },
      { type: "open-ended", question: "Bu oturumdan beklentin ne?", options: [], settings: { maxEntries: 1 } },
      { type: "leaderboard", question: "Skor Tablosu", options: [], settings: {} },
    ],
  },
  {
    id: "quizpaket",
    name: "Quiz Paketi",
    emoji: "⚡",
    description: "Hazır 3 soruluk yarışma + skor tablosu",
    themePreset: "gece",
    slides: [
      { type: "quiz", question: "1. Soru buraya", options: ["A", "B", "C", "D"], settings: { correctIndex: 0, timeLimit: 20, scoreMode: "time" } },
      { type: "quiz", question: "2. Soru buraya", options: ["A", "B", "C", "D"], settings: { correctIndex: 1, timeLimit: 20, scoreMode: "time" } },
      { type: "quiz-type", question: "3. Cevabı yaz", options: ["cevap"], settings: { timeLimit: 30, scoreMode: "time" } },
      { type: "leaderboard", question: "Skor Tablosu", options: [], settings: {} },
    ],
  },
  {
    id: "geribildirim",
    name: "Geri Bildirim",
    emoji: "💬",
    description: "Etkinlik sonu değerlendirme anketi",
    themePreset: "okyanus",
    slides: [
      { type: "scales", question: "Aşağıdakileri değerlendir", options: ["İçerik", "Sunum", "Süre", "Genel"], settings: {} },
      { type: "hundred-points", question: "100 puanı en beğendiğin bölümlere dağıt", options: ["Açılış", "Ana konu", "Atölye", "Kapanış"], settings: {} },
      { type: "open-ended", question: "Bir cümlede geri bildirimin?", options: [], settings: { maxEntries: 1 } },
    ],
  },
];

export function getTemplate(id: string): PresentationTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
