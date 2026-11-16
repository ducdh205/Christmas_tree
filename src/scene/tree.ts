import { ci, cis } from '../charset';
import { Grid } from '../grid';
import { Layout, groundSurfaceY } from '../layout';
import { C } from '../palette';
import { clamp, easeOutBack, hash2, mulberry32 } from '../util';

/** Intro timeline, in seconds. */
export const TIMELINE = {
  buildStart: 0.5,
  buildDur: 3.4,
  get ignite() {
    return this.buildStart + this.buildDur;
  },
};

export interface Intro {
  /** seconds since start (already scaled for reduced motion) */
  t: number;
  /** 0..1 comet spiralling from the ground to the tip, materialising the tree */
  build: number;
  /** 0..1 star igniting */
  star: number;
}

interface Light {
  t: number;
  phi: number;
  depth: number;
  color: number;
  speed: number;
  phase: number;
}

interface Ornament {
  t: number;
  phi: number;
  depth: number;
  color: number;
  glyph: number;
}

interface Gift {
  w: number;
  h: number;
  box: number;
  ribbon: number;
  /** -1 left of the trunk, +1 right */
  side: number;
  /** columns away from the trunk */
  gap: number;
}

const TIERS = 6;
const TURNS = 3.6;
/** rough seconds the comet takes to climb one unit of u */
const SEC_PER_U = TIMELINE.buildDur / (1 + 1 / TURNS);
const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;

const FOLIAGE = cis('.:-=+*x#%');
const SCRAMBLE = cis('*+x#%@&$?!/\\<>=~');
const SPECKS = cis('$&%@');
const SPECK_COLORS = [C.gold, C.red, C.blue, C.rose, C.goldPale];
const G = {
  slash: ci('/'),
  back: ci('\\'),
  tilde: ci('~'),
  pipe: ci('|'),
  hash: ci('#'),
  star: ci('*'),
  plus: ci('+'),
  eq: ci('='),
  mdot: ci('·'),
  o: ci('o'),
  at: ci('@'),
  dash: ci('-'),
};

// light from the upper left, slightly in front
const LX = -0.5;
const LY = 0.62;
const LZ = 0.6;

const GIFTS: Gift[] = [
  { w: 13, h: 5, box: C.deepRed, ribbon: C.gold, side: -1, gap: 1 },
  { w: 8, h: 3, box: C.blue, ribbon: C.silver, side: -1, gap: 16 },
  { w: 11, h: 4, box: C.red, ribbon: C.goldPale, side: 1, gap: 1 },
  { w: 8, h: 3, box: C.gold, ribbon: C.deepRed, side: 1, gap: 14 },
];

export class Tree {
  rot = 0;
  /** 0..1 pulse from the music, decays on its own */
  beat = 0;
  /** where the building comet's head is (CSS px), or null when it isn't flying */
  comet: { x: number; y: number; front: boolean } | null = null;
  readonly lights: Light[] = [];
  private ornaments: Ornament[] = [];

  constructor() {
    const rnd = mulberry32(1225);
    const LIGHT_COLORS = [C.warm, C.warm, C.gold, C.gold, C.red, C.blue, C.rose, C.goldPale];
    for (let i = 0; i < 170; i++) {
      this.lights.push({
        t: 0.06 + 0.91 * Math.sqrt(rnd()),
        phi: rnd() * TAU,
        depth: 0.8 + rnd() * 0.18,
        color: LIGHT_COLORS[Math.floor(rnd() * LIGHT_COLORS.length)],
        speed: 0.8 + rnd() * 2.2,
        phase: rnd() * TAU,
      });
    }
    const ORN_COLORS = [C.red, C.deepRed, C.gold, C.silver, C.blue, C.red, C.rose];
    const ORN_GLYPHS = cis('oO@0');
    for (let i = 0; i < 44; i++) {
      this.ornaments.push({
        t: 0.12 + 0.84 * Math.sqrt(rnd()),
        phi: rnd() * TAU,
        depth: 0.78 + rnd() * 0.16,
        color: ORN_COLORS[Math.floor(rnd() * ORN_COLORS.length)],
        glyph: ORN_GLYPHS[Math.floor(rnd() * ORN_GLYPHS.length)],
      });
    }
  }

