"use client";

/**
 * KANTİN — tüm yazma/okuma yolu tek yerde.
 *
 * KAPILAR SUNUCUDA: buradaki kontroller kullanım kolaylığı içindir; gerçek kapı
 * `firestore.rules` KANTİN bloğudur (rol, yasak, kapalı kantin, kimlik, gün,
 * kişi başı günlük tavan). İkisi ayrıştığında doğru olan kurallardır.
 *
 * ÜÇ TASARIM KARARI (denetim sonrası):
 *  1. SİPARİŞ KİMLİĞİ DETERMİNİSTİK: `{uid}_{gun}_{sıra}`. Böylece çift dokunuş
 *     ikinci bir sipariş AÇAMAZ (aynı kimlik = create reddi) ve kişi başı günlük
 *     tavan sunucuda uygulanır — istemci kilidi yarışı kaybedebilir, kimlik kaybetmez.
 *  2. KUYRUK SAYACI AYRI BELGEDE (`gunler/{gun}`): menü ekranı bekleme tahmini
 *     için günün TÜM siparişlerini dinliyordu — hem mahremiyet (herkes herkesin
 *     ne yediğini görüyordu) hem kota felaketiydi. Artık tek belge dinleniyor,
 *     siparişleri yalnız sahibi ve görevli okuyabiliyor.
 *  3. STOK OTORİTESİ TEZGÂHTA: "tükendi" bilgisini, günün siparişlerini zaten
 *     okuyan tezgâh ekranı menü ürününe yazar (`tukendiGun`). Herkesin yazdığı
 *     bir sayaç, tek satırla menüyü kilitleyen bir saldırı yüzeyi olurdu.
 */
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  documentId,
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
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { censorText } from "@/lib/profanity";
import { withTimeout } from "@/lib/withTimeout";
import { kAuth, kDb } from "./firebase";
import {
  GunOzet,
  Kantin,
  KantinKisi,
  KantinRol,
  MenuUrun,
  Siparis,
  SiparisDurum,
  SiparisSatir,
} from "./types";

/** Yönetici e-postası — kurallardaki karşılığıyla aynı (tek kaynak orada). */
export const KANTIN_ADMIN_EMAIL = "doganbaharozu@gmail.com";

/** Kişi başına GÜNLÜK sipariş tavanı — kurallarda da aynı sayı (belge kimliği). */
export const GUNLUK_TAVAN = 5;

/**
 * Tek siparişin sınırları — kurallardaki sayıların AYNISI
 * (`satirlar.size() <= 10`, `toplamAdet <= 20`). Burada durmalarının sebebi:
 * arayüz bunları göstermezse sunucu sessizce reddediyor ve kullanıcı yanlış
 * sebebi okuyor.
 */
export const SIPARIS_MAKS_SATIR = 10;
export const SIPARIS_MAKS_ADET = 20;

export function gunKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function gunOnce(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return gunKey(d);
}

/**
 * Firebase/Firestore hatalarını insan diline çevirir.
 * Ham "Missing or insufficient permissions." kullanıcıya bir şey anlatmıyor;
 * üstelik çoğu zaman sebebi bilinen bir durum (kantin kapandı, yasak, tavan).
 */
