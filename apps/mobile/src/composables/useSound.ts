// Tiny Web Audio synth for UI/gameplay sound effects. No audio assets and no
// dependency — it generates short tones on the fly, which works in the browser
// and the Capacitor WebView. Audio starts on the first user gesture (a tap),
// which browsers require.

interface ToneSpec {
  freq: number;
  type?: OscillatorType;
  duration?: number;
  gain?: number;
  /** Glide to this frequency over the tone. */
  freqTo?: number;
  /** Start offset in seconds (for simple arpeggios/chords). */
  delay?: number;
}

const SOUNDS: Record<string, ToneSpec[]> = {
  button: [{ freq: 300, type: 'triangle', duration: 0.05, gain: 0.035 }],
  select: [{ freq: 540, type: 'sine', duration: 0.08, gain: 0.05, freqTo: 680 }],
  deselect: [
    { freq: 440, type: 'sine', duration: 0.08, gain: 0.04, freqTo: 320 },
  ],
  turn: [
    { freq: 587, type: 'sine', duration: 0.12, gain: 0.05 },
    { freq: 784, type: 'sine', duration: 0.16, gain: 0.05, delay: 0.09 },
  ],
  roundEnd: [
    { freq: 523, type: 'triangle', duration: 0.14, gain: 0.05 },
    { freq: 392, type: 'triangle', duration: 0.2, gain: 0.05, delay: 0.12 },
  ],
  win: [
    { freq: 523, type: 'triangle', duration: 0.14, gain: 0.06 },
    { freq: 659, type: 'triangle', duration: 0.14, gain: 0.06, delay: 0.12 },
    { freq: 784, type: 'triangle', duration: 0.14, gain: 0.06, delay: 0.24 },
    { freq: 1047, type: 'triangle', duration: 0.28, gain: 0.06, delay: 0.36 },
  ],
  success: [
    { freq: 659, type: 'sine', duration: 0.1, gain: 0.05 },
    { freq: 988, type: 'sine', duration: 0.14, gain: 0.05, delay: 0.08 },
  ],
  error: [{ freq: 196, type: 'sawtooth', duration: 0.22, gain: 0.05, freqTo: 150 }],
};

export type SoundName = keyof typeof SOUNDS;

let audioContext: AudioContext | undefined;
let enabled = true;

function getContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return undefined;
  audioContext ??= new Ctor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function playTone(ctx: AudioContext, spec: ToneSpec): void {
  const start = ctx.currentTime + (spec.delay ?? 0);
  const duration = spec.duration ?? 0.08;
  const gain = spec.gain ?? 0.04;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.freq, start);
  if (spec.freqTo) {
    osc.frequency.exponentialRampToValueAtTime(spec.freqTo, start + duration);
  }
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

export function playSound(name: SoundName): void {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    for (const spec of SOUNDS[name] ?? SOUNDS.button) playTone(ctx, spec);
  } catch {
    // Never let a sound failure affect gameplay.
  }
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}
