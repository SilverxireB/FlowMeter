"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { getLastPresentation, LastPresentation } from "@/lib/participants";

/**
 * Landing = sadece katılım (menti.com gibi). Sunum oluşturma herkese açık
 * değildir; sunucular doğrudan /dashboard adresini kullanır.
 */
export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [last, setLast] = useState<LastPresentation | null>(null);

  useEffect(() => {
    setLast(getLastPresentation());
  }, []);

  function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length === 6) router.push(`/join/${clean}`);
  }

  return (
    <main className="min-h-screen flex flex-col bg-wash">
      <header className="px-6 py-5">
        <Logo />
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 -mt-14">
        <p className="eyebrow mb-4">Canlı sunum</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-center mb-3">
          Sunuma katıl
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
            className="input-base text-center text-4xl tracking-[0.3em] font-bold py-5 placeholder:text-line placeholder:font-semibold"
          />
          <button type="submit" disabled={code.length !== 6} className="btn-accent py-4 text-lg">
            Katıl →
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

      <footer className="px-6 py-5 text-xs text-muted">
        <span>FlowMeter</span>
      </footer>
    </main>
  );
}
