import { ci, cis } from '../charset';
import { Grid } from '../grid';
import { Layout } from '../layout';
import type { Metrics, Renderer, Snapshot } from '../renderer';
import { C } from '../palette';
import { clamp, hash2 } from '../util';

interface Cell {
  x: number;
  y: number;
  c: number;
  cover: number;
  reveal: number;
  xn: number;
  edge: boolean;
}

const FAMILY = '"Playfair Display", "Didot", Georgia, serif';
const FILL = cis('.:=+*#');
const SCRAMBLE = cis('!<>-_\\/[]{}=+*^?#%');
const EDGE = { h: ci('-'), v: ci('|'), up: ci('/'), down: ci('\\'), under: ci('_') };

/**
 * "Merry Christmas" set in an italic serif, then re-drawn in ASCII:
 * outlines follow the stroke direction, interiors use a density ramp.
 * Each cell decodes from random glyphs, left to right.
 */
export class Title {
  private cells: Cell[] = [];
  private M!: Metrics;
  private settledAt = 0;
  snapshot: Snapshot | null = null;
  start = 4.4;

  build(L: Layout, M: Metrics) {
    const lines = L.portrait ? ['Merry', 'Christmas'] : ['Merry Christmas'];
    const boxW = L.W * (L.portrait ? 0.86 : 0.78);
    const boxH = L.titleBot - L.titleTop;

    const cnv = document.createElement('canvas');
    cnv.width = Math.ceil(L.W);
    cnv.height = Math.ceil(boxH);
    const ctx = cnv.getContext('2d', { willReadFrequently: true })!;
    ctx.font = `italic 700 100px ${FAMILY}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const lineGap = 1.02;
    const size = Math.min((100 * boxW) / widest, boxH / (lines.length * lineGap));
    ctx.font = `italic 700 ${size}px ${FAMILY}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      const y = boxH / 2 + (i - (lines.length - 1) / 2) * size * lineGap;
      ctx.fillText(line, L.W / 2, y);
    });

    const data = ctx.getImageData(0, 0, cnv.width, cnv.height).data;
    const { cw, ch: cellH, cols } = M;
    const row0 = Math.floor(L.titleTop / cellH);
    const row1 = Math.ceil(L.titleBot / cellH);
    const nr = row1 - row0 + 1;
    const cover = new Float32Array(nr * cols);
    const S = 4;
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let sy = 0; sy < S; sy++) {
          for (let sx = 0; sx < S; sx++) {
            const px = Math.floor((c + (sx + 0.5) / S) * cw);
            const py = Math.floor((row0 + r + (sy + 0.5) / S) * cellH - L.titleTop);
            if (px < 0 || py < 0 || px >= cnv.width || py >= cnv.height) continue;
            sum += data[(py * cnv.width + px) * 4 + 3];
          }
        }
        cover[r * cols + c] = sum / (S * S * 255);
      }
    }

    const at = (r: number, c: number) =>
      r < 0 || r >= nr || c < 0 || c >= cols ? 0 : cover[r * cols + c];

    let minX = Infinity;
    let maxX = -Infinity;
    const raw: Omit<Cell, 'xn' | 'reveal'>[] = [];
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < cols; c++) {
        const v = at(r, c);
        if (v < 0.14) continue;
        let ch: number;
        let edge = false;
        if (v < 0.55) {
          // outline: pick a glyph that follows the stroke
          const gx = (at(r, c + 1) - at(r, c - 1)) / cw;
          const gy = (at(r + 1, c) - at(r - 1, c)) / cellH;
          const ex = -gy;
          const ey = gx; // edge direction, perpendicular to the gradient
          const ang = Math.atan2(Math.abs(ey), Math.abs(ex));
          edge = true;
          if (ex === 0 && ey === 0) ch = FILL[1];
          else if (ang < 0.42) ch = gy > 0 ? EDGE.under : EDGE.h;
          else if (ang > 1.15) ch = EDGE.v;
          else ch = ex * ey < 0 ? EDGE.up : EDGE.down;
        } else {
          ch = FILL[Math.min(FILL.length - 1, Math.floor(((v - 0.55) / 0.45) * FILL.length * 0.6 + FILL.length * 0.4))];
        }
        raw.push({ x: c, y: row0 + r, c: ch, cover: v, edge });
        minX = Math.min(minX, c);
        maxX = Math.max(maxX, c);
      }
    }
    const span = Math.max(1, maxX - minX);
    this.cells = raw.map((cell) => {
      const xn = (cell.x - minX) / span;
      return { ...cell, xn, reveal: this.start + xn * 1.5 + hash2(cell.x, cell.y) * 0.35 };
    });
    this.M = M;
    this.settledAt = Math.max(0, ...this.cells.map((c) => c.reveal)) + 1.1;
    this.snapshot = null;
  }

  private paint(grid: Grid, cell: Cell, boost: number, settle: number) {
    const a = (cell.edge ? 0.62 + 0.38 * cell.cover : 0.5 + 0.2 * cell.cover) + boost * 0.35;
    const color = boost > 0.45 ? C.warm : cell.edge ? C.gold : C.champagne;
    grid.set(cell.x, cell.y, cell.c, color, a, (cell.edge ? 0.22 : 0.08) + boost * 0.8 + (1 - settle) * 0.5);
  }

  /**
   * Draws into the fine grid. Once every cell has settled, the static title is
   * baked into a snapshot and only the travelling highlight is drawn per frame.
   */
  draw(grid: Grid, time: number, introT: number, renderer: Renderer) {
    if (!this.snapshot && introT > this.settledAt) {
      const g = new Grid();
      g.resize(this.M.cols, this.M.rows);
      for (const cell of this.cells) this.paint(g, cell, 0, 1);
      this.snapshot = renderer.snapshot(g);
    }
    const sweep = ((time * 0.16) % 1.7) - 0.35;
    const tick = Math.floor(time * 16);
    for (const cell of this.cells) {
      const d = (cell.xn - sweep) / 0.07;
      const boost = Math.exp(-d * d);
      if (this.snapshot) {
        if (boost > 0.03) grid.set(cell.x, cell.y, cell.c, C.warm, boost * 0.55, boost * 0.85);
        continue;
      }
      const local = introT - cell.reveal;
      if (local < 0) continue;
      if (local < 0.45) {
        const g = SCRAMBLE[Math.floor(hash2(cell.x * 3.1, cell.y + tick) * SCRAMBLE.length)];
        grid.set(cell.x, cell.y, g, C.goldPale, 0.35 + local, 0.6);
        continue;
      }
      this.paint(grid, cell, boost, clamp((local - 0.45) / 0.6));
    }
  }
}
