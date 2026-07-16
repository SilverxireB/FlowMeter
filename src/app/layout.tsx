import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "@/styles/globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-sans" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "FlowMeter — İnteraktif Sunumlar",
  description:
    "Canlı oylamalar, kelime bulutları ve quizlerle izleyicinizi sunuma dahil edin.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${nunito.variable} ${fredoka.variable}`}>
      <body>{children}</body>
    </html>
  );
}
