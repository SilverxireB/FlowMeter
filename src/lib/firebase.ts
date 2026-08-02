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
 * authDomain — Google girişinin geri döneceği adres.
 *
 * VARSAYILAN: Firebase'in kendi alan adı (`<projectId>.firebaseapp.com`).
 * Bu adres Google tarafında OTOMATİK kayıtlıdır, yani her zaman çalışır.
 *
 * NEDEN "sitenin kendi adresi" DEĞİL: bir denemede authDomain'i sayfanın
 * adresinden almıştım (rewrite sayesinde yardımcı bizim alan adımızda da
 * çalışıyor). Ama Google girişi bir kapı daha kontrol ediyor: istenen dönüş
 * adresi (`https://<authDomain>/__/auth/handler`) Google Cloud'daki OAuth
 * istemcisinin "izin verilen yönlendirme adresleri" listesinde OLMALI. Yeni
 * alan adı orada kayıtlı olmadığı için giriş "Hata 400: redirect_uri_mismatch"
 * ile tamamen durdu. Yani kendi alan adımızı kullanmak TEK BAŞINA yetmiyor,
 * konsolda bir kayıt daha istiyor.
 *
 * Kendi alan adından servis etmek istenirse (PWA'da üçüncü-taraf çerez
 * bölümlemesine takılmamak için tercih edilir) İKİ adım BİRLİKTE yapılmalı:
 *   1. Google Cloud > APIs & Services > Credentials > (Firebase'in açtığı Web
 *      OAuth istemcisi) > Authorized redirect URIs'e
 *      `https://<alan-adi>/__/auth/handler` eklenir,
 *   2. NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN o alan adına set edilir.
 * Biri eksikse giriş kırılır — bu yüzden varsayılan güvenli olan.
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
