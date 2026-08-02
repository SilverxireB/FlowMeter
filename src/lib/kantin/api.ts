"use client";

/**
 * KANTİN — tüm yazma/okuma yolu tek yerde.
 *
 * Kurallar sunucuda aynı şeyleri bir daha kontrol eder (rol, yasak, kapalı
 * kantin, kişi başı limit): buradaki kapılar KULLANIM KOLAYLIĞI içindir, güvenlik
 * değil. Bu ürünün her yerinde olduğu gibi kapı sunucudadır.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { kAuth, kDb } from "./firebase";
import { Kantin, KantinKisi, KantinRol, MenuUrun, Siparis, SiparisDurum, SiparisSatir } from "./types";

/** Yönetici e-postası — kurallardaki karşılığıyla aynı (tek kaynak orada). */
export const KANTIN_ADMIN_EMAIL = "doganbaharozu@gmail.com";

export function gunKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Oturum ───────────────────────────────────────────────────────────────────

export function izleOturum(cb: (u: User | null) => void): () => void {
  return onAuthStateChanged(kAuth(), cb);
}

export async function girisYap(email: string, sifre: string): Promise<void> {
  await signInWithEmailAndPassword(kAuth(), email.trim(), sifre);
}

/**
 * Kayıt: hesap + kişi kaydı birlikte. Rol HER ZAMAN "personel" başlar — kurallar
 * da kişinin kendi rolünü yazmasına izin vermez; yükseltmeyi yönetici yapar.
 */
export async function kayitOl(ad: string, sicil: string, email: string, sifre: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(kAuth(), email.trim(), sifre);
  await updateProfile(cred.user, { displayName: ad.trim() }).catch(() => {});
  await setDoc(doc(kDb(), "kantinUsers", cred.user.uid), {
    ad: ad.trim().slice(0, 60),
    sicil: sicil.trim().slice(0, 20),
    email: email.trim(),
    rol: "personel",
    createdAt: serverTimestamp(),
  });
}

/**
 * Şifre belirleme/sıfırlama postası.
 *
 * İki işe birden yarar: (1) şifresini unutan personel, (2) e-postası bu Firebase
 * projesinde ZATEN kayıtlı olan ama şifresi olmayan hesaplar. E-posta havuzu
 * proje genelinde ortaktır — Google ile açılmış bir hesap "zaten kayıtlı" der
 * ama şifresi yoktur; bu posta o hesaba şifre EKLER, sonra kantine girer.
 */
export async function sifreSifirla(email: string): Promise<void> {
  await sendPasswordResetEmail(kAuth(), email.trim());
}

export async function cikisYap(): Promise<void> {
  await signOut(kAuth());
}

export function izleKisi(uid: string, cb: (k: KantinKisi | null) => void): () => void {
  return onSnapshot(doc(kDb(), "kantinUsers", uid), (s) =>
    cb(s.exists() ? ({ id: s.id, ...s.data() } as KantinKisi) : null)
  );
}

export async function kisiGetir(uid: string): Promise<KantinKisi | null> {
  const s = await getDoc(doc(kDb(), "kantinUsers", uid));
  return s.exists() ? ({ id: s.id, ...s.data() } as KantinKisi) : null;
}

/** Yasak sürüyor mu? (kurallar da aynı kapıyı uygular) */
export function yasakli(k: KantinKisi | null | undefined, now = Date.now()): boolean {
  const t = k?.yasakBitis?.toMillis?.();
  return !!t && t > now;
}

// ── Kişiler (yönetici) ───────────────────────────────────────────────────────

export function izleKisiler(cb: (k: KantinKisi[]) => void): () => void {
  return onSnapshot(query(collection(kDb(), "kantinUsers"), orderBy("ad")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KantinKisi))
  );
}

export async function rolAta(uid: string, rol: KantinRol, kantinId?: string): Promise<void> {
  await updateDoc(doc(kDb(), "kantinUsers", uid), {
    rol,
    // kantinci değilse bağ kalmasın: eski kantininin siparişlerini görmeye devam etmesin
    kantinId: rol === "kantinci" ? (kantinId ?? "") : "",
  });
}

/** Geçici yasak (gün). 0 = kaldır. */
export async function yasakla(uid: string, gun: number): Promise<void> {
  const bitis = gun > 0 ? new Date(Date.now() + gun * 86400000) : null;
  await updateDoc(doc(kDb(), "kantinUsers", uid), { yasakBitis: bitis });
}

// ── Kantinler ────────────────────────────────────────────────────────────────

export function izleKantinler(cb: (k: Kantin[]) => void): () => void {
  return onSnapshot(query(collection(kDb(), "kantin"), orderBy("ad")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Kantin))
  );
}

export function izleKantin(id: string, cb: (k: Kantin | null) => void): () => void {
  return onSnapshot(doc(kDb(), "kantin", id), (s) =>
    cb(s.exists() ? ({ id: s.id, ...s.data() } as Kantin) : null)
  );
}

