/**
 * FlowSign self-host — oturum + YETKİ kapısı.
 *
 * Fabrika iç ağı modeli: yayın (perde) linki AUTH İSTEMEZ; kokpit/yazma uçları
 * imzalı çerez arar. Artık tek ortak parola değil, KİŞİ BAŞINA hesap var
 * (bkz. users.ts) — "ekranı hazırla, ilgilisine teslim et" akışının temeli.
 *
 * Çerez: `userId.HMAC(gizli, userId + ":" + parolaÖzeti)`.
 *  - Sunucuya özel gizli anahtar `data/session-secret` dosyasında (yoksa üretilir)
 *    → .env değişmeden çalışır, sunucu yeniden başlayınca oturumlar düşmez.
 *  - Parola özeti imzaya girer → parola değişince O KULLANICININ oturumları
 *    kendiliğinden geçersizleşir (ayrılan personelin açık kalmış tarayıcısı).
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { DATA_DIR } from "./store";
import { getUser, User } from "./users";
import { Videowall } from "./types";

export const SESSION_COOKIE = "flowsign_session";
const SECRET_FILE = path.join(DATA_DIR, "session-secret");

let cachedSecret: string | null = null;
async function secret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  try {
    const disk = (await fs.readFile(SECRET_FILE, "utf8")).trim();
    if (disk) {
      cachedSecret = disk;
      return disk;
    }
  } catch {}
  const fresh = randomBytes(32).toString("hex");
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SECRET_FILE, fresh, "utf8");
  cachedSecret = fresh;
  return fresh;
}

export async function sessionToken(u: User): Promise<string> {
  const sig = createHmac("sha256", await secret()).update(`${u.id}:${u.hash}`).digest("hex");
  return `${u.id}.${sig}`;
}

/** Çerezden kullanıcıyı çöz (imza tutmuyorsa / kişi silindiyse null). */
export async function currentUser(req: NextRequest): Promise<User | null> {
  const raw = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  const user = await getUser(raw.slice(0, dot));
  if (!user) return null;
  const expected = await sessionToken(user);
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? user : null;
}

export const unauthorized = () => Response.json({ error: "Oturum gerekli" }, { status: 401 });
export const forbidden = () => Response.json({ error: "Bu işlem için yetkin yok" }, { status: 403 });

// ── Ekran yetkisi ────────────────────────────────────────────────────────────
// SAHİP    : düzenler, yayınlar, siler, devreder, yetki dağıtır.
// YETKİLİ  : düzenler ve yayınlar — silemez, devredemez, yetki dağıtamaz.
// YÖNETİCİ : her ekranda sahip yetkisindedir (kurulumu yapan BT dışarıda kalmasın).
// Sahipsiz (eski sürümden kalan) ekranlar yöneticinindir.

export function isOwner(w: Videowall, u: User | null): boolean {
  if (!u) return false;
  if (u.role === "admin") return true;
  if (!w.ownerId) return false; // sahipsiz ekran → yalnız yönetici
  return w.ownerId === u.id;
}

export function isEditor(w: Videowall, u: User | null): boolean {
  if (!u) return false;
  return (w.editorIds ?? []).includes(u.id);
}

export function canEdit(w: Videowall, u: User | null): boolean {
  return isOwner(w, u) || isEditor(w, u);
}
