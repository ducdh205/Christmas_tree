// Usage: node scripts/shots.mjs [url]  — screenshots the scene at a few moments.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch(process.env.GPU ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } : {});
const sizes = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
];
for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.deviceScaleFactor ?? 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  for (const t of (process.env.TIMES ?? '2.5,4.5,9').split(',').map(Number)) {
    await page.waitForTimeout(t * 1000 - (page._elapsed ?? 0));
    page._elapsed = t * 1000;
    await page.screenshot({ path: `.shots/${s.name}-${t}s.png` });
  }
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  const cost = await page.evaluate(() => window.__frameCost());
  console.log(s.name, 'fps≈', fps, 'js ms/frame≈', cost.toFixed(2), 'errors:', errors);
  await page.close();
}
await browser.close();
