/**
 * FlowWall — duvar (walls/{id}) CRUD + kod çözümü + medya moderasyonu.
 * Metadata Firebase'de; dosya byte'ları Cloudinary'de (bkz. cloudinary.ts).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { getVoterId } from "./responses";
import { ContestVote, RaffleDraw, RaffleEntry, RaffleWinner, Wall, WallEffect, WallMedia, WallScreenMode, WallWish } from "./types";

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function randomSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Koleksiyonu sayfa sayfa siler — tüm dokümanları belleğe almadan (binlerce
 *  medya/tepkide bile şişmez): her turda en çok 450 oku + tek batch'te sil. */
async function deleteAllDocs(colPath: [string, ...string[]]): Promise<void> {
  const col = collection(db(), ...colPath);
  for (let guard = 0; guard < 10000; guard++) {
    const snap = await getDocs(query(col, limit(450)));
    if (snap.empty) break;
    const batch = writeBatch(db());
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 450) break;
  }
}

/** joinCodes tek havuz — duvar kodu {id, kind:"wall"} olarak yazılır. */
async function allocateWallCode(wallId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const ref = doc(db(), "joinCodes", code);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { id: wallId, kind: "wall" });
      return code;
    }
  }
  throw new Error("Katılım kodu üretilemedi, tekrar deneyin.");
}

export async function createWall(ownerId: string, title: string): Promise<string> {
  const ref = await addDoc(collection(db(), "walls"), {
    ownerId,
    title,
    joinCode: "",
    moderation: false,
    sessionId: randomSessionId(),
    sessionStartedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  const code = await allocateWallCode(ref.id);
  await updateDoc(ref, { joinCode: code });
  return ref.id;
}

export async function listWalls(ownerId: string): Promise<Wall[]> {
  const snap = await getDocs(query(collection(db(), "walls"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Wall)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function renameWall(id: string, title: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { title, updatedAt: serverTimestamp() });
}

export async function setWallModeration(id: string, moderation: boolean): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { moderation });
}

export async function setWallAllowVideo(id: string, allowVideo: boolean): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { allowVideo, updatedAt: serverTimestamp() });
}

// ── Sınırlar (kota/kalite guard'ları) ────────────────────────────────────────
/** Video süre limiti sn (0 = kapalı). allowVideo'yu da senkron tutar (eski okuyucular). */
export async function setWallVideoLimit(id: string, videoLimitSec: number): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { videoLimitSec, allowVideo: videoLimitSec > 0, updatedAt: serverTimestamp() });
}

/** Kişi başı en fazla foto (0 = sınırsız). */
export async function setWallMaxPerPerson(id: string, maxPerPerson: number): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { maxPerPerson, updatedAt: serverTimestamp() });
}

/** Etkin video limiti (sn): açıkça verilmişse o; yoksa eski allowVideo'dan türet (varsayılan 30). */
export function wallVideoLimitSec(wall: Wall | null | undefined): number {
  if (wall?.videoLimitSec != null) return wall.videoLimitSec;
  return wall?.allowVideo === false ? 0 : 30;
}

/** Etkin kişi başı foto tavanı (0 = sınırsız, varsayılan 20). */
export function wallMaxPerPerson(wall: Wall | null | undefined): number {
  return wall?.maxPerPerson ?? 20;
}

export async function setWallWishesEnabled(id: string, wishesEnabled: boolean): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { wishesEnabled, updatedAt: serverTimestamp() });
}

export async function setWallKeepOriginal(id: string, keepOriginal: boolean): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { keepOriginal, updatedAt: serverTimestamp() });
}

/** Anı Filmi'ni perdede canlı oynat (kokpit tetikler; perde startedAt tazeyse gösterir). */
export async function startWallFilm(id: string, length: string, musicId: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), {
    filmPlay: { startedAt: serverTimestamp(), length, musicId },
    updatedAt: serverTimestamp(),
  });
}

export async function stopWallFilm(id: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { filmPlay: null, updatedAt: serverTimestamp() });
}

// ── Yaşam döngüsü (kapat / aç / yeni oturum) ─────────────────────────────────
/** Duvarı kapat: yükleme durur, perde "teşekkürler" gösterir (veri silinmez). */
export async function closeWall(id: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { closed: true, updatedAt: serverTimestamp() });
}

/** Kapalı duvarı yeniden aç (aynı oturum devam eder). */
export async function reopenWall(id: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { closed: false, updatedAt: serverTimestamp() });
}

