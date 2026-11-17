import { ci, cis } from '../charset';
import { Grid } from '../grid';
import { Layout } from '../layout';
import { C } from '../palette';
import { clamp, easeInOut, hash2 } from '../util';

interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  colors: number[];
  final: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  /** particles of the final burst fly to a letter of the name, hold, then fall */
  seek?: { sx: number; sy: number; cx: number; cy: number; tx: number; ty: number; t: number; glyph: number };
}

const STAGES = cis('*+·.');
const PALETTES = [
  [C.gold, C.goldPale, C.warm],
  [C.rose, C.warm, C.goldPale],
  [C.blue, C.silver, C.snow],
  [C.red, C.gold, C.rose],
  [C.pine3, C.goldPale, C.warm],
];
const TRAIL = ci('|');
const HEAD = ci('*');
const FAMILY = '"Playfair Display", Georgia, serif';

const SEEK_TIME = 1.7;
const HOLD_TIME = 3.6;

/** Rockets bursting over the tree; the last one's sparks gather into a name. */
export class Fireworks {
  private rockets: Rocket[] = [];
  private sparks: Spark[] = [];
  private queue: { at: number; fn: () => void }[] = [];
  private clock = 0;
  private targets: { x: number; y: number; glyph: number }[] = [];
  /** cell box around the name, dimmed behind it so the letters read clearly */
  private box = { c0: 0, c1: -1, r0: 0, r1: -1 };
  /** seconds since the final burst, or -1 */
  private nameT = -1;

  constructor(private name: string) {}

  get active() {
    return this.rockets.length + this.sparks.length + this.queue.length > 0;
  }

