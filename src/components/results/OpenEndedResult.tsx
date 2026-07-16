"use client";

import { ResponseDoc } from "@/lib/types";

/** Açık uçlu cevaplar — en yeniler önde, yapışkan not görünümlü kartlar. */
export default function OpenEndedResult({ responses }: { responses: ResponseDoc[] }) {
  const sorted = [...responses].sort(
    (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-3 animate-pulse" aria-hidden>💬</p>
        <p className="text-muted text-lg">Cevaplar bekleniyor…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[26rem] overflow-y-auto pr-1">
        {sorted.map((r, i) => (
          <blockquote
            key={r.id}
            className="bg-paper rounded-2xl p-5 border-t-4"
            style={{ borderTopColor: `var(--series-${(i % 8) + 1})` }}
          >
            <p className="text-ink/90 break-words leading-relaxed font-medium">
              {String(r.value)}
            </p>
          </blockquote>
        ))}
      </div>
      <p className="text-muted text-sm font-semibold mt-4 tabular-nums">{sorted.length} cevap</p>
    </div>
  );
}