export function kantinHata(e: unknown): string {
  const kod = (e as { code?: string })?.code ?? "";
  const m = e instanceof Error ? e.message : String(e);
  if (kod.includes("permission-denied"))
    return "İşlem kabul edilmedi — kantin kapanmış ya da hakkın dolmuş olabilir. Sayfayı yenile.";
  if (kod.includes("already-exists")) return "Bu sipariş zaten alınmış.";
  if (kod.includes("unavailable") || kod.includes("network") || m.includes("zaman aşımı"))
    return "Bağlantı kurulamadı. Ağını kontrol edip tekrar dene.";
  if (kod.includes("not-found")) return "Kayıt bulunamadı — silinmiş olabilir.";
  if (kod.includes("invalid-credential") || kod.includes("wrong-password") || kod.includes("user-not-found"))
    return "E-posta ya da şifre hatalı.";
  if (kod.includes("email-already-in-use"))
    return "Bu e-posta zaten kayıtlı. Giriş yap; şifren yoksa “Şifremi unuttum” ile belirle.";
  if (kod.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if (kod.includes("invalid-email")) return "E-posta adresi geçersiz.";
  if (kod.includes("operation-not-allowed")) return "E-posta ile giriş kapalı görünüyor — yöneticiye bildir.";
  if (kod.includes("too-many-requests")) return "Çok fazla deneme oldu, biraz bekle.";
  return m || "Bir şeyler ters gitti.";
}

/**
 * Sipariş satırlarını GÖSTERMEDEN/SAYMADAN önce kırp.
 * Kurallar dizi elemanlarının içine bakamaz (rules'ta döngü yok): bozuk bir
 * satır perdeye 50 KB metin basabilir ya da eksi adetle stok hesabını çökertebilir.
 */
export function temizSatirlar(satirlar: SiparisSatir[] | undefined): SiparisSatir[] {
  if (!Array.isArray(satirlar)) return [];
  return satirlar.slice(0, 10).map((s) => ({
    urunId: String(s?.urunId ?? "").slice(0, 60),
    ad: String(s?.ad ?? "Ürün").slice(0, 60),
    adet: Math.max(1, Math.min(20, Math.floor(Number(s?.adet) || 1))),
  }));
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
  await withTimeout(
    setDoc(doc(kDb(), "kantinUsers", cred.user.uid), {
      ad: censorText(ad.trim().slice(0, 60)),
      sicil: sicil.trim().slice(0, 20),
      email: email.trim(),
      rol: "personel",
      createdAt: serverTimestamp(),
    })
  );
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

export function izleKisi(uid: string, cb: (k: KantinKisi | null) => void, onHata?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(kDb(), "kantinUsers", uid),
    (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as KantinKisi) : null),
    (e) => onHata?.(e)
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

export function izleKisiler(cb: (k: KantinKisi[]) => void, onHata?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(kDb(), "kantinUsers"), orderBy("ad")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KantinKisi)),
    (e) => onHata?.(e)
  );
}

export async function rolAta(uid: string, rol: KantinRol, kantinId?: string): Promise<void> {
  await withTimeout(
    updateDoc(doc(kDb(), "kantinUsers", uid), {
      rol,
      // kantinci değilse bağ kalmasın: eski kantininin siparişlerini görmesin
      kantinId: rol === "kantinci" ? (kantinId ?? "") : "",
    })
  );
}

/** Geçici yasak (gün). 0 = kaldır. */
export async function yasakla(uid: string, gun: number): Promise<void> {
  const bitis = gun > 0 ? new Date(Date.now() + gun * 86400000) : null;
  await withTimeout(updateDoc(doc(kDb(), "kantinUsers", uid), { yasakBitis: bitis }));
}

/** Kişinin kendi ad/sicilini düzeltmesi (rol ve yasağa dokunmaz — kurallar da öyle). */
export async function kendiBilgiGuncelle(uid: string, ad: string, sicil: string): Promise<void> {
  await withTimeout(
    updateDoc(doc(kDb(), "kantinUsers", uid), {
      ad: censorText(ad.trim().slice(0, 60)),
      sicil: sicil.trim().slice(0, 20),
    })
  );
}

// ── Kantinler ────────────────────────────────────────────────────────────────

export function izleKantinler(cb: (k: Kantin[]) => void, onHata?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(kDb(), "kantin"), orderBy("ad")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Kantin)),
    (e) => onHata?.(e)
  );
}

export function izleKantin(id: string, cb: (k: Kantin | null) => void): () => void {
  return onSnapshot(doc(kDb(), "kantin", id), (s) =>
    cb(s.exists() ? ({ id: s.id, ...s.data() } as Kantin) : null)
  );
}

