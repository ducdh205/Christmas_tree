import { CHARSET } from './charset';
import { Grid } from './grid';
import { PALETTE } from './palette';
import { clamp } from './util';

const FONT = '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
const GLOW_SCALE = 0.5;

export interface Snapshot {
  main: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}

export interface Metrics {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
}

/** One cell size + its pre-rendered glyph atlas (a row of glyphs per palette colour). */
class GlyphLayer {
  atlas = document.createElement('canvas');
  cwD = 1;
  chD = 1;
  cw = 1;
  ch = 1;

  setup(fontSize: number, dpr: number, W: number, H: number): Metrics {
    // integer device-pixel cells keep glyphs crisp
    this.cwD = Math.max(1, Math.round(fontSize * 0.6 * dpr));
    this.chD = Math.max(1, Math.round(fontSize * 1.2 * dpr));
    this.cw = this.cwD / dpr;
    this.ch = this.chD / dpr;

    const glyphs = [...CHARSET];
    const a = this.atlas;
    a.width = glyphs.length * this.cwD;
    a.height = PALETTE.length * this.chD;
    const c = a.getContext('2d')!;
    c.clearRect(0, 0, a.width, a.height);
    c.font = `${fontSize * dpr}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    PALETTE.forEach((color, row) => {
      c.fillStyle = color;
      glyphs.forEach((g, i) => {
        c.fillText(g, i * this.cwD + this.cwD / 2, row * this.chD + this.chD / 2 + dpr * 0.5);
      });
    });
    return { cols: Math.ceil(W / this.cw), rows: Math.ceil(H / this.ch), cw: this.cw, ch: this.ch };
  }

  draw(ctx: CanvasRenderingContext2D, gctx: CanvasRenderingContext2D, grid: Grid) {
    const { atlas, cwD, chD } = this;
    const gw = this.cw * GLOW_SCALE;
    const gh = this.ch * GLOW_SCALE;
    const { cols, rows, a, glow, ch, col } = grid;
    for (let y = 0; y < rows; y++) {
      const base = y * cols;
      for (let x = 0; x < cols; x++) {
        const i = base + x;
        const al = a[i];
        if (al <= 0.01) continue;
        const sx = ch[i] * cwD;
        const sy = col[i] * chD;
        ctx.globalAlpha = al;
        ctx.drawImage(atlas, sx, sy, cwD, chD, x * cwD, y * chD, cwD, chD);
        const g = glow[i];
        if (g > 0.06) {
          const ga = al * g;
          gctx.globalAlpha = ga > 1 ? 1 : ga;
          // slightly enlarged so the bloom reads as a halo
          gctx.drawImage(atlas, sx, sy, cwD, chD, x * gw - gw * 0.3, y * gh - gh * 0.3, gw * 1.6, gh * 1.6);
        }
      }
    }
  }
}

/**
 * Draws Grids to a canvas: the main scene at the base cell size and the title
 * on a finer grid, plus a low-res "emissive" canvas that CSS blurs and screens
 * on top for bloom.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private gctx: CanvasRenderingContext2D;
  private base = new GlyphLayer();
  private fine = new GlyphLayer();
  dpr = 1;

  constructor(
    private main: HTMLCanvasElement,
    private glow: HTMLCanvasElement,
  ) {
    this.ctx = main.getContext('2d', { alpha: true })!;
    this.gctx = glow.getContext('2d', { alpha: true })!;
  }

  resize(W: number, H: number): { base: Metrics; fine: Metrics } {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fontSize = clamp(Math.round(Math.min(H / 90, W / 60)), 7, 14);
    const base = this.base.setup(fontSize, this.dpr, W, H);
    const fine = this.fine.setup(Math.max(this.dpr > 1 ? 3.5 : 5, fontSize * 0.5), this.dpr, W, H);

    this.main.width = Math.ceil(W * this.dpr);
    this.main.height = Math.ceil(H * this.dpr);
    this.main.style.width = `${W}px`;
    this.main.style.height = `${H}px`;
    this.glow.width = Math.ceil(W * GLOW_SCALE);
    this.glow.height = Math.ceil(H * GLOW_SCALE);
    this.glow.style.width = `${W}px`;
    this.glow.style.height = `${H}px`;
    return { base, fine };
  }

  /** Pre-render a fine grid once, so static content costs one blit per frame. */
  snapshot(fineGrid: Grid): Snapshot {
    const main = document.createElement('canvas');
    main.width = this.main.width;
    main.height = this.main.height;
    const glow = document.createElement('canvas');
    glow.width = this.glow.width;
    glow.height = this.glow.height;
    this.fine.draw(main.getContext('2d')!, glow.getContext('2d')!, fineGrid);
    return { main, glow };
  }

  render(grid: Grid, fineGrid: Grid, statics: (Snapshot | null)[] = []) {
    const { ctx, gctx } = this;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.main.width, this.main.height);
    gctx.globalAlpha = 1;
    gctx.clearRect(0, 0, this.glow.width, this.glow.height);
    for (const s of statics) {
      if (!s) continue;
      ctx.globalAlpha = 1;
      gctx.globalAlpha = 1;
      ctx.drawImage(s.main, 0, 0);
      gctx.drawImage(s.glow, 0, 0);
    }
    this.base.draw(ctx, gctx, grid);
    this.fine.draw(ctx, gctx, fineGrid);
  }
}
