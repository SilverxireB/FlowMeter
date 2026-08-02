/**
 * PROVA botları — FlowWall (yalnız /admin/prova/duvar/[code], yönetici kapısı arkasında).
 *
 * Misafir yazımlarını GERÇEK yoldan yapar ama cihaz yardımcılarını atlar:
 * `walls.ts`teki misafir fonksiyonları tek bir telefon içindir — modül düzeyinde
 * hız freni (tepki 500 ms, dilek 800 ms), localStorage "beğendim/oy verdim"
 * işaretleri ve TEK `getVoterId()` kullanırlar. Onlarla 20 misafir taklit
 * edilemez: hepsi aynı kişi olur ve fren tepki yağmurunu keser. Bu yüzden burada
 * her bot kendi voterId'siyle yazar; ŞEKİL ve KURALLAR birebir aynıdır.
 */
import { addDoc, collection, doc, increment, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { censorText } from "./profanity";
import { WALL_REACTION_EMOJIS } from "./walls";

const FIRST = ["Ada", "Deniz", "Ege", "Mira", "Kaan", "Elif", "Arda", "Nil", "Emir", "Zeynep", "Poyraz", "Lina", "Toprak", "Derin", "Bora", "Ceren", "Umut", "Yağmur", "Kuzey", "Aylin", "Efe", "Su", "Doruk", "İpek"];
const LAST = ["K.", "Y.", "A.", "T.", "B.", "S.", "D.", "M.", "Ç.", "Ö."];

export const WALL_WISHES = [
  "Mutluluklar dilerim",
  "Harika bir geceydi",
  "Nice mutlu yıllara",
  "Buradayız, çok güzel",
  "Emeği geçen herkese teşekkürler",
  "Bu anı unutmayacağız",
  "Müzik çok iyi",
  "Yemekler nefisti",
  "Sonsuz mutluluklar",
  "En güzel günler sizin olsun",
  "Dans pisti bizden sorulur",
  "Fotoğraflar çok güzel çıkmış",
];

export interface WallBot {
  voterId: string;
  nickname: string;
  /** Çekiliş kaydı için sicil (doc id olur — aynı sicil tek kayıt). */
  sicil: string;
  /** Tepki eğilimi (saniyede) — hevesli misafir ile sessiz misafir aynı değil. */
  reactionRate: number;
  /** Beğeni eğilimi (saniyede) */
  likeRate: number;
  /** Dilek bırakma periyodu (ms; 0 = bırakmaz) */
  wishEvery: number;
}

const rnd = () => Math.random();
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];

/** N misafir üretir. Karışım gerçekçi: az sayıda çok hevesli, çoğunluk ılımlı. */
export function makeWallBots(n: number, ilk = 0): WallBot[] {
  return Array.from({ length: n }, (_, i) => {
    const hevesli = rnd() < 0.25;
    const sessiz = !hevesli && rnd() < 0.35;
    return {
      voterId: `sim-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      nickname: `${pick(FIRST)} ${pick(LAST)}`,
      sicil: `PRV${String(ilk + i + 1).padStart(4, "0")}`,
      reactionRate: hevesli ? 0.09 : sessiz ? 0.004 : 0.025,
      likeRate: hevesli ? 0.05 : sessiz ? 0.003 : 0.015,
      wishEvery: sessiz ? 0 : hevesli ? 70000 : 150000,
    };
  });
}

/** Perdeye uçan emoji (fren YOK — 20 misafirin yağmuru taklit edilecek). */
export function fireWallReaction(wallId: string): Promise<unknown> {
  return addDoc(collection(db(), "walls", wallId, "reactions"), {
    emoji: pick(WALL_REACTION_EMOJIS),
    createdAt: serverTimestamp(),
  });
}

/** Dilek bandına not. Moderasyon açıkken 'pending' ZORUNLU (kurallar şart koşar). */
export function fireWish(wallId: string, bot: WallBot, moderation: boolean): Promise<string> {
  const text = censorText(pick(WALL_WISHES));
  return addDoc(collection(db(), "walls", wallId, "wishes"), {
    text,
    nickname: bot.nickname,
    voterId: bot.voterId,
    status: moderation ? "pending" : "approved",
    createdAt: serverTimestamp(),
  }).then(() => text);
}

/** Medyaya ❤ (+1). Kurallar yalnız `likes` alanının tam +1 artmasına izin verir. */
export function fireLike(wallId: string, mediaId: string): Promise<void> {
  return updateDoc(doc(db(), "walls", wallId, "media", mediaId), { likes: increment(1) });
}

/** Yarışma oyu — doc id = voterId (kişi başı tek oy, değiştirilebilir). */
export function fireContestVote(wallId: string, bot: WallBot, contestId: string, mediaId: string): Promise<void> {
  return setDoc(doc(db(), "walls", wallId, "contestVotes", bot.voterId), {
    mediaId,
    contestId,
    createdAt: serverTimestamp(),
  });
}

/** Çekiliş kaydı — doc id = sicil (aynı sicil tek kayıt). */
export function fireRaffleEntry(wallId: string, bot: WallBot): Promise<void> {
  return setDoc(doc(db(), "walls", wallId, "raffleEntries", bot.sicil), {
    name: bot.nickname,
    sicil: bot.sicil,
    voterId: bot.voterId,
    createdAt: serverTimestamp(),
  });
}
