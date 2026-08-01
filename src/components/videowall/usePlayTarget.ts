"use client";

/**
 * Perde linki hangi pencerede açılsın? Masaüstünde yeni sekme (editör/liste
 * açık kalır — 7/24 kurulumun doğal akışı). Telefonda ve PWA'da AYNI pencere:
 * `target="_blank"` PWA'da geçmişsiz yeni pencere açıyor, Android geri tuşu
 * pencereyi değil UYGULAMAYI kapatıyordu. Aynı pencerede geri tuşu listeye döner.
 */
import { useEffect, useState } from "react";

export function usePlayTarget(): "_blank" | undefined {
  const [sameWin, setSameWin] = useState(false);
  useEffect(() => {
    try {
      setSameWin(
        window.matchMedia("(display-mode: standalone)").matches ||
          window.matchMedia("(pointer: coarse)").matches
      );
    } catch {}
  }, []);
  return sameWin ? undefined : "_blank";
}
