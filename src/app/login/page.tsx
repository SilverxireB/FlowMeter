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
import FlowSpinner from "@/components/FlowSpinner";
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

/**
 * Google girişinin yardımcı sayfası (`https://<authDomain>/__/auth/handler`)
 * bu bilgisayardan açılabiliyor mu?
 *
 * Neden gerekiyor: giriş açılır penceresi ayrı bir kaynak (origin) olduğu için
 * ana sayfa onun içine bakamaz — pencere "Bu siteye ulaşılamıyor" gösterirken
 * uygulama yalnızca "bir şey olmadı" bilgisine sahip oluyor. Adresi doğrudan
 * yoklamak o körlüğü kapatıyor.
 *
 * `no-cors`: yanıtı OKUMAK istemiyoruz, yalnız BAĞLANTININ kurulup kurulmadığını
 * öğrenmek istiyoruz — engelli ağda istek reddedilir/zaman aşar, açık ağda
 * opak da olsa döner. Kendi alan adımızdaki /__/auth/* proxy'sini yoklamak
 * İŞE YARAMAZ: o istek sunucumuz üzerinden gider, istemcinin engelini görmez.
 */
const AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "firebase"}.firebaseapp.com`;

async function authDomainUlasilirMi(): Promise<boolean> {
  try {
    const iptal = new AbortController();
    const zaman = setTimeout(() => iptal.abort(), 6000);
    await fetch(`https://${AUTH_DOMAIN}/__/auth/handler`, {
      mode: "no-cors",
      cache: "no-store",
      signal: iptal.signal,
    });
    clearTimeout(zaman);
    return true;
  } catch {
    return false;
  }
}

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
  const { user, loading } = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bekci = useRef<number | null>(null);

  // Oturum zaten açıksa (ör. /dashboard buraya attıysa) panele geç — girişi
  // AÇIK olan birine "Google ile devam et" dayatmak yanlıştı.
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  // Oturum daha okunurken buton aktif durmasın: kullanıcı gereksiz yere
  // tıklıyor, sonra zaten panele atılıyordu.
  const kontrol = loading || !!user;

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
      // "Tekrar dene" tek başına kullanıcıyı sonsuz döngüye sokuyordu: aynı
      // engel duruyorsa yüzüncü deneme de aynı yerde takılır. Takılmanın EN SIK
      // sebebi Google'ın giriş yardımcısının barındığı adrese (authDomain)
      // ulaşılamaması — kurum/fabrika ağları *.firebaseapp.com'u kapatabiliyor.
      // Onu burada ölçüp söylüyoruz; sebebi bilinen hata çözülebilir hatadır.
      void authDomainUlasilirMi().then((ulasilir) =>
        setError(
          ulasilir
            ? "Giriş tamamlanmadı. Tekrar dene."
            : `Google giriş sayfasına ulaşılamıyor (${AUTH_DOMAIN}). Bu adres ağ tarafından engelleniyor olabilir — başka bir ağda (ör. telefon internetini paylaşarak) dene ya da bilgi işlemden bu adrese izin iste.`
        )
      );
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
      // Tam sayfa yönlendirmeye YALNIZ tarayıcı pencereyi ENGELLEDİYSE düşülür.
      //
      // Eskiden koşul `/popup/i` idi ve `auth/popup-closed-by-user` ile
      // `auth/cancelled-popup-request` de ona uyuyordu: yani kullanıcı fikrini
      // değiştirip pencereyi KAPATINCA uygulama bütün sayfayı Google'a
      // götürüyordu. Vazgeçmenin cezası, vazgeçememek olmamalı.
      const engellendi =
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment";
      const vazgecti =
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";

      if (engellendi) {
        try {
          await signInWithRedirect(auth(), new GoogleAuthProvider());
          return;
        } catch {
          // Yönlendirme de olmadıysa kullanıcıya YAPILACAK İŞİ söyle: "giriş
          // başarısız" demek, engel simgesinin adres çubuğunda durduğunu
          // bilmeyen birine hiçbir şey anlatmıyor.
          setError(
            "Tarayıcı giriş penceresini engelledi. Adres çubuğunun sağındaki engel simgesine dokunup bu siteye izin ver, sonra tekrar dene."
          );
        }
      } else if (vazgecti) {
        setError("Giriş penceresi kapandı. Tekrar dene.");
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

        <button onClick={signIn} disabled={busy || kontrol} className="btn-accent w-full py-4">
          {kontrol ? (
            <>
              <FlowSpinner size={20} label="Oturum kontrol ediliyor" />
              {user ? "Panele geçiliyor…" : "Kontrol ediliyor…"}
            </>
          ) : busy ? (
            "Bağlanıyor…"
          ) : (
            "Google ile devam et"
          )}
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
