import { NAME, PORTRAIT } from './content';
import { hash2 } from '../util';

type Kind = 'portrait';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** A soft, centred card that shows what's inside a gift. */
export class GiftModal {
  private root = el('div', 'modal');
  private panel = el('div', 'modal-panel');
  private body = el('div', 'modal-body');
  private closeBtn = el('button', 'modal-close');
  private cleanup: (() => void) | null = null;
  private lastFocus: Element | null = null;
  onClose: (() => void) | null = null;

  constructor() {
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.hidden = true;
    this.closeBtn.type = 'button';
    this.closeBtn.setAttribute('aria-label', 'Đóng');
    this.closeBtn.textContent = '×';
    this.panel.append(this.closeBtn, this.body);
    this.root.append(this.panel);
    document.body.append(this.root);

    this.closeBtn.addEventListener('click', () => this.close());
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(kind: Kind) {
    this.cleanup?.();
    this.lastFocus = document.activeElement;
    this.body.replaceChildren();
    this.panel.dataset.kind = kind;
    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('in'));
    this.cleanup = portrait(this.body);
    this.closeBtn.focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.root.classList.remove('in');
    this.cleanup?.();
    this.cleanup = null;
    window.setTimeout(() => {
      if (!this.root.classList.contains('in')) this.root.hidden = true;
    }, 450);
    (this.lastFocus as HTMLElement | null)?.focus?.({ preventScroll: true });
    this.onClose?.();
  }
}

// --- the portrait: the photo redrawn in coloured ASCII, developing top-down ---
const RAMP = ' .:-=+*x#%@';
const SCRAMBLE = '*+x#%@&$?!/\\<>=~';

function portrait(body: HTMLElement) {
  const frame = el('div', 'portrait');
  const canvas = el('canvas', 'portrait-ascii');
  const photo = el('img', 'portrait-photo');
  photo.alt = `Ảnh ${NAME}`;
  const caption = el('p', 'portrait-caption', '…');
  const hint = el('p', 'portrait-hint', PORTRAIT.hint);
  frame.append(canvas, photo);
  body.append(frame, caption, hint);

  let raf = 0;
  let alive = true;
  const img = new Image();
  img.onerror = () => {
    caption.textContent = 'Chưa có ảnh — đặt ảnh vào public/gift/dilahn.png nhé.';
    hint.remove();
  };
  img.onload = () => {
    if (!alive) return;
    photo.src = img.src;
    const width = Math.min(520, window.innerWidth - 64);
    const cols = Math.max(64, Math.min(120, Math.round(width / 4.2)));
    const cw = width / cols;
    const fs = cw / 0.6;
    const ch = fs * 1.12;
    const rows = Math.round(cols * (img.height / img.width) * (cw / ch));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cols * cw * dpr);
    canvas.height = Math.round(rows * ch * dpr);
    frame.style.width = `${cols * cw}px`;
    frame.style.height = `${rows * ch}px`;

    const small = document.createElement('canvas');
    small.width = cols;
    small.height = rows;
    const sctx = small.getContext('2d', { willReadFrequently: true })!;
    sctx.drawImage(img, 0, 0, cols, rows);
    const px = sctx.getImageData(0, 0, cols, rows).data;

    // stretch contrast between the 3rd and 97th percentile so the figure stands out
    const lums = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) lums[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    const sorted = Float32Array.from(lums).sort();
    const lo = sorted[Math.floor(sorted.length * 0.03)];
    const hi = sorted[Math.floor(sorted.length * 0.97)];

    interface Cell { x: number; y: number; c: string; color: string; at: number; state: number }
    const cells: Cell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const lum = Math.min(1, Math.max(0, (lums[y * cols + x] - lo) / Math.max(0.05, hi - lo)));
        const c = RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(lum, 1.1) * RAMP.length))];
        if (c === ' ') continue;
        // lift the colours a touch so dark areas still read on the dark card
        const boost = (v: number) => Math.min(255, Math.round(v * 1.3 + 30));
        cells.push({ x, y, c, color: `rgb(${boost(r)},${boost(g)},${boost(b)})`, at: (y / rows) * 1.8 + hash2(x, y) * 0.55, state: 0 });
      }
    }
    caption.textContent = PORTRAIT.caption.replace('{n}', cells.length.toLocaleString('vi-VN'));

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.font = `${fs}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const start = performance.now();
    let pending = cells.length;
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      for (const cell of cells) {
        if (cell.state === 2 || t < cell.at) continue;
        ctx.clearRect(cell.x * cw, cell.y * ch, cw, ch);
        if (t < cell.at + 0.22) {
          cell.state = 1;
          ctx.fillStyle = '#ffecad';
          ctx.fillText(SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)], (cell.x + 0.5) * cw, (cell.y + 0.5) * ch);
        } else {
          cell.state = 2;
          pending--;
          ctx.fillStyle = cell.color;
          ctx.fillText(cell.c, (cell.x + 0.5) * cw, (cell.y + 0.5) * ch);
        }
      }
      if (pending > 0 && alive) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  img.src = PORTRAIT.src;

  const toggle = () => frame.classList.toggle('show-photo');
  frame.addEventListener('click', toggle);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    frame.removeEventListener('click', toggle);
  };
}
