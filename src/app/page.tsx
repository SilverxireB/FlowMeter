"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import CodeInput from "@/components/CodeInput";
import Logo from "@/components/Logo";
import { useAuthUser } from "@/lib/hooks";
import { getLastPresentation, LastPresentation } from "@/lib/participants";
import { resolveCode } from "@/lib/walls";

/**
 * Landing = Flow Studio (çatı marka) katılım kapısı. Kod deck ise sunuma
 * (/join→/p), wall ise duvara (/u) gider. Oluşturma /dashboard'da; altta
 * 4 ürünün minik O+ad şeridi (vitrin — kart değil, tıklanmaz).
 *
 * Kod alanı 6 AYRI HANE olarak çizilir: tek geniş kutuda harf aralığıyla
 * yazılan rakamlar kayıyor ve "kaç hane kaldı" görünmüyordu. Girdi hâlâ TEK
 * gerçek input (klavye, yapıştırma ve SMS otomatik doldurma bozulmasın);
 * haneler onun görsel yansıması.
 */
const PRODUCTS = [
  { o: "/logo-o-meter.png", name: "METER" },
  { o: "/logo-o-wall.png", name: "WALL" },
  { o: "/logo-o-sign.png", name: "SIGN" },
  { o: "/logo-o-pulse.png", name: "PULSE" },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<LastPresentation | null>(null);
  // Sahip cihazında (Google oturumu açık) panele kestirme; katılımcı hiç
  // giriş yapmadığından bu çipi asla görmez. PWA'da adres çubuğu yok → tek yol bu.
  const { user } = useAuthUser();
  // Panel AĞIR bir sayfa (tüm ürünler + oturum kontrolü): telefonda dokunuşla
  // açılışı arasında saniyeler geçiyor ve ekranda HİÇBİR belirti olmuyordu —
  // kullanıcı "tıklanmıyor" sanıp üst üste basıyordu. Dokunur dokunmaz çip
  // "Açılıyor…"a döner ve tekrar dokunuşları yutar.
  const [going, setGoing] = useState<null | "panel" | "last">(null);

  // Panel, çip EKRANA GELDİĞİ anda hazırlanır (dokunulunca değil). Asıl şikâyet
  // geri bildirim eksikliği değildi: dokunuşla açılış arasındaki bekleme panelin
  // o an indirilmesinden geliyordu. Oturum bilindiği anda rota önceden çekilir,
  // dokunuş anında gidilecek her şey hazır olur.
  useEffect(() => {
    if (user) router.prefetch("/dashboard");
  }, [user, router]);

  useEffect(() => {
    setLast(getLastPresentation());
  }, []);

  // Geri tuşuyla (bfcache) bu sayfaya dönülürse bileşen yeniden kurulmaz —
  // çip "Açılıyor…"da donmasın diye geri dönüşte sıfırlanır.
  useEffect(() => {
    const reset = () => setGoing(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6 || busy) return;
    setBusy(true);
    try {
      const t = await resolveCode(clean);
      // wall → doğrudan yükleme; deck → mevcut /join akışı (→ /p). QR/linkler değişmez.
      router.push(t?.kind === "wall" ? `/u/${t.id}` : `/join/${clean}`);
    } catch {
      router.push(`/join/${clean}`);
    }
  }

  const ready = code.length === 6;

  return (
    <main className="relative min-h-screen flex flex-col bg-wash overflow-hidden">
      {/* Marka atmosferi: üstten inen çok soluk lacivert/indigo ışıma. Düz gri
          zemin "şablon" hissi veriyordu; bu, sayfayı markaya bağlar ama okumayı
          zorlaştırmaz (opaklık çok düşük). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46vh]"
        style={{
          background:
            "radial-gradient(80rem 26rem at 50% -8%, rgba(79,70,229,0.10), transparent 62%), radial-gradient(50rem 20rem at 15% 0%, rgba(0,30,100,0.06), transparent 60%)",
        }}
      />

      {/* Salt katılımcı yüzeyi: giriş linki YOK; yalnız oturumu AÇIK sahibe çip. */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between gap-3">
        <Logo variant="studio" />
        {user && (
          <Link
            href="/dashboard"
            onClick={() => setGoing("panel")}
            aria-busy={going === "panel"}
            // Dokunma hedefi telefonda en az 44px: çip 30px yüksekliğindeydi,
            // ıskalanan dokunuşlar da "tıklanmıyor" hissini besliyordu.
            //
            // BASILMA TEPKİSİ (active): tepki eskiden yalnız click ile geliyordu;
            // parmağın değdiği an ekranda hiçbir şey olmuyordu, dokunduğundan
            // emin olamayıp tekrar basılıyordu. `chip` sınıfının — düğmelerin
            // aksine — basılı hâli yok, o yüzden burada açıkça veriliyor.
            // Parmak kayıp vazgeçilirse tarayıcı :active'i kendisi geri alır
            // (JS ile yapılsa "Açılıyor…"da takılı kalırdı).
            // touch-action: dokunmadan sonraki çift-dokunma gecikmesini kaldırır.
            className={`chip !py-1.5 min-h-[44px] px-4 text-accent font-semibold hover:border-accent shrink-0
              select-none [touch-action:manipulation] transform-gpu transition-transform duration-100
              active:scale-[0.94] active:bg-accent-soft active:border-accent ${
              going === "panel" ? "pointer-events-none border-accent/40" : ""
            }`}
          >
            {going === "panel" ? (
              <>
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 border-accent/30 border-t-accent animate-spin"
                  aria-hidden
                />
                Açılıyor…
              </>
            ) : (
              "Panelim →"
            )}
          </Link>
        )}
      </header>

      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-6 -mt-10">
        <p className="eyebrow mb-3">Canlı etkinlik</p>
        <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-6xl font-bold tracking-[-0.03em] text-center mb-3">
          Etkinliğe katıl
        </h1>
        <p className="text-muted text-center mb-9 text-[15px]">Ekranda gördüğün 6 haneli kodu gir</p>

        <form onSubmit={join} className="w-full max-w-sm flex flex-col gap-4">
          <CodeInput value={code} onChange={setCode} />

          <button type="submit" disabled={!ready || busy} className="btn-accent py-4 text-lg">
            {busy ? "Bağlanılıyor…" : "Katıl →"}
          </button>
        </form>

        {last && (
          <Link
            href={`/p/${last.id}`}
            onClick={() => setGoing("last")}
            aria-busy={going === "last"}
            className={`mt-7 group inline-flex items-center gap-2 bg-white border border-line rounded-full pl-2 pr-4 py-2.5 min-h-[44px] text-sm hover:border-accent
              select-none [touch-action:manipulation] transform-gpu transition-transform duration-100
              active:scale-[0.97] active:border-accent ${
              going === "last" ? "pointer-events-none border-accent/40" : ""
            }`}
          >
            <span className="bg-accent-soft text-accent-dark rounded-full px-2 py-0.5 text-xs font-bold">Devam et</span>
            <span className="text-ink/80 group-hover:text-ink truncate max-w-[14rem]">{last.title}</span>
            {going === "last" ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" aria-hidden />
            ) : (
              <span className="text-muted">→</span>
            )}
          </Link>
        )}
      </section>

      {/* Çatı vitrini: minik O + ad — salt görsel, tıklanmaz */}
      <footer className="relative z-10 px-6 pb-8 pt-2">
        {/* DÖRT SÜTUN sabit: esnek sarmada dar telefonda "PULSE" tek başına alt
            satıra düşüp şerit kırık görünüyordu. Izgara her genişlikte tek sıra
            tutar; dar ekranda yazı ve boşluk küçülür. */}
        <div className="grid grid-cols-4 gap-x-1 max-w-sm mx-auto">
          {PRODUCTS.map((p) => (
            <span key={p.name} className="inline-flex items-center justify-center gap-1 sm:gap-1.5 opacity-70 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.o} alt="" className="h-3.5 sm:h-4 w-auto shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.08em] sm:tracking-[0.12em] text-ink/45 truncate">
                {p.name}
              </span>
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}
