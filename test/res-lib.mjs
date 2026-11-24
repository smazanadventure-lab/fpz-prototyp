// Pomocnicze: uruchomienie strony testowej rezerwacji w Chrome.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function open(query = '') {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1660, height: 850 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await page.goto(pathToFileURL(path.join(root, 'dist/res-harness.html')).href + query);
  await page.waitForSelector('#host-web .ep-res');
  const M = page.locator('#host-mobile'); const W = page.locator('#host-web');
  const shotHost = async (name, which = 'both') => {
    if (which === 'both') { await page.screenshot({ path: path.join(root, 'shots', `res-${name}.png`), clip: { x: 0, y: 0, width: 1660, height: 840 } }); }
    else await (which === 'mobile' ? M : W).screenshot({ path: path.join(root, 'shots', `res-${name}.png`) });
    console.log('zrzut: shots/res-' + name + '.png');
  };
  return { browser, page, errors, M, W, shot: shotHost };
}