  /** Tree radius at height t (0 = tip, 1 = bottom) facing world angle phi. */
  radius(L: Layout, t: number, phi: number) {
    const env = L.maxR * (0.03 + 0.97 * t);
    const ft = t * TIERS;
    const f = ft - Math.floor(ft);
    const k = 0.64 + 0.36 * Math.pow(f, 0.6);
    const jag = 1 + 0.07 * Math.sin(phi * 7 + t * 41) * Math.sin(phi * 3 - t * 19 + 1.3);
    return env * k * jag;
  }

  /**
   * The comet flies up a helix (u: 1 at the ground -> 0 at the tip, angle u·TURNS·2π).
   * A point on the tree at height t facing world angle phi is "touched" when the
   * comet passes over it: the nearest helix point at that angle just above it.
   * Returns that helix position u' — the point exists once the comet is above u'.
   */
  private touchU(t: number, phi: number) {
    const u = (t - 0.04) / 0.94;
    let d = (u * TURNS * TAU - phi) % TAU;
    if (d < 0) d += TAU;
    return u - d / (TURNS * TAU);
  }

  /**
   * Comet head position on the helix (u). It keeps climbing one extra turn past
   * the tip (u < 0, where it leaps up to the star), and the clock keeps running
   * afterwards so every cell finishes materialising.
   */
  private cometU(intro: Intro) {
    return 1 - intro.build * (1 + 1 / TURNS) - Math.max(0, intro.t - TIMELINE.ignite) / SEC_PER_U;
  }

  /** Where the comet is at helix position u (u < 0: rising from the tip to the star). */
  private cometPoint(L: Layout, u: number) {
    if (u >= 0) return this.place(L, 0.04 + u * 0.94, u * TURNS * TAU, 0.99);
    const f = clamp(-u * TURNS);
    const rel = u * TURNS * TAU - this.rot;
    const r = L.maxR * 0.06 * (1 - f);
    const x = L.cx + Math.sin(rel) * r;
    const y = L.treeTop + 0.04 * (L.treeBot - L.treeTop) * (1 - f) + (L.starY - L.treeTop) * f;
    return { z: Math.cos(rel), x, y, col: Math.floor(x / L.cw), row: Math.floor(y / L.ch) };
  }

  /** 0..1 position of the light wave running down the tree after ignition. */
  private wave(intro: Intro) {
    return (intro.t - TIMELINE.ignite - 0.15) / 1.1;
  }

  draw(grid: Grid, L: Layout, time: number, intro: Intro) {
    this.drawTrunk(grid, L, intro);
    this.drawFoliage(grid, L, time, intro);
    this.drawGifts(grid, L, intro);
    this.drawGarland(grid, L, time, intro);
    this.drawOrnaments(grid, L, time, intro);
    this.drawLights(grid, L, time, intro);
    this.drawComet(grid, L, intro);
    this.drawStar(grid, L, time, intro);
    this.drawShockwave(grid, L, intro);
  }

