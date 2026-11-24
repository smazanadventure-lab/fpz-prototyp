// Budowanie strony testowej gry: node test/game-build.mjs [--stub] → dist/game-harness.html
import * as esbuild from '/home/claude/work/app/node_modules/esbuild/lib/main.js';
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
const root = '/home/claude/work/app';
let stub = process.argv.includes('--stub');
if (!stub) { try { execSync('node tools/validate-content.mjs', { cwd: root, stdio: 'pipe' }); } catch { stub = true; } }
let uiStub = process.argv.includes('--ui-stub');
const plugin = { name: 'stub', setup(b) {
  b.onResolve({ filter: /content\/index\.js$/ }, () => (stub ? { path: path.join(root, 'content-stub/index.js') } : undefined));
  b.onResolve({ filter: /(maps|media|illustrations)\.jsx$/ }, (a) => { const m = path.resolve(a.resolveDir, a.path).match(/src\/ui\/(maps|media|illustrations)\.jsx$/); return uiStub && m ? { path: path.join(root, `src/ui/stubs/${m[1]}.jsx`) } : undefined; });
} };
const build = () => esbuild.build({ entryPoints: [path.join(root, 'test/game-harness.jsx')], bundle: true, write: false, outdir: path.join(root, 'dist'), format: 'iife',
  jsx: 'automatic', jsxImportSource: 'preact', loader: { '.css': 'css', '.svg': 'text' }, define: { __BUILD_ID__: '"t"', __ONLY__: '""' }, plugins: [plugin], logLevel: 'silent' });
let r; try { r = await build(); } catch (e) { if (uiStub) throw e; console.log('wspólne komponenty w trakcie edycji – zaślepki maps/media/illustrations'); uiStub = true; r = await build(); }
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text; const css = r.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
fs.writeFileSync(path.join(root, 'dist/game-harness.html'), `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Gra – test</title><style>body{margin:0}${css}</style></head><body><div id="app"></div><script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`);
console.log('OK dist/game-harness.html', stub ? '(content-stub)' : '(content)', uiStub ? '(ui-stub)' : '');