/**
 * Yeni oturum: sessionId döndürülür → perde/misafir/kokpit yalnız YENİ oturumu
 * gösterir (eski anılar Firestore/Cloudinary'de KALIR, sadece gizlenir). Aynı
 * duvarı ikinci grupla baştan çalıştırmak için. Kapalıysa açılır.
 */
export async function newWallSession(id: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), {
    sessionId: randomSessionId(),
    sessionStartedAt: serverTimestamp(),
    closed: false,
    updatedAt: serverTimestamp(),
  });
}

/** Medya aktif oturuma mı ait? (perde/kokpit/gez oturum filtresi).
 *  - Duvarın oturumu yoksa: hepsi görünür.
 *  - Medyada sessionId yoksa (ESKİ/etiketsiz): daima görünür → oturum
 *    etiketlemesinden önceki yüklemeler bir daha kaybolmaz (legacy uyumu).
 *  - Aksi halde: yalnız aktif oturum eşleşmesi. */
export function isCurrentSession(m: WallMedia, wall: Wall | null | undefined): boolean {
  if (!wall?.sessionId) return true;
  if (!m.sessionId) return true;
  return m.sessionId === wall.sessionId;
}

export async function setWallHeadline(id: string, headline: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { headline, updatedAt: serverTimestamp() });
}

export async function setWallTheme(id: string, theme: { preset?: string; bgImage?: string }): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { theme, updatedAt: serverTimestamp() });
}

export async function setWallScreenMode(id: string, screenMode: WallScreenMode): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { screenMode, updatedAt: serverTimestamp() });
}

export async function setWallEffect(id: string, effect: WallEffect): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { effect, updatedAt: serverTimestamp() });
}

export async function setWallAutoModes(id: string, autoModes: WallScreenMode[]): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { autoModes, updatedAt: serverTimestamp() });
}

export async function setWallAutoInterval(id: string, autoIntervalSec: number): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { autoIntervalSec, updatedAt: serverTimestamp() });
}

/** Duvarı TAM temizler: önce Cloudinary dosyaları (prefix), sonra tüm alt
 *  koleksiyonlar (yetim wishes/reactions/contestVotes dahil), en son kod + doküman.
 *  idToken verilirse Cloudinary temizliği yapılır; başarısızsa Firestore temizliği
 *  yine de tamamlanır (best-effort — buton donmaz). */
export async function deleteWall(w: Wall, idToken?: string): Promise<void> {
  // 1) Cloudinary dosyaları (secret sunucuda; wall dokümanı hâlâ dururken çağır —
  //    route sahiplik kontrolü için okuyor). Temizlik BAŞARISIZSA silme durur:
  //    doküman gidince route'un sahiplik kontrolü bir daha geçemez → dosyalar
  //    KALICI yetim kalırdı. (env tanımsız "not-configured" ise devam edilir.)
  if (idToken) {
    let purgeFailed = false;
    try {
      const res = await fetch("/api/wall/destroy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "wall", wallId: w.id, idToken }),
      });
      const j = await res.json().catch(() => ({}) as { error?: string });
      purgeFailed = !res.ok && j?.error !== "not-configured";
    } catch {
      purgeFailed = true; // ağ hatası: yarım silme yapma
    }
    if (purgeFailed) {
      throw new Error("Medya dosyaları temizlenemedi — duvar silinmedi, lütfen tekrar dene.");
    }
  }
  // 2) Alt koleksiyonlar (yetim kalmasın)
  await deleteAllDocs(["walls", w.id, "media"]);
  await deleteAllDocs(["walls", w.id, "reactions"]);
  await deleteAllDocs(["walls", w.id, "wishes"]);
  await deleteAllDocs(["walls", w.id, "contestVotes"]);
  await deleteAllDocs(["walls", w.id, "raffleEntries"]);
  await deleteAllDocs(["walls", w.id, "draws"]);
  // 3) joinCode + duvar dokümanı
  const batch = writeBatch(db());
  if (w.joinCode) batch.delete(doc(db(), "joinCodes", w.joinCode));
  batch.delete(doc(db(), "walls", w.id));
  await batch.commit();
}

// ── Kod çözümü (deck | wall tek havuz) ───────────────────────────────────────
export interface CodeTarget {
  kind: "wall" | "deck";
  id: string;
}
export async function resolveCode(code: string): Promise<CodeTarget | null> {
  const snap = await getDoc(doc(db(), "joinCodes", code));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (d.kind === "wall" && d.id) return { kind: "wall", id: d.id as string };
  if (d.presentationId) return { kind: "deck", id: d.presentationId as string };
  return null;
}

