// node test/kiosk-standalone-shots.mjs – zrzuty trybu samodzielnego (kiosk/LCD) na kilku viewportach
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path';
const url = 'file://' + path.resolve('dist/test-standalone.html');
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const errors = [];
const run = async (w, h, hash, name, fn) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(name + ': ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.goto(url + '#' + hash); await page.waitForTimeout(900);
  await page.evaluate(() => window.__fpzKiosk.makeApi('mgmt').env.set({ simTime: '12:00' }));
  if (fn) await fn(page); await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/${name}.png` }); console.log('zrzut', name); await page.close();
};
await run(1080, 1920, 'kiosk/TZ.T1.3', 'kiosk-sa-t13-1080');
await run(540, 960, 'kiosk/TZ.T1.5', 'kiosk-sa-t15-540');
await run(540, 960, 'kiosk/TZ.T1.5', 'kiosk-sa-t15-sound', async (p) => {
  await p.locator('.k-menu__it:has-text("Dźwięki")').click(); await p.waitForTimeout(400);
  await p.keyboard.press('Space'); await p.waitForTimeout(300); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  console.log('  słuchawka/ścieżka po klawiszach:', await p.locator('.k-now__state b').innerText(), '/', await p.locator('.k-now__title').innerText());
  await p.locator('.k-svc, .k-corner').first();
});
await run(1000, 700, 'kiosk/TZ.T9.9', 'kiosk-sa-unknown');
await run(1920, 1080, 'lcd/LCD-02', 'signage-sa-lcd02-1920');
await run(1280, 720, 'lcd/LCD-01', 'signage-sa-lcd01-1280', async (p) => {
  await p.evaluate(() => { const a = window.__fpzKiosk.makeApi('mgmt'); a.live.start('Debata o przyszłości Fabryki'); ['Dzień dobry, witamy w Hali Ząbkowice.', 'Za chwilę rozpoczniemy debatę.', 'Pierwszy głos zabierze przedstawicielka mieszkańców.'].forEach((t) => a.live.caption(t)); });
});
await run(1280, 720, 'lcd/XYZ', 'signage-sa-unknown');
await browser.close();
if (errors.length) { console.error('BŁĘDY:', errors); process.exit(1); }
