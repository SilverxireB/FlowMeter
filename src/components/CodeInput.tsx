"use client";

/**
 * 6 haneli katılım kodu alanı (çekirdek). Haneler AYRI kutular olarak çizilir:
 * tek geniş kutuda harf aralığıyla yazılan rakamlar kayıyor, imleç nerede belli
 * olmuyor ve "kaç hane kaldı" görünmüyordu.
 *
 * Girdi hâlâ TEK gerçek input (kutuların üstünde şeffaf durur) — klavye,
 * yapıştırma ve telefonun SMS/otomatik doldurma davranışı bozulmasın diye.
 * Aydınlık (Meter/çatı) ve koyu (Wall) yüzeylerde aynı bileşen kullanılır.
 */
import { useRef, useState } from "react";

export default function CodeInput({
  value,
  onChange,
  tone = "light",
  autoFocus = true,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  tone?: "light" | "dark";
  autoFocus?: boolean;
  length?: number;
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const dark = tone === "dark";

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        aria-label="Katılım kodu"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className={`grid gap-1.5 sm:gap-2`} style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden>
        {Array.from({ length }).map((_, i) => {
          const ch = value[i];
          const active = focused && value.length === i;
          return (
            <div
              key={i}
              className={`aspect-[3/4] rounded-2xl border-2 grid place-items-center font-display text-3xl sm:text-4xl font-bold tabular-nums transition-all duration-150 ${
                dark
                  ? active
                    ? "border-white/70 bg-white/15"
                    : ch
                    ? "border-white/30 bg-white/10"
                    : "border-white/15 bg-white/5"
                  : active
                  ? "border-accent bg-white shadow-[0_0_0_4px_rgba(79,70,229,0.12)]"
                  : ch
                  ? "border-ink/15 bg-white"
                  : "border-line bg-white/70"
              }`}
            >
              {ch ?? (active ? <span className={`w-0.5 h-7 rounded-full animate-pulse ${dark ? "bg-white/80" : "bg-accent"}`} /> : "")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
