"use client";

/** TASARIM ARACI — bildirim şeridi kontrolü (hiçbir yerden linklenmez). */
import { useEffect } from "react";
import { useToast } from "@/components/Toast";

export default function ToastTestPage() {
  const { show, toast } = useToast();
  useEffect(() => {
    show('"Toplantı Açılışı & Gündem (kopya) (kopya)" siliniyor…', "busy");
  }, [show]);
  return (
    <main className="min-h-screen bg-wash p-6">
      <p className="text-muted text-sm">Bildirim şeridi testi — uzun metinle taşma/ortalama kontrolü.</p>
      {toast}
    </main>
  );
}
