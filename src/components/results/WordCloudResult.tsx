"use client";

import { useMemo } from "react";
import { ResponseDoc } from "@/lib/types";

/**
 * Kelime bulutu: tekrar eden kelimeler büyür. En popüler kelimeler ortada
 * kalacak şekilde sıra karıştırılır; renk kelime hash'ine göre sabittir
 * (yeni oy gelince renkler kaymaz). Boyut karekök ölçekli — tek oyluk
 * kelimeler ezilmez.
 */
export default function WordCloudResult({ responses }: { responses: ResponseDoc[] }) {
  const words = useMemo(() => {
    const freq = new Map<string, number>();
    for (const r of responses) {
      const w = String(r.value).trim();
      if (!w) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
    // Büyükler ortada: sıralı listeyi ortadan dışa doğru diz
    const arranged: [string, number][] = [];
    sorted.forEach((entry, i) => {
      if (i % 2 === 0) arranged.push(entry);
      else arranged.unshift(entry);
    });
    return { arranged, max: sorted[0]?.[1] ?? 1 };
  }, [responses]);

  if (words.arranged.length === 0) {
    return (
      <div className="text-center">
        <p className="text-4xl mb-3 animate-pulse" aria-hidden>💭</p>
        <p className="text-muted text-lg">Cevaplar bekleniyor…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1 leading-snug max-w-3xl">
      {words.arranged.map(([word, count]) => {
        const scale = Math.sqrt(count / words.max); // 0..1
        const size = 1.1 + scale * 2.9; // 1.1rem → 4rem
        const hash = [...word].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
        return (
          <span
            key={word}
            title={`${word}: ${count}`}
            className="font-display transition-all duration-500"
            style={{
              fontSize: `${size}rem`,
              fontWeight: count === words.max ? 600 : 500,
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
