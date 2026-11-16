import { ci } from '../charset';
import { Grid } from '../grid';
import { Layout } from '../layout';
import { C } from '../palette';

interface Flake {
  x: number;
  y: number;
  vy: number;
  d: number;
  phase: number;
  sway: number;
  freq: number;
}

const FAR = ci('·');
const MID = ci('•');
const NEAR = ci('*');

/** Gently falling snow in three depth layers; back flakes pass behind the tree. */
export class Snow {
  private flakes: Flake[] = [];
  private L!: Layout;
  wind = 0;
  speed = 1;

  reset(L: Layout) {
    this.L = L;
    const count = Math.floor((L.cols * L.rows) / 120);
    this.flakes = [];
    for (let i = 0; i < count; i++) this.flakes.push(this.make(Math.random() * L.H));
  }

  private make(y: number): Flake {
    const d = Math.random();
    return {
      x: Math.random() * this.L.W,
      y,
      d,
      vy: (10 + 34 * d * d) * this.L.scale,
      phase: Math.random() * Math.PI * 2,
      sway: (6 + 16 * d) * this.L.scale,
      freq: 0.25 + Math.random() * 0.5,
    };
  }

  update(dt: number, time: number) {
    const { L } = this;
    for (const f of this.flakes) {
      f.y += f.vy * dt * this.speed;
      f.x += (Math.cos(time * f.freq + f.phase) * f.sway + this.wind * (0.4 + f.d)) * dt * this.speed;
      if (f.y > L.H + 10) {
        Object.assign(f, this.make(-10));
      }
      if (f.x < -10) f.x += L.W + 20;
      else if (f.x > L.W + 10) f.x -= L.W + 20;
    }
  }

  draw(grid: Grid, front: boolean, appear: number) {
    if (appear <= 0) return;
    const { L } = this;
    for (const f of this.flakes) {
      if (front !== f.d > 0.62) continue;
      const col = f.x / L.cw;
      const row = f.y / L.ch;
      if (f.d < 0.4) grid.set(col, row, FAR, C.snowDim, (0.22 + 0.3 * f.d) * appear);
      else if (f.d < 0.82) grid.set(col, row, MID, C.snow, (0.28 + 0.3 * f.d) * appear, 0.05);
      else grid.set(col, row, NEAR, C.snow, 0.8 * appear, 0.25);
    }
  }
}