// ── Medya ────────────────────────────────────────────────────────────────────
export interface NewMedia {
  voterId: string;
  nickname?: string;
  type: "image" | "video";
  cloudinaryId: string;
  url: string;
  w?: number;
  h?: number;
  durationMs?: number;
}

/** Medya dokümanı oluşturur. Moderasyon açıksa status=pending, değilse approved. */
export async function addWallMedia(
  wallId: string,
  media: NewMedia,
  moderation: boolean,
  sessionId?: string
): Promise<void> {
  const data: Record<string, unknown> = {
    voterId: media.voterId,
    type: media.type,
    cloudinaryId: media.cloudinaryId,
    url: media.url,
    status: moderation ? "pending" : "approved",
    likes: 0,
    createdAt: serverTimestamp(),
  };
  if (media.nickname) data.nickname = media.nickname;
  if (media.w != null) data.w = media.w;
  if (media.h != null) data.h = media.h;
  if (media.durationMs != null) data.durationMs = media.durationMs;
  if (sessionId) data.sessionId = sessionId;
  await addDoc(collection(db(), "walls", wallId, "media"), data);
}

export async function setMediaStatus(
  wallId: string,
  mediaId: string,
  status: WallMedia["status"]
): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId, "media", mediaId), { status });
}

export async function deleteMedia(wallId: string, mediaId: string): Promise<void> {
  // Not: Cloudinary'deki dosya silme API secret ister → ileride Vercel API route.
  // Şimdilik Firestore dokümanı silinir (duvardan kalkar).
  await deleteDoc(doc(db(), "walls", wallId, "media", mediaId));
}

// ── Tepkiler (misafir → perde emoji/kalp yağmuru; create-only) ────────────────
export const WALL_REACTION_EMOJIS = ["❤️", "👏", "🎉", "😍", "🔥", "😮"] as const;
export type WallReactionEmoji = (typeof WALL_REACTION_EMOJIS)[number];

let lastReactionSent = 0;

/** Perdeye emoji gönderir — client-side 500ms rate limit (spam koruması). */
export async function sendWallReaction(wallId: string, emoji: WallReactionEmoji): Promise<void> {
  const now = Date.now();
  if (now - lastReactionSent < 500) return;
  lastReactionSent = now;
  await addDoc(collection(db(), "walls", wallId, "reactions"), {
    emoji,
    createdAt: serverTimestamp(),
  });
}

// ── Dilek/not mesajları (misafir yazılı → perdede akan dilek bandı) ───────────
let lastWishSent = 0;

/** Duvara dilek/not bırakır (create-only). Moderasyon açıksa status=pending.
 *  Dönüş: yazıldı mı? (throttle/boş metin → false; UI sahte başarı göstermesin) */
export async function sendWallWish(wallId: string, text: string, nickname: string | undefined, moderation: boolean): Promise<boolean> {
  const clean = text.trim().slice(0, 140);
  if (!clean) return false;
  const now = Date.now();
  if (now - lastWishSent < 800) return false;
  lastWishSent = now;
  const data: Record<string, unknown> = {
    text: clean,
    voterId: getVoterId(),
    status: moderation ? "pending" : "approved",
    createdAt: serverTimestamp(),
  };
  if (nickname && nickname.trim()) data.nickname = nickname.trim().slice(0, 30);
  await addDoc(collection(db(), "walls", wallId, "wishes"), data);
  return true;
}

export function watchWallWishes(id: string, cb: (w: WallWish[]) => void): () => void {
  const q = query(collection(db(), "walls", id, "wishes"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WallWish));
  });
}

export async function setWishStatus(wallId: string, wishId: string, status: WallWish["status"]): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId, "wishes", wishId), { status });
}

export async function deleteWish(wallId: string, wishId: string): Promise<void> {
  await deleteDoc(doc(db(), "walls", wallId, "wishes", wishId));
}

// ── Canlı anons (moderasyondan; süre sonuna kadar perdede durur) ──────────────
/** Anons yayınlar: `until` = şimdi + dakika. Perde bu ana kadar gösterir. */
export async function setWallAnnouncement(wallId: string, text: string, durationMin: number): Promise<void> {
  const clean = text.trim().slice(0, 160);
  if (!clean) return;
  const until = new Date(Date.now() + Math.max(1, durationMin) * 60_000);
  await updateDoc(doc(db(), "walls", wallId), { announcement: { text: clean, until }, updatedAt: serverTimestamp() });
}

