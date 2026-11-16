import { cis } from '../charset';
import { Grid } from '../grid';
import { Layout } from '../layout';
import { C } from '../palette';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
}

const STAGES = cis('*+·.');
const COLORS = [C.gold, C.goldPale, C.warm, C.gold, C.rose];

/** A soft burst of golden sparks wherever the viewer taps. */
export class Sparkles {
  private sparks: Spark[] = [];

  /** A few slow embers shed from a moving point (the building comet). */
  trail(x: number, y: number, scale: number, n: number) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (8 + Math.random() * 45) * scale;
      const max = 0.5 + Math.random() * 0.9;
      this.sparks.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 12 * scale,
        life: max,
        max,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
    if (this.sparks.length > 900) this.sparks.splice(0, this.sparks.length - 900);
  }

  burst(x: number, y: number, scale: number, n = 26, power = 1) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = (40 + Math.random() * 150) * scale * power;
      const max = 1 + Math.random() * 1.2 * power;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp * 0.75 - 30 * scale,
        life: max,
        max,
        color: COLORS[i % COLORS.length],
      });
    }
    if (this.sparks.length > 900) this.sparks.splice(0, this.sparks.length - 900);
  }

  update(dt: number, scale: number) {
    const drag = Math.exp(-dt * 2.2);
    for (const s of this.sparks) {
      s.vx *= drag;
      s.vy = s.vy * drag + 55 * scale * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }

  draw(grid: Grid, L: Layout, time: number) {
    for (const s of this.sparks) {
      const k = 1 - s.life / s.max; // 0 -> 1 over its life
      const stage = Math.min(STAGES.length - 1, Math.floor(k * STAGES.length));
      const flicker = 0.75 + 0.25 * Math.sin(time * 30 + s.x);
      const a = (1 - k * k) * flicker;
      grid.set(s.x / L.cw, s.y / L.ch, STAGES[stage], s.color, a, a);
    }
  }
}
