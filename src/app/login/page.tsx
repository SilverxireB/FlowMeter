"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { auth } from "@/lib/firebase";

/** Sunucu girişi — sadece Google (izleyiciler hiç giriş yapmaz). */
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth(), new GoogleAuthProvider());
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş başarısız.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-wash">
      <div className="w-full max-w-sm card p-8 text-center">
        <div className="flex items-center justify-center mb-1">
          <Logo size="lg" />
        </div>
        <p className="text-muted text-sm mb-8">Sunum oluşturmak için giriş yap</p>

        <button onClick={signIn} disabled={busy} className="btn-accent w-full py-4">
          {busy ? "Bağlanıyor…" : "Google ile devam et"}
        </button>

        {error && <p className="text-brand text-sm mt-4">{error}</p>}

        <p className="text-muted text-xs mt-8">
          İzleyicilerin girişe ihtiyacı yok — onlar sadece kod girer.
        </p>
      </div>
    </main>
  );
}
