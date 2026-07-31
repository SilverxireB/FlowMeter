"use client";

import { useEffect } from "react";

/**
 * 7/24 perde bekçisi: beklenmedik bir render hatası günlerce açık ekranda
 * beyaz sayfa/hata ekranı bırakmasın — kısa mesaj + 6 sn'de otomatik yeniden
 * yükleme (kalıcı hatada da döngü zararsızdır: ekran "toparlanıyor" der durur).
 */
export default function FlowsignPlayError() {
  useEffect(() => {
    const t = window.setTimeout(() => window.location.reload(), 6000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <main className="w-screen h-screen grid place-items-center bg-black text-white/40 text-sm">
      Ekran toparlanıyor…
    </main>
  );
}
