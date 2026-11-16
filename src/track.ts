/**
 * Plays an audio file you provide (e.g. public/music/christmas-tree.mp3) and
 * listens to its low end, so the lights and star can pulse with the real beat.
 */
export class TrackPlayer {
  playing = false;
  onNote: (() => void) | null = null;
  private audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private gain!: GainNode;
  private analyser!: AnalyserNode;
  private bins!: Uint8Array<ArrayBuffer>;
  private avg = 0;
  private cooldown = 0;
  private raf = 0;

  constructor(readonly src: string) {
    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.preload = 'auto';
  }

  /** True if the file exists and the server actually serves audio (not the SPA fallback page). */
  static async available(src: string) {
    try {
      const res = await fetch(src, { method: 'HEAD' });
      return res.ok && (res.headers.get('content-type') ?? '').startsWith('audio');
    } catch {
      return false;
    }
  }

  private init() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const source = ctx.createMediaElementSource(this.audio);
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.55;
    this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    source.connect(this.gain).connect(ctx.destination);
    source.connect(this.analyser);
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
    await this.audio.play();
    this.playing = true;
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
    cancelAnimationFrame(this.raf);
    this.listen();
  }

  stop() {
    if (!this.ctx) return;
    this.playing = false;
    const ctx = this.ctx;
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
    cancelAnimationFrame(this.raf);
    window.setTimeout(() => !this.playing && this.audio.pause(), 1500);
  }

  /** Simple onset detector on the bass band: fire onNote when energy jumps above its running average. */
  private listen = () => {
    if (!this.playing) return;
    this.analyser.getByteFrequencyData(this.bins);
    const hzPerBin = this.ctx!.sampleRate / this.analyser.fftSize;
    const top = Math.max(2, Math.round(160 / hzPerBin));
    let sum = 0;
    for (let i = 1; i <= top; i++) sum += this.bins[i];
    const energy = sum / top;
    this.avg = this.avg * 0.94 + energy * 0.06;
    this.cooldown--;
    if (energy > this.avg * 1.25 + 6 && energy > 60 && this.cooldown <= 0) {
      this.onNote?.();
      this.cooldown = 12; // ~200ms at 60fps
    }
    this.raf = requestAnimationFrame(this.listen);
  };
}