  private drawFoliage(grid: Grid, L: Layout, time: number, intro: Intro) {
    const h = L.treeBot - L.treeTop;
    const uc = this.cometU(intro);
    const wave = this.wave(intro);
    const waving = wave > -0.2 && wave < 1.3;
    const r0 = Math.floor(L.treeTop / L.ch);
    const r1 = Math.ceil(L.treeBot / L.ch);
    const c0 = Math.max(0, Math.floor((L.cx - L.maxR * 1.15) / L.cw));
    const c1 = Math.min(L.cols - 1, Math.ceil((L.cx + L.maxR * 1.15) / L.cw));
    const rot = this.rot;
    const tick = Math.floor(time * 22);

    for (let row = r0; row <= r1; row++) {
      const py = (row + 0.5) * L.ch;
      const t = (py - L.treeTop) / h;
      if (t < 0 || t > 1) continue;
      if ((t - 0.04) / 0.94 < uc - 0.01) continue; // comet hasn't reached this height yet
      const ft = t * TIERS;
      const f = ft - Math.floor(ft);
      const tierShade = 0.55 + 0.45 * Math.pow(f, 0.8);
      const rl = this.radius(L, t, rot - HALF_PI);
      const rr = this.radius(L, t, rot + HALF_PI);
      const wd = waving ? (t - wave) / 0.08 : 9;
      const waveBoost = waving ? 0.45 * Math.exp(-wd * wd) : 0;

      for (let col = c0; col <= c1; col++) {
        const dx = (col + 0.5) * L.cw - L.cx;
        const r = dx < 0 ? rl : rr;
        if (dx < -r || dx > r) continue;

        const nx0 = dx / r;
        const touched = this.touchU(t, Math.asin(nx0 < -1 ? -1 : nx0 > 1 ? 1 : nx0) + rot);
        const jitter = (hash2(col, row) - 0.5) * 0.012;
        const age = (touched - uc + jitter) * SEC_PER_U; // seconds since the comet touched this cell
        if (age < 0) continue;

        // materialising: flickering glyphs that cool from white-gold into green
        if (age < 0.38) {
          const hs = hash2(col * 1.3, row + tick);
          const color = age < 0.1 ? C.warm : age < 0.22 ? C.goldPale : C.pine3;
          grid.set(col, row, SCRAMBLE[Math.floor(hs * SCRAMBLE.length)], color, 0.95, 1 - age * 2);
          continue;
        }

        const nx = dx / r;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
        let diff = nx * 0.9 * LX + 0.42 * LY + nz * 0.9 * LZ;
        if (diff < 0) diff = 0;
        const phi = Math.asin(nx) + rot;
        const tex = Math.sin(phi * 17 + t * 57 + Math.sin(phi * 5 + t * 9) * 1.7) * Math.sin(phi * 9 - t * 33);
        const settle = Math.exp(-(age - 0.38) * 2.2) * 0.45; // afterglow of materialising
        let b = 0.2 + 0.86 * diff * tierShade + tex * 0.12;
        b = clamp(b * (0.72 + 0.28 * nz) + settle + waveBoost);
        const glow = settle * 0.8 + waveBoost * 1.2 + (b > 0.85 ? 0.12 : 0);

        if (nx < -0.9 || nx > 0.9) {
          grid.set(col, row, dx < 0 ? G.slash : G.back, b > 0.45 ? C.pine3 : C.pine2, 0.6 + 0.4 * b, glow);
          continue;
        }
        if (f > 0.86 && Math.sin(phi * 11 + t * 7) > 0.3 && nz > 0.25) {
          // snow resting on the branch tips
          grid.set(col, row, G.tilde, b > 0.45 ? C.snow : C.snowDim, 0.55 + 0.45 * b, 0.1 + glow);
          continue;
        }
        const pw = ((phi % TAU) + TAU) % TAU;
        const sp = hash2(Math.floor((pw / TAU) * 96), row * 1.7);
        if (sp > 0.955 && nz > 0.2) {
          // little coloured baubles and tinsel bits scattered in the needles
          const k = Math.floor(((sp - 0.955) / 0.045) * 97);
          grid.set(col, row, SPECKS[k % SPECKS.length], SPECK_COLORS[k % SPECK_COLORS.length], 0.6 + 0.4 * nz, 0.3 + glow);
          continue;
        }
        const color = b < 0.3 ? C.pine0 : b < 0.52 ? C.pine1 : b < 0.78 ? C.pine2 : C.pine3;
        grid.set(col, row, FOLIAGE[Math.floor(b * (FOLIAGE.length - 0.001))], color, 0.5 + 0.5 * b, glow);
      }
    }
  }

