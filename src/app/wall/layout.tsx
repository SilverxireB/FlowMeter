import type { Metadata, Viewport } from "next";

/** FlowWall rotaları kendi PWA kimliğini taşır (manifest + ikonlar + tema). */
export const metadata: Metadata = {
  title: "FlowWall — Canlı Anı Duvarı",
  description: "Fotoğrafını yükle, saniyeler içinde perdede parlasın.",
  manifest: "/manifest-wall.webmanifest",
  icons: {
    icon: [{ url: "/wall-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/wall-apple-touch.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FlowWall" },
};

export const viewport: Viewport = {
  themeColor: "#070c22",
};

export default function WallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
