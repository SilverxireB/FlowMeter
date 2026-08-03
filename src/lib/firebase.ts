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
