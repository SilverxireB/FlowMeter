/**
 * Anı Filmi — sahne listesi (timeline) kurgusu + akıllı seçim (curation).
 *
 * 1000 anı olsa bile film ~40 sahneye sığar. Seçim mantığı:
 *  1. 👑 en sevilen garantili (finalde),
 *  2. adalet: her yükleyenden en az 1 foto (bütçe elverdiğince → herkes filmde),
 *  3. kalan bütçe: beğeni × tazelik karışımı,
 *  4. sıralama kronolojik (etkinliğin hikâyesi), en sevilen sona alınır,
 *  5. aralara dilek kartları serpiştirilir.
 *
 * Süre = sahne sayısını belirler (foto başına sabit süre); kullanıcı foto
 * saymaz, sadece Kısa/Orta/Uzun seçer.
 */
import { WallMedia, WallWish } from "@/lib/types";

export type FilmLength = "short" | "medium" | "long";
export type FilmOrientation = "portrait" | "landscape";

export interface FilmOptions {
  length: FilmLength;
  fairness: boolean; // her yükleyenden en az 1 foto
}

/** Sahne süreleri (ms) ve geçiş örtüşmesi. */
export const SCENE_MS = { title: 3000, photo: 4000, wish: 3800, outro: 4400 } as const;
export const TRANSITION_MS = 600; // crossfade örtüşmesi

/** Uzunluk → hedef foto sayısı (foto süresi 4sn'ye çıktı → sayı buna göre). */
export function photoBudget(length: FilmLength): number {
  return length === "short" ? 16 : length === "long" ? 44 : 30;
}

export interface PhotoScene {
  type: "photo";
  media: WallMedia;
  crownded: boolean; // 👑 en sevilen mi
  ken: { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number };
}
export interface WishScene {
  type: "wish";
  text: string;
  nickname?: string;
}
export interface TitleScene {
  type: "title";
  title: string;
  subtitle: string;
}
export interface OutroScene {
  type: "outro";
  memories: number;
  people: number;
  likes: number;
}
export type BaseScene = PhotoScene | WishScene | TitleScene | OutroScene;
export type FilmScene = BaseScene & {
  /** Zaman çizgisindeki başlangıç ve süre (ms), örtüşme dahil hesaplanır. */
  startMs: number;
  durMs: number;
};

const mediaMs = (m: WallMedia) => m.createdAt?.toMillis?.() ?? 0;

/**
 * Bir fotoya çeşitlemeli, mekanik durmayan Ken Burns hareketi ata.
 * ÖNEMLİ: zoom tabanı hep >1 (base=1.10) ve kaydırma ≤0.035 → görüntü her an
 * kareyi taşırır; kenardan siyah GÖRÜNMEZ (koşul: |kaydırma| ≤ (scale−1)/2).
 */
function kenBurns(i: number): PhotoScene["ken"] {
  const base = 1.1;
  const amp = 0.1; // zoom aralığı 1.10 ↔ 1.20
  const zoomIn = i % 2 === 0;
  const fromScale = zoomIn ? base : base + amp;
  const toScale = zoomIn ? base + amp : base;
  const dirs = [
    { x: -0.03, y: -0.02 },
    { x: 0.03, y: 0.02 },
    { x: -0.025, y: 0.03 },
    { x: 0.03, y: -0.025 },
  ];
  const d = dirs[i % dirs.length];
  return { fromScale, toScale, fromX: -d.x, toX: d.x, fromY: -d.y, toY: d.y };
}

/**
 * Onaylı medya + dilek + ayarlardan sahne listesi kurar.
 * Not: v1'de video de "sabit kare" (poster) olarak filme girer — oynatma yok.
 */
