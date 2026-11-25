// Pliki logo do przekazania (docs/logo/): SVG i PNG pełnego logo oraz sygnetu w wersjach czarnej, białej i zielonej
// + plansza podglądowa docs/logo/podglad.png. Dane ścieżek: src/ui/logo-data.js (wektoryzacja pliku źródłowego).
// Uruchomienie z katalogu głównego:  node tools/gen-logo-files.mjs   (Playwright + Chrome do renderowania PNG)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOGO } from '../src/ui/logo-data.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'docs/logo');
const COLORS = { czarne: '#000000', biale: '#FFFFFF', zielone: '#125930' };
const MARK_NAME = { czarne: 'czarny', biale: 'bialy', zielone: 'zielony' };
const n = (v) => +v.toFixed(2);
const svgFull = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO.w} ${LOGO.h}" width="${LOGO.w * 5}" height="${n(LOGO.h * 5)}"><title>Fabryka Pełna Życia</title><path fill="${fill}" d="${LOGO.mark.d}${LOGO.word.d}"/></svg>\n`;
const svgMark = (fill) => { const [x, y, w, h] = LOGO.mark.box; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${n(w * 5)}" height="${n(h * 5)}"><title>Fabryka Pełna Życia – sygnet</title><path fill="${fill}" d="${LOGO.mark.d}"/></svg>\n`; };

const files = [];
for (const [k, c] of Object.entries(COLORS)) {
  files.push({ name: `fpz-logo-poziome-${k}`, svg: svgFull(c), w: 2000, h: Math.round(2000 * LOGO.h / LOGO.w) });
  const [, , mw, mh] = LOGO.mark.box;
  files.push({ name: `fpz-sygnet-${MARK_NAME[k]}`, svg: svgMark(c), w: 1024, h: Math.round(1024 * mh / mw) });
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
for (const f of files) {
  fs.writeFileSync(path.join(OUT, f.name + '.svg'), f.svg);
  const page = await browser.newPage({ viewport: { width: f.w, height: f.h } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${f.svg.replace(/width="[^"]+" height="[^"]+"/, `width="${f.w}" height="${f.h}"`)}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(OUT, f.name + '.png'), omitBackground: true });
  await page.close();
  console.log('OK', f.name, f.w + '×' + f.h);
}
// plansza podglądowa 1600×900: wersje na właściwych tłach + ikona aplikacji
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'public/icon-512.png')).toString('base64');
const full = (c) => svgFull(c).replace(/ width="[^"]+" height="[^"]+"/, ' class="full"');
const mark = (c) => svgMark(c).replace(/ width="[^"]+" height="[^"]+"/, ' class="mark"');
const tile = (bg, fg, label, sub) => `<div class="t" style="background:${bg};color:${fg === '#FFFFFF' ? '#fff' : '#101411'}"><div class="row">${full(fg)}${mark(fg)}</div><p><b>${label}</b> · ${sub}</p></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;width:1600px;height:900px;font-family:"Helvetica Neue",Arial,"Liberation Sans",sans-serif;background:#D9DCD3;box-sizing:border-box;padding:36px 40px}
h1{margin:0 0 4px;font-size:26px;color:#101411}h2{margin:0 0 22px;font-size:15px;font-weight:400;color:#45574D}
.g{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:330px 330px;gap:20px}
.t{border-radius:18px;display:flex;flex-direction:column;justify-content:space-between;padding:30px 30px 18px;box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.row{display:flex;align-items:center;gap:34px;flex:1}.full{height:110px;width:auto}.mark{height:92px;width:auto}
p{margin:0;font-size:14px;opacity:.85}
.ic{display:flex;align-items:center;gap:28px;flex:1}.ic img{width:150px;height:150px}.ic img.s{width:76px;height:76px}
</style></head><body><h1>Fabryka Pełna Życia – logo (wersja pozioma i sygnet)</h1><h2>Wektoryzacja pliku przekazanego przez Zamawiającego · wersje kolorystyczne i ich tła · ikona aplikacji</h2><div class="g">
${tile('#FFFFFF', '#000000', 'Czarne', 'tło białe')}
${tile('#EEF6F2', '#000000', 'Czarne', 'tło jasnozielone #EEF6F2')}
${tile('#EEF6F2', '#125930', 'Zielone #125930', 'tło białe lub jasnozielone')}
${tile('#125930', '#FFFFFF', 'Białe', 'tło zielone #125930')}
${tile('#0E1512', '#FFFFFF', 'Białe', 'tło ciemne #0E1512 (motyw nocny)')}
<div class="t" style="background:#FFFFFF"><div class="ic"><img src="${icon}" alt=""><img class="s" src="${icon}" alt=""></div><p><b>Ikona aplikacji</b> · sygnet biały na zielonym #125930 (PWA, Android, iOS)</p></div>
</div></body></html>`;
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(html); await page.screenshot({ path: path.join(OUT, 'podglad.png') });
await browser.close();
console.log('OK podglad.png');