export async function kantinAc(ad: string, yer: string): Promise<string> {
  const ref = await addDoc(collection(kDb(), "kantin"), {
    ad: ad.trim().slice(0, 60) || "Kantin",
    yer: yer.trim().slice(0, 80),
    acik: true,
    kapasite: 4,
    hazirlikDk: 3,
    kisiBasiLimit: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function kantinGuncelle(id: string, patch: Partial<Kantin>): Promise<void> {
  await updateDoc(doc(kDb(), "kantin", id), { ...patch, updatedAt: serverTimestamp() });
}

export async function kantinSil(id: string): Promise<void> {
  // Menü + siparişler sayfalı silinir (450'lik turlar — büyük koleksiyon donmasın).
  for (const alt of ["menu", "siparisler"]) {
    for (;;) {
      const snap = await getDocs(query(collection(kDb(), "kantin", id, alt), limit(450)));
      if (snap.empty) break;
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      if (snap.size < 450) break;
    }
  }
  await deleteDoc(doc(kDb(), "kantin", id));
}

// ── Menü ─────────────────────────────────────────────────────────────────────

export function izleMenu(kantinId: string, cb: (u: MenuUrun[]) => void): () => void {
  return onSnapshot(query(collection(kDb(), "kantin", kantinId, "menu"), orderBy("sira")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MenuUrun))
  );
}

export async function urunEkle(kantinId: string, u: Omit<MenuUrun, "id">): Promise<void> {
  await addDoc(collection(kDb(), "kantin", kantinId, "menu"), u);
}

export async function urunGuncelle(kantinId: string, urunId: string, patch: Partial<MenuUrun>): Promise<void> {
  await updateDoc(doc(kDb(), "kantin", kantinId, "menu", urunId), patch);
}

export async function urunSil(kantinId: string, urunId: string): Promise<void> {
  await deleteDoc(doc(kDb(), "kantin", kantinId, "menu", urunId));
}

// ── Siparişler ───────────────────────────────────────────────────────────────

/** Bugünün siparişleri — tek alan filtresi (`gun`), bileşik index gerekmez. */
export function izleGunSiparisleri(kantinId: string, gun: string, cb: (s: Siparis[]) => void): () => void {
  return onSnapshot(
    query(collection(kDb(), "kantin", kantinId, "siparisler"), where("gun", "==", gun)),
    (snap) => {
      const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Siparis);
      // Sıra istemcide: en eski üstte (tezgâh sırayla hazırlar).
      liste.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
      cb(liste);
    }
  );
}

/** Kişinin kendi siparişleri (kendi kimliğiyle filtreli — kurallar bunu ister). */
export function izleSiparislerim(kantinId: string, uid: string, cb: (s: Siparis[]) => void): () => void {
  return onSnapshot(
    query(collection(kDb(), "kantin", kantinId, "siparisler"), where("uid", "==", uid)),
    (snap) => {
      const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Siparis);
      liste.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      cb(liste);
    }
  );
}

export async function siparisVer(
  kantinId: string,
  kisi: KantinKisi,
  satirlar: SiparisSatir[],
  not?: string
): Promise<string> {
  const toplamAdet = satirlar.reduce((a, s) => a + s.adet, 0);
  const ref = await addDoc(collection(kDb(), "kantin", kantinId, "siparisler"), {
    uid: kisi.id,
    ad: kisi.ad,
    sicil: kisi.sicil,
    satirlar,
    toplamAdet,
    durum: "yeni" as SiparisDurum,
    gun: gunKey(),
    ...(not && not.trim() ? { not: not.trim().slice(0, 120) } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function durumDegistir(kantinId: string, siparisId: string, durum: SiparisDurum): Promise<void> {
  await updateDoc(doc(kDb(), "kantin", kantinId, "siparisler", siparisId), {
    durum,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Bekleme tahmini (dk): önündeki iş / kapasite × hazırlık süresi.
 * Söz verilen süre TUTMALI — mola 10 dakika. Bu yüzden tahmin iyimser değil:
 * hâlihazırda hazırlanan siparişler de kuyruğa sayılır.
 */
export function beklemeDk(kantin: Kantin, onundekiAdet: number): number {
  const kap = Math.max(1, kantin.kapasite || 1);
  const hazirlik = Math.max(1, kantin.hazirlikDk || 1);
  return Math.max(hazirlik, Math.ceil((onundekiAdet + 1) / kap) * hazirlik);
}

/** Bugün bu üründen kaç adet satıldı (stok düşümü için; iptaller sayılmaz). */
export function satilanAdet(siparisler: Siparis[], urunId: string): number {
  return siparisler
    .filter((s) => s.durum !== "iptal")
    .reduce((a, s) => a + (s.satirlar.find((x) => x.urunId === urunId)?.adet ?? 0), 0);
}