export function buildTimeline(
  title: string,
  media: WallMedia[],
  wishes: WallWish[],
  opts: FilmOptions
): { scenes: FilmScene[]; totalMs: number; picked: number; totalApproved: number } {
  const approved = media.filter((m) => m.status === "approved");
  const budget = photoBudget(opts.length);

  // En sevilen (👑) — beğenisi >0 olanlar arasında en yüksek
  let crown: WallMedia | null = null;
  for (const m of approved) if ((m.likes ?? 0) > 0 && (!crown || (m.likes ?? 0) > (crown.likes ?? 0))) crown = m;

  // Skor: beğeni ağırlıklı + hafif tazelik (0..1). Eşitlikte yeni olan öne.
  const times = approved.map(mediaMs);
  const minT = Math.min(...times, 0);
  const maxT = Math.max(...times, 1);
  const span = Math.max(1, maxT - minT);
  const score = (m: WallMedia) => (m.likes ?? 0) * 10 + (mediaMs(m) - minT) / span;

  const chosen = new Map<string, WallMedia>();
  const add = (m?: WallMedia | null) => {
    if (m && !chosen.has(m.id) && chosen.size < budget) chosen.set(m.id, m);
  };

  add(crown);

  // 1) Adalet: her yükleyenden en iyi 1 foto (bütçe dolana / kişiler bitene dek)
  if (opts.fairness) {
    const bestPerVoter = new Map<string, WallMedia>();
    for (const m of approved) {
      const k = m.voterId || m.id;
      const cur = bestPerVoter.get(k);
      if (!cur || score(m) > score(cur)) bestPerVoter.set(k, m);
    }
    for (const m of [...bestPerVoter.values()].sort((a, b) => score(b) - score(a))) add(m);
  }

  // 2) Kalan bütçe: skora göre en iyiler
  for (const m of [...approved].sort((a, b) => score(b) - score(a))) add(m);

  // Kronolojik sırala, en seveni finale taşı
  let picked = [...chosen.values()].sort((a, b) => mediaMs(a) - mediaMs(b));
  if (crown && chosen.has(crown.id)) {
    picked = picked.filter((m) => m.id !== crown!.id);
    picked.push(crown);
  }

  const photoScenes: PhotoScene[] = picked.map((m, i) => ({
    type: "photo",
    media: m,
    crownded: !!crown && m.id === crown.id,
    ken: kenBurns(i),
  }));

  // Dilekleri araya serpiştir (yaklaşık her 6 fotoda 1, en fazla 6)
  const approvedWishes = wishes.filter((w) => (w.status ?? "approved") === "approved" && w.text?.trim());
  const wishCount = Math.min(approvedWishes.length, Math.max(0, Math.floor(photoScenes.length / 6)), 6);
  const wishPick = [...approvedWishes]
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
    .slice(0, wishCount);

  // Sahneleri birleştir: title → (fotolar arasına dilek) → outro
  const body: (PhotoScene | WishScene)[] = [];
  const gap = wishPick.length ? Math.ceil(photoScenes.length / (wishPick.length + 1)) : 0;
  let wi = 0;
  photoScenes.forEach((ps, i) => {
    body.push(ps);
    if (gap && wi < wishPick.length && (i + 1) % gap === 0 && i < photoScenes.length - 1) {
      const w = wishPick[wi++];
      body.push({ type: "wish", text: w.text.trim(), nickname: w.nickname });
    }
  });

  const participants = new Set(approved.map((m) => m.voterId || m.id)).size;
  const totalLikes = approved.reduce((s, m) => s + (m.likes ?? 0), 0);

  const raw: (BaseScene & { durMs: number })[] = [
    { type: "title", title: title || "FlowWall", subtitle: new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }), durMs: SCENE_MS.title },
    ...body.map((s) => ({ ...s, durMs: s.type === "wish" ? SCENE_MS.wish : SCENE_MS.photo })),
    { type: "outro", memories: approved.length, people: participants, likes: totalLikes, durMs: SCENE_MS.outro },
  ];

  // Örtüşmeli başlangıç zamanları (crossfade): her sahne bir öncekiyle TRANSITION_MS örtüşür
  const scenes: FilmScene[] = [];
  let cursor = 0;
  raw.forEach((s, i) => {
    const startMs = i === 0 ? 0 : cursor - TRANSITION_MS;
    scenes.push({ ...s, startMs } as FilmScene);
    cursor = startMs + s.durMs;
  });
  const totalMs = cursor;

  return { scenes, totalMs, picked: picked.length, totalApproved: approved.length };
}
