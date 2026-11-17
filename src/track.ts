/**
 * Plays the audio files you put in public/music/ one after another (looping the
 * whole list) and listens to their low end, so the lights and star pulse with
 * the real beat.
 */
export class PlaylistPlayer {
  playing = false;
  onNote: (() => void) | null = null;
  /** called with a readable title whenever a track starts */
  onTrack: ((title: string) => void) | null = null;
  private audio = new Audio();
  private index = 0;
  private ctx: AudioContext | null = null;
  private gain!: GainNode;
  private analyser!: AnalyserNode;
  private bins!: Uint8Array<ArrayBuffer>;
  private avg = 0;
  private cooldown = 0;
  private raf = 0;
  private failures = 0;

  constructor(private readonly srcs: string[]) {
    this.audio.preload = 'auto';
    this.audio.src = srcs[0];
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('error', () => {
      // skip files the browser can't play, but don't spin forever if none work
      if (++this.failures < this.srcs.length) this.next();
    });
    this.audio.addEventListener('playing', () => {
      this.failures = 0;
      this.onTrack?.(this.title);
    });
  }

  get count() {
    return this.srcs.length;
  }

  get title() {
    const file = decodeURIComponent(this.srcs[this.index].split('/').pop() ?? '');
    return file
      .replace(/\.[^.]+$/, '')
      .replace(/^\d+\s*[-_.]\s*/, '') // "01 - Last Christmas" -> "Last Christmas"
      .replace(/[_]+/g, ' ')
      .trim();
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
    this.fade(0.9, 0.6);
    cancelAnimationFrame(this.raf);
    this.listen();
  }

  stop() {
    if (!this.ctx) return;
    this.playing = false;
    this.fade(0, 0.35);
    cancelAnimationFrame(this.raf);
    window.setTimeout(() => !this.playing && this.audio.pause(), 1500);
  }

  /** Skip to the next track (with a short fade), wrapping around. */
  next() {
    this.index = (this.index + 1) % this.srcs.length;
    const swap = () => {
      this.audio.src = this.srcs[this.index];
      if (this.playing) {
        this.audio.play().catch(() => {});
        this.fade(0.9, 0.4);
      }
    };
    if (this.playing && this.ctx && !this.audio.ended) {
      this.fade(0, 0.12);
      window.setTimeout(swap, 400);
    } else {
      swap();
    }
  }

  private fade(to: number, tc: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.setTargetAtTime(to, now, tc);
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
