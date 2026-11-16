// Clicks, drags and toggles music; reports any page errors.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const errors = [];
for (const reducedMotion of ['no-preference', 'reduce']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForTimeout(reducedMotion === 'reduce' ? 3500 : 8000);
  await page.mouse.click(300, 300);
  await page.mouse.click(960, 250);
  await page.mouse.move(640, 400);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(640 + i * 30, 400);
  await page.mouse.up();
  await page.click('#sound');
  await page.waitForTimeout(350);
  const pressed = await page.getAttribute('#sound', 'aria-pressed');
  await page.screenshot({ path: `.shots/interact-${reducedMotion}.png` });
  await page.click('#sound');
  console.log(reducedMotion, 'music pressed after click:', pressed, 'after 2nd:', await page.getAttribute('#sound', 'aria-pressed'));
  await page.close();
}
console.log('errors:', errors);
await browser.close();
