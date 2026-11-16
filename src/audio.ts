/**
 * A tiny synthesised music box playing "Jingle Bells" (public domain),
 * with soft chords and a generated reverb. Nothing is loaded from the network.
 */
const N: Record<string, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  F3: 174.61,
  G3: 196.0,
  C3: 130.81,
};

type Ev = [string | null, number];

const bar = {
  a: [['E5', 1], ['E5', 1], ['E5', 2]] as Ev[],
  b: [['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5]] as Ev[],
  c: [['E5', 4]] as Ev[],
  d: [['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5]] as Ev[],
  e: [['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5]] as Ev[],
  f: [['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1]] as Ev[],
  g: [['D5', 2], ['G5', 2]] as Ev[],
  h: [['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1]] as Ev[],
  i: [['C5', 4]] as Ev[],
  rest: [[null, 4]] as Ev[],
};

const BARS = [
  bar.a, bar.a, bar.b, bar.c, bar.d, bar.e, bar.f, bar.g,
  bar.a, bar.a, bar.b, bar.c, bar.d, bar.e, bar.h, bar.i,
  bar.rest, bar.rest,
];
const CHORDS: [string, string][] = [
  ['C4', 'G4'], ['C4', 'G4'], ['C4', 'G4'], ['C4', 'G4'], ['F3', 'C4'], ['C4', 'G4'], ['G3', 'D4'], ['G3', 'D4'],
  ['C4', 'G4'], ['C4', 'G4'], ['C4', 'G4'], ['C4', 'G4'], ['F3', 'C4'], ['C4', 'G4'], ['G3', 'D4'], ['C3', 'C4'],
];

const BPM = 100;
const SPB = 60 / BPM;

export class MusicBox {
  playing = false;
  onNote: (() => void) | null = null;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private timer = 0;
  private barIdx = 0;
  private nextBar = 0;

  private init() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;

    this.bus = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(ctx, 3.2);

    this.bus.connect(dry).connect(tone);
    this.bus.connect(verb).connect(wet).connect(tone);
    tone.connect(this.master).connect(ctx.destination);
  }

  private impulse(ctx: AudioContext, seconds: number) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  async toggle() {
    if (this.playing) this.stop();
    else await this.start();
    return this.playing;
  }

  async start() {
    if (!this.ctx) this.init();
    const ctx = this.ctx!;
    await ctx.resume();
    this.playing = true;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.32, now, 0.5);
    this.barIdx = 0;
    this.nextBar = now + 0.15;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  stop() {
    if (!this.ctx) return;
    this.playing = false;
    window.clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.35);
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextBar < ctx.currentTime + 0.4) {
      const i = this.barIdx;
      let t = this.nextBar;
      for (const [note, beats] of BARS[i]) {
        if (note) this.tine(N[note], t, 0.26);
        t += beats * SPB;
      }
      const chord = CHORDS[i];
      if (chord) {
        this.tine(N[chord[0]], this.nextBar, 0.12, 2.8);
        this.tine(N[chord[1]], this.nextBar + 2 * SPB, 0.08, 2.4);
      }
      this.nextBar += 4 * SPB;
      this.barIdx = (i + 1) % BARS.length;
    }
  }

  /** One plucked music-box tine: a sine with a couple of quickly fading partials. */
  private tine(freq: number, t: number, vel: number, decay = 1.9) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vel, t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    out.connect(this.bus);

    const partials: [number, number, number][] = [
      [1, 1, decay],
      [2, 0.28, decay * 0.45],
      [4.17, 0.07, decay * 0.18],
    ];
    for (const [mult, amp, len] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }

    if (this.onNote && vel > 0.2) {
      const delay = Math.max(0, (t - ctx.currentTime) * 1000);
      window.setTimeout(() => this.playing && this.onNote?.(), delay);
    }
  }
}
