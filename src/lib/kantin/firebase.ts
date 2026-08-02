/**
 * KANTİN — AYRI Firebase bağlantısı.
 *
 * NEDEN AYRI: Kantin girişli bir uygulama (e-posta + şifre), Flow Studio ise
 * Google ile giren bambaşka bir dünya. İkisi aynı `auth` örneğini paylaşsaydı
 * kantine giren kişi Studio'da da "giriş yapmış" sayılırdı — panel boş açılır,
 * kimin oturumu olduğu karışırdı. Bu yüzden kantin, aynı Firebase PROJESİNDE
 * ama KENDİ uygulama örneğinde çalışır: oturumları birbirine değmez.
 *
 * KALDIRMA: bu klasörü (`src/lib/kantin`) + `src/app/kantin` klasörünü silmek ve
 * kurallardaki KANTİN bloğunu çıkarmak yeter. Studio'nun tek satırı etkilenmez.
 *
 * Not: kalıcı önbellek (offline) BİLEREK açılmadı. Aynı projede iki kalıcı
 * önbellek aynı tarayıcıda çakışabiliyor; kantin zaten bina içinde ve çevrimiçi
 * kullanılıyor.
 */
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const APP_ADI = "kantin";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`
      : undefined),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function kantinYapilandirildi(): boolean {
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}

function app(): FirebaseApp {
  return getApps().some((a) => a.name === APP_ADI)
    ? getApp(APP_ADI)
    : initializeApp(cfg, APP_ADI);
}

export function kAuth(): Auth {
  return getAuth(app());
}

export function kDb(): Firestore {
  return getFirestore(app());
}
