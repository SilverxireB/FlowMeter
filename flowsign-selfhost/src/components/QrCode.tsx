"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Verilen metni QR koda çevirir (data URL, tamamen client-side). */
export default function QrCode({ text, size = 260 }: { text: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(text, {
      width: size * 2, // retina netliği
      margin: 1,
      color: { dark: "#0b0b0b", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [text, size]);

  if (!dataUrl) return <div style={{ width: size, height: size }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image gereksiz
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={`Katılım QR kodu: ${text}`}
      className="rounded-2xl"
    />
  );
}
