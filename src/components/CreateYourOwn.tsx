"use client";

/**
 * "Sen de kendi etkinliğini kur" çağrısı — büyüme halkası.
 *
 * Etkinliğe katılan kişi ürünü ÇALIŞIRKEN görüyor; en ikna olduğu an bu.
 * Ama katılımcı yüzeyi bir satış sayfası değil: çağrı akışın SONUNDA, sakin
 * ve tek satır durur (üstteki işi bölmez). Zaten oturumu açık olan sahibe
 * hiç gösterilmez — o zaten müşteri.
 */
import Link from "next/link";
import { useAuthUser } from "@/lib/hooks";

export default function CreateYourOwn({
  tone = "light",
  text = "Kendi etkinliğini yönetmek ister misin?",
  cta = "Ücretsiz başla",
  className = "",
}: {
  tone?: "light" | "dark";
  text?: string;
  cta?: string;
  className?: string;
}) {
  const { user, loading } = useAuthUser();
  if (loading || user) return null; // sahibe reklam yapma
  const dark = tone === "dark";
  return (
    <p className={`text-center text-sm ${dark ? "text-white/45" : "text-muted"} ${className}`}>
      {text}{" "}
      <Link
        href="/dashboard"
        className={`font-semibold underline underline-offset-2 ${
          dark ? "text-white/80 hover:text-white" : "text-accent hover:text-accent-dark"
        }`}
      >
        {cta} →
      </Link>
    </p>
  );
}
