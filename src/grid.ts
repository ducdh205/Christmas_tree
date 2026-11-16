/**
 * The frame buffer: one glyph per cell, with colour, opacity and a glow amount.
 * Scene layers write into it in painter's order; the renderer draws it.
 */
export class Grid {
  cols = 0;
  rows = 0;
  ch = new Uint8Array(0);
  col = new Uint8Array(0);
  a = new Float32Array(0);
  glow = new Float32Array(0);

  resize(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.ch = new Uint8Array(n);
    this.col = new Uint8Array(n);
    this.a = new Float32Array(n);
    this.glow = new Float32Array(n);
  }

  clear() {
    this.a.fill(0);
    this.glow.fill(0);
  }

  set(x: number, y: number, c: number, color: number, alpha: number, glow = 0) {
    if (alpha <= 0.01) return;
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = c;
    this.col[i] = color;
    this.a[i] = alpha > 1 ? 1 : alpha;
    this.glow[i] = glow;
  }
}
