/**
 * Kantin'in KENDİ uygulama kimliği. Sunucu bileşeni olmak zorunda: `metadata`
 * yalnız sunucudan verilebiliyor, kabuk ise istemci (canlı sipariş dinliyor).
 *
 * Neden ayrı manifest: telefona eklenince Flow Studio değil "Kantin" kurulmalı;
 * `scope: /kantin` sayesinde uygulamadan çıkılınca Studio'ya düşmez.
 */
import type { Metadata, Viewport } from "next";
import KantinKabuk from "./Kabuk";

export const metadata: Metadata = {
  title: "Kantin",
  description: "Siparişini telefondan ver, hazır olunca haber gelsin.",
  manifest: "/kantin.webmanifest",
  appleWebApp: { capable: true, title: "Kantin", statusBarStyle: "default" },
  icons: { icon: "/kantin-icon-192.png", apple: "/kantin-icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#001e64",
  // Tezgâhta ıslak/hızlı dokunuş çift dokunuşla sayfayı yakınlaştırıyordu.
  maximumScale: 1,
};

export default function KantinLayout({ children }: { children: React.ReactNode }) {
  return <KantinKabuk>{children}</KantinKabuk>;
}
