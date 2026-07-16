"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length === 6) router.push(`/join/${clean}`);
  }

  return (
    <main className="min-h-screen bg-brand-navy flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-white text-xl font-bold tracking-tight">FlowMeter</span>
        <nav className="flex gap-3">
          <Link
            href="/login"
            className="text-white/80 hover:text-white text-sm font-medium px-3 py-2"
          >
            Giriş yap
          </Link>
          <Link
            href="/dashboard"
            className="bg-brand-blue hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Sunum oluştur
          </Link>
        </nav>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4">
        <h1 className="text-white text-3xl sm:text-4xl font-bold text-center mb-2">
          Sunuma katıl
        </h1>
        <p className="text-white/60 text-center mb-8">
          Ekranda gördüğün 6 haneli kodu gir
        </p>
        <form onSubmit={join} className="w-full max-w-sm flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123 456"
            aria-label="Katılım kodu"
            className="w-full text-center text-3xl tracking-[0.3em] font-semibold rounded-xl px-4 py-4 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-brand-blue/40"
          />
          <button
            type="submit"
            disabled={code.length !== 6}
            className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-xl py-4 text-lg"
          >
            Katıl
          </button>
        </form>
      </section>

      <footer className="text-center text-white/40 text-xs py-4">
        FlowMeter — interaktif sunum platformu
      </footer>
    </main>
  );
}
