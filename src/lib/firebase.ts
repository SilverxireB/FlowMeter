import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  disableNetwork,
  enableNetwork,
} from "firebase/firestore";

/**
 * authDomain — Google girişinin geri döneceği adres.
 *
 * ÜRETİMDE SİTENİN KENDİ ADRESİ kullanılıyor
 * (`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = flowstudiomanisa.vercel.app`).
 * Buradaki `.firebaseapp.com` yalnız YEDEK: değişken tanımsızsa devreye girer.
 *
 * NEDEN — 2026-08, fabrika iç ağı: kurum ağı `*.firebaseapp.com`'u kapatıyordu.
 * Site açılıyor, Firestore çalışıyor (o `googleapis.com` üstünden gider), ama
 * Google giriş penceresi `flowmeter-938a3.firebaseapp.com/__/auth/handler`
 * adresinde ERR_CONNECTION_TIMED_OUT alıp asılı kalıyordu. Dışarıdaki wifi'de
 * sorun yoktu; ürünün asıl çalışacağı yer ise iç ağ. Yardımcı artık kendi alan
 * adımızdan servis ediliyor (`next.config.mjs` içindeki `/__/auth/*` proxy'si),
 * yani tarayıcı `firebaseapp.com`'a HİÇ gitmiyor ve engel anlamsızlaşıyor.
 * Yan fayda: PWA'da üçüncü-taraf çerez bölümlemesi sorunu da kapanıyor.
 *
 * ⚠ GERİ ALMAYIN — iki parça birlikte çalışıyor:
 *   1. Google Cloud > APIs & Services > Credentials > (Firebase'in açtığı Web
 *      OAuth istemcisi) > Authorized redirect URIs içinde
 *      `https://flowstudiomanisa.vercel.app/__/auth/handler` KAYITLI olmalı,
 *   2. `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` o alan adına set olmalı (Vercel).
 * Biri eksikse giriş "Hata 400: redirect_uri_mismatch" ile tamamen durur —
 * bir kez yaşandı. Eski `.firebaseapp.com` kaydı Google Cloud'da BİLEREK
 * duruyor: sorun çıkarsa değişkeni silmek eski davranışa anında döndürür.
 */
const authDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`
    : undefined);

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

// Lazy init: env değişkenleri yokken build kırılmasın diye modül seviyesinde
// initializeApp çağrılmaz; ilk gerçek kullanımda başlatılır.
function app(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase yapılandırılmamış. NEXT_PUBLIC_FIREBASE_* değişkenlerini .env.local dosyasına (veya Vercel'e) ekleyin."
    );
  }
  return getApps().length ? getApp() : initializeApp(config);
}

// Firestore: tarayıcıda kalıcı IndexedDB önbelleği (ağ kesilse son içerik/oynatma
// devam eder — FlowSign tabelası için 7/24 dayanıklılık; realtime onSnapshot
// online'da aynen çalışır). Tek giriş noktası → initializeFirestore bir kez.
/**
 * UZUN BOŞLUKTAN SONRA BAĞLANTIYI TAZELE — "sunucu yanıtı bekleniyor" bir
 * dakika sürmesin.
 *
 * Firestore bağlantısı koptuğunda (sekme arka plana atılıp dondurulur, ağ
 * dalgalanır, kimlik jetonu tazelenemez) SDK üstel geri çekilmeyle yeniden
 * dener ve bu bekleme **60 saniyeye kadar** çıkar. Sekmeye dönen kullanıcı
 * hiçbir şey yapmadan o pencerenin dolmasını bekliyor: yazım kuyrukta duruyor,
 * ekranda "sunucu yanıtı bekleniyor" yazıyor, oysa ağ çoktan geri gelmiş.
 *
 * disableNetwork→enableNetwork o geri çekilme sayacını SIFIRLAR ve bağlantıyı
 * hemen kurar. Yalnız sekme UZUN süre (45 sn+) gizli kaldıysa yapılır; kısa
 * sekme değişimlerinde bağlantıyı boşuna sarsmanın anlamı yok.
 *
 * Yazımlar kaybolmaz: çevrimdışı geçişte kuyrukta beklerler, bağlantı gelince
 * giderler — zaten kalıcı önbellek bunun için açık.
 */
let _tazeleniyor = false;

/**
 * Bağlantıyı ZORLA tazele — geri çekilme sayacını sıfırlar.
 *
 * Sekme dönüşünde kendiliğinden çağrılır (aşağıda), ama YETMİYOR: ekran uzun
 * süre GÖRÜNÜR kalıp boşta beklediğinde `visibilitychange` hiç tetiklenmiyor ve
 * kullanıcı bir dakikadan uzun "sunucu yanıtı bekleniyor" görüyor. Bu yüzden
 * bir yazım gecikirse çağıran taraf bunu doğrudan çağırabiliyor — sayfayı
 * yenilemenin yaptığı işi, sayfayı yenilemeden yapar.
 */
export async function baglantiyiTazele(): Promise<void> {
  if (typeof window === "undefined" || !_db || _tazeleniyor) return;
  _tazeleniyor = true;
  try {
    await disableNetwork(_db);
    await enableNetwork(_db);
  } catch {
    // Tazeleme başarısızsa SDK kendi döngüsüne devam eder — yutulur.
  } finally {
    _tazeleniyor = false;
  }
}

/**
 * KİMLİĞİ TAZELE — `permission-denied` çoğu zaman yetki değil, JETON sorunudur.
 *
 * Firebase kimlik jetonu ~1 saat yaşar; SDK onu `securetoken.googleapis.com`
 * üstünden yeniler. Kurum ağı bu adresi süzüyorsa ya da uzun ömürlü bağlantıları
 * kesiyorsa yenileme sessizce başarısız oluyor ve o andan sonra Firestore'a
 * giden her istek ESKİ jetonla gidiyor: sunucu reddediyor, ekranlar boşalıyor
 * ("tüm kişiler, yetkiler gitti"). Sayfayı yenilemek düzeltiyor çünkü yenileme
 * TAZE bir bağlantı üzerinden jeton alıyor.
 *
 * Bu işlev sayfayı yenilemeden aynısını yapar: jetonu ZORLA tazeler, sonra
 * Firestore bağlantısını sıfırlar ki dinleyiciler yeni jetonla yeniden kurulsun.
 * Gerçekten yetki sorunuysa sonuç değişmez — yalnız bir tazeleme maliyeti.
 */
export async function kimligiTazele(): Promise<boolean> {
  try {
    const u = getAuth(app()).currentUser;
    if (!u) return false;
    await u.getIdToken(true);
    await baglantiyiTazele();
    return true;
  } catch {
    return false;
  }
}

/**
 * JETON TEŞHİSİ — arıza ANINDA gerçekleri yakalar (tahmin değil, ölçüm).
 *
 * "permission-denied" için üç ayrı hikâye kurulabiliyor: jetonun süresi doldu,
 * cihaz saati kaymış, ya da gerçekten yetki yok. Üçü de aynı ekranı gösteriyor.
 * Bu satır hangisi olduğunu tek bakışta söylüyor:
 *  - jeton kaç dakika önce alındı, bitmesine kaç dakika var,
 *  - cihaz saatinin SUNUCUDAN sapması (kendi alan adımızın `Date` başlığı),
 *  - tarayıcı çevrimiçi mi.
 * Jeton dolmadan reddediliyorsa suçlu jeton değildir; saat sapması büyükse
 * doğrudan onu gösterir.
 */
export async function jetonTeshis(): Promise<string> {
  try {
    const u = getAuth(app()).currentUser;
    if (!u) return "oturum yok";
    const r = await u.getIdTokenResult();
    const simdi = Date.now();
    const alindi = Math.round((simdi - Date.parse(r.issuedAtTime)) / 60000);
    const kalan = Math.round((Date.parse(r.expirationTime) - simdi) / 60000);
    let sapma = "ölçülemedi";
    try {
      const res = await fetch("/", { method: "HEAD", cache: "no-store" });
      const d = res.headers.get("date");
      if (d) sapma = `${Math.round((simdi - Date.parse(d)) / 1000)} sn`;
    } catch {}
    return `jeton ${alindi} dk önce alındı, ${kalan} dk kaldı · cihaz saati sapması ${sapma} · ${
      navigator.onLine ? "çevrimiçi" : "çevrimdışı"
    }`;
  } catch (e) {
    return `jeton okunamadı (${e instanceof Error ? e.message : "bilinmeyen"})`;
  }
}

function agTazelemeKur(): void {
  if (typeof window === "undefined") return;
  let gizlendi = 0;
  // Bağlantı tazelenirken KİMLİK de tazelenir: ikisi aynı arızanın iki yüzü.
  const tazele = () => void kimligiTazele().then((oldu) => (oldu ? undefined : baglantiyiTazele()));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      gizlendi = Date.now();
      return;
    }
    if (gizlendi && Date.now() - gizlendi > 45_000) tazele();
    gizlendi = 0;
  });
  // Ağ geri geldiğinde de aynı sayaç sıfırlanmalı.
  window.addEventListener("online", tazele);
  // ÖNDEN TAZELEME: jeton ~60 dk yaşıyor. 40 dakikada bir yenileyerek uçuruma
  // hiç gelinmiyor; süzgeçli ağda deneme sayısı arttıkça en az birinin geçme
  // olasılığı da artıyor. Sekme gizliyken tarayıcı zamanlayıcıyı kısar, o yüzden
  // görünürlük dönüşündeki tazeleme bunun tamamlayıcısı.
  window.setInterval(() => void kimligiTazele(), 40 * 60_000);
}

let _db: Firestore | null = null;
export function db(): Firestore {
  if (_db) return _db;
  const a = app();
  if (typeof window !== "undefined") {
    try {
      _db = initializeFirestore(a, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      _db = getFirestore(a); // zaten başlatılmışsa / desteklenmiyorsa
    }
  } else {
    _db = getFirestore(a);
  }
  if (typeof window !== "undefined") agTazelemeKur();
  return _db;
}

export function auth(): Auth {
  return getAuth(app());
}
