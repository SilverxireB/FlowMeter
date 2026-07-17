import type { Metadata } from "next";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
