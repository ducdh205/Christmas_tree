// Walks through the gate and every gift; screenshots into .shots/
import { chromium } from 'playwright';
const base = process.env.URL ?? 'http://localhost:4173/';
const mobile = !!process.env.MOBILE;
const vp = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const tag = mobile ? 'm' : 'd';
const shot = (n) => page.screenshot({ path: `.shots/${tag}-${n}.png` });

if (!process.env.SKIP_GATE) {
  await page.goto(base);
  await page.waitForTimeout(3000);
  await shot('gate');
  await page.click('#gate');
  await page.waitForTimeout(2600);
  await shot('after-gate');
}
await page.goto(base + '?t=9');
await page.waitForTimeout(800);
const rects = await page.evaluate(() => window.__gifts());
console.log('gift rects', JSON.stringify(rects));
const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
await page.mouse.move(...center(rects[0]));
await page.waitForTimeout(300);
await shot('hover');
const esc = () => page.keyboard.press('Escape');

await page.mouse.click(...center(rects[0]));
await page.waitForTimeout(600);
await shot('gift0-opening');
await page.waitForTimeout(4500);
await shot('aurora');

await page.mouse.click(...center(rects[1]));
await page.waitForTimeout(4200);
await shot('portrait');
await page.click('.portrait');
await page.waitForTimeout(1200);
await shot('portrait-photo');
await esc();
await page.waitForTimeout(600);

await page.mouse.click(...center(rects[2]));
await page.waitForTimeout(2200);
await shot('meteors');

await page.mouse.click(...center(rects[3]));
await page.waitForTimeout(2200);
await shot('fireworks-1');
await page.waitForTimeout(2600);
await shot('fireworks-name');
await page.waitForTimeout(1500);
await shot('gifts-open');
console.log('stored:', await page.evaluate(() => localStorage.getItem('dilahn-gifts-opened-v2')));
console.log('errors:', errors);
await browser.close();
