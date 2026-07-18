"use client";

/**
 * FlowWall karşılama — etkinlik foto/video duvarına katılım kapısı.
 * FlowMeter'ın açık/kurumsal landing'inden AYRIŞIR: koyu, festival havası.
 * Akıllı kod kutusu: kod deck ise /join'e, wall ise /u'ya yönlendirir.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Logo from "@/components/Logo";
import { resolveCode } from "@/lib/walls";

const SERIES = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"];
// Arka plan foto-kolaj karoları (soyut renk karoları — sahte foto değil, ambiyans)
const TILES = Array.from({ length: 14 }, (_, i) => ({
  c: SERIES[i % SERIES.length],
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 60 + ((i * 29) % 90),
  delay: (i % 7) * 0.9,
  dur: 7 + (i % 5),
}));

export default function WallHome() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const t = await resolveCode(clean);
      if (!t) {
        setErr("Bu koda ait bir duvar/sunum bulunamadı.");
        setBusy(false);
        return;
      }
      router.push(t.kind === "wall" ? `/u/${t.id}` : `/join/${clean}`);
    } catch {
      setErr("Bağlantı hatası, tekrar dene.");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070c22] text-white flex flex-col">
      {/* Ambiyans: yüzen renk karoları + degrade */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.22]">
        {TILES.map((t, i) => (
          <span
            key={i}
            className="ww-float absolute rounded-2xl"
            style={{
              left: `${t.left}%`,
              top: `${t.top}%`,
              width: t.size,
              height: t.size,
              background: t.c,
              animationDelay: `${t.delay}s`,
              animationDuration: `${t.dur}s`,
            }}
          />
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, transparent 30%, #070c22 78%)" }}
      />

      <header className="relative z-10 px-6 py-5">
        <Logo variant="wall" onDark />
      </header>

      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 -mt-10 text-center">
        <p className="uppercase tracking-[0.22em] text-xs font-bold text-white/60 mb-4">
          Canlı anı duvarı
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight mb-3 text-balance">
          Anını paylaş,<br />perdede parla
        </h1>
        <p className="text-white/70 mb-9 max-w-md">
          Ekrandaki 6 haneli kodu gir; fotoğrafın ya da videon saniyeler içinde
          duvarda akmaya başlasın.
        </p>

        <form onSubmit={join} className="w-full max-w-sm flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
            placeholder="123 456"
            aria-label="Katılım kodu"
            className="w-full text-center text-4xl tracking-[0.3em] font-bold py-5 rounded-2xl bg-white/10 border border-white/15 text-white placeholder:text-white/25 focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            disabled={code.length !== 6 || busy}
            className="py-4 text-lg font-semibold rounded-2xl bg-white text-[#070c22] disabled:opacity-40 transition-opacity"
          >
            {busy ? "Bağlanıyor…" : "Duvara katıl →"}
          </button>
          {err && <p className="text-[#ff9db3] text-sm font-semibold">{err}</p>}
        </form>

        <Link
          href="/dashboard"
          className="mt-10 text-sm text-white/55 hover:text-white transition-colors"
        >
          Kendi duvarını oluştur →
        </Link>
      </section>

      <footer className="relative z-10 px-6 py-5 text-xs text-white/40">FlowWall</footer>

      <style jsx>{`
        .ww-float {
          animation-name: wwfloat;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          animation-direction: alternate;
        }
        @keyframes wwfloat {
          from {
            transform: translateY(0) rotate(-4deg);
          }
          to {
            transform: translateY(-26px) rotate(4deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ww-float {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
