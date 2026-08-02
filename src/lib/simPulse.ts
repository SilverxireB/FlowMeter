/**
 * PROVA botları — FlowPulse (yalnız /admin/prova/nabiz/[id], yönetici kapısı arkasında).
 *
 * Pulse ANONİMDİR: bot yazımı gerçek ziyaretçinin yazımıyla birebir aynı yoldan
 * gider (castVote/addComment) — kurallar değişmez, yani prova gerçek yolu dener.
 *
 * Gerçekçilik: memnuniyet dağılımı düz rastgele DEĞİL. Gerçek nokta ölçümlerinde
 * cevaplar yüksek uca yığılır, azınlık bir kuyruk aşağıdadır; bu yüzden skor da
 * 60-85 bandında oturur. Düz rastgele üretim skoru hep ~%50 gösterip pano
 * eşiklerini (yeşil/amber/gül) anlamsız kılıyordu.
 */
import { doc, increment, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { addComment, castVote, dayKey, scaleOf } from "./pulses";
import { Pulse, PulseQuestionType } from "./types";

export const PULSE_COMMENTS = [
  "Her şey yolunda, teşekkürler",
  "Personel çok ilgiliydi",
  "Sıra biraz uzundu",
  "Temizlik iyiydi",
  "Yemek sıcak değildi",
  "Hızlı çözüldü",
  "Yönlendirme net değildi",
  "Beklediğimden iyiydi",
  "Kapıda biraz bekledik",
  "Görevliye teşekkürler",
  "Fiyatlar biraz yüksek",
  "Tekrar geleceğim",
];

/** Memnuniyete eğilimli 0-1 arası oran (yüksek uca yığılır, ince bir alt kuyruk). */
function memnuniyet(): number {
  // %72 memnun (0.7-1.0), %20 orta (0.35-0.7), %8 memnuniyetsiz (0-0.35)
  const r = Math.random();
  if (r < 0.72) return 0.7 + Math.random() * 0.3;
  if (r < 0.92) return 0.35 + Math.random() * 0.35;
  return Math.random() * 0.35;
}

/** Soru tipine uygun, gerçekçi dağılımlı bir oy değeri. */
export function randomPulseValue(q: Pulse["question"]): number {
  const t: PulseQuestionType = q.type;
  if (t === "yesno") return memnuniyet() > 0.4 ? 1 : 0;
  if (t === "choice") {
    const n = q.options?.length ?? 0;
    if (n <= 0) return 0;
    // düşük index'lere eğilim (genelde ilk seçenekler "iyi" tarafta yazılır)
    return Math.min(n - 1, Math.floor(Math.pow(Math.random(), 1.5) * n));
  }
  const { min, max } = scaleOf(t);
  return Math.round(min + memnuniyet() * (max - min));
}

/** Tek oy yazar (gerçek ziyaretçi yolu). Yazılan değeri döndürür. */
export async function firePulseVote(
  pulseId: string,
  q: Pulse["question"],
  channel: "kiosk" | "qr"
): Promise<number> {
  const v = randomPulseValue(q);
  await castVote(pulseId, v, channel);
  return v;
}

/** Tek yorum yazar (moderasyon açıksa 'pending' — kurallar bunu şart koşar). */
export async function firePulseComment(pulseId: string, moderation: boolean): Promise<string> {
  const t = PULSE_COMMENTS[Math.floor(Math.random() * PULSE_COMMENTS.length)];
  await addComment(pulseId, t, moderation);
  return t;
}

/**
 * GEÇMİŞ gün üretir (trend grafiği boş kalmasın). Yalnız günlük özet yazılır,
 * ham oy YAZILMAZ: kurallar özetin yazım başına tam +1 artmasına izin verdiği
 * için her oy ayrı yazımdır — geçmişi ham oylarla doldurmak yazım sayısını
 * ikiye katlardı. Skor/oy sayısı zaten özetten okunur.
 */
export async function seedPulseHistory(
  pulseId: string,
  q: Pulse["question"],
  gun: number,
  gunlukOy: number,
  ilerleme?: (yapilan: number, toplam: number) => void
): Promise<void> {
  const toplam = gun * gunlukOy;
  let yapilan = 0;
  for (let g = gun; g >= 1; g--) {
    const d = new Date();
    d.setDate(d.getDate() - g);
    const key = dayKey(d);
    for (let i = 0; i < gunlukOy; i++) {
      const v = randomPulseValue(q);
      const saat = 8 + Math.floor(Math.random() * 11); // mesai saatleri
      const b = writeBatch(db());
      b.set(
        doc(db(), "pulses", pulseId, "days", key),
        {
          total: increment(1),
          sum: increment(v),
          counts: { [String(v)]: increment(1) },
          hours: { [String(saat)]: { t: increment(1), s: increment(v) } },
        },
        { merge: true }
      );
      await b.commit();
      ilerleme?.(++yapilan, toplam);
    }
  }
}
