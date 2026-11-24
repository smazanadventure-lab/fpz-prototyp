// Zrzuty komponentów: node test/media-shots.mjs [sekcje…] [--modes=phone,kiosk,night,contrast]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const secs = args.filter((a) => !a.startsWith('--')); const modesArg = (args.find((a) => a.startsWith('--modes=')) || '').slice(8);
const MODES = { phone: { w: 360, base: 16 }, kiosk: { w: 900, base: 30 }, night: { w: 360, base: 16, theme: 'night' }, contrast: { w: 360, base: 16, contrast: 'high' }, en: { w: 360, base: 16, lang: 'en' }, knight: { w: 900, base: 30, theme: 'night' } };
const modes = modesArg ? modesArg.split(',') : ['phone', 'kiosk', 'night', 'contrast'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const sec of secs.length ? secs : ['video', 'audio', 'model', 'pano', 'ar']) for (const m of modes) {
  const c = MODES[m]; const page = await browser.newPage({ viewport: { width: c.w + 40, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${sec}/${m} pageerror: ${e.message}`)); page.on('console', (x) => { if (x.type() === 'error') errors.push(`${sec}/${m} console: ${x.text()}`); });
  const hash = `sec=${sec}&w=${c.w}&base=${c.base}` + (c.theme ? `&theme=${c.theme}` : '') + (c.contrast ? `&contrast=${c.contrast}` : '') + (c.lang ? `&lang=${c.lang}` : '');
  await page.goto(pathToFileURL(path.join(root, 'dist/media-harness.html')).href + '#' + hash);
  await page.waitForTimeout(sec === 'ar' ? 1700 : 1200);
  if (sec === 'video') { await page.locator('.hx-v1 .md-video__big').click(); await page.waitForTimeout(900); }
  if (sec === 'pano') { await page.locator('#pano-go').click(); await page.waitForTimeout(sec === 'pano' ? 900 : 0); }
  if (sec === 'audio') { await page.locator('.md-audio:not(.md-audio--compact) .md-btn--main').click(); await page.waitForTimeout(2600); }
  const el = await page.$('#hx-frame'); await el.screenshot({ path: path.join(root, `shots/media-${sec}-${m}.png`) });
  console.log('zrzut', `shots/media-${sec}-${m}.png`); await page.close();
}
await browser.close();
if (errors.length) { console.error('BŁĘDY:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
