import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

/**
 * authDomain SİTENİN KENDİ ALAN ADIDIR — env'den değil, tarayıcıdan alınır.
 *
 * Bu proje Firebase'in "auth yardımcısını kendi alan adından servis et"
 * mimarisini kullanıyor: `next.config.mjs` içindeki rewrite `/__/auth/*`
 * isteklerini firebaseapp.com'a proxyler. Yani hangi alan adından açılırsak
 * açalım, yardımcı O alan adında da çalışır.
 *
 * NEDEN ENV'DEN ALINMIYOR: alan adı değişince (flowmetermanisa → studiomanisa)
 * env eskide kalıyordu; giriş penceresi ESKİ alan adının yardımcısına gidip
 * yeni alan adındaki sayfaya geri dönemiyor, Google ekranında asılı kalıyordu.
 * Kaynağı adresin kendisi yapmak bu hatayı imkânsız kılıyor.
 *
 * Env değeri sunucu tarafı için yedek olarak durur (tarayıcı yokken).
 * NOT: kullanılan alan adı Firebase Console > Authentication > Settings >
 * "Yetkili alan adları" listesinde OLMALI; değilse giriş reddedilir (bu durum
 * artık /login'de okunabilir bir mesajla görünür).
 */
function resolveAuthDomain(): string | undefined {
  const env = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (typeof window === "undefined") return env;
  const host = window.location.hostname;
  // Yerel geliştirmede KULLANILMAZ: Firebase yardımcı adresini
  // `https://<authDomain>/__/auth/handler` diye kurar; "localhost" verilirse
  // port düşer ve https'e gider → dev sunucusunda çalışmaz. Orada env değeri
  // (firebaseapp.com) doğru olanı.
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return env;
  return host;
}

const authDomain = resolveAuthDomain();

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
  return _db;
}

export function auth(): Auth {
  return getAuth(app());
}