export async function kantinAc(ad: string, yer: string): Promise<string> {
  const ref = doc(collection(kDb(), "kantin"));
  await withTimeout(
    setDoc(ref, {
      ad: ad.trim().slice(0, 60) || "Kantin",
      yer: yer.trim().slice(0, 80),
      acik: true,
      kapasite: 4,
      hazirlikDk: 3,
      kisiBasiLimit: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function kantinGuncelle(id: string, patch: Partial<Kantin>): Promise<void> {
  await withTimeout(updateDoc(doc(kDb(), "kantin", id), { ...patch, updatedAt: serverTimestamp() }));
}

export async function kantinSil(id: string, idToken?: string): Promise<void> {
  // Cloudinary ÖNCE: Firestore belgesi gidince görsellerin izi kalmaz; sunucu
  // tarafında ön ek temizliği yapılmazsa dosyalar yetim kalır (ve URL'siyle
  // herkese açık kalmayı sürdürür).
  if (idToken) {
    await fetch("/api/wall/destroy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallId: id, idToken, mode: "kantin" }),
    }).catch(() => {});
  }
  for (const alt of ["menu", "siparisler", "gunler"]) {
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

export function izleMenu(kantinId: string, cb: (u: MenuUrun[]) => void, onHata?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(kDb(), "kantin", kantinId, "menu"), orderBy("sira")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MenuUrun)),
    (e) => onHata?.(e)
  );
}

export async function urunEkle(kantinId: string, u: Omit<MenuUrun, "id">): Promise<void> {
  await withTimeout(setDoc(doc(collection(kDb(), "kantin", kantinId, "menu")), u));
}

export async function urunGuncelle(kantinId: string, urunId: string, patch: Partial<MenuUrun>): Promise<void> {
  await withTimeout(updateDoc(doc(kDb(), "kantin", kantinId, "menu", urunId), patch));
}

export async function urunSil(kantinId: string, urunId: string): Promise<void> {
  await withTimeout(deleteDoc(doc(kDb(), "kantin", kantinId, "menu", urunId)));
}

/** "Bugünlük bitti" / geri aç — otorite tezgâhta (bkz. dosya başlığı). */
export async function urunTukendi(kantinId: string, urunId: string, tukendi: boolean): Promise<void> {
  await withTimeout(
    updateDoc(doc(kDb(), "kantin", kantinId, "menu", urunId), {
      tukendiGun: tukendi ? gunKey() : deleteField(),
    })
  );
}

/** Ürün bugün için kapalı mı? (stok bitti işareti yalnız O GÜN geçerlidir) */
export function bugunTukendi(u: MenuUrun): boolean {
  return !!u.tukendiGun && u.tukendiGun === gunKey();
}

/**
 * Ürün görseli — Studio'nun Cloudinary yolunu kullanır (kural 4'ün tek istisnası
 * zaten Cloudinary). Klasör `kantin/{kantinId}`: kantin silinince ön ek
 * temizliğiyle topluca kaldırılabilir.
 */
export async function urunGorselYukle(
  kantinId: string,
  urunId: string,
  dosya: File,
  ilerleme?: (p: number) => void
): Promise<string> {
  const res = await uploadToCloudinary(dosya, `kantin/${kantinId}`, (p) => ilerleme?.(p));
  await urunGuncelle(kantinId, urunId, { gorselUrl: res.url, cloudinaryId: res.cloudinaryId });
  return res.url;
}

export async function urunGorselSil(kantinId: string, urunId: string): Promise<void> {
  await withTimeout(
    updateDoc(doc(kDb(), "kantin", kantinId, "menu", urunId), {
      gorselUrl: deleteField(),
      cloudinaryId: deleteField(),
    })
  );
}

// ── Günlük özet (kuyruk sayacı) ──────────────────────────────────────────────

/**
 * Menü/sipariş ekranları için TEK belge. Sipariş yazımıyla aynı batch'te artar;
 * sipariş kapanınca (teslim/gelinmedi/iptal) `acik` düşer.
 * Not: `acik` bir TAHMİN girdisidir — tam sayım tezgâhta.
 */
export function izleBugunOzet(kantinId: string, cb: (o: GunOzet | null) => void): () => void {
  let gun = gunKey();
  const kur = () =>
    onSnapshot(
      doc(kDb(), "kantin", kantinId, "gunler", gun),
      (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as GunOzet) : { id: gun, toplam: 0, acik: 0 }),
      () => cb(null)
    );
  let birak = kur();
  const timer = window.setInterval(() => {
    if (gunKey() === gun) return;
    gun = gunKey();
    birak();
    birak = kur();
  }, 60_000);
  return () => {
    window.clearInterval(timer);
    birak();
  };
}

// ── Siparişler ───────────────────────────────────────────────────────────────

/**
 * BUGÜNÜN siparişleri — gece yarısı KENDİLİĞİNDEN yeni güne geçer.
 *
 * Fabrika vardiyalı: tezgâh tableti sabahtan beri açık kalır. Gün anahtarı
 * abonelik kurulurken bir kez hesaplansaydı 00:00'dan sonraki siparişler o
 * ekranda HİÇ görünmezdi — kişi telefonunda "Alındı" görür, kimse hazırlamaz.
 * (Aynı ders FlowPulse `watchToday`de alınmıştı.)
 */
export function izleBugunSiparisleri(
  kantinId: string,
  cb: (s: Siparis[]) => void,
  onHata?: (e: Error) => void
): () => void {
  let gun = gunKey();
  let birak = izleGunSiparisleri(kantinId, gun, cb, onHata);
  const timer = window.setInterval(() => {
    if (gunKey() === gun) return;
    gun = gunKey();
    birak();
    cb([]); // yeni gün boş başlar
    birak = izleGunSiparisleri(kantinId, gun, cb, onHata);
  }, 60_000);
  return () => {
    window.clearInterval(timer);
    birak();
  };
}

/** Belirli bir günün siparişleri — tek alan filtresi (`gun`), bileşik index gerekmez. */
export function izleGunSiparisleri(
  kantinId: string,
  gun: string,
  cb: (s: Siparis[]) => void,
  onHata?: (e: Error) => void
): () => void {
  return onSnapshot(
    query(collection(kDb(), "kantin", kantinId, "siparisler"), where("gun", "==", gun)),
    (snap) => {
      const liste = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Siparis)
        .map((s) => ({ ...s, satirlar: temizSatirlar(s.satirlar) }));
      // Sıra istemcide: en eski üstte (tezgâh sırayla hazırlar).
      liste.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
      cb(liste);
    },
    (e) => onHata?.(e)
  );
}

