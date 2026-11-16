import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/playfair-display/700-italic.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import './style.css';

import { MusicBox } from './audio';
import { TrackPlayer } from './track';
import { Grid } from './grid';
import { Layout, computeLayout } from './layout';
import { Renderer } from './renderer';
import { drawGround } from './scene/ground';
import { Snow } from './scene/snow';
import { Starfield } from './scene/stars';
import { Sparkles } from './scene/sparkles';
import { Title } from './scene/title';
import { Intro, TIMELINE, Tree } from './scene/tree';
import { clamp, easeInOut, lerp } from './util';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
const caption = $('caption');
const soundBtn = $<HTMLButtonElement>('sound');
const flash = $('flash');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTRO_SPEED = reduced ? 3 : 1;

const renderer = new Renderer($<HTMLCanvasElement>('scene'), $<HTMLCanvasElement>('glow'));
const grid = new Grid();
const fineGrid = new Grid();
const tree = new Tree();
const snow = new Snow();
const stars = new Starfield();
const sparkles = new Sparkles();
const title = new Title();
title.start = TIMELINE.ignite + 1.0;
/** Drop your own copy of the song here; without it the synthesised music box plays. */
const TRACK_SRC = `${import.meta.env.BASE_URL}music/christmas-tree.mp3`;
let music: MusicBox | TrackPlayer = new MusicBox();
music.onNote = () => (tree.beat = 1);

async function pickMusic() {
  if (!(await TrackPlayer.available(TRACK_SRC))) return;
  music = new TrackPlayer(TRACK_SRC);
  music.onNote = () => (tree.beat = 1);
  soundBtn.title = 'Christmas Tree — V';
}

let L: Layout;
const params = new URLSearchParams(location.search);
let time = Number(params.get('t')) || 0;
const frozen = params.has('freeze');
if (params.has('t')) document.getElementById('stage')!.classList.add('instant');
const prof = { scene: 0, render: 0 };
(window as unknown as { __prof: typeof prof }).__prof = prof;
let last = 0;
let ignited = false;
/** smoothed JS cost of one frame in ms (read it from the console: __frameCost()) */
let frameCost = 0;
(window as unknown as { __frameCost: () => number }).__frameCost = () => frameCost;

// --- rotation & input -------------------------------------------------------
const BASE_SPIN = reduced ? 0.08 : 0.24;
let spin = 0;
let windTarget = 0;
let pointer: { id: number; x: number; y: number; moved: number; lastT: number; vel: number } | null = null;

function resize() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const { base, fine } = renderer.resize(W, H);
  grid.resize(base.cols, base.rows);
  fineGrid.resize(fine.cols, fine.rows);
  L = computeLayout(W, H, base.cw, base.ch, base.cols, base.rows);
  title.build(L, fine);
  snow.reset(L);
  stars.reset(L);
  flash.style.setProperty('--sx', `${L.cx}px`);
  flash.style.setProperty('--sy', `${L.starY}px`);
  caption.style.top = `${L.titleBot + H * 0.012}px`;
}

function introState(): Intro {
  const t = time * INTRO_SPEED;
  return {
    t,
    build: easeInOut((t - TIMELINE.buildStart) / TIMELINE.buildDur),
    star: clamp((t - TIMELINE.ignite) / 1.0),
  };
}

