/**
 * Anı Filmi müziği. İki kaynak:
 *  1. Yerleşik "mood"lar — WebAudio ile sentezlenir (dosya/telif YOK, kutudan çalışır).
 *  2. Telifsiz mp3 dosyaları — `public/music/manifest.json` ile eklenir (proje sahibi
 *     kendi telifsiz parçalarını koyar; kod değişmeden seçeneğe düşer) + "kendi müziğim"
 *     yükleme (moderatör kendi ses dosyasını seçer).
 *
 * Hepsi tek biçime indirgenir: film süresinde, fade in/out'lu bir AudioBuffer.
 * Aynı buffer hem canlı önizlemede hem MP4 encode'unda kullanılır.
 */

export interface MusicTrack {
  id: string;
  label: string;
  kind: "none" | "synth" | "file" | "custom";
  file?: string; // kind:"file" için /music/... yolu
}

export const BUILTIN_TRACKS: MusicTrack[] = [
  { id: "none", label: "Müziksiz", kind: "none" },
  { id: "warm", label: "Sıcak", kind: "synth" },
  { id: "joy", label: "Neşeli", kind: "synth" },
  { id: "tender", label: "Duygusal", kind: "synth" },
];

// Mood tanımları — yumuşak akorlar (Hz), sakin tempo.
const MOODS: Record<string, { tempo: number; chords: number[][] }> = {
  warm: {
    tempo: 3.2,
    chords: [
      [261.63, 329.63, 392.0], // C
      [220.0, 277.18, 329.63], // Am
      [349.23, 440.0, 523.25], // F
      [392.0, 493.88, 587.33], // G
    ],
  },
  joy: {
    tempo: 2.4,
    chords: [
      [293.66, 369.99, 440.0], // D
      [392.0, 493.88, 587.33], // G
      [329.63, 415.3, 493.88], // E-ish
      [440.0, 554.37, 659.25], // A
    ],
  },
  tender: {
    tempo: 3.8,
    chords: [
      [220.0, 261.63, 329.63], // Am
      [349.23, 440.0, 523.25], // F
      [261.63, 329.63, 392.0], // C
      [392.0, 493.88, 587.33], // G
    ],
  },
};

let liveCtx: AudioContext | null = null;
export function getLiveAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!liveCtx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      liveCtx = new AC();
    }
    if (liveCtx.state === "suspended") liveCtx.resume().catch(() => {});
    return liveCtx;
  } catch {
    return null;
  }
}

function OfflineCtor(): typeof OfflineAudioContext | null {
  if (typeof window === "undefined") return null;
  return window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext ?? null;
}

/** İsteğe bağlı telifsiz mp3'ler: public/music/manifest.json → [{id,label,file}]. */
export async function loadMusicManifest(): Promise<MusicTrack[]> {
  try {
    const res = await fetch("/music/manifest.json", { cache: "no-store" });
    if (!res.ok) return [];
    const arr = (await res.json()) as { id: string; label: string; file: string }[];
    return arr
      .filter((t) => t.id && t.label && t.file)
      .map((t) => ({ id: `file:${t.id}`, label: t.label, kind: "file" as const, file: t.file }));
  } catch {
    return [];
  }
}

function padNote(ctx: BaseAudioContext, dest: AudioNode, freq: number, at: number, dur: number, gainVal: number, type: OscillatorType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(gainVal, at + dur * 0.25);
  gain.gain.linearRampToValueAtTime(gainVal * 0.7, at + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function renderSynth(mood: string, durSec: number, sr: number): Promise<AudioBuffer | null> {
  const OAC = OfflineCtor();
  const prog = MOODS[mood];
  if (!OAC || !prog) return Promise.resolve(null);
  const oac = new OAC(2, Math.ceil(durSec * sr), sr);
  const master = oac.createGain();
  master.connect(oac.destination);
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.5, 1.4);
  master.gain.setValueAtTime(0.5, Math.max(1.4, durSec - 1.8));
  master.gain.linearRampToValueAtTime(0, durSec);

  const cd = prog.tempo;
  let t = 0;
  let i = 0;
  while (t < durSec) {
    const chord = prog.chords[i % prog.chords.length];
    // yumuşak pad
    chord.forEach((f) => padNote(oac, master, f, t, cd, 0.05, "sine"));
    // hafif üst arpej pırıltısı
    chord.forEach((f, k) => padNote(oac, master, f * 2, t + (k * cd) / chord.length, cd / chord.length, 0.022, "triangle"));
    t += cd;
    i++;
  }
  return oac.startRendering().catch(() => null);
}

/** Kaynağı film süresine uydur: döngüle/kırp + fade in/out (dosya ve custom için). */
async function fitBuffer(src: AudioBuffer, durSec: number, sr: number): Promise<AudioBuffer | null> {
  const OAC = OfflineCtor();
  if (!OAC) return null;
  const oac = new OAC(2, Math.ceil(durSec * sr), sr);
  const source = oac.createBufferSource();
  source.buffer = src;
  source.loop = src.duration < durSec;
  const gain = oac.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(0.85, 1.2);
  gain.gain.setValueAtTime(0.85, Math.max(1.2, durSec - 1.6));
  gain.gain.linearRampToValueAtTime(0, durSec);
  source.connect(gain).connect(oac.destination);
  source.start(0);
  return oac.startRendering().catch(() => null);
}

async function decodeUrl(url: string, sr: number): Promise<AudioBuffer | null> {
  const OAC = OfflineCtor();
  if (!OAC) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const tmp = new OAC(2, sr, sr);
    return await tmp.decodeAudioData(arr);
  } catch {
    return null;
  }
}

export async function decodeFile(file: File, sr: number): Promise<AudioBuffer | null> {
  const OAC = OfflineCtor();
  if (!OAC) return null;
  try {
    const arr = await file.arrayBuffer();
    const tmp = new OAC(2, sr, sr);
    return await tmp.decodeAudioData(arr);
  } catch {
    return null;
  }
}

/**
 * Film için müzik buffer'ı üretir (film süresinde, fade'li). none → null.
 * custom track için `customBuffer` verilir (moderatörün yüklediği ses).
 */
export async function getMusicBuffer(
  track: MusicTrack,
  durSec: number,
  sr: number,
  customBuffer?: AudioBuffer | null
): Promise<AudioBuffer | null> {
  if (track.kind === "none") return null;
  if (track.kind === "synth") return renderSynth(track.id, durSec, sr);
  if (track.kind === "custom") return customBuffer ? fitBuffer(customBuffer, durSec, sr) : null;
  if (track.kind === "file" && track.file) {
    const decoded = await decodeUrl(track.file, sr);
    return decoded ? fitBuffer(decoded, durSec, sr) : null;
  }
  return null;
}
