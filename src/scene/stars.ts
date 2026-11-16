import { ci } from '../charset';
import { Grid } from '../grid';
import { Layout } from '../layout';
import { C } from '../palette';

interface Star {
  x: number;
  y: number;
  c: number;
  color: number;
  base: number;
  speed: number;
  phase: number;
}

const GLYPHS = [ci('·'), ci('·'), ci('.'), ci('+'), ci('*')];

/** A dense, quietly twinkling starfield behind everything. */
export class Starfield {
  private stars: Star[] = [];

  reset(L: Layout) {
    const n = Math.floor(L.cols * L.rows * 0.028);
    this.stars = [];
    for (let i = 0; i < n; i++) {
      const g = Math.random();
      const gi = g < 0.55 ? 0 : g < 0.85 ? 2 : g < 0.97 ? 3 : 4;
      this.stars.push({
        x: Math.floor(Math.random() * L.cols),
        // a little denser towards the top of the sky
        y: Math.floor(Math.pow(Math.random(), 1.3) * L.rows),
        c: GLYPHS[gi],
        color: Math.random() < 0.85 ? C.snow : Math.random() < 0.5 ? C.goldPale : C.blue,
        base: gi >= 3 ? 0.55 : 0.18 + Math.random() * 0.35,
        speed: 0.4 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  draw(grid: Grid, time: number, appear: number) {
    if (appear <= 0) return;
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(time * s.speed + s.phase);
      const a = s.base * tw * appear;
      grid.set(s.x, s.y, s.c, s.color, a, s.base > 0.5 ? a * 0.6 : 0);
    }
  }
}
