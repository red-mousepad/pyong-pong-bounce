let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function resumeAudio() {
  getCtx();
}

type ToneOpts = {
  from: number;
  to: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweep?: "exp" | "lin";
};

function tone({ from, to, duration, type = "sine", gain = 0.25, delay = 0, sweep = "exp" }: ToneOpts) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (sweep === "exp") osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
  else osc.frequency.linearRampToValueAtTime(Math.max(1, to), t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Cute "뿅!" start sound: quick upward blip. */
export function playPyong() {
  tone({ from: 420, to: 1180, duration: 0.16, type: "sine", gain: 0.3 });
  tone({ from: 900, to: 1600, duration: 0.1, type: "triangle", gain: 0.12, delay: 0.05 });
}

/** Short crisp "통" wall bounce. */
export function playTong() {
  tone({ from: 640, to: 220, duration: 0.09, type: "triangle", gain: 0.22 });
}

/** Cute firework "피용!" corner sound. */
export function playPiyong() {
  tone({ from: 300, to: 1900, duration: 0.28, type: "sine", gain: 0.28 });
  tone({ from: 1900, to: 700, duration: 0.22, type: "square", gain: 0.07, delay: 0.24 });
  const ac = getCtx();
  if (!ac) return;
  // sparkle tail
  for (let i = 0; i < 5; i++) {
    tone({
      from: 1200 + Math.random() * 900,
      to: 2400 + Math.random() * 900,
      duration: 0.08,
      type: "sine",
      gain: 0.06,
      delay: 0.26 + i * 0.05,
    });
  }
}

export function playPurchase() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone({ from: f, to: f, duration: 0.18, type: "triangle", gain: 0.18, delay: i * 0.09 }),
  );
}
