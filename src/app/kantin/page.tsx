"use client";

/** Kantin girişi — role göre doğru sayfaya yollar. */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useKantin } from "@/lib/kantin/oturum";

export default function KantinAnaPage() {
  const { user, kisi, rol, hazir } = useKantin();
  const router = useRouter();

  useEffect(() => {
    if (!hazir) return;
    if (!user) {
      router.replace("/kantin/giris");
      return;
    }
    // Kişi kaydı gelene kadar bekle: rolü bilmeden yönlendirmek kantinciyi
    // menüye düşürüyor, sonra sekme değişince atlıyordu.
    if (!kisi) return;
    router.replace(rol === "kantinci" ? "/kantin/tezgah" : "/kantin/menu");
  }, [hazir, user, kisi, rol, router]);

  return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Açılıyor…</main>;
}
