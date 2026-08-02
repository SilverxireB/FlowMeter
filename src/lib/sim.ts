/**
 * PROVA botları — yalnız /admin/prova/[id] kullanır (yönetici kapısı arkasında).
 * Gerçek izleyici gibi anonim yazar; rules hiç değişmez, yani prova gerçek yolu
 * dener. Eski gizli anahtar (SIM_SECRET) kaldırıldı: istemci paketinin içinde
 * durduğu için kapı değildi.
 *
 * Amaç: GERÇEK bir oturumu olabildiğince gerçekçi taklit etmek. Botlar
 * personaya göre insanca oranlarda tepki/oy/soru/mesaj üretir — yük bombası
 * değil. Oranlar "dakikada birkaç" ölçeğindedir (bkz. PERSONAS yorumları).
 */
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { AVATAR_SEEDS } from "./participants";
import { Slide } from "./types";

export const SIM_REACTIONS = ["❤️", "👍", "🎉"] as const;

export type Persona = "reactor" | "questioner" | "chatter" | "active" | "lurker";

export interface Bot {
  voterId: string;
  nickname: string;
  avatarSeed: string;
  persona: Persona;
  /** saniyede tepki oranı (temel) */
  reactionRate: number;
  /** slayt göründükten sonra oy verme gecikmesi (ms) */
  voteDelay: number;
  /** bu slaytta oy verme olasılığı */
  voteProb: number;
  /** soru sorma periyodu (ms, 0 = sormaz) */
  questionEvery: number;
  /** sohbet periyodu (ms, 0 = yazmaz) */
  chatEvery: number;
}

interface PersonaSpec {
  weight: number;
  reactionRate: number;
  voteDelay: number;
  voteProb: number;
  questionEvery: number;
  chatEvery: number;
}

// Oranlar GERÇEKÇİdir: reactionRate = saniyedeki tepki (0.06 ≈ dakikada ~4).
// questionEvery/chatEvery = ortalama periyot (ms). Bir "an" dalgası (present'te
// heyecanlı bir slayt) tepkileri page.tsx'teki excitement zarfıyla kısa süre çarpar.
const PERSONAS: Record<Persona, PersonaSpec> = {
  // hevesli izleyici: dakikada ~4 tepki, ara sıra tek tük mesaj
  reactor: { weight: 0.12, reactionRate: 0.06, voteDelay: 2500, voteProb: 0.9, questionEvery: 0, chatEvery: 90000 },
  // meraklı: ~dakikada 1 soru + seyrek tepki
  questioner: { weight: 0.08, reactionRate: 0.006, voteDelay: 3000, voteProb: 0.85, questionEvery: 60000, chatEvery: 120000 },
  // sohbetçi: canlı sohbete ~25 sn'de bir yazar, az tepki
  chatter: { weight: 0.08, reactionRate: 0.01, voteDelay: 3500, voteProb: 0.8, questionEvery: 180000, chatEvery: 25000 },
  // aktif ortalama: hızlı oy, dakikada ~1 tepki, çok seyrek soru
  active: { weight: 0.42, reactionRate: 0.012, voteDelay: 1600, voteProb: 0.97, questionEvery: 300000, chatEvery: 90000 },
  // sessiz izleyici: çoğunlukla sadece oy, nadiren tepki
  lurker: { weight: 0.3, reactionRate: 0.0015, voteDelay: 9000, voteProb: 0.55, questionEvery: 0, chatEvery: 0 },
};

const FIRST = ["Ada", "Deniz", "Ege", "Mira", "Kaan", "Elif", "Arda", "Nil", "Emir", "Zeynep", "Poyraz", "Lina", "Toprak", "Derin", "Bora", "Ceren", "Umut", "Yağmur", "Kuzey", "Aylin", "Efe", "Su", "Doruk", "İpek"];
const LAST = ["K.", "Y.", "A.", "T.", "B.", "S.", "D.", "M.", "Ç.", "Ö."];

const WORDS = ["yenilik", "hız", "kalite", "takım", "güven", "enerji", "vizyon", "cesaret", "odak", "ilham", "başarı", "uyum", "gelişim", "tutku", "denge", "merak"];
const PHRASES = ["Bence harika bir fikir", "Bunu deneyelim", "Katılıyorum", "Emin değilim ama olabilir", "Süper gidiyor", "Daha fazla örnek lazım", "Çok net oldu", "Bize uyar", "Zaman kısıtlı", "Devam edelim"];
const QUESTIONS = ["Bu konuda örnek verir misiniz?", "Süre ne kadar?", "Bunu nasıl uygularız?", "Kaynak paylaşacak mısınız?", "Bir sonraki adım ne?", "Bütçe etkisi ne olur?", "Ekip için ne değişecek?", "Riskler neler?", "Ne zaman başlıyoruz?", "Bunu ölçebilir miyiz?"];
const CHAT = ["Selam 👋", "Buradayım", "Bağlantı iyi", "Harika sunum", "+1", "Katılıyorum", "Sesi açar mısınız?", "Ekran net", "Teşekkürler", "😄"];

function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function personaByWeight(): Persona {
  const r = Math.random();
  let acc = 0;
  for (const [k, v] of Object.entries(PERSONAS)) {
    acc += v.weight;
    if (r <= acc) return k as Persona;
  }
  return "active";
}

