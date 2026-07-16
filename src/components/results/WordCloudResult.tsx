"use client";

import { useMemo } from "react";
import { ResponseDoc } from "@/lib/types";

/**
 * Kelime bulutu canlı sonucu: tekrar eden kelimeler büyür.
 * Font boyutu frekansla ölçeklenir; renkler kategorik paletten kelime
 * hash'ine göre sabit atanır (yeni oy geldiğinde renkler kaymaz).
 */
export default function WordCloudResult({ responses }: { responses: ResponseDoc[] }) {
  const words = useMemo(() => {
    const freq = new Map<string, number>();
    for (const r of responses) {
      const w = String(r.value).trim();
      if (!w) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  }, [responses]);

  if (words.length === 0) {
    return <p className="text-slate-400 text-center text-lg">Cevaplar bekleniyor…</p>;
  }

  const max = words[0][1];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 leading-tight">
      {words.map(([word, count]) => {
        // 1 → 1.25rem, max → 3.5rem arası ölçek
        const size = 1.25 + (count / max) * 2.25;
        const hash = [...word].reduce((h, c) => h * 31 + c.charCodeAt(0), 7);
        return (
          <span
            key={word}
            title={`${word}: ${count}`}
            className="font-semibold transition-all duration-300"
            style={{
              fontSize: `${size}rem`,
              color: `var(--series-${(Math.abs(hash) % 8) + 1})`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
