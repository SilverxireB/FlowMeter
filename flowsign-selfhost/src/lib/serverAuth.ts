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

// ── Ekran yetkisi (matris) ───────────────────────────────────────────────────
// TEK yerden yönetilir: Kullanıcılar → "Sign yetkileri". Açık kayıt (grants)
// varsa o geçerlidir; yoksa ekranı OLUŞTURAN tam yetkilidir ("yarattığına zaten
// yetkili"). Yönetici (kurulumu yapan BT) her ekranda tam yetkilidir; sahipsiz
// (eski sürümden kalan) ekranlar da yöneticinindir.

const FULL = { view: true, edit: true, copy: true, delete: true } as const;
const NONE = { view: false, edit: false, copy: false, delete: false } as const;

export function permOf(w: Videowall, u: User | null): { view: boolean; edit: boolean; copy: boolean; delete: boolean } {
  if (!u) return { ...NONE };
  if (u.role === "admin") return { ...FULL };
  const explicit = w.grants?.[u.id];
  if (explicit) return { ...NONE, ...explicit };
  // VARSAYILAN: giriş yapan herkes GÖRÜNTÜLEYEREK doğar (kurum kararı) —
  // açık kayıt bunu da ezebilir (yönetici kişi+ekran bazında kesebilir).
  return w.ownerId && w.ownerId === u.id ? { ...FULL } : { ...NONE, view: true };
}

export const canEdit = (w: Videowall, u: User | null) => permOf(w, u).edit;
export const canDelete = (w: Videowall, u: User | null) => permOf(w, u).delete;
export const canCopy = (w: Videowall, u: User | null) => permOf(w, u).copy;
export const canView = (w: Videowall, u: User | null) => {
  const p = permOf(w, u);
  return p.view || p.edit || p.copy || p.delete;
};
