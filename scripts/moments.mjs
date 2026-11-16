// Screenshot specific intro moments: node scripts/moments.mjs 1.5 2.5 4.1 ...
// Uses ?t=<seconds> to jump the clock, so captures aren't skewed by screenshot time.
import { chromium } from 'playwright';
const base = process.env.URL ?? 'http://localhost:4173/';
const times = process.argv.slice(2).map(Number);
const vp = process.env.MOBILE ? { width: 390, height: 844, deviceScaleFactor: 2 } : { width: 1440, height: 900, deviceScaleFactor: 1 };
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
for (const t of times) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
  await page.goto(`${base}?t=${Math.max(0, t - 0.5)}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `.shots/${process.env.MOBILE ? 'm' : 'd'}-at-${t}.png` });
  await page.close();
}
const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
await page.goto(`${base}?t=12`);
await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => window.__prof)));
await browser.close();
