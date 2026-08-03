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
  // Kök "Flow Studio" yazıyor ve metadata anahtar bazında TAM eziliyor (alan
  // alan birleşmiyor): yazılmazsa Kantin, Android kısayol yüzeylerinde
  // "Flow Studio" adıyla görünür.
  applicationName: "Kantin",
  appleWebApp: { capable: true, title: "Kantin", statusBarStyle: "black-translucent" },
  icons: { icon: "/kantin-icon-192.png", apple: "/kantin-apple-touch-icon.png" },
};

// Kökteki alanlar burada TEKRAR yazılıyor. `viewportFit: "cover"` görünüşte
// gereksiz (viewport alan alan birleşiyor, kökten miras gelirdi) ama Kantin'in
// alt çubuğu `env(safe-area-inset-bottom)`a bağlı ve o değer YALNIZ cover
// varken sıfırdan farklı döner — kökten sessizce kaldırılırsa çentikli
// telefonda alt çubuk ev tuşunun altına girerdi. Bağımlılık görünür dursun.
//
// Yakınlaştırma BİLEREK açık: `maximumScale: 1` WCAG 1.4.4 ihlali, üstelik iOS
// onu zaten yok sayıyor. Tezgâhtaki çift-dokunuş yakınlaştırması gerçek bir
// dert ama çaresi `touch-action: manipulation` (bkz. Kabuk).
export const viewport: Viewport = {
  themeColor: "#001e64",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function KantinLayout({ children }: { children: React.ReactNode }) {
  return <KantinKabuk>{children}</KantinKabuk>;
}
