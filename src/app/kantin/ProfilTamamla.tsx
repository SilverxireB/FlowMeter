"use client";

/**
 * Hesabı olan ama KİŞİ KAYDI olmayan kullanıcı için tek adımlık form.
 *
 * Neden gerekli: Firebase'de e-posta havuzu proje geneli. Bu projede zaten
 * hesabı olan biri (ör. Flow Studio'ya Google ile girmiş yönetici) kantine
 * "Şifremi unuttum" ile şifre belirleyip girebilir — ama kayıt akışından
 * geçmediği için ad/sicili yoktur. Bu ekran olmasaydı "Açılıyor…" ekranında
 * sonsuza kadar beklerdi.
 */
import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { kDb } from "@/lib/kantin/firebase";
import { useKantin } from "@/lib/kantin/oturum";
import { cikisYap } from "@/lib/kantin/api";

export default function ProfilTamamla() {
  const { user } = useKantin();
  const [ad, setAd] = useState(user?.displayName ?? "");
  const [sicil, setSicil] = useState("");
  const [hata, setHata] = useState("");
  const [busy, setBusy] = useState(false);

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    if (!ad.trim() || !sicil.trim()) {
      setHata("Ad ve sicil gerekli.");
      return;
    }
    setBusy(true);
    setHata("");
    try {
      await setDoc(doc(kDb(), "kantinUsers", user.uid), {
        ad: ad.trim().slice(0, 60),
        sicil: sicil.trim().slice(0, 20),
        email: user.email ?? "",
        rol: "personel",
        createdAt: serverTimestamp(),
      });
    } catch (e2) {
      setHata(e2 instanceof Error ? e2.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-wash p-6">
      <form onSubmit={kaydet} className="card p-6 w-full max-w-sm flex flex-col gap-3">
        <div>
          <p className="eyebrow text-accent">Kantin</p>
          <h1 className="font-display text-2xl font-semibold">Bilgilerini tamamla</h1>
          <p className="text-muted text-sm mt-0.5">Sicilin siparişe işlenir.</p>
        </div>
        <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ad soyad" className="input-base !py-2 text-sm" autoComplete="name" />
        <input value={sicil} onChange={(e) => setSicil(e.target.value)} placeholder="Sicil no" className="input-base !py-2 text-sm" inputMode="numeric" />
        {hata && <p className="text-brand text-sm">{hata}</p>}
        <button type="submit" disabled={busy} className="btn-primary !py-2.5 text-sm">
          {busy ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button type="button" onClick={() => void cikisYap()} className="text-muted text-xs hover:text-ink">
          Çıkış yap
        </button>
      </form>
    </main>
  );
}
