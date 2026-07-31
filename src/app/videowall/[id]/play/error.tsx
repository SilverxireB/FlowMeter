"use client";

import { useEffect } from "react";

/** 7/24 perde bekçisi — bkz. flowsign/[slug]/error.tsx (aynı davranış). */
export default function VideowallPlayError() {
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
