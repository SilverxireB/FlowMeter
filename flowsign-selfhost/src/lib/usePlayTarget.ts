"use client";

/**
 * Perde linki hangi pencerede açılsın? Masaüstünde yeni sekme (editör/liste
 * açık kalır). Telefonda/PWA'da AYNI pencere: yeni pencerede geri tuşu
 * uygulamayı kapatıyordu; aynı pencerede geri tuşu listeye döner.
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
