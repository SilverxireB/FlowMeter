"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { getLastPresentation, LastPresentation } from "@/lib/participants";
import { resolveCode } from "@/lib/walls";

/**
 * Landing = Flow Studio (çatı marka) katılım kapısı. Kod deck ise sunuma
 * (/join→/p), wall ise duvara (/u) gider. Oluşturma /dashboard'da; altta
 * 4 ürünün markalı şeridi (vitrin).
 */
const PRODUCTS = [
  { href: "/dashboard?p=decks", variant: "meter", desc: "İnteraktif sunum & oylama", card: "bg-white border border-line", onDark: false },
  { href: "/dashboard?p=walls", variant: "wall", desc: "Canlı etkinlik foto duvarı", card: "bg-[#0b1533] border border-white/10", onDark: true },
  { href: "/videowall", variant: "sign", desc: "Dijital tabela & video-wall", card: "bg-[#0d102f] border border-white/10", onDark: true },
  { href: "/pulse", variant: "pulse", desc: "Sürekli nabız & geri bildirim", card: "bg-white border border-line", onDark: false },
] as const;
export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<LastPresentation | null>(null);

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
      <header className="px-6 py-5 flex items-center justify-between gap-3">
        <Logo variant="studio" />
        <Link href="/login" className="chip !py-1.5 text-accent font-semibold hover:border-accent shrink-0">
          Giriş yap →
        </Link>
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

        <p className="text-muted text-sm mt-6">
          Sunum, duvar veya ekran mı oluşturacaksın?{" "}
          <Link href="/login" className="text-accent font-semibold hover:underline">Giriş yap →</Link>
        </p>

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

      {/* Çatı vitrini: 4 ürün, tek hesap — kartlar kendi marka yüzeyinde */}
      <footer className="px-6 pb-8 pt-2">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRODUCTS.map((p) => (
            <Link
              key={p.variant}
              href={p.href}
              className={`${p.card} rounded-2xl px-4 py-4 flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all`}
            >
              <Logo size="sm" variant={p.variant} onDark={p.onDark} />
              <span className={`text-xs ${p.onDark ? "text-white/60" : "text-muted"}`}>{p.desc}</span>
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
