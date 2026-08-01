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
import { UserRecord } from "./types";

/** Bootstrap yönetici — rules'ta da aynı e-posta hardcode'ludur. */
export const ADMIN_EMAIL = "doganbaharozu@gmail.com";

/** Girişte kayıt düş/güncelle (role alanına DOKUNMAZ — rules zaten engeller). */
export async function upsertUserRecord(user: User): Promise<void> {
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

/** FlowSign: kişi yeni ekran açabilir mi? (yönetici → "Sign yetkileri" sayfası) */
export async function setCanCreateSign(uid: string, canCreate: boolean): Promise<void> {
  await updateDoc(doc(db(), "users", uid), { canCreateSign: canCreate });
}

/** Kullanıcı KAYDINI siler (Auth hesabını değil — tekrar girişte kayıt yeniden oluşur). */
export async function deleteUserRecord(uid: string): Promise<void> {
  await deleteDoc(doc(db(), "users", uid));
}
