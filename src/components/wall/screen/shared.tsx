"use client";

/**
 * Perde modları ortak parçaları — küçük UI bileşenleri + saf yardımcılar + global
 * chrome (boş durum, "yeni anı" rozeti, animasyon stilleri). Modlar bunları paylaşır.
 */
import { useEffect, useRef, useState } from "react";
import { cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";

export function mediaPoster(m: WallMedia, w = 500, h = 500): string {
  return m.type === "video" ? cldVideoPoster(m.url, w, h) : cldThumb(m.url, w, h);
}

export function splitStrips(media: WallMedia[]): { left: WallMedia[]; right: WallMedia[] } {
  const recent = [...media].reverse().slice(0, 24);
  const left: WallMedia[] = [];
  const right: WallMedia[] = [];
  recent.forEach((m, i) => (i % 2 === 0 ? left : right).push(m));
  return { left, right };
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

/** Beğeni pili — perdede yalnız gösterim (>0 ise). */
export function LikePill({ likes, large }: { likes?: number; large?: boolean }) {
  if (!likes || likes <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-black/45 text-white font-bold backdrop-blur tabular-nums shadow ${
        large ? "text-base px-3 py-1" : "text-xs px-2 py-0.5"
      }`}
    >
      <span className="ww-heart" aria-hidden>❤</span>
      {likes}
    </span>
  );
}

/** "En sevilen" altın kurdele. */
export function LovedRibbon() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold text-[#3a2a00] shadow-lg ww-glow"
      style={{ background: "linear-gradient(135deg,#ffe27a,#f6b73c)" }}>
      👑 En sevilen
    </span>
  );
}

export function EmptyState({ mutedClass }: { mutedClass: string }) {
  return (
    <div className="h-full grid place-items-center">
      <div className="text-center">
        <div className="text-7xl mb-6 ww-pulse" aria-hidden>📷</div>
        <p className="text-3xl font-bold mb-2">İlk anı sen paylaş</p>
        <p className={`text-lg ${mutedClass}`}>QR&apos;ı okut, fotoğrafını yükle — birazdan burada parlayacak.</p>
      </div>
    </div>
  );
}

/** ✨ Yeni anı — global rozet; yeni medya gelince ~5 sn görünür (TÜM modlarda). */
export function WallNewMemory({ media }: { media: WallMedia[] }) {
  const [show, setShow] = useState<WallMedia | null>(null);
  const known = useRef<Set<string>>(new Set());
  useEffect(() => {
    let newest: WallMedia | null = null;
    for (const m of media) if (!known.current.has(m.id)) newest = m;
    const first = known.current.size === 0;
    known.current = new Set(media.map((m) => m.id));
    if (first || !newest) return;
    setShow(newest);
    const t = window.setTimeout(() => setShow(null), 5000);
    return () => window.clearTimeout(t);
  }, [media]);

  if (!show) return null;
  const poster = mediaPoster(show, 120, 120);
  return (
    <div className="absolute top-[4.25rem] left-5 z-40 ww-pop pointer-events-none">
      <div className="flex items-center gap-2.5 rounded-full bg-[#e34948] text-white pl-2 pr-4 py-1.5 shadow-2xl">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white/40" />
        )}
        <span className="text-sm font-bold">✨ Yeni anı{show.nickname ? ` · ${show.nickname}` : ""}</span>
      </div>
    </div>
  );
}

/** Tüm perde modlarının paylaştığı animasyon sınıfları (global). */
export function WallStyles() {
  return (
    <style jsx global>{`
      .ww-fade { animation: wwfade 1s ease-out; }
      @keyframes wwfade { from { opacity: 0; } to { opacity: 1; } }
      .ww-pulse { animation: wwpulse 2.4s ease-in-out infinite; }
      @keyframes wwpulse { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.08); opacity: 1; } }
      .ww-pop { animation: wwpop 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes wwpop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      .ww-ken { animation: wwken 8s ease-out both; }
      @keyframes wwken { from { transform: scale(1.02); } to { transform: scale(1.13) translate(1.5%, -1.5%); } }
      .ww-ken-slow { animation: wwkenslow 9s ease-out both; }
      @keyframes wwkenslow { from { transform: scale(1.04); } to { transform: scale(1.14) translate(-1.5%, 1.5%); } }
      .ww-marquee { animation-name: wwmarquee; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes wwmarquee { from { transform: translateY(0); } to { transform: translateY(-50%); } }
      .ww-marquee-x { animation-name: wwmarqueex; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes wwmarqueex { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .ww-spot { animation: wwspot 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes wwspot { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      .ww-heart { animation: wwheart 1.6s ease-in-out infinite; display: inline-block; }
      @keyframes wwheart { 0%,100% { transform: scale(1); } 30% { transform: scale(1.25); } }
      .ww-glow { animation: wwglow 2s ease-in-out infinite; }
      @keyframes wwglow { 0%,100% { filter: drop-shadow(0 0 3px rgba(246,183,60,0.5)); } 50% { filter: drop-shadow(0 0 12px rgba(246,183,60,0.9)); } }
      .ww-drop { animation: wwdrop 0.9s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes wwdrop { from { opacity: 0; transform: translateY(-40px) rotate(0deg) scale(1.1); } }
      .ww-float { animation: wwfloat 7s ease-in-out infinite; }
      @keyframes wwfloat { 0%,100% { transform: translateY(0) rotate(var(--r,0)); } 50% { transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) {
        .ww-fade, .ww-pulse, .ww-ken, .ww-ken-slow, .ww-pop, .ww-marquee, .ww-marquee-x, .ww-spot, .ww-heart, .ww-glow, .ww-drop, .ww-float { animation: none !important; }
      }
    `}</style>
  );
}
