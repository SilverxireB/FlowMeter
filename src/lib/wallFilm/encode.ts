/**
 * Anı Filmi encode boru hattı.
 *  A2 (tercih): WebCodecs VideoEncoder(H.264)+AudioEncoder(AAC) → mp4-muxer → MP4.
 *               Native encoder = hızlı + profesyonel; kredi/sunucu yok (tamamen lokal).
 *  A1 (yedek):  WebCodecs yoksa MediaRecorder → WebM (gerçek zamanlı kayıt).
 *
 * WebCodecs tipleri bazı TS lib sürümlerinde eksik olabildiğinden global
 * yapıcılara gevşek (any) erişilir — çalışma zamanı özellik tespiti esas.
 */
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { FilmScene } from "./timeline";
import { Palette, renderFrame } from "./render";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EncodeResult {
  blob: Blob;
  ext: "mp4" | "webm";
  mime: string;
}

export interface EncodeInput {
  scenes: FilmScene[];
  totalMs: number;
  W: number;
  H: number;
  fps: number;
  pal: Palette;
  images: Map<string, HTMLImageElement | null>;
  bg: HTMLImageElement | null;
  audio: AudioBuffer | null;
  onProgress?: (pct: number) => void;
}

const AVC_CANDIDATES = ["avc1.640028", "avc1.4d0028", "avc1.42e028"]; // High/Main/Baseline 4.0

async function pickAvcCodec(W: number, H: number, fps: number, bitrate: number): Promise<string | null> {
  const VE: any = (globalThis as any).VideoEncoder;
  if (!VE?.isConfigSupported) return null;
  for (const codec of AVC_CANDIDATES) {
    try {
      const sup = await VE.isConfigSupported({ codec, width: W, height: H, framerate: fps, bitrate });
      if (sup?.supported) return codec;
    } catch {
      /* dene */
    }
  }
  return null;
}

export async function canEncodeMp4(): Promise<boolean> {
  const hasV = !!(globalThis as any).VideoEncoder && !!(globalThis as any).VideoFrame;
  const hasA = !!(globalThis as any).AudioEncoder && !!(globalThis as any).AudioData;
  return hasV && hasA;
}

function waitQueue(encoder: any, max: number): Promise<void> {
  return new Promise((res) => {
    const tick = () => (encoder.encodeQueueSize > max ? setTimeout(tick, 8) : res());
    tick();
  });
}

/** A2 — WebCodecs → MP4. Desteklenmezse null döner (çağıran yedeğe düşer). */
async function encodeMp4(input: EncodeInput, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<EncodeResult | null> {
  const { scenes, totalMs, W, H, fps, pal, images, bg, audio, onProgress } = input;
  const bitrate = Math.round(W * H * fps * 0.07); // ~ görsel kaliteye göre ölçekli
  const codec = await pickAvcCodec(W, H, fps, bitrate);
  if (!codec) return null;

  const sampleRate = audio?.sampleRate ?? 48000;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H },
    audio: audio ? { codec: "aac", sampleRate, numberOfChannels: 2 } : undefined,
    fastStart: "in-memory",
  });

  const VideoEncoderC: any = (globalThis as any).VideoEncoder;
  const VideoFrameC: any = (globalThis as any).VideoFrame;
  let encErr: any = null;
  const videoEncoder = new VideoEncoderC({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => (encErr = e),
  });
  videoEncoder.configure({ codec, width: W, height: H, framerate: fps, bitrate });

  const totalFrames = Math.max(1, Math.ceil((totalMs / 1000) * fps));
  const frameDur = Math.round(1e6 / fps);
  for (let i = 0; i < totalFrames; i++) {
    if (encErr) throw encErr;
    const t = (i / fps) * 1000;
    renderFrame(ctx, scenes, totalMs, t, W, H, pal, images, bg);
    const frame = new VideoFrameC(canvas, { timestamp: i * frameDur, duration: frameDur });
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    if (videoEncoder.encodeQueueSize > 8) await waitQueue(videoEncoder, 4);
    if (onProgress && i % 5 === 0) onProgress(Math.round((i / totalFrames) * 92));
  }
  await videoEncoder.flush();

  if (audio) {
    const AudioDataC: any = (globalThis as any).AudioData;
    const AudioEncoderC: any = (globalThis as any).AudioEncoder;
    const audioEncoder = new AudioEncoderC({
      output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
      error: (e: any) => (encErr = e),
    });
    audioEncoder.configure({ codec: "mp4a.40.2", sampleRate, numberOfChannels: 2, bitrate: 128000 });
    const ch0 = audio.getChannelData(0);
    const ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : ch0;
    const CHUNK = 4096;
    for (let off = 0; off < audio.length; off += CHUNK) {
      if (encErr) throw encErr;
      const n = Math.min(CHUNK, audio.length - off);
      const data = new Float32Array(n * 2);
      data.set(ch0.subarray(off, off + n), 0);
      data.set(ch1.subarray(off, off + n), n);
      const ad = new AudioDataC({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: n,
        numberOfChannels: 2,
        timestamp: Math.round((off / sampleRate) * 1e6),
        data,
      });
      audioEncoder.encode(ad);
      ad.close();
    }
    await audioEncoder.flush();
  }

  if (encErr) throw encErr;
  muxer.finalize();
  onProgress?.(100);
  const buf = (muxer.target as ArrayBufferTarget).buffer;
  return { blob: new Blob([buf], { type: "video/mp4" }), ext: "mp4", mime: "video/mp4" };
}

