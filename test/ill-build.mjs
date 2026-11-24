// node test/ill-build.mjs [--shots=all|tones|ratios|big] [--ids=a,b]  → dist/ill-gallery.html + shots/ill-*.png
import * as esbuild from '/home/claude/work/app/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
const root = '/home/claude/work/app';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const r = await esbuild.build({ entryPoints: [root + '/test/ill-harness.jsx'], bundle: true, write: false, format: 'iife', jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [root + '/node_modules'], logLevel: 'error' });
const js = r.outputFiles[0].text;
fs.mkdirSync(root + '/dist', { recursive: true }); fs.mkdirSync(root + '/shots', { recursive: true });
fs.writeFileSync(root + '/dist/ill-gallery.html', `<!doctype html><meta charset="utf-8"><title>FPŻ – ilustracje</title><body></body><script>${js}</script>`);
console.log('dist/ill-gallery.html', (js.length / 1024).toFixed(1) + ' kB');
const which = args.shots; if (!which) process.exit(0);
const { chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on('console', (m) => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', (e) => errs.push(String(e)));
const ids = args.ids ? '&ids=' + args.ids : '';
const jobs = [];
if (which === 'all' || which === 'tones') for (const t of ['duotone', 'archival', 'color']) jobs.push([`view=tones&tone=${t}${ids}`, `ill-${t}`]);
if (which === 'all' || which === 'ratios') jobs.push([`view=ratios${ids}`, 'ill-ratios']);
if (which === 'all' || which === 'small') jobs.push([`view=tones&cols=16${ids}`, 'ill-thumbs']);
if (which === 'all' || which === 'modes') { jobs.push([`view=modes&f=invert(1) hue-rotate(180deg) brightness(.85)${ids}`, 'ill-night']); jobs.push([`view=modes&f=contrast(1.6) grayscale(1)${ids}`, 'ill-contrast']); }
if (which === 'big') jobs.push([`view=big${ids}`, 'ill-big' + (args.tag || '')]);
for (const [h, name] of jobs) {
  await page.goto('file://' + root + '/dist/ill-gallery.html#' + h); await page.reload(); await page.waitForTimeout(150);
  await page.screenshot({ path: `${root}/shots/${name}.png`, fullPage: true }); console.log('shots/' + name + '.png');
}
await browser.close();
if (errs.length) { console.error('Błędy konsoli:', errs); process.exit(1); }
