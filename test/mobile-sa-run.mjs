// Test trybu samodzielnego: node test/mobile-sa-build.mjs && node test/mobile-sa-run.mjs
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const VPS = [[360, 640, 3], [412, 915, 2.6], [320, 568, 2]];
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
let errors = [];
for (const [w, h, dpr] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, permissions: ['camera', 'geolocation'], geolocation: { latitude: 50.3246, longitude: 19.1879, accuracy: 12 } });
  const page = await ctx.newPage(); const tag = `${w}x${h}`;
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text().slice(0, 300)}`); });
  const shot = async (n) => { await page.waitForTimeout(450); await page.screenshot({ path: `shots/mobile-sa-${tag}-${n}.png` }); };
  const top = () => page.locator('.m-screen:not([hidden])');
  await page.goto('file:///tmp/mobagent/sa.html'); await page.waitForTimeout(300); await shot('01-splash');
  await page.waitForSelector('.m-onb'); await shot('02-lang'); await page.click('.m-onb .fpz-btn'); await shot('03-tut'); await page.click('.m-tut__skip button');
  await page.waitForSelector('.m-bnav'); await shot('04-home');
  await page.evaluate(() => window.__fpzMobile.push('entry', { id: 'defum-obrabiarki' })); await shot('05-entry');
  await page.click('.m-bnav__item:nth-child(4)'); await shot('06-map');
  await page.click('.m-bnav__item:nth-child(5)'); await page.waitForTimeout(400); await shot('07-game');
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-bnav__item:nth-child(1)');
  await page.evaluate(() => window.__fpzMobile.push('reservation', { initial: { view: 'events' } })); await page.waitForTimeout(400); await shot('08-reservation');
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-bnav__item:nth-child(1)');
  await page.click('.m-testbadge'); await shot('09-testmode');
  await page.locator('.m-tm__list button').nth(2).click(); await page.locator('.m-tm .m-seg button', { hasText: 'Słaba' }).click();
  const qrOpt = await page.locator('.m-tm select option').nth(1).getAttribute('value'); await page.locator('.m-tm select').selectOption(qrOpt); await shot('10-testmode-set');
  await page.locator('.m-tm .fpz-switch', { hasText: 'GPS' }).click(); await page.waitForTimeout(800); await shot('11-testmode-gps');
  const gpsTxt = await page.locator('.m-tm .fpz-notice').first().textContent().catch(() => ''); console.log(tag, 'GPS:', gpsTxt);
  await page.locator('.m-tm .fpz-switch', { hasText: 'GPS' }).click(); await page.locator('.m-tm .m-seg button', { hasText: 'LTE' }).click();
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('.m-shortcut >> nth=0'); await page.waitForTimeout(1500); await shot('12-scanner-camera');
  const vid = await page.evaluate(() => { const v = document.querySelector('.m-cam__video'); return v ? { w: v.videoWidth, ready: v.readyState, playing: !v.paused } : null; }); console.log(tag, 'video:', JSON.stringify(vid));
  await top().locator('.m-seg button', { hasText: 'Symulacja' }).click(); await page.waitForTimeout(1600); await shot('13-scanner-sim');
  // dekodowanie: kod QR z arkusza udostępniania → canvas → decodeImageData
  await page.keyboard.press('Escape'); await page.evaluate(() => window.__fpzMobile.push('entry', { id: 'defum-obrabiarki' })); await page.waitForTimeout(300);
  await top().locator('.m-top__actions .fpz-iconbtn').first().click(); await page.waitForTimeout(300);
  const dec = await page.evaluate(async () => { const svg = document.querySelector('.m-share .fpz-qr svg'); const xml = new XMLSerializer().serializeToString(svg); const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); await img.decode(); const c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 300); g.drawImage(img, 30, 30, 240, 240); return window.__fpzMobile.decodeImageData(g.getImageData(0, 0, 300, 300)); });
  console.log(tag, 'decoded:', dec);
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('BŁĘDY KONSOLI:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK');
