"use client";

/**
 * Tam ekran yüzeylerde (perde/pano) dokunmatik cihaza özel geri dönüş kontrolü.
 * YALNIZ şu iki koşul birlikte sağlanınca görünür:
 *  - cihaz dokunmatik (telefon/tablet) → projeksiyon PC'sinde/fareyle ASLA çıkmaz,
 *    yani kimse gösteri sırasında yanlışlıkla perdeden çıkamaz;
 *  - geride dönülecek bir sayfa var → doğrudan linkle açılmış kiosk ekranında çıkmaz.
 * Başka bir sayfaya GÖMÜLÜYSE (Pulse panosu FlowSign tabelasında) hiç çıkmaz.
 * Pulse kiosk'ta KULLANILMAZ: orada çıkış bilerek 5 dokunuş + PIN ile korunur.
 */
import { useEffect, useState } from "react";

export default function ScreenClose({ dark = true }: { dark?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const embedded = window.self !== window.top;
      setShow(!embedded && window.matchMedia("(pointer: coarse)").matches && window.history.length > 1);
    } catch {
      /* çapraz-origin erişim hatası = gömülüyüz → gösterme */
    }
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.history.back()}
      className={`fixed bottom-4 left-4 z-[60] rounded-full px-4 py-2 text-sm font-semibold backdrop-blur border transition-opacity opacity-60 hover:opacity-100 ${
        dark ? "bg-black/50 border-white/20 text-white" : "bg-white/70 border-black/10 text-ink"
      }`}
    >
      ← Kapat
    </button>
  );
}