  /** Sample the name into base-grid cells across the sky. */
  build(L: Layout) {
    const cy = L.H * (L.portrait ? 0.3 : 0.26);
    const boxW = L.W * (L.portrait ? 0.84 : 0.56);
    const boxH = L.H * (L.portrait ? 0.16 : 0.2);
    const cnv = document.createElement('canvas');
    cnv.width = Math.ceil(L.W);
    cnv.height = Math.ceil(boxH);
    const ctx = cnv.getContext('2d', { willReadFrequently: true })!;
    ctx.font = `italic 700 100px ${FAMILY}`;
    const size = Math.min((100 * boxW) / ctx.measureText(this.name).width, boxH * 0.95);
    ctx.font = `italic 700 ${size}px ${FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.name, L.W / 2, boxH / 2);
    const data = ctx.getImageData(0, 0, cnv.width, cnv.height).data;
    const top = cy - boxH / 2;
    this.targets = [];
    this.box = { c0: L.cols, c1: -1, r0: L.rows, r1: -1 };
    for (let row = Math.floor(top / L.ch); row * L.ch < top + boxH; row++) {
      for (let col = 0; col < L.cols; col++) {
        let sum = 0;
        for (let sy = 0; sy < 3; sy++) {
          for (let sx = 0; sx < 3; sx++) {
            const px = Math.floor((col + (sx + 0.5) / 3) * L.cw);
            const py = Math.floor((row + (sy + 0.5) / 3) * L.ch - top);
            if (px < 0 || py < 0 || px >= cnv.width || py >= cnv.height) continue;
            sum += data[(py * cnv.width + px) * 4 + 3];
          }
        }
        const cover = sum / (9 * 255);
        if (cover > 0.3) {
          this.box.c0 = Math.min(this.box.c0, col - 2);
          this.box.c1 = Math.max(this.box.c1, col + 2);
          this.box.r0 = Math.min(this.box.r0, row - 1);
          this.box.r1 = Math.max(this.box.r1, row + 1);
          this.targets.push({ x: (col + 0.5) * L.cw, y: (row + 0.5) * L.ch, glyph: cover > 0.7 ? ci('#') : HEAD });
        }
      }
    }
  }

  launch(L: Layout) {
    const at = (s: number, fn: () => void) => this.queue.push({ at: this.clock + s, fn });
    const xs = [0.2, 0.78, 0.34, 0.66, 0.12, 0.88];
    xs.forEach((fx, i) => at(i * 0.32, () => this.rocket(L, L.W * (fx + (Math.random() - 0.5) * 0.06), false)));
    at(2.3, () => this.rocket(L, L.cx, true));
  }

  private rocket(L: Layout, x: number, final: boolean) {
    const targetY = final ? L.H * (L.portrait ? 0.3 : 0.26) : L.H * (0.1 + Math.random() * 0.22);
    const dist = L.groundY - targetY;
    this.rockets.push({
      x,
      y: L.groundY,
      vx: (Math.random() - 0.5) * 30 * L.scale,
      vy: -Math.sqrt(2 * 420 * L.scale * dist) * 1.05,
      targetY,
      colors: PALETTES[Math.floor(Math.random() * PALETTES.length)],
      final,
    });
  }

  private explode(L: Layout, r: Rocket) {
    if (r.final && this.targets.length) {
      this.nameT = 0;
      const cols = [C.rose, C.goldPale, C.gold, C.warm];
      const xs = this.targets.map((t) => t.x);
      const minX = Math.min(...xs);
      const span = Math.max(1, Math.max(...xs) - minX);
      for (const t of this.targets) {
        const ang = Math.random() * Math.PI * 2;
        const rad = (90 + Math.random() * 170) * L.scale;
        const xn = (t.x - minX) / span;
        this.sparks.push({
          x: r.x,
          y: r.y,
          vx: 0,
          vy: 0,
          life: 1,
          max: 1,
          color: cols[Math.min(cols.length - 1, Math.floor(xn * cols.length))],
          seek: { sx: r.x, sy: r.y, cx: r.x + Math.cos(ang) * rad, cy: r.y + Math.sin(ang) * rad, tx: t.x, ty: t.y, t: 0, glyph: t.glyph },
        });
      }
    }
    const n = r.final ? 90 : 80;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.15;
      const sp = (90 + Math.random() * 160) * L.scale * (r.final ? 1.3 : 1);
      const max = 1.2 + Math.random() * 0.9;
      this.sparks.push({
        x: r.x,
        y: r.y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: max,
        max,
        color: r.colors[i % r.colors.length],
      });
    }
  }

  update(dt: number, L: Layout) {
    this.clock += dt;
    if (this.nameT >= 0) {
      this.nameT += dt;
      if (this.nameT > SEEK_TIME + HOLD_TIME + 1) this.nameT = -1;
    }
    this.queue = this.queue.filter((q) => {
      if (q.at > this.clock) return true;
      q.fn();
      return false;
    });

    const g = 420 * L.scale;
    for (const r of this.rockets) {
      r.vy += g * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
    }
    for (const r of this.rockets) if (r.vy >= -40 || r.y <= r.targetY) this.explode(L, r);
    this.rockets = this.rockets.filter((r) => !(r.vy >= -40 || r.y <= r.targetY));

    const drag = Math.exp(-dt * 1.6);
    for (const s of this.sparks) {
      if (s.seek) {
        const k = s.seek;
        k.t += dt;
        if (k.t < SEEK_TIME) {
          const e = easeInOut(k.t / SEEK_TIME);
          // quadratic bezier: burst point -> scattered control point -> letter
          s.x = (1 - e) * (1 - e) * k.sx + 2 * (1 - e) * e * k.cx + e * e * k.tx;
          s.y = (1 - e) * (1 - e) * k.sy + 2 * (1 - e) * e * k.cy + e * e * k.ty;
        } else if (k.t < SEEK_TIME + HOLD_TIME) {
          s.x = k.tx;
          s.y = k.ty;
        } else {
          // let go: drift down like glitter
          s.vx = (Math.random() - 0.5) * 30 * L.scale;
          s.vy = Math.random() * 20 * L.scale;
          s.max = s.life = 1.4 + Math.random() * 1.2;
          s.seek = undefined;
        }
        continue;
      }
      s.vx *= drag;
      s.vy = s.vy * drag + 60 * L.scale * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.seek || s.life > 0);
  }

  draw(grid: Grid, L: Layout, time: number) {
    if (this.nameT >= 0) {
      // fade whatever is behind the name while it's spelled out
      const t = this.nameT;
      const k = clamp(Math.min((t - 0.6) / 0.9, (SEEK_TIME + HOLD_TIME + 0.6 - t) / 0.8));
      const keep = 1 - 0.8 * k;
      const { c0, c1, r0, r1 } = this.box;
      for (let row = Math.max(0, r0); row <= Math.min(grid.rows - 1, r1); row++) {
        for (let col = Math.max(0, c0); col <= Math.min(grid.cols - 1, c1); col++) {
          const i = row * grid.cols + col;
          grid.a[i] *= keep;
          grid.glow[i] *= keep;
        }
      }
    }
    for (const r of this.rockets) {
      const col = r.x / L.cw;
      const row = r.y / L.ch;
      grid.set(col, row, HEAD, C.warm, 1, 1.5);
      for (let k = 1; k <= 4; k++) grid.set(col, row + k, TRAIL, C.gold, 0.7 - k * 0.15, 0.6 - k * 0.12);
    }
    for (const s of this.sparks) {
      if (s.seek) {
        const k = s.seek;
        const arriving = clamp(k.t / SEEK_TIME);
        const tw = 0.75 + 0.25 * Math.sin(time * 5 + k.tx * 0.07 + k.ty * 0.11);
        const glyph = arriving < 1 ? STAGES[hash2(k.tx, Math.floor(time * 12)) > 0.5 ? 0 : 1] : k.glyph;
        grid.set(s.x / L.cw, s.y / L.ch, glyph, s.color, (0.55 + 0.45 * arriving) * tw, 0.7 + 0.5 * tw);
        continue;
      }
      const k = 1 - s.life / s.max;
      const stage = Math.min(STAGES.length - 1, Math.floor(k * STAGES.length));
      const a = (1 - k * k) * (0.75 + 0.25 * Math.sin(time * 28 + s.x));
      grid.set(s.x / L.cw, s.y / L.ch, STAGES[stage], s.color, a, a * 1.1);
    }
  }
}
