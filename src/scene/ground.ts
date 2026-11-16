import { ci } from '../charset';
import { Grid } from '../grid';
import { Layout, groundSurfaceY } from '../layout';
import { C } from '../palette';
import { clamp, hash2 } from '../util';

const UNDER = ci('_');
const RISE = ci('/');
const FALL = ci('\\');
const DOT = ci('.');
const COLON = ci(':');
const STAR = ci('*');
const MDOT = ci('·');

/** A thin line of snowy ground with a mound under the tree and a little glitter. */
export function drawGround(grid: Grid, L: Layout, time: number, introT: number) {
  const appear = clamp((introT - 0.3) / 1.5);
  if (appear <= 0) return;
  const half = L.W * 0.5;
  let prev = -1;
  for (let col = 0; col < L.cols; col++) {
    const px = (col + 0.5) * L.cw;
    const dx = Math.abs(px - L.cx);
    // the line draws itself outward from the tree
    if (dx > half * 1.1 * appear) {
      prev = -1;
      continue;
    }
    const edge = clamp(dx / half);
    const fade = (1 - edge * edge) * appear;
    const row = Math.floor(groundSurfaceY(L, px) / L.ch);
    const a = 0.55 * fade;
    if (prev >= 0 && row < prev) grid.set(col, row + 1, RISE, C.snow, a);
    else if (prev >= 0 && row > prev) grid.set(col, row, FALL, C.snow, a);
    else grid.set(col, row, UNDER, C.snow, a);
    prev = row;

    // sparse snow texture below the surface
    for (let k = 1; k <= 3; k++) {
      const h = hash2(col, row + k);
      if (h < 0.5) continue;
      const tw = Math.pow(Math.max(0, Math.sin(time * 1.3 + h * 60)), 14);
      if (h > 0.93 && tw > 0.05) {
        grid.set(col, row + k, STAR, C.warm, (0.25 + 0.75 * tw) * fade, tw);
      } else {
        grid.set(col, row + k, h > 0.8 ? COLON : h > 0.65 ? DOT : MDOT, C.snowDim, (0.26 - k * 0.06) * fade);
      }
    }
  }
}
