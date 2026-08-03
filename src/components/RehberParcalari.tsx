"use client";

/**
 * Rehber yapı taşları — dört ürünün rehberi de bunları kullanır.
 *
 * Çekirdekte (ürün klasörlerinde değil) durmasının sebebi: Sign ayrı paket
 * olarak satılacağı için Sign'ın rehberi Meter/Wall/Pulse'a bağ KURMAMALI.
 * Ortak olan yalnız bu biçimsel parçalar — `ConfirmDialog` gibi.
 *
 * `Dugme` bilerek ürünün GERÇEK sınıflarını kullanır: rehberde gösterilen düğme,
 * ekrandaki düğmenin aynısıdır. Tasarım değişince rehber de değişir; ekran
 * görüntüsü tutmamızın sebebi yok.
 */
import { ReactNode } from "react";
import { Icon, IconName } from "@/components/Icon";

/** Ürünün gerçek düğmesi, metnin içinde. */
export function Dugme({ children, icon, birincil }: { children?: ReactNode; icon?: IconName; birincil?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-semibold align-middle ${
        birincil ? "bg-accent text-white" : "bg-white border border-line text-ink"
      }`}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function Tus({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line border-b-2 bg-white px-1.5 py-0.5 text-xs font-bold">{children}</kbd>;
}

export function Kutu({
  tur = "not",
  baslik,
  children,
}: {
  /** ekran = "ekranda ne göreceksin", uyari = tuzak, not = yan bilgi */
  tur?: "not" | "uyari" | "ekran";
  baslik: string;
  children: ReactNode;
}) {
  const stil =
    tur === "uyari"
      ? "bg-brand-soft border-brand/25"
      : tur === "ekran"
        ? "bg-white border-line border-l-[3px] border-l-accent"
        : "bg-paper border-line";
  const renk = tur === "uyari" ? "text-brand" : tur === "ekran" ? "text-accent-dark" : "text-muted";
  return (
    <div className={`rounded-xl border p-3.5 ${stil}`}>
      <p className={`eyebrow mb-1 ${renk}`}>{baslik}</p>
      <div className="text-[14.5px] leading-relaxed text-ink/85 flex flex-col gap-2">{children}</div>
    </div>
  );
}

/** Numaralı adımlar — YALNIZ gerçekten sıralı işlerde (numara bilgi taşımalı). */
export function Adimlar({ items }: { items: { baslik: string; metin: ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((a, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 w-7 h-7 rounded-lg bg-accent text-white grid place-items-center text-[13px] font-bold tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold mb-0.5">{a.baslik}</p>
            <p className="text-ink/80">{a.metin}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Tablo({ basliklar, satirlar }: { basliklar: string[]; satirlar: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-[14px] border-collapse">
        <thead>
          <tr className="bg-accent-soft/60">
            {basliklar.map((b) => (
              <th key={b} className="text-left font-bold text-[11px] uppercase tracking-wider text-muted px-3 py-2 whitespace-nowrap">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s, i) => (
            <tr key={i} className="border-t border-line align-top">
              {s.map((h, j) => (
                <td key={j} className={`px-3 py-2.5 ${j === 0 ? "font-semibold whitespace-nowrap" : "text-ink/80"}`}>
                  {h}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Baslik({ children }: { children: ReactNode }) {
  return <p className="font-semibold text-[15px] mt-2">{children}</p>;
}
