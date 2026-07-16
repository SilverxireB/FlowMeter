import { SlideType } from "./types";

export interface Template {
  id: string;
  emoji: string;
  name: string;
  title: string;
  slides: Array<{ type: SlideType; question: string; options: string[]; settings: object }>;
}

/** Hazır sunum şablonları — dashboard'daki "şablondan başla" için. */
export const TEMPLATES: Template[] = [
  {
    id: "icebreaker",
    emoji: "🧊",
    name: "Buz Kırıcı",
    title: "Buz Kırıcı",
    slides: [
      { type: "word-cloud", question: "Bugün nasıl hissediyorsun? Tek kelimeyle", options: [], settings: { maxEntries: 1 } },
      { type: "multiple-choice", question: "Kahve mi çay mı?", options: ["Kahve ☕", "Çay 🫖", "İkisi de", "Hiçbiri"], settings: { allowMultiple: false } },
      { type: "guess-number", question: "Bu salonda toplam kaç yıllık deneyim var sence?", options: [], settings: {} },
      { type: "open-ended", question: "Bu hafta seni gülümseten bir şey?", options: [], settings: { maxEntries: 1 } },
    ],
  },
  {
    id: "feedback",
    emoji: "💬",
    name: "Geri Bildirim",
    title: "Geri Bildirim Anketi",
    slides: [
      { type: "scales", question: "Ne kadar katılıyorsun?", options: ["Sunum faydalıydı", "Süre iyi kullanıldı", "Tekrar katılırım"], settings: {} },
      { type: "multiple-choice", question: "En çok hangi bölümü beğendin?", options: ["Açılış", "Ana bölüm", "Soru-cevap"], settings: { allowMultiple: false } },
      { type: "word-cloud", question: "Bu oturumu üç kelimeyle özetle", options: [], settings: { maxEntries: 3 } },
      { type: "open-ended", question: "Neyi daha iyi yapabilirdik?", options: [], settings: { maxEntries: 1 } },
      { type: "qna", question: "Aklına takılan soruları yaz!", options: [], settings: {} },
    ],
  },
  {
    id: "quiz",
    emoji: "⚡",
    name: "Quiz Paketi",
    title: "Hızlı Quiz",
    slides: [
      { type: "content", question: "Quiz zamanı! 🏁", options: [], settings: { description: "Telefonlar hazır! Hızlı cevap = daha çok puan. Üst üste doğrularda seri bonusu var." } },
      { type: "quiz", question: "Örnek soru 1 — doğru cevabı editörden işaretle", options: ["Seçenek A", "Seçenek B", "Seçenek C"], settings: { correctIndex: 0, timeLimit: 20 } },
      { type: "quiz", question: "Örnek soru 2", options: ["Seçenek A", "Seçenek B", "Seçenek C", "Seçenek D"], settings: { correctIndex: 1, timeLimit: 15 } },
      { type: "content", question: "Skor tablosu zamanı 🏆", options: [], settings: { description: "Sunucu: alttaki 🏆 butonuyla skor tablosunu aç!" } },
    ],
  },
];
