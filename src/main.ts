import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/playfair-display/700-italic.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import './style.css';
import './gifts/gifts.css';

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
import { GIFTS_READY, GIFT_KINDS, Intro, TIMELINE, Tree } from './scene/tree';
import { Fireworks } from './scene/fireworks';
import { Aurora, Meteors } from './scene/skyfx';
import { GiftModal } from './gifts/overlay';
import { ADDRESS, NAME } from './gifts/content';
import { clamp, easeInOut, lerp } from './util';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
const caption = $('caption');
const soundBtn = $<HTMLButtonElement>('sound');
const flash = $('flash');
const gate = $('gate');

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
const fireworks = new Fireworks(NAME);
const aurora = new Aurora();
const meteors = new Meteors();
meteors.onBurnout = (x, y) => sparkles.burst(x, y, L.scale, 12, 0.5);
const modal = new GiftModal();
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
/** always-running clock (twinkles, snow, gift animations) */
let time = 0;
/** intro clock: starts when the gate is opened (or at ?t=<seconds>) */
let introTime = Number(params.get('t')) || 0;
let started = params.has('t');
const frozen = params.has('freeze');
if (params.has('t')) document.getElementById('stage')!.classList.add('instant');
const prof = { scene: 0, render: 0 };
(window as unknown as { __prof: typeof prof }).__prof = prof;
let last = 0;
let ignited = false;
/** smoothed JS cost of one frame in ms (read it from the console: __frameCost()) */
let frameCost = 0;
(window as unknown as { __frameCost: () => number }).__frameCost = () => frameCost;
(window as unknown as { __gifts: () => unknown }).__gifts = () => tree.gifts.map((g) => g.rect);

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
  fireworks.build(L);
  snow.reset(L);
  stars.reset(L);
  flash.style.setProperty('--sx', `${L.cx}px`);
  flash.style.setProperty('--sy', `${L.starY}px`);
  caption.style.top = `${L.titleBot + H * 0.012}px`;
}

function introState(): Intro {
  const t = introTime * INTRO_SPEED;
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
  if (!frozen) {
    time += dt;
    if (started) introTime += dt;
  }
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
  fireworks.update(dt, L);
  aurora.update(dt);
  meteors.update(dt);

  // the moment the comet reaches the tip: flash, burst of sparks, aura
  if (!ignited && intro.t >= TIMELINE.ignite) {
    ignited = true;
    sparkles.burst(L.cx, L.starY, L.scale, 90, 2.2);
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
    stage.classList.add('lit');
  }

  const snowIn = clamp(time / 2);
  grid.clear();
  fineGrid.clear();
  stars.draw(grid, time, clamp(time / 1.5));
  aurora.draw(grid, L);
  meteors.draw(grid, L, time);
  snow.draw(grid, false, snowIn);
  drawGround(grid, L, time, intro.t);
  tree.draw(grid, L, time, intro);
  fireworks.draw(grid, L, time);
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

const giftsReady = () => started && introTime * INTRO_SPEED > GIFTS_READY;

stage.addEventListener('pointermove', (e) => {
  windTarget = (e.clientX / window.innerWidth - 0.5) * 36 * (L?.scale ?? 1);
  if (!pointer && L) {
    const hit = giftsReady() ? tree.giftAt(e.clientX, e.clientY) : -1;
    tree.gifts.forEach((g, i) => (g.hover = i === hit));
    stage.classList.toggle('over-gift', hit >= 0);
  }
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
  if (pointer.moved <= 6) {
    const hit = giftsReady() ? tree.giftAt(e.clientX, e.clientY) : -1;
    if (hit >= 0) openGift(hit);
    else sparkles.burst(e.clientX, e.clientY, L.scale);
  }
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

// --- gifts ------------------------------------------------------------------
const OPENED_KEY = 'dilahn-gifts-opened-v2';
function loadOpened() {
  try {
    const list = JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]') as number[];
    list.forEach((i) => tree.gifts[i] && (tree.gifts[i].opened = -Infinity));
  } catch {
    /* storage unavailable: every visit starts fresh */
  }
}
function saveOpened() {
  try {
    const list = tree.gifts.flatMap((g, i) => (Number.isNaN(g.opened) ? [] : [i]));
    localStorage.setItem(OPENED_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function openGift(i: number) {
  const g = tree.gifts[i];
  const first = Number.isNaN(g.opened);
  if (first) {
    g.opened = time;
    saveOpened();
  }
  const r = g.rect;
  if (r) window.setTimeout(() => sparkles.burst(r.x + r.w / 2, r.y + r.h / 2, L.scale, 40, 1.3), first ? 350 : 0);
  const kind = GIFT_KINDS[i];
  const delay = first ? 1000 : 150;
  const later = (fn: () => void) => window.setTimeout(fn, first ? 600 : 0);
  if (kind === 'fireworks') {
    if (!fireworks.active) later(() => fireworks.launch(L));
  } else if (kind === 'aurora') {
    later(() => aurora.trigger());
  } else if (kind === 'meteors') {
    if (!meteors.active) later(() => meteors.shower(L));
  } else {
    window.setTimeout(() => modal.open(kind), delay);
  }
}

// --- gate: "Gửi dilahn · chạm để mở" ------------------------------------------
async function startMusic() {
  try {
    const on = music.playing || (await music.toggle());
    soundBtn.setAttribute('aria-pressed', String(on));
  } catch (err) {
    console.warn('music could not start', err);
  }
}

function scheduleCaptions() {
  const ms = (s: number) => Math.max(0, (s * 1000) / INTRO_SPEED - introTime * 1000);
  setTimeout(() => stage.classList.add('show-caption'), ms(7.2));
  setTimeout(() => stage.classList.add('show-ui'), ms(7.6));
  setTimeout(() => stage.classList.add('show-hint'), ms(8.4));
  setTimeout(() => stage.classList.remove('show-hint'), ms(18));
}

function openGate() {
  if (started) return;
  started = true;
  gate.classList.add('gone');
  window.setTimeout(() => gate.remove(), 1600);
  startMusic();
  scheduleCaptions();
}
gate.addEventListener('click', openGate);
gate.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openGate();
  }
});

// --- captions ---------------------------------------------------------------
function fillCaption() {
  const now = new Date();
  const y = now.getFullYear();
  const xmas = new Date(y, 11, 25);
  const today = new Date(y, now.getMonth(), now.getDate());
  const days = Math.round((xmas.getTime() - today.getTime()) / 86400000);
  const newYear = now.getMonth() >= 6 ? y + 1 : y;
  $('subtitle').textContent = `gửi ${ADDRESS} · Happy New Year ${newYear}`;
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
  loadOpened();
  const musicReady = pickMusic();
  resize();
  if (started) {
    gate.remove();
    scheduleCaptions();
  } else {
    gate.querySelector<HTMLElement>('.gate-hint')!.textContent = 'chạm để mở quà';
    musicReady.finally(() => gate.classList.add('ready'));
  }
  requestAnimationFrame((t) => {
    last = t;
    stage.classList.add('ready');
    requestAnimationFrame(frame);
  });
}

boot();