export async function clearWallAnnouncement(wallId: string): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId), { announcement: null, updatedAt: serverTimestamp() });
}

/** "En Sevilenler" turu sıklığı (saniye; 0 = kapalı). */
export async function setWallTopLovedInterval(wallId: string, topLovedEverySec: number): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId), { topLovedEverySec, updatedAt: serverTimestamp() });
}

/** Milestone kutlamaları aç/kapat. */
export async function setWallMilestones(wallId: string, milestones: boolean): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId), { milestones, updatedAt: serverTimestamp() });
}

// ── Foto yarışması (moderasyondan) ────────────────────────────────────────────
export async function startContest(wallId: string, title: string, durationMin = 0): Promise<void> {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`;
  await deleteAllDocs(["walls", wallId, "contestVotes"]); // eski oyları temizle
  const endsAt = durationMin > 0 ? new Date(Date.now() + durationMin * 60_000) : null;
  await updateDoc(doc(db(), "walls", wallId), {
    contest: { id, title: title.trim().slice(0, 80), status: "running", startedAt: serverTimestamp(), endsAt, winnerMediaId: null },
    updatedAt: serverTimestamp(),
  });
}

export async function endContest(wallId: string, winnerMediaId: string | null): Promise<void> {
  await updateDoc(doc(db(), "walls", wallId), {
    "contest.status": "ended",
    "contest.endedAt": serverTimestamp(),
    "contest.winnerMediaId": winnerMediaId ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function clearContest(wallId: string): Promise<void> {
  await deleteAllDocs(["walls", wallId, "contestVotes"]);
  await updateDoc(doc(db(), "walls", wallId), { contest: null, updatedAt: serverTimestamp() });
}

function contestVoteKey(contestId: string): string {
  return `flowwall.vote.${contestId}`;
}
export function getMyContestVote(contestId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(contestVoteKey(contestId));
}
export async function castContestVote(wallId: string, contestId: string, mediaId: string): Promise<void> {
  // İşaret yazım BAŞARISINDA düşülür — sunucu reddederse oy "verilmiş" görünmez.
  await setDoc(doc(db(), "walls", wallId, "contestVotes", getVoterId()), {
    mediaId,
    contestId,
    createdAt: serverTimestamp(),
  });
  localStorage.setItem(contestVoteKey(contestId), mediaId);
}

/** Oyları dinler — YALNIZ perde + kokpit kullanır (misafir değil, ölçek). */
export function watchContestVotes(wallId: string, cb: (v: ContestVote[]) => void): () => void {
  return onSnapshot(collection(db(), "walls", wallId, "contestVotes"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContestVote));
  });
}

/** Aktif contestId oylarını mediaId'ye göre say, azalan (eşitlik: en eski media). */
export function tallyContest(votes: ContestVote[], contestId: string, media: WallMedia[]): { mediaId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of votes) if (v.contestId === contestId) counts.set(v.mediaId, (counts.get(v.mediaId) ?? 0) + 1);
  const order = new Map(media.map((m, i) => [m.id, i])); // createdAt asc → küçük index = eski
  return [...counts.entries()]
    .map(([mediaId, count]) => ({ mediaId, count }))
    .sort((a, b) => b.count - a.count || (order.get(a.mediaId) ?? 0) - (order.get(b.mediaId) ?? 0));
}

// ── Çekiliş (moderasyondan kurulur; perdede animasyonlu çekilir) ──────────────
type RaffleType = "registration" | "number";

/** Çekilişi kur/aç — TAZE havuz (önceki kayıtları temizler). Kayıt türünde giriş açık. */
export async function startRaffle(id: string, type: RaffleType): Promise<void> {
  await deleteAllDocs(["walls", id, "raffleEntries"]); // yeni çekiliş = temiz havuz
  await updateDoc(doc(db(), "walls", id), {
    // Misafir kaydı VARSAYILAN KAPALI — organizatör hazır olunca "Aç" der / Excel yükler.
    raffle: { type, registerOpen: false, registerUntil: null, prize: "", winnersCount: 1, suspenseSec: 7, min: 1, max: 100, draw: null },
    updatedAt: serverTimestamp(),
  });
}

/** Çekilişi bitir — perdeden kaldırır ama KAYITLARI SİLMEZ (tekrar kurulunca temizlenir). */
export async function endRaffle(id: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { raffle: null, updatedAt: serverTimestamp() });
}

/** Çekiliş ayarlarını güncelle (raffle mevcut olmalı; dot-path). */
export async function setRaffleFields(id: string, patch: Partial<{ registerOpen: boolean; prize: string; winnersCount: number; suspenseSec: number; min: number; max: number; type: RaffleType }>): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(patch)) data[`raffle.${k}`] = v;
  await updateDoc(doc(db(), "walls", id), data);
}

/** Çekilişi kapat + kayıtları temizle. */
export async function clearRaffle(id: string): Promise<void> {
  await deleteAllDocs(["walls", id, "raffleEntries"]);
  await updateDoc(doc(db(), "walls", id), { raffle: null, updatedAt: serverTimestamp() });
}

function raffleKey(wallId: string): string {
  return `flowwall.raffle.${wallId}`;
}
/** Bu cihaz bu duvarda çekilişe hangi sicille kayıtlı? (UX; güvenlik değil). */
export function getMyRaffleSicil(wallId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(raffleKey(wallId));
}

/** Çekilişe kaydol — doc id = sicil (aynı sicil = tek kayıt; iki-telefon şişirmesini keser). */
export async function registerRaffle(wallId: string, name: string, sicil: string): Promise<void> {
  const cleanName = name.trim().slice(0, 40);
  const cleanSicil = sicil.trim().slice(0, 40);
  if (!cleanName || !cleanSicil) throw new Error("İsim ve sicil gerekli.");
  const docId = cleanSicil.replace(/[^\w-]/g, "_"); // Firestore doc id güvenli
  await setDoc(doc(db(), "walls", wallId, "raffleEntries", docId), {
    name: cleanName,
    sicil: cleanSicil,
    voterId: getVoterId(),
    createdAt: serverTimestamp(),
  });
  if (typeof localStorage !== "undefined") localStorage.setItem(raffleKey(wallId), cleanSicil);
}

/** Kayıtları dinle — YALNIZ kokpit + perde (misafir değil; ölçek). */
export function watchRaffleEntries(wallId: string, cb: (e: RaffleEntry[]) => void): () => void {
  return onSnapshot(collection(db(), "walls", wallId, "raffleEntries"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RaffleEntry));
  });
}

/** Çekim geçmişini dinle (kalıcı "çekiliş sonuçları" — Bitir/Sil sonrası da kalır). */
export function watchDraws(wallId: string, cb: (d: RaffleDraw[]) => void): () => void {
  const q = query(collection(db(), "walls", wallId, "draws"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RaffleDraw)));
}

/** Organizatör toplu liste ekler (Excel/CSV). doc id = sicil (tekilleştirir). */
export async function bulkAddRaffleEntries(wallId: string, rows: { name: string; sicil: string }[]): Promise<number> {
  const seen = new Set<string>();
  const clean = rows
    .map((r) => ({ name: (r.name ?? "").trim().slice(0, 40), sicil: (r.sicil ?? "").trim().slice(0, 40) }))
    .filter((r) => r.sicil && r.name && !seen.has(r.sicil) && seen.add(r.sicil));
  const vid = getVoterId();
  for (let i = 0; i < clean.length; i += 400) {
    const batch = writeBatch(db());
    for (const r of clean.slice(i, i + 400)) {
      const docId = r.sicil.replace(/[^\w-]/g, "_");
      batch.set(doc(db(), "walls", wallId, "raffleEntries", docId), {
        name: r.name,
        sicil: r.sicil,
        voterId: vid,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return clean.length;
}

/** Kayıt penceresini aç: registerOpen=true + (dakika>0 ise) registerUntil. 0 = süresiz. */
export async function openRaffleRegistration(id: string, minutes: number): Promise<void> {
  const until = minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;
  await updateDoc(doc(db(), "walls", id), {
    "raffle.registerOpen": true,
    "raffle.registerUntil": until,
    updatedAt: serverTimestamp(),
  });
}

/** Kayıt penceresini kapat. */
export async function closeRaffleRegistration(id: string): Promise<void> {
  await updateDoc(doc(db(), "walls", id), { "raffle.registerOpen": false, updatedAt: serverTimestamp() });
}

/** Kayıt şu an açık mı? (registerOpen + registerUntil geçmediyse). */
export function raffleRegistrationOpen(wall: Wall | null | undefined, now = Date.now()): boolean {
  const r = wall?.raffle;
  if (!r || r.type !== "registration" || r.registerOpen === false) return false;
  const until = r.registerUntil?.toMillis?.() ?? 0;
  return !until || until > now;
}

function pickUnique<T>(arr: T[], k: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, k));
}

/**
 * Çekimi yap: kazananları belirle, perde tetikleyicisine yaz (raffle.draw) VE
 * kalıcı kayıt için `draws` loguna ekle (moderatöre güven + kayıt kalır).
 */
export async function drawRaffle(wall: Wall, entries: RaffleEntry[]): Promise<void> {
  const r = wall.raffle;
  if (!r) return;
  const count = Math.max(1, r.winnersCount ?? 1);
  let winners: RaffleWinner[] = [];
  let poolSize = 0;
  if (r.type === "number") {
    const min = r.min ?? 1;
    const max = Math.max(min, r.max ?? min);
    const pool: number[] = [];
    for (let n = min; n <= max; n++) pool.push(n);
    poolSize = pool.length;
    winners = pickUnique(pool, count).map((n) => ({ label: String(n) }));
  } else {
    poolSize = entries.length;
    winners = pickUnique(entries, Math.min(count, entries.length)).map((e) => ({ label: e.name, sub: e.sicil }));
  }
  if (winners.length === 0) throw new Error("Havuz boş — çekilecek kimse yok.");
  const nonce = Math.random().toString(36).slice(2, 10);
  // 1) Perde tetikleyicisi ÖNCE (asıl olay bu) — nonce ile saat-bağımsız oynar.
  await updateDoc(doc(db(), "walls", wall.id), {
    "raffle.draw": { startedAt: serverTimestamp(), winners, nonce },
    updatedAt: serverTimestamp(),
  });
  // 2) Kayıt logu best-effort — rules yoksa/başarısızsa çekim yine de oynasın.
  try {
    await addDoc(collection(db(), "walls", wall.id, "draws"), {
      type: r.type,
      prize: r.prize ?? "",
      poolSize,
      winners,
      createdAt: serverTimestamp(),
    });
  } catch {
    /* log yazılamadı (ör. rules henüz deploy edilmedi) → çekim etkilenmez */
  }
}

// ── Beğeni (misafir ❤ — sunum Q&A upvote deseniyle aynı: +1, localStorage dedup) ─
function likeKey(mediaId: string): string {
  return `flowwall.liked.${mediaId}`;
}

/** Bu cihaz bu medyayı daha önce beğendi mi? (tek beğeni; kurallar da +1 sınırlar) */
export function hasLikedMedia(mediaId: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(likeKey(mediaId)) === "1";
}

/** Medyayı beğen (+1). Tekrarları localStorage engeller; sunucuda +1 kuralı var.
 *  İşaret yazım BAŞARISINDA düşülür — hata olursa cihaz tekrar deneyebilir
 *  (önce yazılırsa başarısız beğeni kalıcı "beğenilmiş" görünürdü). */
export async function likeMedia(wallId: string, mediaId: string): Promise<void> {
  if (hasLikedMedia(mediaId)) return;
  await updateDoc(doc(db(), "walls", wallId, "media", mediaId), { likes: increment(1) });
  localStorage.setItem(likeKey(mediaId), "1");
}

// ── Canlı dinleyiciler ───────────────────────────────────────────────────────
export function watchWall(id: string, cb: (w: Wall | null) => void): () => void {
  return onSnapshot(doc(db(), "walls", id), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Wall) : null);
  });
}

export function watchWallMedia(id: string, cb: (m: WallMedia[]) => void): () => void {
  const q = query(collection(db(), "walls", id, "media"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WallMedia));
  });
}

/** Sadece bir voterId'nin medyasını dinler (tek alan filtresi — index gerekmez).
 * Misafir telefonları TÜM koleksiyonu dinlemesin diye ("duvarda göründün"). */
export function watchWallMediaByVoter(id: string, voterId: string, cb: (m: WallMedia[]) => void): () => void {
  const q = query(collection(db(), "walls", id, "media"), where("voterId", "==", voterId));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WallMedia));
  });
}

/** En yeni N medyayı dinler (misafir "Duvarı gez" için — sınırlı okuma). */
export function watchWallMediaRecent(id: string, max: number, cb: (m: WallMedia[]) => void): () => void {
  const q = query(collection(db(), "walls", id, "media"), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WallMedia));
  });
}
