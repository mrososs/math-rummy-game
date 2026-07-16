// Tiny Web Audio synth for UI/gameplay sound effects. No audio assets and no
// dependency — it generates short tones on the fly, which works in the browser
// and the Capacitor WebView.
//
// WebViews start the AudioContext "suspended" and only allow it to resume from
// a user gesture, so unlockAudio() must run on the first touch/click.

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
  button: [{ freq: 300, type: 'triangle', duration: 0.06, gain: 0.11 }],
  select: [{ freq: 540, type: 'sine', duration: 0.09, gain: 0.16, freqTo: 720 }],
  deselect: [
    { freq: 460, type: 'sine', duration: 0.09, gain: 0.13, freqTo: 300 },
  ],
  deal: [
    { freq: 380, type: 'triangle', duration: 0.07, gain: 0.13 },
    { freq: 300, type: 'triangle', duration: 0.07, gain: 0.13, delay: 0.07 },
    { freq: 240, type: 'triangle', duration: 0.09, gain: 0.13, delay: 0.14 },
  ],
  turn: [
    { freq: 587, type: 'sine', duration: 0.13, gain: 0.16 },
    { freq: 784, type: 'sine', duration: 0.18, gain: 0.16, delay: 0.1 },
  ],
  roundEnd: [
    { freq: 523, type: 'triangle', duration: 0.16, gain: 0.16 },
    { freq: 392, type: 'triangle', duration: 0.22, gain: 0.16, delay: 0.14 },
  ],
  win: [
    { freq: 523, type: 'triangle', duration: 0.15, gain: 0.18 },
    { freq: 659, type: 'triangle', duration: 0.15, gain: 0.18, delay: 0.13 },
    { freq: 784, type: 'triangle', duration: 0.15, gain: 0.18, delay: 0.26 },
    { freq: 1047, type: 'triangle', duration: 0.3, gain: 0.18, delay: 0.39 },
  ],
  success: [
    { freq: 659, type: 'sine', duration: 0.11, gain: 0.16 },
    { freq: 988, type: 'sine', duration: 0.15, gain: 0.16, delay: 0.09 },
  ],
  error: [{ freq: 196, type: 'sawtooth', duration: 0.24, gain: 0.16, freqTo: 150 }],
};

export type SoundName = keyof typeof SOUNDS;

let audioContext: AudioContext | undefined;
let enabled = true;
let unlocked = false;

function getContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return undefined;
  audioContext ??= new Ctor();
  return audioContext;
}

/** Resume + prime the context from a user gesture (required by WebViews). */
export function unlockAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  if (unlocked) return;
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    unlocked = true;
  } catch {
    // ignore
  }
}

function playTone(ctx: AudioContext, spec: ToneSpec, base: number): void {
  const start = base + (spec.delay ?? 0);
  const duration = spec.duration ?? 0.08;
  const gain = spec.gain ?? 0.1;
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
  if (ctx.state === 'suspended') void ctx.resume();
  try {
    const base = ctx.currentTime + 0.02;
    for (const spec of SOUNDS[name] ?? SOUNDS.button) playTone(ctx, spec, base);
  } catch {
    // Never let a sound failure affect gameplay.
  }
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}
