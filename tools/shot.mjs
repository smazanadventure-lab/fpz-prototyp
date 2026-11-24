// Zrzut ekranu / test dymny w bezgłowym Chrome.
//   node tools/shot.mjs --file=dist/dev-mobile.html --tab=mobile --out=shots/mobile.png [--w=1440 --h=900] [--script=test/moj-skrypt.mjs] [--wait=400]
// Skrypt (opcjonalny) to moduł ES z domyślnym eksportem: export default async (page, helpers) => { … }
//   helpers.shot(nazwa) – zrzut do shots/<nazwa>.png ; helpers.tab(id) – przełączenie zakładki powłoki ; helpers.errors – zebrane błędy konsoli
// Kod wyjścia 1, gdy w konsoli pojawiły się błędy (pageerror / console.error).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const file = path.resolve(root, args.file || 'dist/index.html');
const out = path.resolve(root, args.out || 'shots/shot.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +(args.w || 1440), height: +(args.h || 900) }, deviceScaleFactor: +(args.dpr || 1) });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 400)); });
await page.goto(pathToFileURL(file).href + (args.tab ? '#' + args.tab : ''));
await page.waitForSelector('.sh-root', { timeout: 15000 });
const helpers = {
  errors,
  tab: async (id) => { await page.evaluate((h) => { location.hash = h; }, id); await page.waitForTimeout(250); },
  shot: async (name) => { const p = path.resolve(root, 'shots', name.endsWith('.png') ? name : name + '.png'); await page.screenshot({ path: p }); console.log('zrzut:', path.relative(root, p)); },
};
await page.waitForTimeout(+(args.wait || 500));
let failed = false;
if (args.script) { try { const mod = await import(pathToFileURL(path.resolve(root, args.script)).href); await mod.default(page, helpers); } catch (e) { failed = true; console.error('BŁĄD SKRYPTU:', e.message.split('\n').slice(0, 6).join('\n')); try { await page.screenshot({ path: out.replace(/\.png$/, '-blad.png') }); console.log('zrzut błędu:', path.relative(root, out.replace(/\.png$/, '-blad.png'))); } catch {} } }
if (!args.script || args.out) { await page.screenshot({ path: out }); console.log('zrzut:', path.relative(root, out)); }
await browser.close();
if (errors.length) { console.error(`BŁĘDY KONSOLI (${errors.length}):\n` + [...new Set(errors)].slice(0, 15).join('\n')); }
process.exit(errors.length || failed ? 1 : 0);
