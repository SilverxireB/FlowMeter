"use client";

/**
 * KANTİN girişi — e-posta + şifre.
 *
 * Anonim giriş BİLEREK yok: sipariş kimliğe bağlı olmalı (alınmayan siparişin
 * sahibi bilinmezse ne rapor çıkar ne de yaptırım). Google girişi de yok —
 * bu uygulama iç ağa taşınacak, orada Google'a çıkış olmayabilir.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { girisYap, kayitOl } from "@/lib/kantin/api";
import { kantinYapilandirildi } from "@/lib/kantin/firebase";
import { useKantin } from "@/lib/kantin/oturum";

export default function KantinGirisPage() {
  const { user, hazir } = useKantin();
  const router = useRouter();
  const [mod, setMod] = useState<"giris" | "kayit">("giris");
  const [ad, setAd] = useState("");
  const [sicil, setSicil] = useState("");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hazir && user) router.replace("/kantin");
  }, [hazir, user, router]);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setHata("");
    setBusy(true);
    try {
      if (mod === "giris") await girisYap(email, sifre);
      else {
        if (!ad.trim() || !sicil.trim()) throw new Error("Ad ve sicil gerekli.");
        await kayitOl(ad, sicil, email, sifre);
      }
      router.replace("/kantin");
    } catch (e2) {
      setHata(cevir(e2));
    } finally {
      setBusy(false);
    }
  };

  if (!kantinYapilandirildi()) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash px-6 text-center">
        <p className="text-muted">Bağlantı ayarları eksik — yöneticiye bildir.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-wash p-6">
      <form onSubmit={gonder} className="card p-6 w-full max-w-sm flex flex-col gap-3">
        <div>
          <p className="eyebrow text-accent">Kantin</p>
          <h1 className="font-display text-2xl font-semibold">
            {mod === "giris" ? "Giriş yap" : "Hesap aç"}
          </h1>
          <p className="text-muted text-sm mt-0.5">
            {mod === "giris" ? "Sipariş vermek için giriş gerekir." : "Sicilin siparişe işlenir."}
          </p>
        </div>

        {mod === "kayit" && (
          <>
            <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ad soyad" className="input-base !py-2 text-sm" autoComplete="name" />
            <input value={sicil} onChange={(e) => setSicil(e.target.value)} placeholder="Sicil no" className="input-base !py-2 text-sm" inputMode="numeric" />
          </>
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta" type="email" required className="input-base !py-2 text-sm" autoComplete="email" />
        <input value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="Şifre" type="password" required minLength={6} className="input-base !py-2 text-sm" autoComplete={mod === "giris" ? "current-password" : "new-password"} />

        {hata && <p className="text-brand text-sm">{hata}</p>}

        <button type="submit" disabled={busy} className="btn-primary !py-2.5 text-sm">
          {busy ? "Bekle…" : mod === "giris" ? "Giriş yap" : "Hesap aç"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMod((m) => (m === "giris" ? "kayit" : "giris"));
            setHata("");
          }}
          className="text-muted text-xs hover:text-ink"
        >
          {mod === "giris" ? "Hesabın yok mu? Hesap aç" : "Zaten hesabın var mı? Giriş yap"}
        </button>
      </form>
    </main>
  );
}

/** Firebase hata kodlarını insan diline çevirir — ham kod kullanıcıya gösterilmez. */
function cevir(e: unknown): string {
  const kod = (e as { code?: string })?.code ?? "";
  if (kod.includes("invalid-credential") || kod.includes("wrong-password") || kod.includes("user-not-found"))
    return "E-posta ya da şifre hatalı.";
  if (kod.includes("email-already-in-use")) return "Bu e-posta zaten kayıtlı — giriş yap.";
  if (kod.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if (kod.includes("invalid-email")) return "E-posta adresi geçersiz.";
  if (kod.includes("operation-not-allowed"))
    return "E-posta ile giriş kapalı görünüyor — yöneticiye bildir.";
  if (kod.includes("too-many-requests")) return "Çok fazla deneme oldu, biraz bekle.";
  if (kod.includes("network")) return "Bağlantı kurulamadı.";
  return e instanceof Error ? e.message : "Bir şeyler ters gitti.";
}