/**
 * Kişinin kendi siparişleri — SON 7 GÜN + en fazla 30 kayıt.
 * Sınırsız geçmiş her gün büyüyen bir okumaydı; ekranda zaten son birkaçı var.
 */
export function izleSiparislerim(
  kantinId: string,
  uid: string,
  cb: (s: Siparis[]) => void,
  onHata?: (e: Error) => void
): () => void {
  const basKey = gunOnce(6);
  return onSnapshot(
    // BELGE KİMLİĞİ ARALIĞI ile daralt. Eskiden `where(uid ==)` + limit(60)
    // vardı ve Firestore belge kimliğine göre ARTAN keser; kimlik
    // `{uid}_{gun}_{n}` olduğu için bu "en eski gün önce" demek. Çok sipariş
    // veren biri ~12 günü aşınca pencereye BUGÜN hiç girmiyordu: geçmiş yanlış
    // görünüyor, günlük sıra 0 sanılıp var olan belgeye yazılmaya çalışılıyor,
    // sipariş sessizce reddediliyordu.
    //
    // Neden `where('gun','>=')` DEĞİL: `uid` eşitliği + `gun` aralığı iki ayrı
    // alan demek, Firestore bileşik index ister — bu üründe index dosyası yok
    // ve eksik index sorguyu tümden düşürür. Kimlik aralığı tek alan (__name__)
    // üstünde çalışır, index istemez ve uid önekini de zaten kapsar.
    query(
      collection(kDb(), "kantin", kantinId, "siparisler"),
      where(documentId(), ">=", `${uid}_${basKey}`),
      // Üst sınırdaki \uf8ff şart: düz `${gun}_` bugünün `${gun}_1` belgesinden
      // KISA olduğu için sözlük sırasında ondan küçük kalır ve BUGÜNÜ dışarıda
      // bırakırdı — düzeltmeye çalıştığımız hatanın aynısını üretirdi.
      where(documentId(), "<=", `${uid}_${gunKey()}_`),
      limit(60)
    ),
    (snap) => {
      const liste = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Siparis)
        .filter((s) => s.gun >= basKey)
        .map((s) => ({ ...s, satirlar: temizSatirlar(s.satirlar) }));
      liste.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      cb(liste.slice(0, 30));
    },
    (e) => onHata?.(e)
  );
}

