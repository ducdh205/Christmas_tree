/**
 * A soft, flowing synthesised medley of popular public-domain carols
 * (Jingle Bells, We Wish You a Merry Christmas, Silent Night): a legato lead
 * voice that glides between notes, a warm pad that cross-fades from chord to
 * chord, a gentle bass, a few quiet bells and a long reverb.
 * Used when public/music/ has no audio files. Nothing is loaded from the network.
 */

/** note name -> frequency (equal temperament, A4 = 440) */
function freq(name: string) {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const semis: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const n = semis[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, n / 12);
}

type Ev = [string | null, number]; // [note or rest, beats]

interface Song {
  title: string;
  bpm: number;
  /** one array of events per bar; a bar may be a partial pickup */
  bars: Ev[][];
  /** chord per bar (lowest note is the bass) */
  chords: string[][];
  /** bars that start a phrase get a quiet bell */
  bells: number[];
}

const CH: Record<string, string[]> = {
  C: ['C3', 'G3', 'C4', 'E4'],
  F: ['F2', 'F3', 'A3', 'C4'],
  G: ['G2', 'D3', 'G3', 'B3'],
  G7: ['G2', 'F3', 'B3', 'D4'],
  D: ['D3', 'A3', 'D4', 'F#4'],
  D7: ['D3', 'A3', 'C4', 'F#4'],
  A7: ['A2', 'E3', 'G3', 'C#4'],
  B7: ['B2', 'F#3', 'A3', 'D#4'],
  Em: ['E3', 'B3', 'E4', 'G4'],
  Am: ['A2', 'E3', 'A3', 'C4'],
};
const chords = (names: string) => names.split(' ').map((n) => CH[n]);

