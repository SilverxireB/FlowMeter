import type { Metadata, Viewport } from "next";

/** FlowWall yükleme rotası da FlowWall PWA kimliğini taşır. */
export const metadata: Metadata = {
  title: "FlowWall — Anını Paylaş",
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

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
