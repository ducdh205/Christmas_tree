/** Where everything sits, in CSS pixels, derived from the viewport. */
export interface Layout {
  W: number;
  H: number;
  cw: number;
  ch: number;
  cols: number;
  rows: number;
  /** cell height / cell width — how many columns span one row's height */
  aspect: number;
  portrait: boolean;
  /** 1 at a 900px-tall viewport */
  scale: number;
  cx: number;
  starY: number;
  treeTop: number;
  treeBot: number;
  maxR: number;
  trunkBot: number;
  trunkW: number;
  groundY: number;
  titleTop: number;
  titleBot: number;
}

export function computeLayout(W: number, H: number, cw: number, ch: number, cols: number, rows: number): Layout {
  const portrait = W / H < 0.78;
  const treeTop = H * (portrait ? 0.17 : 0.11);
  const treeBot = H * (portrait ? 0.585 : 0.58);
  const maxR = Math.min((treeBot - treeTop) * (portrait ? 0.44 : 0.48), W * 0.4);
  const groundY = treeBot + H * 0.048;
  const titleTop = groundY + H * (portrait ? 0.045 : 0.035);
  const titleBot = H * (portrait ? 0.865 : 0.85);

  return {
    W,
    H,
    cw,
    ch,
    cols,
    rows,
    aspect: ch / cw,
    portrait,
    scale: H / 900,
    cx: W / 2,
    starY: treeTop - H * 0.03,
    treeTop,
    treeBot,
    maxR,
    trunkBot: groundY,
    trunkW: Math.max(cw * 1.6, maxR * 0.075),
    groundY,
    titleTop,
    titleBot,
  };
}

/** Height of the snowy ground at x (a soft mound under the tree). */
export function groundSurfaceY(L: Layout, x: number) {
  const d = (x - L.cx) / (L.maxR * 1.35);
  return L.groundY - L.H * 0.02 * Math.exp(-d * d);
}
