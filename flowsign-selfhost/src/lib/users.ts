/**
 * FlowSign self-host — KULLANICI DEFTERİ (`data/users.json`).
 *
 * Neden var: paketin asıl kullanımı "ekranı hazırla, ilgilisine teslim et"
 * (İK'ya bir ekran kur → "al bu senin, bundan sonra sen yönet"). Tek ortak
 * parola bunu yapamaz: kim neyi değiştirdi belli olmaz, parola herkese yayılır,
 * ayrılan personelin erişimi kesilemez. Bu yüzden her kişinin kendi hesabı var.
 *
 * İki rol var, bilerek sade:
 *  - YÖNETİCİ (admin): kurulumu yapan BT. Kullanıcı açar/siler, TÜM ekranları
 *    yönetir, parola sıfırlar.
 *  - KULLANICI (user): kendi ekranlarının sahibi + kendisine yetki verilen
 *    ekranları düzenler.
 *
 * Depolama: veritabanı yok — atomik JSON (elektrik kesilse yarım dosya kalmaz).
 * Parolalar scrypt + kullanıcıya özel tuz ile saklanır (düz metin YOK).
 * İlk açılış: users.json yoksa .env'deki SIGN_ADMIN_PASSWORD ile "yonetici"
 * hesabı kurulur → eski tek-parola kurulumları güncellemeden sonra da girer.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { DATA_DIR } from "./store";
import { PublicUser } from "./types";

export type Role = "admin" | "user";

export interface User {
  id: string;
  name: string; // giriş adı (küçük harfe indirgenir; ör. "ayse")
  label?: string; // görünen ad (ör. "Ayşe — İK")
  role: Role;
  /** Yeni ekran açabilir mi? (yoksa AÇABİLİR — yönetici "Sign yetkileri"nden kapatır) */
  canCreate?: boolean;
  salt: string;
  hash: string;
  createdAt: number;
  /** Denetim izi — "bu hesabı kim değiştirdi" sorusunun cevabı. */
  updatedBy?: string;
  updatedAt?: number;
}

/**
 * Denetim damgası. Her yazma yolundan geçer: tek tek eklenirse biri unutulur
 * ve o alan sessizce izsiz kalır (en çok da parola sıfırlama gibi en merak
 * edilen işlem).
 */
const damgala = (u: User, kim: string): User => ({ ...u, updatedBy: kim, updatedAt: Date.now() });

/** İstemciye giden güvenli görünüm — tuz/özet ASLA dışarı çıkmaz (tip: types.ts). */
export const publicUser = (u: User): PublicUser => ({
  id: u.id,
  name: u.name,
  label: u.label,
  role: u.role,
  canCreate: u.canCreate,
  createdAt: u.createdAt,
  updatedBy: u.updatedBy,
  updatedAt: u.updatedAt,
});

/** Ekran açma hakkı — kayıt yoksa AÇIK sayılır (kapatma açık karardır). */
export const canCreateWalls = (u: { role: Role; canCreate?: boolean }) => u.role === "admin" || u.canCreate !== false;

const USERS_FILE = path.join(DATA_DIR, "users.json");

/** Giriş adı: küçük harf, boşluksuz — "Ayşe " ile "ayşe" aynı hesaba düşsün. */
export const normName = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, "");

function hashPassword(pw: string, salt: string): string {
  return scryptSync(pw, salt, 64).toString("hex");
}

export function verifyPassword(u: User, pw: string): boolean {
  const a = Buffer.from(hashPassword(pw, u.salt), "hex");
  const b = Buffer.from(u.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function writeAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp-${randomBytes(3).toString("hex")}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function readUsers(): Promise<User[]> {
  try {
    const raw = JSON.parse(await fs.readFile(USERS_FILE, "utf8")) as { users?: User[] };
    return Array.isArray(raw.users) ? raw.users : [];
  } catch {
    return [];
  }
}

async function saveUsers(users: User[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await writeAtomic(USERS_FILE, { users });
}

function makeUser(name: string, password: string, role: Role, label?: string): User {
  const salt = randomBytes(16).toString("hex");
  return {
    id: `u-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    name: normName(name),
    label: label?.trim() || undefined,
    role,
    salt,
    hash: hashPassword(password, salt),
    createdAt: Date.now(),
  };
}

/**
 * Defteri hazırla: hiç kullanıcı yoksa .env parolasıyla "yonetici" kur.
 * Böylece bu sürüme geçen mevcut kurulumlar hiçbir şey yapmadan girmeye
 * devam eder (kullanıcı adı: yonetici, parola: eski SIGN_ADMIN_PASSWORD).
 */
export async function listUsers(): Promise<User[]> {
  const users = await readUsers();
  if (users.length > 0) return users;
  const bootstrap = process.env.SIGN_ADMIN_PASSWORD || "";
  if (!bootstrap) return []; // parola tanımlı değilse hesap da yok (güvenli varsayılan)
  const admin = makeUser("yonetici", bootstrap, "admin", "Yönetici");
  await saveUsers([admin]);
  return [admin];
}

export async function getUser(id: string): Promise<User | null> {
  return (await listUsers()).find((u) => u.id === id) ?? null;
}

export async function findByName(name: string): Promise<User | null> {
  const n = normName(name);
  return (await listUsers()).find((u) => u.name === n) ?? null;
}

export async function createUser(name: string, password: string, role: Role, label?: string): Promise<User> {
  const n = normName(name);
  if (!n) throw new Error("Kullanıcı adı boş olamaz.");
  if (!/^[a-z0-9._-]{2,32}$/.test(n)) throw new Error("Kullanıcı adı 2-32 karakter olmalı (harf, rakam, . _ -).");
  if (password.length < 4) throw new Error("Parola en az 4 karakter olmalı.");
  const users = await listUsers();
  if (users.some((u) => u.name === n)) throw new Error("Bu kullanıcı adı zaten var.");
  const u = makeUser(n, password, role, label);
  await saveUsers([...users, u]);
  return u;
}

export async function setPassword(id: string, password: string, kim: string): Promise<void> {
  if (password.length < 4) throw new Error("Parola en az 4 karakter olmalı.");
  const users = await listUsers();
  const salt = randomBytes(16).toString("hex");
  await saveUsers(users.map((u) => (u.id === id ? damgala({ ...u, salt, hash: hashPassword(password, salt) }, kim) : u)));
}

export async function setRole(id: string, role: Role, kim: string): Promise<void> {
  const users = await listUsers();
  // Son yönetici rolünü bırakamaz — sistem yönetici SIZ kalmasın.
  if (role === "user" && users.filter((u) => u.role === "admin").length <= 1 && users.find((u) => u.id === id)?.role === "admin") {
    throw new Error("Tek yönetici kaldı — önce başka bir yönetici ata.");
  }
  await saveUsers(users.map((u) => (u.id === id ? damgala({ ...u, role }, kim) : u)));
}

export async function setCanCreate(id: string, canCreate: boolean, kim: string): Promise<void> {
  const users = await listUsers();
  await saveUsers(users.map((u) => (u.id === id ? damgala({ ...u, canCreate }, kim) : u)));
}

export async function setLabel(id: string, label: string, kim: string): Promise<void> {
  const users = await listUsers();
  await saveUsers(users.map((u) => (u.id === id ? damgala({ ...u, label: label.trim() || undefined }, kim) : u)));
}

export async function deleteUser(id: string): Promise<void> {
  const users = await listUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return;
  if (target.role === "admin" && users.filter((u) => u.role === "admin").length <= 1) {
    throw new Error("Son yönetici silinemez.");
  }
  await saveUsers(users.filter((u) => u.id !== id));
}