/**
 * Sipariş yaz. Belge kimliği `{uid}_{gun}_{sıra}` — DETERMİNİSTİK:
 *  - çift dokunuş ikinci siparişi AÇAMAZ (aynı kimlik, create reddi),
 *  - kişi başı günlük tavan sunucuda uygulanır (kurallar sırayı 1..5 ile sınırlar).
 * Kuyruk sayacı aynı batch'te artar; yarım kalmış bir sayaç olmaz.
 */
export async function siparisVer(
  kantinId: string,
  kisi: KantinKisi,
  satirlar: SiparisSatir[],
  not: string | undefined,
  sira: number
): Promise<string> {
  const temiz = temizSatirlar(satirlar);
  if (!temiz.length) throw new Error("Sipariş boş.");
  const toplamAdet = temiz.reduce((a, s) => a + s.adet, 0);
  const gun = gunKey();
  const id = `${kisi.id}_${gun}_${Math.max(1, Math.min(GUNLUK_TAVAN, sira))}`;
  const temizNot = not ? censorText(not.trim().slice(0, 120)) : "";

  // NOT: istemci SDK'sında batch.create yok; kimlik zaten deterministik olduğu
  // için "yalnız bir kez" güvencesini KURALLAR verir — var olan bir siparişin
  // üstüne set etmek `update` sayılır ve kişiye yalnız "iptal" güncellemesi
  // açıktır, dolayısıyla ikinci yazım reddedilir ("Bu sipariş zaten alınmış").
  const b = writeBatch(kDb());
  b.set(doc(kDb(), "kantin", kantinId, "siparisler", id), {
    uid: kisi.id,
    ad: kisi.ad,
    sicil: kisi.sicil,
    satirlar: temiz,
    toplamAdet,
    durum: "yeni" as SiparisDurum,
    gun,
    ...(temizNot ? { not: temizNot } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  b.set(
    doc(kDb(), "kantin", kantinId, "gunler", gun),
    { toplam: increment(1), acik: increment(1) },
    { merge: true }
  );
  await withTimeout(b.commit());
  return id;
}

/** Sipariş bu duruma geçince kantinin işi biter mi? (kuyruk sayacı buna bakar) */
const KAPANIS: SiparisDurum[] = ["alindi", "alinmadi", "iptal"];

/**
 * Durum değiştir. Kuyruk sayacı aynı batch'te düşer — ayrı yazım olsaydı biri
 * tutup diğeri tutmadığında tahmin kalıcı olarak bozulurdu.
 */
export async function durumDegistir(
  kantinId: string,
  siparis: Pick<Siparis, "id" | "durum" | "gun">,
  yeni: SiparisDurum
): Promise<void> {
  const b = writeBatch(kDb());
  b.update(doc(kDb(), "kantin", kantinId, "siparisler", siparis.id), {
    durum: yeni,
    updatedAt: serverTimestamp(),
  });
  const kapandi = KAPANIS.includes(yeni) && !KAPANIS.includes(siparis.durum);
  const acildi = !KAPANIS.includes(yeni) && KAPANIS.includes(siparis.durum);
  if (kapandi || acildi) {
    b.set(
      doc(kDb(), "kantin", kantinId, "gunler", siparis.gun),
      { acik: increment(kapandi ? -1 : 1) },
      { merge: true }
    );
  }
  await withTimeout(b.commit());
}

/**
 * Tarih ARALIĞI (rapor). `gun` tek alan üzerinde aralık — bileşik index gerekmez.
 * Canlı dinleme YOK: rapor bir kerelik okumadır.
 */
export async function siparisAraligi(kantinId: string, bas: string, bit: string): Promise<Siparis[]> {
  const snap = await getDocs(
    query(
      collection(kDb(), "kantin", kantinId, "siparisler"),
      where("gun", ">=", bas),
      where("gun", "<=", bit)
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Siparis)
    .map((s) => ({ ...s, satirlar: temizSatirlar(s.satirlar) }))
    .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
}

/**
 * Bekleme tahmini (dk): önündeki iş / kapasite × hazırlık süresi.
 * Söz verilen süre TUTMALI — mola 10 dakika. Bu yüzden tahmin iyimser değil:
 * hâlihazırda hazırlanan siparişler de kuyruğa sayılır.
 */
export function beklemeDk(kantin: Kantin, onundekiAdet: number): number {
  const kap = Math.max(1, kantin.kapasite || 1);
  const hazirlik = Math.max(1, kantin.hazirlikDk || 1);
  return Math.max(hazirlik, Math.ceil((Math.max(0, onundekiAdet) + 1) / kap) * hazirlik);
}

/** Bugün bu üründen kaç adet satıldı (yalnız tezgâh hesaplar; iptaller sayılmaz). */
export function satilanAdet(siparisler: Siparis[], urunId: string): number {
  return siparisler
    .filter((s) => s.durum !== "iptal")
    .reduce((a, s) => a + (temizSatirlar(s.satirlar).find((x) => x.urunId === urunId)?.adet ?? 0), 0);
}

/** Kantin şu an sipariş alıyor mu? (elle kapatma + çalışma saatleri birlikte) */
export function siparisAcikMi(k: Kantin | null | undefined, simdi = new Date()): boolean {
  // `acik` alanı YOKSA kapalı sayılır — kurallar da öyle diyor
  // (`get('acik', false) == true`). Tersi olduğunda arayüz "açık" gösterip
  // her sipariş denemesi sunucuda reddediliyordu.
  if (!k || k.acik !== true) return false;
  const pencere = (k.saatler ?? []).filter((s) => s.bas && s.bit);
  if (!pencere.length) return true;
  const hm = `${String(simdi.getHours()).padStart(2, "0")}:${String(simdi.getMinutes()).padStart(2, "0")}`;
  return pencere.some((p) => (p.bas <= p.bit ? hm >= p.bas && hm <= p.bit : hm >= p.bas || hm <= p.bit));
}

/** Kapalıysa bir sonraki açılış saati ("14:00'te açılıyor" diyebilmek için). */
export function sonrakiAcilis(k: Kantin | null | undefined, simdi = new Date()): string | null {
  const pencere = (k?.saatler ?? []).filter((s) => s.bas && s.bit);
  if (!pencere.length) return null;
  const hm = `${String(simdi.getHours()).padStart(2, "0")}:${String(simdi.getMinutes()).padStart(2, "0")}`;
  const sonraki = pencere.map((p) => p.bas).filter((b) => b > hm).sort()[0];
  return sonraki ?? pencere.map((p) => p.bas).sort()[0] ?? null;
}
