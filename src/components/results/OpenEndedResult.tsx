"use client";

import { ResponseDoc } from "@/lib/types";

/** Açık uçlu cevaplar — en yeniler önde, kart ızgarası. */
export default function OpenEndedResult({ responses }: { responses: ResponseDoc[] }) {
  const sorted = [...responses].sort(
    (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
  );

  if (sorted.length === 0) {
    return <p className="text-muted text-center text-lg">Cevaplar bekleniyor…</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[24rem] overflow-y-auto pr-1">
        {sorted.map((r, i) => (
          <div
            key={r.id}
            className="bg-paper border border-line rounded-xl p-4 border-l-4"
            style={{ borderLeftColor: `var(--series-${(i % 8) + 1})` }}
          >
            <p className="text-ink break-words">{String(r.value)}</p>
          </div>
        ))}
      </div>
      <p className="text-muted text-sm mt-3">{sorted.length} cevap</p>
    </div>
  );
}
