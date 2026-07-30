"use client";

/**
 * Hub açılış bannerı — Flow Studio "sahne"si.
 * Koyu lacivert sahne üzerinde orkestre edilmiş tek gösteri: arkada marka
 * renklerinde süzülen ışık bulutları, altta akan hayalet marka şeridi
 * (O-ikon + kontur yazı), önde kelime kelime yükselen tek soru ve dört
 * renkte çizilip ışık süpürmesiyle parlayan imza çizgisi.
 * Saf CSS (JS zamanlayıcı yok); prefers-reduced-motion'da durağan.
 */

const TICKER = [
  { o: "/logo-o-meter-white.png", name: "METER" },
  { o: "/logo-o-wall-white.png", name: "WALL" },
  { o: "/logo-o-sign-white.png", name: "SIGN" },
  { o: "/logo-o-pulse-white.png", name: "PULSE" },
];

const WORDS = ["Bugün", "ne", "oluşturmak", "istersin?"];

export default function StudioHero() {
  // Şerit 3× tekrarlanır; animasyon -%33.33 kaydırınca dikişsiz döngü oluşur.
  const strip = [...TICKER, ...TICKER, ...TICKER];

  return (
    <div
      className="relative overflow-hidden rounded-3xl mb-8 text-white shadow-sm"
      style={{ background: "linear-gradient(150deg,#001e64 0%,#0b1030 55%,#131847 100%)" }}
    >
      {/* Ambiyans: marka renklerinde süzülen bulanık ışıklar */}
      <div aria-hidden className="fs-blob fs-blob-a" />
      <div aria-hidden className="fs-blob fs-blob-b" />
      <div aria-hidden className="fs-blob fs-blob-c" />

      {/* Tek cümle + imza çizgisi */}
      <div className="relative z-10 px-6 pt-12 pb-20 sm:pt-16 sm:pb-24 text-center">
        <h1 className="font-display font-semibold tracking-tight text-3xl sm:text-5xl leading-tight">
          {WORDS.map((w, i) => (
            <span
              key={i}
              className="inline-block overflow-hidden align-bottom mr-[0.28em] last:mr-0 pb-[0.12em] -mb-[0.12em]"
            >
              <span className="fs-word inline-block" style={{ animationDelay: `${0.15 + i * 0.13}s` }}>
                {w}
              </span>
            </span>
          ))}
        </h1>
        <div className="fs-bar mx-auto mt-6" aria-hidden>
          <span className="fs-shine" />
        </div>
      </div>

      {/* Hayalet marka şeridi: O-ikon + kontur yazı, sonsuz akış */}
      <div aria-hidden className="absolute inset-x-0 bottom-4 overflow-hidden">
        <div className="fs-ticker flex items-center gap-12 w-max pl-4">
          {strip.map((t, i) => (
            <span key={i} className="flex items-center gap-3 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.o} alt="" className="h-6 w-auto opacity-60" />
              <span className="fs-ghost text-2xl font-bold tracking-[0.25em]">{t.name}</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        .fs-word {
          transform: translateY(130%);
          animation: fs-word 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fs-word { to { transform: translateY(0); } }

        .fs-bar {
          position: relative;
          overflow: hidden;
          width: 190px;
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, #2094f3, #1b7d3a, #f0913a, #d62027);
          transform: scaleX(0);
          transform-origin: center;
          animation: fs-bar 0.9s 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fs-bar { to { transform: scaleX(1); } }

        .fs-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent);
          transform: translateX(-100%);
          animation: fs-shine 3.6s 2s ease-in-out infinite;
        }
        @keyframes fs-shine {
          0% { transform: translateX(-100%); }
          40%, 100% { transform: translateX(100%); }
        }

        .fs-ticker { animation: fs-ticker 36s linear infinite; }
        @keyframes fs-ticker { to { transform: translateX(-33.3333%); } }

        .fs-ghost {
          color: transparent;
          -webkit-text-stroke: 1px rgba(255, 255, 255, 0.3);
        }

        .fs-blob {
          position: absolute;
          width: 360px;
          height: 360px;
          border-radius: 9999px;
          filter: blur(80px);
        }
        .fs-blob-a { background: #2094f3; opacity: 0.33; top: -140px; left: -90px;
          animation: fs-float-a 16s ease-in-out infinite alternate; }
        .fs-blob-b { background: #d62027; opacity: 0.22; bottom: -170px; right: -80px;
          animation: fs-float-b 20s ease-in-out infinite alternate; }
        .fs-blob-c { background: #f0913a; opacity: 0.16; top: -100px; right: 20%;
          animation: fs-float-c 24s ease-in-out infinite alternate; }
        @keyframes fs-float-a { to { transform: translate(70px, 50px) scale(1.15); } }
        @keyframes fs-float-b { to { transform: translate(-80px, -40px) scale(1.1); } }
        @keyframes fs-float-c { to { transform: translate(-60px, 60px) scale(1.2); } }

        @media (prefers-reduced-motion: reduce) {
          .fs-word { animation: none; transform: none; }
          .fs-bar { animation: none; transform: none; }
          .fs-shine { display: none; }
          .fs-ticker { animation: none; }
          .fs-blob { animation: none; }
        }
      `}</style>
    </div>
  );
}
