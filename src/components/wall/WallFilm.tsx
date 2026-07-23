"use client";

/**
 * Anı Filmi — kokpit paneli. Duvarın onaylı foto/dileklerinden müzikli, geçişli
 * bir highlight video üretir. Tek canvas motoru (render.ts) hem canlı önizlemeyi
 * hem MP4 encode'unu besler. Ayarlar az ama kritik: yön, uzunluk, müzik.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wall, WallMedia, WallWish } from "@/lib/types";
import { compressImage } from "@/lib/images";
import { buildTimeline, FilmLength, FilmOrientation } from "@/lib/wallFilm/timeline";
import { filmColors, photoSrc, preloadImage, renderFrame } from "@/lib/wallFilm/render";
import { BUILTIN_TRACKS, MusicTrack, decodeFile, getLiveAudioContext, getMusicBuffer, loadMusicManifest } from "@/lib/wallFilm/music";
import { encodeFilm } from "@/lib/wallFilm/encode";
import { startWallFilm, stopWallFilm } from "@/lib/walls";

const DIMS = { portrait: { W: 1080, H: 1920 }, landscape: { W: 1920, H: 1080 } };
const FPS = 30;
const LONG_EDGE = 1920;

const LEN_LABEL: Record<FilmLength, string> = { short: "Kısa ~1 dk", medium: "Orta ~2 dk", long: "Uzun ~3 dk" };

export default function WallFilm({ wall, media, wishes }: { wall: Wall; media: WallMedia[]; wishes: WallWish[] }) {
  const [length, setLength] = useState<FilmLength>("medium");
  const [orientation, setOrientation] = useState<FilmOrientation>("portrait");
  const [tracks, setTracks] = useState<MusicTrack[]>(BUILTIN_TRACKS);
  const [musicId, setMusicId] = useState("warm");
  const [customBuffer, setCustomBuffer] = useState<AudioBuffer | null>(null);
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const imgCache = useRef<{ sig: string; map: Map<string, HTMLImageElement | null> } | null>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMusicManifest().then((extra) => {
      // Telifsiz mp3'ler varsa sentez (dosyasız) varsayılanları gizle → tek temiz
      // liste (Müziksiz + gerçek parçalar). Yoksa sentez mood'ları kalır.
      if (extra.length) {
        setTracks([BUILTIN_TRACKS[0], ...extra]);
        setMusicId(extra[0].id);
      }
    });
  }, []);

  const { W, H } = DIMS[orientation];
  const pal = useMemo(() => filmColors(wall), [wall]);
  const built = useMemo(
    () => buildTimeline(wall.headline || wall.title || "FlowWall", media, wishes, { length, fairness: true }),
    [wall.headline, wall.title, media, wishes, length]
  );
  const approvedCount = built.totalApproved;
  const track = tracks.find((t) => t.id === musicId) ?? tracks[0];

  const stopPreview = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try {
      srcRef.current?.stop();
    } catch {
      /* zaten durmuş olabilir */
    }
    srcRef.current = null;
    setPreviewing(false);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);
  // Yön/uzunluk değişince önizlemeyi durdur (timeline değişti)
  useEffect(() => {
    stopPreview();
  }, [orientation, length, stopPreview]);

  /** Foto görsellerini CORS-temiz önyükle (encode + önizleme paylaşır). */
  const ensureImages = useCallback(async (): Promise<Map<string, HTMLImageElement | null>> => {
    const photos = built.scenes.filter((s) => s.type === "photo") as Extract<(typeof built.scenes)[number], { type: "photo" }>[];
    const sig = orientation + "|" + photos.map((p) => p.media.id).join(",");
    if (imgCache.current?.sig === sig) return imgCache.current.map;
    const entries = await Promise.all(
      photos.map(async (p) => [p.media.id, await preloadImage(photoSrc(p, LONG_EDGE))] as const)
    );
    const map = new Map(entries);
    imgCache.current = { sig, map };
    return map;
  }, [built.scenes, orientation]);

  async function togglePreview() {
    if (previewing) {
      stopPreview();
      return;
    }
    setMsg(null);
    setBusy(true);
    try {
      const images = await ensureImages();
      const ctx = canvasRef.current?.getContext("2d", { alpha: false });
      if (!ctx) return;
      const liveCtx = getLiveAudioContext();
      let srcNode: AudioBufferSourceNode | null = null;
      if (liveCtx && track.kind !== "none") {
        const buf = await getMusicBuffer(track, built.totalMs / 1000, liveCtx.sampleRate, customBuffer);
        if (buf) {
          srcNode = liveCtx.createBufferSource();
          srcNode.buffer = buf;
          srcNode.connect(liveCtx.destination);
        }
      }
      setBusy(false);
      setPreviewing(true);
      const start = performance.now();
      srcNode?.start();
      srcRef.current = srcNode;
      const loop = () => {
        const t = performance.now() - start;
        renderFrame(ctx, built.scenes, built.totalMs, Math.min(t, built.totalMs), W, H, pal, images, bg);
        if (t < built.totalMs) {
          rafRef.current = requestAnimationFrame(loop);
        } else {
          stopPreview();
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setBusy(false);
      setMsg("Önizleme başlatılamadı.");
    }
  }

  async function generate() {
    if (busy) return;
    stopPreview();
    setBusy(true);
    setPct(0);
    setMsg("Görseller hazırlanıyor…");
    try {
      const images = await ensureImages();
      const liveCtx = getLiveAudioContext();
      const sr = liveCtx?.sampleRate ?? 48000;
      const audio = track.kind === "none" ? null : await getMusicBuffer(track, built.totalMs / 1000, sr, customBuffer);
      setMsg("Film oluşturuluyor…");
      const result = await encodeFilm(
        { scenes: built.scenes, totalMs: built.totalMs, W, H, fps: FPS, pal, images, bg, audio, onProgress: setPct },
        liveCtx
      );
      const file = new File([result.blob], `flowwall-ani-filmi-${wall.joinCode || "film"}.${result.ext}`, { type: result.mime });
      setMsg(null);
      // Telefonda paylaş; masaüstünde indir
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: wall.title || "Anı Filmi" });
        } catch {
          /* kullanıcı paylaşımı iptal etti → sorun değil */
        }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setMsg(result.ext === "webm" ? "İndirildi (WebM — masaüstü Chrome/Edge MP4 verir)." : "Film hazır! 🎬");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Film oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function onAudioPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const liveCtx = getLiveAudioContext();
    const buf = await decodeFile(f, liveCtx?.sampleRate ?? 48000);
    if (buf) {
      setCustomBuffer(buf);
      setTracks((prev) => (prev.some((t) => t.id === "custom") ? prev : [...prev, { id: "custom", label: `Kendi müziğim: ${f.name.slice(0, 20)}`, kind: "custom" }]));
      setMusicId("custom");
    } else {
      setMsg("Ses dosyası okunamadı.");
    }
    if (audioFileRef.current) audioFileRef.current.value = "";
  }

  async function onBgPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await compressImage(f, 1920, undefined, 1_400_000);
      const img = await preloadImage(dataUrl);
      setBg(img);
    } catch {
      setMsg("Arka plan görseli işlenemedi.");
    }
    if (bgFileRef.current) bgFileRef.current.value = "";
  }

  const previewW = orientation === "portrait" ? 220 : 360;

  return (
    <div className="card p-5">
      <p className="eyebrow mb-1">🎬 Anı Filmi</p>
      <p className="text-sm text-muted mb-4">
        Duvarın en güzel anlarından müzikli, paylaşılabilir bir highlight video.
        {approvedCount > built.picked && (
          <> {approvedCount} anıdan en iyi <b>{built.picked}</b> tanesi akıllıca seçilir; tümü ZIP/hatıra kitabında.</>
        )}
      </p>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Önizleme */}
        <div className="shrink-0">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="rounded-xl bg-black border border-line"
            style={{ width: previewW, height: (previewW * H) / W, maxWidth: "100%" }}
          />
          <button onClick={togglePreview} disabled={busy && !previewing} className="btn-ghost w-full mt-2 text-sm">
            {previewing ? "⏹ Durdur" : "▶ Önizle"}
          </button>
        </div>

        {/* Ayarlar */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted">Yön</label>
            <div className="flex gap-2 mt-1">
              {(["portrait", "landscape"] as FilmOrientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${orientation === o ? "bg-accent text-white border-accent" : "border-line text-ink"}`}
                >
                  {o === "portrait" ? "📱 Dikey" : "🖥 Yatay"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted">Uzunluk</label>
            <div className="flex gap-2 mt-1">
              {(["short", "medium", "long"] as FilmLength[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLength(l)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${length === l ? "bg-accent text-white border-accent" : "border-line text-ink"}`}
                >
                  {LEN_LABEL[l]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted">Müzik</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {tracks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMusicId(t.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${musicId === t.id ? "bg-ink text-paper border-ink" : "border-line text-ink"}`}
                >
                  {t.label}
                </button>
              ))}
              <button onClick={() => audioFileRef.current?.click()} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-line text-muted">
                + Kendi müziğim
              </button>
            </div>
            <input ref={audioFileRef} type="file" accept="audio/*" onChange={onAudioPick} className="hidden" />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => bgFileRef.current?.click()} className="btn-ghost text-xs">
              {bg ? "🖼 Arka plan seçildi ✓" : "🖼 Arka plan görseli (opsiyonel)"}
            </button>
            {bg && (
              <button onClick={() => setBg(null)} className="text-xs text-brand">
                Kaldır
              </button>
            )}
            <input ref={bgFileRef} type="file" accept="image/*" onChange={onBgPick} className="hidden" />
          </div>
        </div>
      </div>

      {/* Perdede canlı oynat — indirme yerine büyük ekranda (custom müzik perdede yok) */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => startWallFilm(wall.id, length, track.kind === "custom" ? "warm" : musicId).catch(() => setMsg("Perde tetiklenemedi."))}
          disabled={approvedCount === 0}
          className="btn-accent !py-2 text-sm"
        >
          📽 Perdede oynat
        </button>
        <button onClick={() => stopWallFilm(wall.id).catch(() => {})} className="btn-ghost !py-2 text-sm">
          ⏹ Perdede durdur
        </button>
        <span className="text-xs text-muted">Açık olan perde ekranında filmi başlatır.</span>
      </div>

      <div className="mt-4">
        <button onClick={generate} disabled={busy || approvedCount === 0} className="btn-primary w-full">
          {busy ? (pct > 0 ? `Oluşturuluyor… %${pct}` : "Hazırlanıyor…") : "🎬 Filmi oluştur (indir)"}
        </button>
        {busy && pct > 0 && (
          <div className="h-1.5 rounded-full bg-line mt-2 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        {approvedCount === 0 && <p className="text-xs text-muted mt-2">Filme koyacak onaylı anı yok.</p>}
        {msg && <p className="text-sm mt-2 text-ink">{msg}</p>}
      </div>
    </div>
  );
}