const JINGLE_A: Ev[] = [['E5', 1], ['E5', 1], ['E5', 2]];
const JINGLE_B: Ev[] = [['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5]];
const JINGLE_D: Ev[] = [['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5]];
const JINGLE_E: Ev[] = [['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5]];

const SONGS: Song[] = [
  {
    title: 'Jingle Bells',
    bpm: 112,
    bars: [
      JINGLE_A, JINGLE_A, JINGLE_B, [['E5', 4]],
      JINGLE_D, JINGLE_E, [['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1]], [['D5', 2], ['G5', 2]],
      JINGLE_A, JINGLE_A, JINGLE_B, [['E5', 4]],
      JINGLE_D, JINGLE_E, [['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1]], [['C5', 4]],
      [[null, 4]],
    ],
    chords: chords('C C C C F C D7 G7 C C C C F C G7 C C'),
    bells: [0, 4, 8, 12],
  },
  {
    title: 'We Wish You a Merry Christmas',
    bpm: 132,
    bars: [
      [[null, 2], ['D4', 1]],
      [['G4', 1], ['G4', 0.5], ['A4', 0.5], ['G4', 0.5], ['F#4', 0.5]],
      [['E4', 1], ['E4', 1], ['E4', 1]],
      [['A4', 1], ['A4', 0.5], ['B4', 0.5], ['A4', 0.5], ['G4', 0.5]],
      [['F#4', 1], ['D4', 1], ['D4', 1]],
      [['B4', 1], ['B4', 0.5], ['C5', 0.5], ['B4', 0.5], ['A4', 0.5]],
      [['G4', 1], ['E4', 1], ['D4', 0.5], ['D4', 0.5]],
      [['E4', 1], ['A4', 1], ['F#4', 1]],
      [['G4', 3]],
      [[null, 3]],
    ],
    chords: chords('G G C A7 D B7 Em C D7 G'),
    bells: [1, 5],
  },
  {
    title: 'Silent Night',
    bpm: 68,
    bars: [
      [['G4', 1.5], ['A4', 0.5], ['G4', 1]], [['E4', 3]],
      [['G4', 1.5], ['A4', 0.5], ['G4', 1]], [['E4', 3]],
      [['D5', 2], ['D5', 1]], [['B4', 3]],
      [['C5', 2], ['C5', 1]], [['G4', 3]],
      [['A4', 2], ['A4', 1]], [['C5', 1.5], ['B4', 0.5], ['A4', 1]],
      [['G4', 1.5], ['A4', 0.5], ['G4', 1]], [['E4', 3]],
      [['A4', 2], ['A4', 1]], [['C5', 1.5], ['B4', 0.5], ['A4', 1]],
      [['G4', 1.5], ['A4', 0.5], ['G4', 1]], [['E4', 3]],
      [['D5', 2], ['D5', 1]], [['F5', 1.5], ['D5', 0.5], ['B4', 1]],
      [['C5', 3]], [['E5', 3]],
      [['C5', 1.5], ['G4', 0.5], ['E4', 1]], [['G4', 1.5], ['F4', 0.5], ['D4', 1]],
      [['C4', 3]], [[null, 3]],
      [[null, 3]],
    ],
    chords: chords('C C C C G7 G7 C C F F C C F F C Am G7 G7 C C C G7 C C C'),
    bells: [0, 4, 8, 12, 16, 20],
  },
];


export class MusicBox {
  playing = false;
  onNote: (() => void) | null = null;
  /** called with the carol title when it starts */
  onTrack: ((title: string) => void) | null = null;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private lead!: { a: OscillatorNode; b: OscillatorNode; gain: GainNode };
  private padBus!: GainNode;
  private padVoices: { gain: GainNode; oscs: OscillatorNode[] }[] = [];
  private padChord = '';
  private timer = 0;
  private songIdx = 0;
  private barIdx = 0;
  private nextBar = 0;
  private lastFreq = 0;
  /** true while the lead is sounding (so the next note glides instead of re-attacking) */
  private leadOn = false;

  private init() {
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 6000;

    this.bus = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.75;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(ctx, 4.2);
    this.bus.connect(dry).connect(tone);
    this.bus.connect(verb).connect(wet).connect(tone);
    tone.connect(comp).connect(this.master).connect(ctx.destination);

    // pad: warm, filtered, slowly breathing
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 850;
    padFilter.Q.value = 0.4;
    const padLfo = ctx.createOscillator();
    padLfo.frequency.value = 0.09;
    const padLfoAmt = ctx.createGain();
    padLfoAmt.gain.value = 260;
    padLfo.connect(padLfoAmt).connect(padFilter.frequency);
    padLfo.start();
    this.padBus = ctx.createGain();
    this.padBus.gain.value = 1;
    this.padBus.connect(padFilter).connect(this.bus);

    // lead: one continuous voice (triangle + soft sine an octave up) with vibrato
    const leadFilter = ctx.createBiquadFilter();
    leadFilter.type = 'lowpass';
    leadFilter.frequency.value = 2600;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const a = ctx.createOscillator();
    a.type = 'triangle';
    const b = ctx.createOscillator();
    b.type = 'sine';
    const bGain = ctx.createGain();
    bGain.gain.value = 0.35;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.1;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = 2.2;
    vib.connect(vibAmt);
    vibAmt.connect(a.frequency);
    vibAmt.connect(b.frequency);
    a.connect(gain);
    b.connect(bGain).connect(gain);
    gain.connect(leadFilter).connect(this.bus);
    a.frequency.value = freq('G4');
    b.frequency.value = freq('G4') * 2;
    a.start();
    b.start();
    vib.start();
    this.lead = { a, b, gain };
  }

  private impulse(ctx: AudioContext, seconds: number) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
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
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.setTargetAtTime(0.85, now, 0.8);
    this.lead.gain.gain.cancelScheduledValues(now);
    this.lead.gain.gain.setValueAtTime(0, now);
    this.leadOn = false;
    this.releasePad(now);
    this.barIdx = 0;
    this.lastFreq = 0;
    this.nextBar = now + 0.3;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 60);
    this.schedule();
  }

  stop() {
    if (!this.ctx) return;
    this.playing = false;
    window.clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.setTargetAtTime(0, now, 0.5);
    this.releasePad(now + 1.5);
    this.lead.gain.gain.cancelScheduledValues(now);
    this.lead.gain.gain.setTargetAtTime(0, now, 0.4);
    this.leadOn = false;
  }

  /** Skip to the next carol. */
  next() {
    this.songIdx = (this.songIdx + 1) % SONGS.length;
    this.barIdx = 0;
    if (!this.ctx || !this.playing) return;
    const now = this.ctx.currentTime;
    const g = this.lead.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(0, now, 0.15);
    this.leadOn = false;
    this.lastFreq = 0;
    this.releasePad(now + 0.2);
    this.nextBar = now + 0.9;
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextBar < ctx.currentTime + 0.6) {
      const song = SONGS[this.songIdx];
      const i = this.barIdx;
      const t0 = this.nextBar;
      const spb = 60 / song.bpm;
      const barLen = song.bars[i].reduce((sum, [, b]) => sum + b, 0) * spb;
      if (i === 0) this.announce(song.title, t0);
      this.scheduleMelody(song.bars[i], t0, spb);
      const chord = song.chords[i] ?? song.chords[song.chords.length - 1];
      this.schedulePad(chord, t0);
      this.bass(freq(chord[0]), t0, barLen);
      if (song.bells.includes(i)) {
        const first = song.bars[i].find(([n]) => n)?.[0];
        if (first) this.bell(freq(first) * 2, t0);
      }
      this.nextBar += barLen;
      this.barIdx++;
      if (this.barIdx >= song.bars.length) {
        this.barIdx = 0;
        this.songIdx = (this.songIdx + 1) % SONGS.length;
      }
    }
  }

  /** Legato lead: glide to each note; swell gently; breathe at rests. */
  private scheduleMelody(events: Ev[], t0: number, spb: number) {
    const g = this.lead.gain.gain;
    let t = t0;
    for (const [note, beats] of events) {
      const dur = beats * spb;
      if (!note) {
        if (this.leadOn) g.setTargetAtTime(0, t, 0.3);
        this.leadOn = false;
        this.lastFreq = 0;
        t += dur;
        continue;
      }
      const f = freq(note);
      const glide = this.leadOn ? Math.min(0.045, dur * 0.12) : 0.001;
      this.lead.a.frequency.setTargetAtTime(f, t, glide);
      this.lead.b.frequency.setTargetAtTime(f * 2, t, glide);
      const peak = 0.2;
      if (!this.leadOn) {
        g.setTargetAtTime(peak, t, 0.07); // soft entry
      } else {
        // repeated notes get a gentle breath so they are still heard as separate
        // notes; new pitches just lift a little instead of being re-plucked
        const dip = f === this.lastFreq ? 0.38 : 0.84;
        g.setTargetAtTime(peak * dip, t - 0.035, 0.018);
        g.setTargetAtTime(peak, t + 0.02, 0.06);
      }
      // long notes relax a little, like a singer easing off
      if (dur > 0.9) g.setTargetAtTime(peak * 0.72, t + 0.35, dur * 0.5);
      this.leadOn = true;
      this.lastFreq = f;
      this.notify(t);
      t += dur;
    }
  }

  private schedulePad(chord: string[], t: number) {
    const key = chord.join(' ');
    if (key === this.padChord) return; // same chord: keep the current pad ringing
    this.releasePad(t);
    this.padChord = key;
    const ctx = this.ctx!;
    const voice = { gain: ctx.createGain(), oscs: [] as OscillatorNode[] };
    voice.gain.gain.setValueAtTime(0, t);
    voice.gain.gain.linearRampToValueAtTime(1, t + 1.1);
    voice.gain.connect(this.padBus);
    chord.forEach((n, idx) => {
      const level = idx === 0 ? 0.035 : 0.028;
      for (const detune of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq(n);
        o.detune.value = detune;
        const og = ctx.createGain();
        og.gain.value = level;
        o.connect(og).connect(voice.gain);
        o.start(t);
        voice.oscs.push(o);
      }
    });
    this.padVoices.push(voice);
  }

  private releasePad(t: number) {
    for (const v of this.padVoices) {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.8);
      v.oscs.forEach((o) => o.stop(t + 5));
    }
    this.padVoices = [];
    this.padChord = '';
  }

  private bass(f: number, t: number, barLen: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.25);
    g.gain.setTargetAtTime(0, t + barLen * 0.7, 0.5);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + barLen + 3);
  }

  /** A quiet celesta-like bell: sine with a fast-fading upper partial. */
  private bell(f: number, t: number) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.07, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    out.connect(this.bus);
    for (const [mult, amp] of [
      [1, 1],
      [3.01, 0.18],
    ] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 3.3);
    }
  }

  private announce(title: string, t: number) {
    const delay = Math.max(0, (t - this.ctx!.currentTime) * 1000);
    window.setTimeout(() => this.playing && this.onTrack?.(title), delay);
  }

  private notify(t: number) {
    if (!this.onNote) return;
    const delay = Math.max(0, (t - this.ctx!.currentTime) * 1000);
    window.setTimeout(() => this.playing && this.onNote?.(), delay);
  }
}
