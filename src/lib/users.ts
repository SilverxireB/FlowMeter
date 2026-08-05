/**
 * Kullanıcı kayıt defteri (users/{uid}) + yönetici rolü.
 * Auth kullanıcı listesi istemciden okunamadığı için her girişte buraya kayıt
 * düşülür; /admin sayfası bu koleksiyonu yönetir. Bootstrap yönetici
 * (ADMIN_EMAIL) rules seviyesinde de tanınır — rol alanına muhtaç değildir.
 */
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { deletePresentation, listPresentations } from "./presentations";
import { deleteWall, listWalls } from "./walls";
import { deletePulse, listPulses } from "./pulses";
import { UserRecord } from "./types";

/** Bootstrap yönetici — rules'ta da aynı e-posta hardcode'ludur. */
export const ADMIN_EMAIL = "doganbaharozu@gmail.com";

/**
 * Girişte kayıt düş/güncelle (role alanına DOKUNMAZ — rules zaten engeller).
 *
 * ANONİM oturum kaydedilmez: duvar yükleme sayfası misafire sessizce anonim
 * oturum açıyor. Bir hata yüzünden o kimlik Google oturumunun üstüne yazınca
 * panele anonim olarak girilmiş ve yönetici listesine e-postasız, adsız hayalet
 * kayıtlar düşmüştü. Kimlik katmanı artık anonimi süzüyor; burası ikinci kapı.
 */
export async function upsertUserRecord(user: User): Promise<void> {
  if (user.isAnonymous) return;
  const ref = doc(db(), "users", user.uid);
  const existing = await getDoc(ref);
  const data: Record<string, unknown> = {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? "",
    lastSeenAt: serverTimestamp(),
  };
  if (!existing.exists()) data.createdAt = serverTimestamp();
  await setDoc(ref, data, { merge: true });
}

export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  const snap = await getDoc(doc(db(), "users", uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserRecord) : null;
}

/** Bu kullanıcı yönetici mi? (bootstrap e-posta VEYA role=admin) */
export function isAdminUser(user: User | null, record: UserRecord | null): boolean {
  if (!user) return false;
  if (user.email === ADMIN_EMAIL) return true;
  return record?.role === "admin";
}

export async function listUsers(): Promise<UserRecord[]> {
  const snap = await getDocs(collection(db(), "users"));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRecord);
  return items.sort((a, b) => (b.lastSeenAt?.toMillis() ?? 0) - (a.lastSeenAt?.toMillis() ?? 0));
}

export async function setUserRole(uid: string, role: "admin" | "user"): Promise<void> {
  await updateDoc(doc(db(), "users", uid), { role });
}

/** Erişimi kapat/aç. Kayıt silinmez — kişi geri döndüğünde tek tıkla açılır. */
export async function setUserBlocked(uid: string, blocked: boolean): Promise<void> {
  await updateDoc(doc(db(), "users", uid), { blocked });
}

/** FlowSign: kişi yeni ekran açabilir mi? (yönetici → "Sign yetkileri" sayfası) */
export async function setCanCreateSign(uid: string, canCreate: boolean): Promise<void> {
  await updateDoc(doc(db(), "users", uid), { canCreateSign: canCreate });
}

/** Foto sahne açma hakkı — canCreateSign'ın sahne ikizi (kayıt yoksa AÇIK). */
export async function setCanCreateSahne(uid: string, canCreate: boolean): Promise<void> {
  await updateDoc(doc(db(), "users", uid), { canCreateSahne: canCreate });
}

/**
 * E-postası olmayan kayıtlar — anonim oturumdan kalma hayaletler.
 * Gerçek kullanıcının e-postası hep vardır (Google ile girilir).
 */
export const isGhostRecord = (u: UserRecord): boolean => !u.email;

/**
 * Bir kişinin TÜM içeriğini devral — ownerId yöneticiye geçer.
 *
 * Neden devir: silme kuralları "sahip" bazlıydı, yönetici başkasının içeriğini
 * silemiyordu. Yirmi kural satırına isAdmin() eklemek yerine yalnız üç yerde
 * (presentations/walls/pulses doküman güncellemesi) yöneticiye izin verildi;
 * devirden sonra alt koleksiyonların mevcut sahip kuralları kendiliğinden geçer
 * ve var olan silme yolları hiç değişmeden çalışır.
 *
 * Devir tek başına da işe yarar: ayrılan kişinin duvarını yok etmeden sahiplen.
 * FlowSign ayrı — orada yetki matrisi var, yönetici zaten tam yetkili.
 */
export async function transferAllContent(fromUid: string, toUid: string): Promise<number> {
  const [decks, walls, pulses] = await Promise.all([
    listPresentations(fromUid),
    listWalls(fromUid),
    listPulses(fromUid),
  ]);
  for (const d of decks) await updateDoc(doc(db(), "presentations", d.id), { ownerId: toUid });
  for (const w of walls) await updateDoc(doc(db(), "walls", w.id), { ownerId: toUid });
  for (const p of pulses) await updateDoc(doc(db(), "pulses", p.id), { ownerId: toUid });
  return decks.length + walls.length + pulses.length;
}

/**
 * Bir kişinin TÜM içeriğini sil. Önce devralınır (yukarıdaki gerekçe), sonra
 * ürünlerin KENDİ silme yollarıyla silinir — alt koleksiyonlar, katılım kodu ve
 * Cloudinary temizliği o yollarda zaten çözülmüş, burada tekrarlanmaz.
 *
 * Yarıda kalırsa içerik yöneticide kalır: yarım silinmiş kalıntıdan iyidir.
 */
export async function deleteAllContent(uid: string, adminUid: string, idToken?: string): Promise<number> {
  // Kimlikler devirden ÖNCE alınır. Devirden sonra listelemek yöneticinin KENDİ
  // içeriğini de kapsardı ve onları da silerdik.
  const [decks, walls, pulses] = await Promise.all([
    listPresentations(uid),
    listWalls(uid),
    listPulses(uid),
  ]);
  await transferAllContent(uid, adminUid);
  for (const d of decks) await deletePresentation({ ...d, ownerId: adminUid });
  for (const w of walls) await deleteWall({ ...w, ownerId: adminUid }, idToken);
  for (const p of pulses) await deletePulse(p.id);
  return decks.length + walls.length + pulses.length;
}

/** Kullanıcı KAYDINI siler (Auth hesabını değil — tekrar girişte kayıt yeniden oluşur). */
export async function deleteUserRecord(uid: string): Promise<void> {
  await deleteDoc(doc(db(), "users", uid));
}
