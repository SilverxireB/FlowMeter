"use client";

/**
 * Anı Filmi — PERDE oynatıcı. Kokpit tetikleyince duvarın highlight filmini büyük
 * ekranda canlı oynatır (indirme yok; C yolu — aynı render motoru). Bitince onEnd.
 * Yatay 1920×1080 render, ekrana object-contain sığar. Müzik perdede çalar
 * (autoplay engellenirse sessiz devam eder).
 */
import { useEffect, useRef, useState } from "react";
import { Wall, WallMedia, WallWish } from "@/lib/types";
import { buildTimeline, FilmLength } from "@/lib/wallFilm/timeline";
import { filmColors, photoSrc, preloadImage, renderFrame } from "@/lib/wallFilm/render";
import { BUILTIN_TRACKS, getLiveAudioContext, getMusicBuffer, loadMusicManifest, MusicTrack } from "@/lib/wallFilm/music";

const W = 1920;
const H = 1080;
const LONG_EDGE = 1920;

export default function WallFilmStage({
  wall,
  media,
  wishes,
  length,
  musicId,
  onEnd,
}: {
  wall: Wall;
  media: WallMedia[];
  wishes: WallWish[];
  length: FilmLength;
  musicId: string;
  onEnd: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const endedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const built = buildTimeline(wall.headline || wall.title || "FlowWall", media, wishes, { length, fairness: true });

    async function run() {
      const ctx = canvasRef.current?.getContext("2d", { alpha: false });
      if (!ctx || built.scenes.length === 0) {
        onEnd();
        return;
      }
      // Görselleri önyükle
      const photos = built.scenes.filter((s) => s.type === "photo") as Extract<(typeof built.scenes)[number], { type: "photo" }>[];
      const entries = await Promise.all(photos.map(async (p) => [p.media.id, await preloadImage(photoSrc(p, LONG_EDGE))] as const));
      if (cancelled) return;
      const images = new Map(entries);
      const pal = filmColors(wall);

      // Müzik (custom perdede yok → none'a düşer)
      const liveCtx = getLiveAudioContext();
      if (liveCtx && musicId !== "none") {
        let track: MusicTrack | undefined = BUILTIN_TRACKS.find((t) => t.id === musicId);
        if (!track && musicId.startsWith("file:")) {
          const manifest = await loadMusicManifest();
          track = manifest.find((t) => t.id === musicId);
        }
        if (track && track.kind !== "none") {
          const buf = await getMusicBuffer(track, built.totalMs / 1000, liveCtx.sampleRate);
          if (buf && !cancelled) {
            try {
              const node = liveCtx.createBufferSource();
              node.buffer = buf;
              node.connect(liveCtx.destination);
              node.start();
              srcRef.current = node;
            } catch {
              /* autoplay engeli → sessiz oynat */
            }
          }
        }
      }
      if (cancelled) return;
      setReady(true);

      const start = performance.now();
      const loop = () => {
        const t = performance.now() - start;
        renderFrame(ctx, built.scenes, built.totalMs, Math.min(t, built.totalMs), W, H, pal, images, null);
        if (t < built.totalMs && !cancelled) {
          rafRef.current = requestAnimationFrame(loop);
        } else if (!endedRef.current) {
          endedRef.current = true;
          onEnd();
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    }

    run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      try {
        srcRef.current?.stop();
      } catch {
        /* zaten durmuş */
      }
      srcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black grid place-items-center animate-[fadeIn_0.6s_ease]">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full" style={{ aspectRatio: "16 / 9" }} />
      {!ready && <div className="absolute text-white/60 text-lg">🎬 Anı filmi hazırlanıyor…</div>}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
