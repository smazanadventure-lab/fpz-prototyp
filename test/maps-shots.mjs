// node test/maps-shots.mjs [--stub] [ids…] → shots/maps-<id>.png ; kod 1 przy błędach konsoli
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stub = process.argv.includes('--stub'); const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const file = pathToFileURL(path.join(root, 'dist', stub ? 'maps-harness-stub.html' : 'maps-harness.html')).href;
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1040, height: 1300 } });
const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(file); await page.waitForTimeout(300);
const ids = only.length ? only : await page.evaluate(() => window.__scenarios);
for (const id of ids) {
  await page.goto(file + '#' + id); await page.reload(); await page.waitForTimeout(700);
  const box = await page.locator('#app > div').boundingBox();
  await page.screenshot({ path: path.join(root, 'shots', `maps-${id}${stub ? '-stub' : ''}.png`), clip: box });
  console.log('zrzut', id);
}
await browser.close();
if (errors.length) { console.error('BŁĘDY:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
