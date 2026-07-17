import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/globals.css";

// Tek, uyumlu ve modern aile: başlıklar da metin de aynı ailede (sade + tutarlı).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlowMeter — İnteraktif Sunumlar",
  description:
    "Canlı oylamalar, kelime bulutları ve quizlerle izleyicinizi sunuma dahil edin.",
  manifest: "/manifest.webmanifest",
  applicationName: "FlowMeter",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  // "Ana ekrana ekle"de tam ekran (tarayıcı çubuğu olmadan) açılsın
  appleWebApp: {
    capable: true,
    title: "FlowMeter",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#001e64",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