/** A1 — MediaRecorder → WebM (gerçek zamanlı). WebCodecs yoksa yedek. */
function encodeWebm(
  input: EncodeInput,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  liveCtx: AudioContext | null
): Promise<EncodeResult | null> {
  return new Promise((resolve) => {
    const { scenes, totalMs, W, H, fps, pal, images, bg, audio, onProgress } = input;
    if (typeof (window as any).MediaRecorder === "undefined" || !canvas.captureStream) {
      resolve(null);
      return;
    }
    const stream: MediaStream = canvas.captureStream(fps);
    let srcNode: AudioBufferSourceNode | null = null;
    if (audio && liveCtx) {
      const dest = liveCtx.createMediaStreamDestination();
      srcNode = liveCtx.createBufferSource();
      srcNode.buffer = audio;
      srcNode.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) =>
      (window as any).MediaRecorder.isTypeSupported?.(m)
    ) || "video/webm";
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.round(W * H * fps * 0.08) });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => resolve({ blob: new Blob(chunks, { type: "video/webm" }), ext: "webm", mime: "video/webm" });

    const start = performance.now();
    rec.start();
    srcNode?.start();
    const loop = () => {
      const t = performance.now() - start;
      renderFrame(ctx, scenes, totalMs, Math.min(t, totalMs), W, H, pal, images, bg);
      onProgress?.(Math.min(99, Math.round((t / totalMs) * 100)));
      if (t < totalMs) {
        requestAnimationFrame(loop);
      } else {
        srcNode?.stop();
        rec.stop();
      }
    };
    requestAnimationFrame(loop);
  });
}

/** Filmi encode eder: önce MP4 (WebCodecs), olmazsa WebM (MediaRecorder). */
export async function encodeFilm(input: EncodeInput, liveCtx: AudioContext | null): Promise<EncodeResult> {
  const canvas = document.createElement("canvas");
  canvas.width = input.W;
  canvas.height = input.H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas desteklenmiyor.");

  if (await canEncodeMp4()) {
    try {
      const mp4 = await encodeMp4(input, canvas, ctx);
      if (mp4) return mp4;
    } catch {
      /* WebCodecs patlarsa WebM'e düş */
    }
  }
  const webm = await encodeWebm(input, canvas, ctx, liveCtx);
  if (webm) return webm;
  throw new Error("Bu tarayıcı video oluşturmayı desteklemiyor. Masaüstü Chrome/Edge deneyin.");
}
