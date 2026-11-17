import { ci, cis } from '../charset';
import { Grid } from '../grid';
import { Layout } from '../layout';
import { C } from '../palette';
import { clamp, hash2 } from '../util';

// ---------------------------------------------------------------------------
// Aurora: curtains of light swaying across the sky behind the tree.
// ---------------------------------------------------------------------------

const CURTAIN = cis('.:;!|');
const AURORA_LEN = 15;

interface Ribbon {
  base: number; // fraction of H for the curtain's lower edge
  height: number; // fraction of H
  amp: number;
  freq: number;
  speed: number;
  phase: number;
  /** colours from the lower edge upward */
  colors: [number, number, number];
}

const RIBBONS: Ribbon[] = [
  { base: 0.34, height: 0.26, amp: 0.05, freq: 2.3, speed: 0.35, phase: 0, colors: [C.pine3, C.pine2, C.blue] },
  { base: 0.25, height: 0.2, amp: 0.045, freq: 3.1, speed: -0.27, phase: 2.1, colors: [C.pine3, C.blue, C.rose] },
  { base: 0.4, height: 0.14, amp: 0.035, freq: 1.7, speed: 0.22, phase: 4.2, colors: [C.rose, C.rose, C.blue] },
];

export class Aurora {
  private start = -Infinity;

  get active() {
    return this.clock - this.start < AURORA_LEN;
  }
  private clock = 0;

  /** Start (or, if already showing, extend) the aurora. */
  trigger() {
    this.start = this.active ? this.clock - 2 : this.clock;
  }

  update(dt: number) {
    this.clock += dt;
  }

  draw(grid: Grid, L: Layout) {
    const t = this.clock - this.start;
    if (t < 0 || t >= AURORA_LEN) return;
    const env = clamp(t / 2.5) * clamp((AURORA_LEN - t) / 3.5);
    if (env <= 0) return;
    const rowMax = Math.min(grid.rows - 1, Math.ceil((L.H * 0.5) / L.ch));
    for (const rb of RIBBONS) {
      for (let col = 0; col < grid.cols; col++) {
        const xn = col / grid.cols;
        // the curtain's lower edge waves; it hangs upward from there
        const edge =
          L.H * (rb.base + rb.amp * Math.sin(xn * rb.freq * 6.283 + t * rb.speed * 2 + rb.phase) + rb.amp * 0.5 * Math.sin(xn * 9.1 - t * 0.6 + rb.phase));
        const height = L.H * rb.height * (0.65 + 0.35 * Math.sin(xn * 5.3 + t * 0.4 + rb.phase));
        // vertical rays that drift sideways, plus a slow shimmer
        const ray = 0.5 + 0.5 * Math.sin(xn * 61 + Math.sin(t * 0.7 + xn * 7) * 3);
        const ray2 = 0.5 + 0.5 * Math.sin(xn * 147 - t * 0.9 + rb.phase);
        const rays = 0.12 + 0.88 * Math.pow(ray, 3) * (0.55 + 0.45 * ray2);
        const shimmer = 0.75 + 0.25 * Math.sin(xn * 23 - t * 2.2 + rb.phase);
        // fade at the screen edges so it feels like it is far away
        const side = Math.sin(Math.PI * clamp(xn * 1.15 - 0.075));
        const strength = env * rays * shimmer * side;
        if (strength < 0.03) continue;
        const r0 = Math.max(0, Math.floor((edge - height) / L.ch));
        const r1 = Math.min(rowMax, Math.ceil((edge + L.ch) / L.ch));
        for (let row = r0; row <= r1; row++) {
          const y = (row + 0.5) * L.ch;
          const d = (edge - y) / height; // 0 at the lower edge, 1 at the top
          if (d < -0.08 || d > 1) continue;
          const fall = d < 0 ? 1 + d / 0.08 : Math.pow(1 - d, 1.2);
          const I = Math.min(1, strength * fall * 1.35);
          if (I < 0.05) continue;
          const glyph = CURTAIN[Math.min(CURTAIN.length - 1, Math.floor(I * CURTAIN.length * 1.2))];
          const color = d < 0.3 ? rb.colors[0] : d < 0.65 ? rb.colors[1] : rb.colors[2];
          grid.set(col, row, glyph, color, 0.3 + 0.7 * I, I * 1.2);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Meteor shower: streaks of light falling across the sky.
// ---------------------------------------------------------------------------

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number; // tail length in px
  life: number;
  max: number;
  color: number;
  /** spawn time offset (s); waits until <= 0 */
  wait: number;
  sparkle: boolean;
}

const HEAD = ci('*');
const TAIL = [ci('/'), ci('/'), ci('/'), ci('·'), ci('.')];
const METEOR_COLORS = [C.warm, C.warm, C.goldPale, C.silver, C.blue, C.rose];

export class Meteors {
  private list: Meteor[] = [];
  /** called where a bright meteor burns out, for a little sparkle */
  onBurnout: ((x: number, y: number) => void) | null = null;

  get active() {
    return this.list.length > 0;
  }

  shower(L: Layout, count = 34, over = 7) {
    for (let i = 0; i < count; i++) {
      const ang = Math.PI * (0.72 + Math.random() * 0.06); // heading down and to the left, like '/'
      const speed = (480 + Math.random() * 380) * L.scale;
      const max = 1.0 + Math.random() * 0.7;
      this.list.push({
        x: L.W * (0.25 + Math.random() * 0.95),
        y: L.H * (-0.05 + Math.random() * 0.3),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        len: (170 + Math.random() * 190) * L.scale,
        life: max,
        max,
        color: METEOR_COLORS[Math.floor(Math.random() * METEOR_COLORS.length)],
        wait: (i / count) * over + Math.random() * 0.3,
        sparkle: Math.random() < 0.35,
      });
    }
  }

  update(dt: number) {
    for (const m of this.list) {
      if (m.wait > 0) {
        m.wait -= dt;
        continue;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
      if (m.life <= 0 && m.sparkle) this.onBurnout?.(m.x, m.y);
    }
    this.list = this.list.filter((m) => m.wait > 0 || m.life > 0);
  }

  draw(grid: Grid, L: Layout, time: number) {
    for (const m of this.list) {
      if (m.wait > 0) continue;
      const k = 1 - m.life / m.max; // 0 -> 1
      const fade = Math.sin(Math.PI * Math.min(1, k * 1.15)); // brighten, then burn out
      const sp = Math.hypot(m.vx, m.vy);
      const ux = m.vx / sp;
      const uy = m.vy / sp;
      const steps = Math.ceil(m.len / (L.cw * 0.8));
      for (let s = steps; s >= 0; s--) {
        const f = s / steps;
        const x = m.x - ux * m.len * f;
        const y = m.y - uy * m.len * f;
        const a = fade * Math.pow(1 - f, 1.3);
        if (a < 0.03) continue;
        const glyph = s === 0 ? HEAD : TAIL[Math.min(TAIL.length - 1, Math.floor(f * TAIL.length))];
        const flick = 0.85 + 0.15 * hash2(s, Math.floor(time * 20));
        grid.set(x / L.cw, y / L.ch, glyph, s < 4 ? C.warm : m.color, Math.min(1, a * flick * 1.15), a * 1.4);
      }
    }
  }
}
