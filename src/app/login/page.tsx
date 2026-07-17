"use client";

import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { auth } from "@/lib/firebase";

/** Kurulu PWA (standalone) veya iOS ana ekran modunda mıyız? */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Sunucu girişi — sadece Google (izleyiciler hiç giriş yapmaz). */
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Redirect ile dönüşte oturumu tamamla (PWA akışı)
  useEffect(() => {
    getRedirectResult(auth())
      .then((res) => {
        if (res?.user) router.push("/dashboard");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Giriş başarısız."));
  }, [router]);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Kurulu uygulamada popup engellenir → tam sayfa redirect kullan
      if (isStandalone()) {
        await signInWithRedirect(auth(), provider);
        return; // sayfa Google'a yönlenir; dönüşte yukarıdaki effect tamamlar
      }
      await signInWithPopup(auth(), provider);
      router.push("/dashboard");
    } catch (e) {
      // Popup başarısızsa (engellendi/kapatıldı) redirect'e düş
      const msg = e instanceof Error ? e.message : "Giriş başarısız.";
      if (/popup/i.test(msg)) {
        try {
          await signInWithRedirect(auth(), new GoogleAuthProvider());
          return;
        } catch {
          /* aşağıda hata gösterilir */
        }
      }
      setError(msg);
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
