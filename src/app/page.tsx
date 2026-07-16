"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
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
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-5">
        <span className="text-xl font-semibold tracking-tight">FlowMeter</span>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <h1 className="text-3xl sm:text-4xl font-semibold text-center mb-3">
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
            className="w-full text-center text-3xl tracking-[0.3em] font-semibold rounded-2xl px-4 py-5 bg-white border border-line placeholder:text-line focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
          <button
            type="submit"
            disabled={code.length !== 6}
            className="w-full bg-ink hover:bg-black disabled:opacity-30 text-white font-medium rounded-2xl py-4 text-lg transition-opacity"
          >
            Katıl
          </button>
        </form>

        {last && (
          <Link
            href={`/p/${last.id}`}
            className="mt-8 text-accent hover:text-accent-dark text-sm font-medium"
          >
            ‹{last.title}› sunumuna geri dön →
          </Link>
        )}
      </section>

      <footer className="px-6 py-5 flex items-center justify-between text-xs text-muted">
        <span>FlowMeter</span>
        <Link href="/dashboard" className="hover:text-ink transition-colors">
          Sunucu girişi
        </Link>
      </footer>
    </main>
  );
}
