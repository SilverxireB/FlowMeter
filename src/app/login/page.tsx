"use client";

import { FirebaseError } from "firebase/app";
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import StudioHero from "@/components/StudioHero";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/hooks";

/** Kurulu PWA (standalone) veya iOS ana ekran modunda mıyız? */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/*
 * NOT — neden hâlâ popup (kurulu PWA hariç):
 * Telefonda popup ayrı bir SEKME olarak açılıyor, kullanıcı çoğu zaman
 * farketmiyor; ilk sekme "Bağlanıyor…"da kalıyor. İlk çözüm dokunmatik her
 * cihazda tam sayfa yönlendirmeye geçmekti — ama uygulama adresi (vercel.app)
 * Firebase'in auth adresinden farklı olduğu için tarayıcılar o akışı üçüncü
 * taraf depolama engeliyle bozabiliyor; popup bu kurulumda daha güvenilir.
 * Bu yüzden akış korundu, ASILI KALMA giderildi: oturum nerede açılırsa açılsın
 * (arka plandaki sekmede bile) aşağıdaki oturum takibi paneli açar, bekçi de
 * butonu serbest bırakır.
 */

/** Firebase hata kodunu kullanıcıya anlatılabilir Türkçeye çevir. */
function readableError(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : "";
  if (code === "auth/unauthorized-domain")
    return "Bu adresten girişe izin verilmiyor. Alan adının Firebase'de yetkili adresler listesine eklenmesi gerekiyor.";
  if (code === "auth/network-request-failed") return "İnternete ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request")
    return "Giriş penceresi kapandı. Tekrar dene.";
  if (code === "auth/operation-not-allowed") return "Google ile giriş bu projede kapalı.";
  return e instanceof Error ? e.message : "Giriş başarısız.";
}

/** Sunucu girişi — sadece Google (izleyiciler hiç giriş yapmaz). */
export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bekci = useRef<number | null>(null);

  // Oturum zaten açıksa (ör. /dashboard buraya attıysa) panele geç
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  // Redirect ile dönüşte oturumu tamamla
  useEffect(() => {
    getRedirectResult(auth())
      .then((res) => {
        if (res?.user) router.push("/dashboard");
      })
      .catch((e) => setError(readableError(e)));
  }, [router]);

  const durdur = () => {
    if (bekci.current) {
      window.clearTimeout(bekci.current);
      bekci.current = null;
    }
  };
  useEffect(() => () => { if (bekci.current) window.clearTimeout(bekci.current); }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    // Bekçi: yönlendirme/popup bir yerde takılırsa buton sonsuza kadar
    // "Bağlanıyor…" kalmasın — kullanıcı tekrar deneyebilsin.
    durdur();
    bekci.current = window.setTimeout(() => {
      setBusy(false);
      setError("Giriş tamamlanmadı. Tekrar dene.");
    }, 25000);

    try {
      const provider = new GoogleAuthProvider();
      if (isStandalone()) {
        await signInWithRedirect(auth(), provider);
        return; // sayfa Google'a gider; dönüşte yukarıdaki effect tamamlar
      }
      await signInWithPopup(auth(), provider);
      durdur();
      router.push("/dashboard");
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : "";
      // Popup engellendiyse tam sayfa yönlendirmeye düş
      if (/popup/i.test(code)) {
        try {
          await signInWithRedirect(auth(), new GoogleAuthProvider());
          return;
        } catch (e2) {
          setError(readableError(e2));
        }
      } else {
        setError(readableError(e));
      }
      durdur();
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-wash">
      <div className="w-full max-w-sm">
        {/* Çatı kimlik: hub'daki sahnenin kompakt hâli — giriş markayla açılır */}
        <StudioHero variant="compact" />
        <div className="card p-8 text-center">
        <p className="text-muted text-sm mb-8">Sunum, etkinlik duvarı, tabela ve nabız ölçümü için giriş yap</p>

        <button onClick={signIn} disabled={busy} className="btn-accent w-full py-4">
          {busy ? "Bağlanıyor…" : "Google ile devam et"}
        </button>

        {error && <p className="text-brand text-sm mt-4">{error}</p>}

        <p className="text-muted text-xs mt-8">
          İzleyicilerin girişe ihtiyacı yok — onlar sadece kod girer.
        </p>
        </div>
      </div>
    </main>
  );
}
