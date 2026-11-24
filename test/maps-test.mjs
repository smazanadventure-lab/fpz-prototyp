// Test interakcji map: node test/maps-test.mjs [--stub]  (wymaga dist/maps-harness*.html)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stub = process.argv.includes('--stub');
const file = pathToFileURL(path.join(root, 'dist', stub ? 'maps-harness-stub.html' : 'maps-harness.html')).href;
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1040, height: 1300 } });
const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let fails = 0; const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'BŁĄD ') + msg); if (!cond) fails++; };
const open = async (id, scale) => { await page.goto(file + '#' + id); await page.reload(); if (scale) await page.evaluate((s) => { const d = document.querySelector('#app > div'); d.style.transform = `scale(${s})`; d.style.transformOrigin = '0 0'; }, scale); await page.waitForTimeout(600); await page.evaluate(() => { window.__log = []; }); };
const tf = () => page.evaluate(() => document.querySelector('.map-svg > g').getAttribute('transform'));
const k = async () => +(await tf()).match(/scale\(([\d.e-]+)\)/)[1];
const log = () => page.evaluate(() => window.__log);
const center = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

// 1. SitePlan: klik w budynek
await open('site-plan-filter');
let c = await center('[data-poi="hala-zielona"]'); await page.mouse.click(c.x, c.y + 6); await page.waitForTimeout(100);
ok((await log()).some(([t, v]) => t === 'select' && v === 'hala-zielona'), 'klik w budynek → onSelect(hala-zielona)');
// 2. przeciąganie nie wybiera obiektu
await page.evaluate(() => { window.__log = []; }); const t0 = await tf();
c = await center('[data-poi="hala-tworzen"]'); await page.mouse.move(c.x, c.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(c.x - i * 15, c.y + i * 8); await page.mouse.up(); await page.waitForTimeout(100);
ok((await tf()) !== t0, 'przeciąganie przesuwa mapę'); ok(!(await log()).some(([t]) => t === 'select'), 'przeciąganie nie wywołuje onSelect');
// 3. kółko
let k0 = await k(); await page.mouse.move(400, 300); await page.mouse.wheel(0, -400); await page.waitForTimeout(100); ok((await k()) > k0 * 1.3, 'kółko przybliża');
// 4. klawiatura
await page.evaluate(() => { window.__log = []; document.querySelector('[data-poi="hala-zabkowice"]').focus(); }); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
ok((await log()).some(([t, v]) => t === 'select' && v === 'hala-zabkowice'), 'Enter na obiekcie z fokusem → onSelect');
await page.evaluate(() => document.querySelector('.map-root').focus()); const t1 = await tf(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('+'); await page.waitForTimeout(350); ok((await tf()) !== t1, 'strzałki / + na mapie');
// 5. pinch (dwa wskaźniki dotykowe przez CDP)
await open('site-iso-en'); const cdp = await page.context().newCDPSession(page); k0 = await k();
const tp = (pts) => pts.map(([x, y], i) => ({ x, y, id: i + 1 }));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[300, 250], [380, 250]]) });
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[300 - i * 10, 250], [380 + i * 10, 250]]) }); await page.waitForTimeout(16); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(100);
ok((await k()) > k0 * 1.6, `szczypanie przybliża (×${((await k()) / k0).toFixed(2)})`);
// 6. tap dotykiem w pinezkę
await page.evaluate(() => { window.__log = []; }); c = await center('[data-poi="fabryka-wczoraj-i-dzis"] .map-pin-body');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[c.x, c.y]]) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150);
ok((await log()).some(([t, v]) => t === 'select' && v === 'fabryka-wczoraj-i-dzis'), 'tap w pinezkę → onSelect');
// 7. kontener skalowany CSS (scale 0.5): zoom kółkiem trzyma punkt pod kursorem
await open('site-plan-filter', 0.5); c = await center('[data-poi="hala-tworzen"]'); await page.mouse.move(c.x, c.y); await page.mouse.wheel(0, -300); await page.waitForTimeout(100);
const c2 = await center('[data-poi="hala-tworzen"]'); ok(Math.hypot(c2.x - c.x, c2.y - c.y) < 12, `skalowany kontener: punkt pod kursorem stały (Δ=${Math.hypot(c2.x - c.x, c2.y - c.y).toFixed(1)}px)`);
await page.evaluate(() => { window.__log = []; }); await page.mouse.click(c2.x, c2.y); await page.waitForTimeout(80); ok((await log()).some(([t, v]) => t === 'select' && v === 'hala-tworzen'), 'skalowany kontener: klik w obiekt');
// 8. CityMap: tickboxy
await open('city-hc-ticks'); const p0 = await page.textContent('.map-progress');
c = await page.evaluate(() => { const cells = [...document.querySelectorAll('.map-cell[data-district]')].filter((e) => !e.classList.contains('is-visited'));
  for (const cell of cells) { const b = cell.getBoundingClientRect(); for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) { const x = b.left + (b.width * i) / 10, y = b.top + (b.height * j) / 10; if (document.elementFromPoint(x, y) === cell) return { x, y }; } } return null; });