/** N bot üretir (rastgele persona + ad + avatar + benzersiz voterId). */
export function makeBots(n: number): Bot[] {
  return Array.from({ length: n }, () => {
    const persona = personaByWeight();
    const spec = PERSONAS[persona];
    return {
      voterId: `sim-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      nickname: `${pick(FIRST)} ${pick(LAST)}`,
      avatarSeed: pick(AVATAR_SEEDS),
      persona,
      reactionRate: spec.reactionRate,
      voteDelay: spec.voteDelay + Math.random() * spec.voteDelay,
      voteProb: spec.voteProb,
      questionEvery: spec.questionEvery,
      chatEvery: spec.chatEvery,
    };
  });
}

/** Botları katılımcı olarak yazar (500'lük batch'ler), aktif oturumla etiketli. */
export async function joinBots(
  presentationId: string,
  bots: Bot[],
  sessionId?: string
): Promise<void> {
  for (let i = 0; i < bots.length; i += 450) {
    const batch = writeBatch(db());
    bots.slice(i, i + 450).forEach((b) => {
      batch.set(doc(db(), "presentations", presentationId, "participants", b.voterId), {
        nickname: b.nickname,
        avatarSeed: b.avatarSeed,
        joinedAt: serverTimestamp(),
        ...(sessionId ? { sessionId } : {}),
      });
    });
    await batch.commit();
  }
}

// ── Yazıcılar (açık voterId ile; localStorage yardımcılarını atlar) ──────────
export function fireReaction(presentationId: string): Promise<unknown> {
  const emoji = Math.random() < 0.5 ? "❤️" : Math.random() < 0.6 ? "👍" : "🎉";
  return addDoc(collection(db(), "presentations", presentationId, "reactions"), {
    emoji,
    createdAt: serverTimestamp(),
  });
}

export function fireResponse(
  presentationId: string,
  slide: Slide,
  voterId: string,
  sessionId?: string
) {
  let value: ReturnType<typeof randomVoteValue>;
  try {
    value = randomVoteValue(slide);
  } catch {
    value = 0;
  }
  if (value === undefined || value === null) value = 0;
  return addDoc(
    collection(db(), "presentations", presentationId, "slides", slide.id, "responses"),
    { voterId, value, createdAt: serverTimestamp(), ...(sessionId ? { sessionId } : {}) }
  );
}

export function fireQuestion(presentationId: string, voterId: string) {
  return addDoc(collection(db(), "presentations", presentationId, "questions"), {
    text: pick(QUESTIONS),
    voterId,
    upvotes: 0,
    createdAt: serverTimestamp(),
  });
}

export function upvoteQuestion(presentationId: string, questionId: string, current: number) {
  return updateDoc(doc(db(), "presentations", presentationId, "questions", questionId), {
    upvotes: current + 1,
  });
}

export function fireMessage(presentationId: string, bot: Bot) {
  return addDoc(collection(db(), "presentations", presentationId, "messages"), {
    text: pick(CHAT),
    voterId: bot.voterId,
    nickname: bot.nickname,
    createdAt: serverTimestamp(),
  });
}

/** Slayt tipine göre gerçekçi rastgele oy değeri. */
export function randomVoteValue(slide: Slide) {
  const opts = slide.options.length || 3;
  const skewIndex = () => Math.floor(Math.pow(Math.random(), 1.4) * opts); // düşük index'lere eğilim
  switch (slide.type) {
    case "multiple-choice":
      if (slide.settings?.allowMultiple && Math.random() < 0.3) {
        return shuffle([...Array(opts).keys()]).slice(0, 2);
      }
      return skewIndex();
    case "word-cloud":
      return pick(WORDS);
    case "open-ended":
      return pick(PHRASES);
    case "scales":
      return slide.options.map(() => 1 + Math.floor(Math.random() * 5));
    case "ranking":
      return shuffle([...Array(opts).keys()]);
    case "quiz": {
      const correct = slide.settings?.correctIndex ?? 0;
      const idx = Math.random() < 0.6 ? correct : skewIndex();
      const t = Math.random() * (slide.settings?.timeLimit ?? 20) * 1000;
      return [idx, Math.round(t)];
    }
    case "quiz-type": {
      const ok = Math.random() < 0.55 && slide.options.length;
      const text = ok ? pick(slide.options) : pick(WORDS);
      const t = Math.random() * (slide.settings?.timeLimit ?? 30) * 1000;
      return [text, Math.round(t)];
    }
    case "pin-on-image":
    case "grid-2x2":
      return [Math.random(), Math.random()];
    case "guess-number": {
      const min = slide.settings?.min ?? 0;
      const max = slide.settings?.max ?? 100;
      const c = slide.settings?.correctNumber ?? (min + max) / 2;
      const v = c + (Math.random() - 0.5) * (max - min) * 0.6;
      return Math.round(Math.min(max, Math.max(min, v)));
    }
    case "hundred-points": {
      const w = slide.options.map(() => Math.random());
      const sum = w.reduce((a, b) => a + b, 0) || 1;
      const pts = w.map((x) => Math.round((x / sum) * 100));
      // 100'e yuvarla
      const diff = 100 - pts.reduce((a, b) => a + b, 0);
      if (pts.length) pts[0] += diff;
      return pts;
    }
    default:
      return skewIndex();
  }
}

/** İzleyicinin cevap verdiği (oy) slayt tipleri. */
export function isVotingSlide(slide: Slide): boolean {
  return [
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
  ].includes(slide.type);
}
