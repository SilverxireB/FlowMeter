import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "FlowMeter — İnteraktif Sunumlar",
  description:
    "Canlı oylamalar, kelime bulutları ve quizlerle izleyicinizi sunuma dahil edin.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