await page.mouse.click(c.x, c.y); await page.waitForTimeout(150);
ok((await log()).some(([t]) => t === 'district') && (await page.textContent('.map-progress')) !== p0, `klik w dzielnicę → onDistrict, licznik: ${p0.trim()} → ${(await page.textContent('.map-progress')).trim()}`);
// 9. CityMap: klik w POI, klik w mapę, kółko, węzeł FPŻ
await open('city-zoom'); const hitP = await page.evaluate(() => { for (const e of document.querySelectorAll('.map-poi[data-poi]:not([data-poi="fpz"])')) { const b = e.querySelector('.map-mk').getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = x > 0 && y > 0 && x < 600 && y < 480 && document.elementFromPoint(x, y)?.closest('[data-poi]'); if (h && h.getAttribute('data-poi') !== 'fpz') return { x, y, id: h.getAttribute('data-poi') }; } return null; });
c = hitP; const pid = hitP?.id;
if (!c) console.log('     (brak POI w kadrze – pominięto)'); else await page.mouse.click(c.x, c.y); await page.waitForTimeout(80); if (c) ok((await log()).some(([t, v]) => t === 'select' && v === pid), 'CityMap: klik w POI → onSelect');
await page.evaluate(() => { window.__log = []; }); await page.mouse.click(560, 120); await page.waitForTimeout(80);
const mc = (await log()).find(([t]) => t === 'mapclick'); ok(mc && mc[1].lat > 50.28 && mc[1].lat < 50.44 && mc[1].lng > 19.1 && mc[1].lng < 19.5, 'CityMap: klik w mapę → onMapClick ' + JSON.stringify(mc && mc[1]));
if (await page.locator('.map-fpz').count()) { k0 = await k(); c = await center('.map-fpz'); await page.mouse.click(c.x, c.y); await page.waitForTimeout(700); ok((await k()) > k0 * 2 && (await page.locator('.map-fpz').count()) === 0, 'węzeł FPŻ → zbliżenie, punkty terenu rozwinięte'); }
// 10. przyciski + / − / wyśrodkuj
await open('city-fpz'); k0 = await k(); await page.click('.map-controls button[aria-label="Oddal"]'); await page.waitForTimeout(400); ok((await k()) < k0, 'przycisk Oddal');
// 11. wydajność przeciągania
await open('city-kiosk-night'); const dt = await page.evaluate(async () => { const r = document.querySelector('.map-root'); const b = r.getBoundingClientRect(); const ev = (type, x, y) => r.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1 }));
  ev('pointerdown', b.left + 500, b.top + 400); const t0 = performance.now(); for (let i = 0; i < 120; i++) ev('pointermove', b.left + 500 - i * 3, b.top + 400 + (i % 20)); const t = performance.now() - t0; ev('pointerup', b.left + 140, b.top + 400); return t / 120; });
ok(dt < 4, `przeciąganie: ${dt.toFixed(2)} ms / zdarzenie`);
await browser.close();
if (errors.length) { console.error('BŁĘDY KONSOLI:\n' + [...new Set(errors)].join('\n')); fails++; }
process.exit(fails ? 1 : 0);
