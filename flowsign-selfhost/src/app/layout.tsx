import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "FlowSign",
  description: "Video-wall / dijital tabela — yerel sunucu sürümü",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
