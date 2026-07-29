/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Google girişi (signInWithRedirect) PWA'da üçüncü-taraf çerez bölümlemesine
  // takılmasın diye Firebase auth helper'ı KENDİ domain'imizden servis edilir:
  // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN site domain'ine eşitlenir, /__/auth/*
  // istekleri buradan firebaseapp.com'a proxylenir (Firebase resmî çözümü).
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://flowmeter-938a3.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
