"use client";

import type { ReactNode } from "react";

/**
 * Dashboard hub açılışı — Flow Studio imza animasyonu.
 * Dört yay (marka renkleri) kendini çizerek açılır, sonra tüm halka çok yavaş
 * döner; ortada dört ürünün glifi (bar-chart → kamera → totem → EKG) sırayla
 * nefes alır. "Dört ürün, tek halka" fikrinin kendisi animasyondur.
 * Saf CSS (JS zamanlayıcı yok); prefers-reduced-motion'da durağan tek kare.
 */

const NAVY = "#001e64";

// O-glifleri: 120×120 viewBox, merkez (60,60) — hepsi aynı sahnede üst üste,
// CSS keyframe %25'lik dilimlerle sırayla görünür.
const GLYPHS: { key: string; el: ReactNode }[] = [
  {
    key: "meter",
    el: (
      <g fill={NAVY}>
        <rect x="48" y="62" width="6" height="12" rx="2" />
        <rect x="57" y="52" width="6" height="22" rx="2" />
        <rect x="66" y="57" width="6" height="17" rx="2" />
      </g>
    ),
  },
  {
    key: "wall",
    el: (
      <g fill={NAVY}>
        <rect x="44" y="52" width="32" height="22" rx="5" />
        <circle cx="60" cy="63" r="6.5" fill="#fff" />
        <circle cx="60" cy="63" r="3.5" fill={NAVY} />
        <rect x="52" y="48" width="10" height="6" rx="2" />
      </g>
    ),
  },
  {
    key: "sign",
    el: (
      <g fill={NAVY}>
        <path
          fillRule="evenodd"
          d="M50 44h20a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H50a4 4 0 0 1-4-4V48a4 4 0 0 1 4-4Zm2.5 4.5a1.8 1.8 0 0 0-1.8 1.8v19.4a1.8 1.8 0 0 0 1.8 1.8h15a1.8 1.8 0 0 0 1.8-1.8V50.3a1.8 1.8 0 0 0-1.8-1.8h-15Z"
        />
        <rect x="53" y="51" width="14" height="10" rx="1.5" />
        <rect x="53" y="64" width="14" height="2.6" rx="1.3" />
        <rect x="53" y="68.4" width="9" height="2.6" rx="1.3" />
        <rect x="47" y="78" width="26" height="3.4" rx="1.7" />
      </g>
    ),
  },
  {
    key: "pulse",
    el: (
      <path
        d="M42 62h9l4-10 8 20 5-14 3 4h9"
        fill="none"
        stroke={NAVY}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

// Yaylar logodaki dört renk/duruşu izler: dış mavi (üst) + kırmızı (alt),
// iç yeşil (sağ üst) + turuncu (sol alt). pathLength=100 → çizim animasyonu.
function arc(r: number, startDeg: number, endDeg: number): string {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = 60 + r * Math.cos(rad(startDeg));
  const y1 = 60 + r * Math.sin(rad(startDeg));
  const x2 = 60 + r * Math.cos(rad(endDeg));
  const y2 = 60 + r * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

const ARCS = [
  { d: arc(48, 265, 395), color: "#2094f3", w: 8, delay: "0s" }, // mavi — dış üst(sol)
  { d: arc(48, 85, 215), color: "#d62027", w: 8, delay: ".18s" }, // kırmızı — dış alt(sağ)
  { d: arc(36, 350, 480), color: "#1b7d3a", w: 7, delay: ".36s" }, // yeşil — iç sağ
  { d: arc(36, 170, 300), color: "#f0913a", w: 7, delay: ".54s" }, // turuncu — iç sol
];

export default function StudioHero() {
  return (
    <div className="flex items-center justify-between gap-6 mb-8">
      <div className="min-w-0">
        <p className="eyebrow mb-2">Flow Studio</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Ne oluşturmak istersin?
        </h1>
        <p className="text-muted text-sm mt-2">
          Dört ürün, tek hesap — sunum, duvar, tabela, nabız.
        </p>
      </div>

      <div className="shrink-0 w-28 h-28 sm:w-36 sm:h-36" aria-hidden>
        <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
          {/* Yaylar: çizilerek açılır, sonra grup hâlinde çok yavaş döner */}
          <g className="sh-ring motion-reduce:animate-none">
            {ARCS.map((a) => (
              <path
                key={a.color}
                d={a.d}
                pathLength={100}
                fill="none"
                stroke={a.color}
                strokeWidth={a.w}
                strokeLinecap="round"
                className="sh-arc"
                style={{ animationDelay: a.delay }}
              />
            ))}
          </g>
          {/* Ürün glifleri: sırayla nefes alır (12sn döngü, %25'lik dilimler) */}
          {GLYPHS.map((g, i) => (
            <g key={g.key} className={`sh-glyph${i === 0 ? " sh-glyph-first" : ""}`} style={{ animationDelay: `${i * 3}s` }}>
              {g.el}
            </g>
          ))}
        </svg>
      </div>

      <style>{`
        .sh-arc {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: sh-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .sh-ring {
          transform-origin: 60px 60px;
          animation: sh-spin 90s linear infinite;
        }
        .sh-glyph {
          opacity: 0;
          transform-origin: 60px 62px;
          animation: sh-cycle 12s ease-in-out infinite;
        }
        @keyframes sh-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes sh-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes sh-cycle {
          0%, 3% { opacity: 0; transform: scale(0.85); }
          7%, 22% { opacity: 1; transform: scale(1); }
          26%, 100% { opacity: 0; transform: scale(0.92); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sh-arc { animation: none; stroke-dashoffset: 0; }
          .sh-ring { animation: none; }
          .sh-glyph { animation: none; }
          .sh-glyph-first { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
