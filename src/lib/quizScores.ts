import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { Slide } from "./types";

export interface ScoreRow {
  voterId: string;
  points: number;
  correct: number;
  streak: number;
  /** Cevaplanan son quiz sorusundan gelen puan (podyumda "+X" olarak gösterilir) */
  delta: number;
}

/** Yazılı cevap karşılaştırması: küçük harf (TR), boşluk/noktalama toleransı. */
export function normalizeAnswer(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,!?'"’-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bir yazılı cevabın kabul edilen cevaplardan birine uyup uymadığı. */
export function isTypedAnswerCorrect(answer: string, accepted: string[]): boolean {
  const n = normalizeAnswer(answer);
  return n.length > 0 && accepted.some((a) => normalizeAnswer(a) === n);
}

/** Pin [x,y] doğru alan dairesinin (correctArea [cx,cy,r]) içinde mi. */
export function isPinInArea(
  pin: [number, number],
  area: [number, number, number]
): boolean {
  const dx = pin[0] - area[0];
  const dy = pin[1] - area[1];
  return Math.hypot(dx, dy) <= area[2];
}

/** Bir slaytın skor tablosuna (leaderboard) katkı verip vermediği. */
export function isScoringSlide(slide: Slide): boolean {
  return (
    slide.type === "quiz" ||
    slide.type === "quiz-type" ||
    (slide.type === "pin-on-image" && Array.isArray(slide.settings?.correctArea))
  );
}

/**
 * Skor hesabı — Menti formülü + Kahoot usulü seri bonusu:
 * - Doğru cevap: 1000 × (1 − (geçen süre / toplam süre) / 2)
 *   → en hızlı ≈1000, son anda doğru ≈500
 * - Seri bonusu: üst üste 2. doğrudan itibaren +50/soru (en çok +250)
 * quiz (seçmeli) ve quiz-type (yazarak) slaytlarının ikisini de sayar.
 */
export async function computeQuizScores(
  presentationId: string,
  slides: Slide[]
): Promise<ScoreRow[]> {
  const quizSlides = slides.filter(isScoringSlide);
  const scores = new Map<string, ScoreRow>();
  const streaks = new Map<string, number>();

  // Slayt sırasına göre işle — seri bonusu ardışıklığa bağlı.
  // Her turda delta sıfırlanır: en son cevaplanan soru turunun puanı kalır.
  for (const s of quizSlides) {
    const timeLimitMs = (s.settings?.timeLimit ?? 20) * 1000;
    const correctIndex = s.settings?.correctIndex ?? 0;
    const correctArea = s.settings?.correctArea;
    // pin-on-image'ın zamanlaması yok → sabit puan; diğerleri scoreMode'a uyar
    const fixed = s.settings?.scoreMode === "fixed" || s.type === "pin-on-image";
    const snap = await getDocs(
      collection(db(), "presentations", presentationId, "slides", s.id, "responses")
    );
    if (snap.empty) continue;
    for (const row of scores.values()) row.delta = 0;
    const answeredCorrect = new Set<string>();
    snap.docs.forEach((d) => {
      const { voterId, value } = d.data() as { voterId: string; value: unknown };
      if (!Array.isArray(value)) return;
      const isCorrect =
        s.type === "quiz"
          ? value[0] === correctIndex
          : s.type === "quiz-type"
            ? typeof value[0] === "string" && isTypedAnswerCorrect(value[0], s.options)
            : // pin-on-image
              !!correctArea &&
              typeof value[0] === "number" &&
              typeof value[1] === "number" &&
              isPinInArea([value[0], value[1]], correctArea);
      if (!isCorrect) {
        streaks.set(voterId, 0); // yanlış → seri sıfırlanır
        const row = scores.get(voterId);
        if (row) row.streak = 0;
        return;
      }
      answeredCorrect.add(voterId);
      const elapsed =
        s.type !== "pin-on-image" && typeof value[1] === "number" ? value[1] : 0;
      // Puanlama: "fixed"/pin → 1000; "time" → Menti formülü 1000×(1−(t/T)/2)
      const speedPoints = fixed
        ? 1000
        : Math.round(1000 * (1 - Math.min(1, Math.max(0, elapsed / timeLimitMs)) / 2));
      const streak = (streaks.get(voterId) ?? 0) + 1;
      streaks.set(voterId, streak);
      const streakBonus = Math.min(streak - 1, 5) * 50;
      const row =
        scores.get(voterId) ?? { voterId, points: 0, correct: 0, streak: 0, delta: 0 };
      const earned = speedPoints + streakBonus;
      row.points += earned;
      row.delta = earned;
      row.correct += 1;
      row.streak = streak;
      scores.set(voterId, row);
    });
    // Bu soruyu hiç cevaplamayanların da serisi kırılır
    for (const [v, st] of streaks) {
      if (st > 0 && !answeredCorrect.has(v)) streaks.set(v, 0);
    }
  }
  return [...scores.values()].sort((a, b) => b.points - a.points);
}
