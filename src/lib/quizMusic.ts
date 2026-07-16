/**
 * Quiz gerilim müziği — WebAudio ile sentezlenir (dosya/dış servis YOK).
 * Basit bir minör arpej döngüsü; süre azaldıkça tempo hafifçe artar hissi
 * için iki katmanlı kısa osilatör notaları çalar.
 */

let ctx: AudioContext | null = null;
let stopFlag = { stopped: true };

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function note(ac: AudioContext, freq: number, at: number, dur: number, gainVal: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(gainVal, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

// A minör arpej (A3 C4 E4 A4) + bas — Kahoot benzeri gerilim döngüsü
const ARP = [220, 261.63, 329.63, 440, 329.63, 261.63];
const BASS = [110, 110, 98, 98, 87.31, 87.31, 98, 98];

/** Döngüyü başlatır. Tekrar çağrılırsa öncekini durdurur. */
export function startQuizMusic(): void {
  const ac = ensureContext();
  if (!ac) return;
  stopQuizMusic();
  const flag = { stopped: false };
  stopFlag = flag;

  let bar = 0;
  const scheduleBar = () => {
    if (flag.stopped || !ctx) return;
    const t0 = ac.currentTime + 0.05;
    const step = 0.16; // ~94 BPM onaltılıklar
    ARP.forEach((f, i) => note(ac, f, t0 + i * step, step * 0.9, 0.045));
    note(ac, BASS[bar % BASS.length], t0, step * ARP.length, 0.06);
    bar += 1;
    timer = window.setTimeout(scheduleBar, ARP.length * step * 1000 - 30);
  };
  let timer = window.setTimeout(scheduleBar, 0);
  flagTimers.set(flag, () => window.clearTimeout(timer));
}

const flagTimers = new WeakMap<{ stopped: boolean }, () => void>();

export function stopQuizMusic(): void {
  stopFlag.stopped = true;
  flagTimers.get(stopFlag)?.();
}
