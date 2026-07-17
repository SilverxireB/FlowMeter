/**
 * Quiz geri sayım sesi — WebAudio ile sentezlenir (dosya/dış servis YOK).
 * Sürekli müzik yerine yalnızca SON birkaç saniyeyi belirginleştiren bir
 * geri sayım: her saniye yükselen perdede bir "tık", süre bitince kısa buzzer.
 */

let ctx: AudioContext | null = null;
let nodes: OscillatorNode[] = [];

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function beep(
  ac: AudioContext,
  at: number,
  freq: number,
  dur: number,
  gainVal: number,
  type: OscillatorType
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainVal, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.03);
  nodes.push(osc);
}

/**
 * `seconds` kadar geri sayım tıkı çalar (her saniye bir tane, yükselen perde),
 * ardından süre bitince iki tonlu buzzer. Tekrar çağrılırsa öncekini durdurur.
 */
export function startQuizCountdown(seconds: number): void {
  const ac = ensureContext();
  if (!ac) return;
  stopQuizCountdown();
  const n = Math.max(1, Math.min(5, Math.round(seconds)));
  const t0 = ac.currentTime + 0.03;
  for (let i = 0; i < n; i++) {
    const at = t0 + i; // saniyede bir tık
    const stepsLeft = n - i; // n…1
    const last = stepsLeft === 1;
    // Sona yaklaştıkça yükselen perde + son tık biraz daha gür
    const freq = 620 + (n - stepsLeft) * 70;
    beep(ac, at, freq, last ? 0.16 : 0.11, last ? 0.15 : 0.1, "square");
  }
  // Süre bitti → kısa "buzzer"
  const end = t0 + n;
  beep(ac, end, 330, 0.5, 0.15, "sawtooth");
  beep(ac, end, 247, 0.5, 0.11, "sawtooth");
}

export function stopQuizCountdown(): void {
  nodes.forEach((o) => {
    try {
      o.stop();
    } catch {
      /* zaten durmuş olabilir */
    }
  });
  nodes = [];
}