function frame(now: number) {
  const t0 = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (!frozen) time += dt;
  const intro = introState();

  if (!pointer) {
    spin *= Math.exp(-dt * 1.1);
    tree.rot += (BASE_SPIN + spin) * dt;
  }
  tree.beat *= Math.exp(-dt * 4);
  snow.wind = lerp(snow.wind, windTarget, 1 - Math.exp(-dt * 1.5));
  snow.speed = reduced ? 0.4 : 1;
  snow.update(dt, time);
  sparkles.update(dt, L.scale);

  // the moment the comet reaches the tip: flash, burst of sparks, aura
  if (!ignited && intro.t >= TIMELINE.ignite) {
    ignited = true;
    sparkles.burst(L.cx, L.starY, L.scale, 90, 2.2);
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
    stage.classList.add('lit');
  }

  const snowIn = clamp(intro.t / 2);
  grid.clear();
  fineGrid.clear();
  stars.draw(grid, time, clamp(intro.t / 1.5));
  snow.draw(grid, false, snowIn);
  drawGround(grid, L, time, intro.t);
  tree.draw(grid, L, time, intro);
  if (tree.comet) sparkles.trail(tree.comet.x, tree.comet.y, L.scale, tree.comet.front ? 5 : 1);
  title.draw(fineGrid, time, intro.t, renderer);
  snow.draw(grid, true, snowIn);
  sparkles.draw(grid, L, time);
  const tScene = performance.now();
  renderer.render(grid, fineGrid, [title.snapshot]);
  prof.scene = lerp(prof.scene, tScene - t0, 0.05);
  prof.render = lerp(prof.render, performance.now() - tScene, 0.05);
  frameCost = lerp(frameCost, performance.now() - t0, 0.05);

  requestAnimationFrame(frame);
}

stage.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, lastT: performance.now(), vel: 0 };
  stage.setPointerCapture(e.pointerId);
});

stage.addEventListener('pointermove', (e) => {
  windTarget = (e.clientX / window.innerWidth - 0.5) * 36 * (L?.scale ?? 1);
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x;
  const nowT = performance.now();
  const dtp = Math.max(1, nowT - pointer.lastT) / 1000;
  pointer.moved += Math.abs(dx) + Math.abs(e.clientY - pointer.y);
  if (pointer.moved > 6) stage.classList.add('dragging');
  const k = 5 / Math.max(L.maxR, 80);
  tree.rot += dx * k;
  pointer.vel = lerp(pointer.vel, (dx * k) / dtp, 0.4);
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.lastT = nowT;
});

const release = (e: PointerEvent) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  if (pointer.moved <= 6) sparkles.burst(e.clientX, e.clientY, L.scale);
  else spin = clamp(pointer.vel - BASE_SPIN, -5, 5);
  pointer = null;
  stage.classList.remove('dragging');
};
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);

soundBtn.addEventListener('click', async () => {
  let on = false;
  try {
    on = await music.toggle();
  } catch (err) {
    console.warn('music could not start', err);
  }
  soundBtn.setAttribute('aria-pressed', String(on));
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && music.playing) {
    music.stop();
    soundBtn.setAttribute('aria-pressed', 'false');
  }
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resize, 120);
});

// --- captions ---------------------------------------------------------------
function fillCaption() {
  const now = new Date();
  const y = now.getFullYear();
  const xmas = new Date(y, 11, 25);
  const today = new Date(y, now.getMonth(), now.getDate());
  const days = Math.round((xmas.getTime() - today.getTime()) / 86400000);
  const newYear = now.getMonth() >= 6 ? y + 1 : y;
  $('subtitle').textContent = `and a Happy New Year ${newYear}`;
  let line: string;
  if (days > 1) line = `${days} days until Christmas`;
  else if (days === 1) line = 'Christmas Eve';
  else if (days === 0) line = 'Today is Christmas';
  else line = "Season's Greetings";
  $('countdown').textContent = `·  ${line}  ·`;
}

// --- boot -------------------------------------------------------------------
async function boot() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "JetBrains Mono"'),
        document.fonts.load('italic 700 64px "Playfair Display"'),
        document.fonts.load('italic 400 20px "Cormorant Garamond"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  fillCaption();
  pickMusic();
  resize();
  requestAnimationFrame((t) => {
    last = t;
    stage.classList.add('ready');
    requestAnimationFrame(frame);
  });
  const ms = (s: number) => (s * 1000) / INTRO_SPEED;
  setTimeout(() => stage.classList.add('show-caption'), ms(7.2));
  setTimeout(() => stage.classList.add('show-ui'), ms(7.6));
  setTimeout(() => stage.classList.add('show-hint'), ms(8.2));
  setTimeout(() => stage.classList.remove('show-hint'), ms(15));
}

boot();