  private drawTrunk(grid: Grid, L: Layout, intro: Intro) {
    const appear = clamp(intro.build * 12);
    if (appear <= 0) return;
    const r0 = Math.floor(L.treeBot / L.ch) - 1;
    const r1 = Math.floor(groundSurfaceY(L, L.cx) / L.ch);
    const c0 = Math.floor((L.cx - L.trunkW) / L.cw);
    const c1 = Math.ceil((L.cx + L.trunkW) / L.cw);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const dx = (col + 0.5) * L.cw - L.cx;
        if (Math.abs(dx) > L.trunkW) continue;
        const nx = dx / L.trunkW;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
        const light = Math.max(0, -0.5 * nx + 0.8 * nz);
        const phi = Math.asin(nx) + this.rot;
        const c = Math.sin(phi * 6 + row * 0.9) > 0.55 ? G.hash : G.pipe;
        grid.set(col, row, c, C.bark, (0.4 + 0.6 * light) * appear);
      }
    }
  }

  /** The tinsel follows exactly the path the comet flew, so the comet "draws" it. */
  private drawGarland(grid: Grid, L: Layout, time: number, intro: Intro) {
    if (intro.build <= 0) return;
    const h = L.treeBot - L.treeTop;
    const uc = this.cometU(intro);
    const N = 1800;
    for (const tinsel of [true, false]) {
      const off = tinsel ? 0 : Math.PI;
      for (let i = 0; i <= N; i++) {
        const u = i / N; // 0 at the top, 1 at the bottom
        if (u < uc) continue;
        const t = 0.04 + u * 0.94;
        const phi = u * TURNS * TAU + off;
        const rel = phi - this.rot;
        const z = Math.cos(rel);
        if (z < 0.06) continue;
        const r = this.radius(L, t, phi) * 0.97;
        const x = L.cx + Math.sin(rel) * r;
        const y = L.treeTop + t * h;
        const vx = z * r * TURNS * TAU;
        const vy = 0.94 * h;
        const col = Math.floor(x / L.cw);
        const row = Math.floor(y / L.ch);
        const depth = 0.4 + 0.6 * z;
        if (tinsel) {
          if (Math.abs(vx) < vy * 1.4) continue; // skip steep runs near the silhouette
          const shimmer = 0.5 + 0.5 * Math.sin(u * 95 - time * 2.6);
          grid.set(col, row, G.tilde, shimmer > 0.7 ? C.goldPale : C.gold, (0.6 + 0.4 * shimmer) * depth, 0.4 + 0.6 * shimmer);
        } else if ((col + row) % 2 === 0) {
          const tw = 0.65 + 0.35 * Math.sin(u * 60 + time * 1.4);
          grid.set(col, row, G.o, C.silver, 0.7 * tw * depth, 0.35);
        }
      }
    }
  }

  private place(L: Layout, t: number, phi: number, depth: number) {
    const rel = phi - this.rot;
    const z = Math.cos(rel);
    const r = this.radius(L, t, phi) * depth;
    const x = L.cx + Math.sin(rel) * r;
    const y = L.treeTop + t * (L.treeBot - L.treeTop);
    return { z, x, y, col: Math.floor(x / L.cw), row: Math.floor(y / L.ch) };
  }

  /** The golden comet that spirals up and builds the tree, with a fading tail. */
  private drawComet(grid: Grid, L: Layout, intro: Intro) {
    this.comet = null;
    if (intro.build <= 0 || intro.build >= 1) return;
    const uc = this.cometU(intro);
    const TAIL = 90;
    for (let k = TAIL; k >= 0; k--) {
      const u = uc + k * 0.0022;
      if (u > 1) continue;
      const p = this.cometPoint(L, u);
      const fade = Math.pow(1 - k / TAIL, 1.4);
      const vis = p.z > 0 ? 1 : 0.3;
      const glyph = k < 2 ? G.at : k < 10 ? G.star : k < 34 ? G.plus : G.mdot;
      const color = k < 5 ? C.warm : k < 20 ? C.goldPale : C.gold;
      grid.set(p.col, p.row, glyph, color, fade * vis, fade * vis * 1.4);
      if (k === 0) {
        this.comet = { x: p.x, y: p.y, front: p.z > 0 };
        // a bright, slightly larger head
        grid.set(p.col - 1, p.row, G.star, C.goldPale, 0.85 * vis, 1.5 * vis);
        grid.set(p.col + 1, p.row, G.star, C.goldPale, 0.85 * vis, 1.5 * vis);
        grid.set(p.col, p.row - 1, G.plus, C.goldPale, 0.7 * vis, 1.3 * vis);
        grid.set(p.col, p.row + 1, G.plus, C.goldPale, 0.7 * vis, 1.3 * vis);
        grid.set(p.col, p.row, G.at, C.warm, vis, 2);
      }
    }
  }

  private drawOrnaments(grid: Grid, L: Layout, time: number, intro: Intro) {
    const uc = this.cometU(intro);
    for (const o of this.ornaments) {
      const appear = clamp((this.touchU(o.t, o.phi) - uc) / 0.02);
      if (appear <= 0) continue;
      const p = this.place(L, o.t, o.phi, o.depth);
      if (p.z < 0.08) continue;
      const depth = clamp((p.z - 0.08) / 0.35);
      const sheen = 0.82 + 0.18 * Math.sin(time * 0.8 + o.phi * 3);
      grid.set(p.col, p.row, o.glyph, o.color, depth * appear * sheen, 0.4 + (1 - appear));
    }
  }

  private drawLights(grid: Grid, L: Layout, time: number, intro: Intro) {
    const wave = this.wave(intro);
    if (wave <= 0) return;
    for (const l of this.lights) {
      const since = wave - l.t;
      if (since <= 0) continue;
      const appear = clamp(since / 0.06);
      const pop = Math.exp(-since * 5); // flare as the wave switches it on
      const p = this.place(L, l.t, l.phi, l.depth);
      if (p.z < 0.04) continue;
      const depth = clamp((p.z - 0.04) / 0.3);
      const tw = 0.5 + 0.5 * Math.sin(time * l.speed + l.phase);
      const b = clamp(0.4 + 0.6 * tw * tw + this.beat * 0.3 + pop);
      const c = b > 0.75 ? G.star : b > 0.5 ? G.plus : G.mdot;
      grid.set(p.col, p.row, c, l.color, b * depth * appear, b * 1.3 + pop);
    }
  }

  private drawStar(grid: Grid, L: Layout, time: number, intro: Intro) {
    if (intro.star <= 0) return;
    const ign = easeOutBack(intro.star);
    const flash = intro.star < 1 ? Math.sin(intro.star * Math.PI) : 0;
    const cx = Math.floor(L.cx / L.cw);
    const cy = Math.floor(L.starY / L.ch);
    const base = Math.max(2, (L.H * 0.036) / L.ch);
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.6);
    const mix = 0.5 + 0.5 * Math.sin(time * 0.55);
    const grow = ign * (0.9 + 0.22 * pulse + this.beat * 0.2) * (1 + flash * 1.6);
    const lenO = base * grow * (0.85 + 0.35 * mix);
    const lenD = base * grow * (0.5 + 0.3 * (1 - mix));
    const A = L.aspect;
    const arm = (k: number, len: number) => clamp(1 - k / (len + 1));
    const colr = (k: number, len: number) => (k < len * 0.45 ? C.goldPale : C.gold);

    // long, faint light beams
    const beam = base * 4.5 * ign;
    for (let k = Math.ceil(lenO); k <= beam; k++) {
      const a = 0.32 * (1 - k / beam) * (0.7 + 0.3 * pulse);
      grid.set(cx, cy - k, G.pipe, C.gold, a, a);
    }
    const beamH = beam * A * 0.8;
    for (let k = Math.ceil(lenO * A); k <= beamH; k++) {
      const a = 0.25 * (1 - k / beamH) * (0.7 + 0.3 * pulse);
      grid.set(cx - k, cy, G.dash, C.gold, a, a);
      grid.set(cx + k, cy, G.dash, C.gold, a, a);
    }

    for (let k = 1; k <= Math.ceil(lenO); k++) {
      const a = arm(k, lenO);
      grid.set(cx, cy - k, G.pipe, colr(k, lenO), a, a * 1.2);
      grid.set(cx, cy + k, G.pipe, colr(k, lenO), a, a * 1.2);
    }
    const lenH = lenO * A;
    for (let k = 1; k <= Math.ceil(lenH); k++) {
      const a = arm(k, lenH);
      grid.set(cx - k, cy, G.dash, colr(k, lenH), a, a * 1.2);
      grid.set(cx + k, cy, G.dash, colr(k, lenH), a, a * 1.2);
    }
    for (let k = 1; k <= Math.ceil(lenD); k++) {
      const a = arm(k, lenD) * 0.9;
      const xo = Math.round(k * A);
      grid.set(cx + xo, cy - k, G.slash, C.gold, a, a);
      grid.set(cx - xo, cy - k, G.back, C.gold, a, a);
      grid.set(cx + xo, cy + k, G.back, C.gold, a, a);
      grid.set(cx - xo, cy + k, G.slash, C.gold, a, a);
    }
    // a small solid core
    grid.set(cx - 1, cy, G.star, C.goldPale, ign, 1.2);
    grid.set(cx + 1, cy, G.star, C.goldPale, ign, 1.2);
    grid.set(cx, cy - 1, G.star, C.goldPale, ign * 0.9, 1.2);
    grid.set(cx, cy + 1, G.star, C.goldPale, ign * 0.9, 1.2);
    grid.set(cx, cy, G.at, C.warm, 1, 1.6);
  }

  /** Rings of light expanding from the star the moment it ignites. */
  private drawShockwave(grid: Grid, L: Layout, intro: Intro) {
    const k = (intro.t - TIMELINE.ignite) / 1.8;
    if (k <= 0 || k >= 1) return;
    const maxR = Math.hypot(L.W, L.H) * 0.75;
    const rings = [
      { lag: 0, glyph: G.star, color: C.goldPale, strength: 1 },
      { lag: 0.09, glyph: G.mdot, color: C.gold, strength: 0.6 },
    ];
    for (const ring of rings) {
      const kk = k - ring.lag;
      if (kk <= 0) continue;
      const R = (1 - Math.pow(1 - kk, 3)) * maxR;
      const a = Math.pow(1 - kk, 1.6) * ring.strength;
      const n = Math.ceil((TAU * R) / (L.cw * 0.9));
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU;
        const x = L.cx + Math.cos(ang) * R;
        const y = L.starY + Math.sin(ang) * R;
        if (x < 0 || y < 0 || x > L.W || y > L.H) continue;
        const flick = 0.6 + 0.4 * hash2(i, ring.lag * 10);
        grid.set(x / L.cw, y / L.ch, ring.glyph, ring.color, a * flick, a * flick);
      }
    }
  }

  private drawGifts(grid: Grid, L: Layout, intro: Intro) {
    const tc = Math.floor(L.cx / L.cw);
    const tw = Math.ceil(L.trunkW / L.cw);
    GIFTS.forEach((g, gi) => {
      const appear = clamp((intro.build - 0.04 - gi * 0.03) / 0.06);
      if (appear <= 0) return;
      const left = g.side < 0 ? tc - tw - g.gap - g.w : tc + tw + 1 + g.gap;
      const bottom = Math.floor(groundSurfaceY(L, (left + g.w / 2) * L.cw) / L.ch);
      const top = bottom - g.h + 1;
      const mid = Math.floor(g.w / 2);
      const band = Math.floor(g.h / 2);
      for (let r = 0; r < g.h; r++) {
        for (let i = 0; i < g.w; i++) {
          const vert = i === mid;
          const horiz = r === band;
          const shade = 0.62 + 0.38 * (1 - i / g.w); // lit from the left
          if (vert || horiz) {
            grid.set(left + i, top + r, vert && horiz ? G.plus : vert ? G.pipe : G.eq, g.ribbon, appear, 0.45);
          } else if (i === 0 || i === g.w - 1) {
            grid.set(left + i, top + r, G.pipe, g.box, shade * appear, 0.1);
          } else {
            grid.set(left + i, top + r, r === 0 ? G.eq : G.hash, g.box, shade * appear, 0.12);
          }
        }
      }
      // the bow
      grid.set(left + mid - 1, top - 1, G.back, g.ribbon, appear, 0.6);
      grid.set(left + mid, top - 1, G.o, g.ribbon, appear, 0.6);
      grid.set(left + mid + 1, top - 1, G.slash, g.ribbon, appear, 0.6);
    });
  }
}
