"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { useAuthUser } from "@/lib/hooks";
import { getLastPresentation, LastPresentation } from "@/lib/participants";
import { resolveCode } from "@/lib/walls";

/**
 * Landing = Flow Studio (çatı marka) katılım kapısı. Kod deck ise sunuma
 * (/join→/p), wall ise duvara (/u) gider. Oluşturma /dashboard'da; altta
 * 4 ürünün minik O+ad şeridi (vitrin — kart değil, tıklanmaz).
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

  useEffect(() => {
    setLast(getLastPresentation());
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

  return (
    <main className="min-h-screen flex flex-col bg-wash">
      {/* Salt katılımcı yüzeyi: giriş linki YOK; yalnız oturumu AÇIK sahibe çip.
          z-10: -mt-14'lü içerik bloğu başlığın üstüne binip dokunuşu yutmasın */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between gap-3">
        <Logo variant="studio" />
        {user && (
          <Link href="/dashboard" className="chip !py-1.5 text-accent font-semibold hover:border-accent shrink-0">
            Panelim →
          </Link>
        )}
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 -mt-14">
        <p className="eyebrow mb-4">Canlı etkinlik</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-center mb-3">
          Etkinliğe katıl
        </h1>
        <p className="text-muted text-center mb-10">
          Ekranda gördüğün 6 haneli kodu gir
        </p>

        <form onSubmit={join} className="w-full max-w-sm flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
            placeholder="123 456"
            aria-label="Katılım kodu"
            className="input-base text-center text-4xl tracking-[0.3em] font-bold py-5 placeholder:text-ink/15 placeholder:font-semibold"
          />
          <button type="submit" disabled={code.length !== 6 || busy} className="btn-accent py-4 text-lg">
            {busy ? "Bağlanılıyor…" : "Katıl →"}
          </button>
        </form>

        {last && (
          <Link
            href={`/p/${last.id}`}
            className="mt-8 group inline-flex items-center gap-2 bg-white border border-line rounded-full pl-2 pr-4 py-1.5 text-sm hover:border-accent transition-colors"
          >
            <span className="bg-accent-soft text-accent-dark rounded-full px-2 py-0.5 text-xs font-bold">
              Devam et
            </span>
            <span className="text-ink/80 group-hover:text-ink truncate max-w-[14rem]">
              {last.title}
            </span>
            <span className="text-muted">→</span>
          </Link>
        )}
      </section>

      {/* Çatı vitrini: minik O + ad — salt görsel, tıklanmaz */}
      <footer className="px-6 pb-8 pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {PRODUCTS.map((p) => (
          <span key={p.name} className="inline-flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.o} alt="" className="h-4 w-auto" />
            <span className="text-xs font-semibold tracking-wide text-ink/45">{p.name}</span>
          </span>
        ))}
      </footer>
    </main>
  );
}
