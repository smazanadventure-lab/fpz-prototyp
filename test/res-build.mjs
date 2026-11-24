// Budowa strony testowej systemu rezerwacji → dist/res-harness.html
//   node test/res-build.mjs [--content=auto|real|stub]
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (process.argv.find((a) => a.startsWith('--content=')) || '--content=auto').split('=')[1];
let useStub = arg === 'stub';
if (arg === 'auto') { try { execSync('node tools/validate-content.mjs', { cwd: root, stdio: 'ignore' }); } catch { useStub = true; } }
const plugin = { name: 'res-content', setup(b) { b.onResolve({ filter: /content\/index\.js$/ }, () => (useStub ? { path: path.join(root, 'content-stub/index.js') } : undefined)); } };
const r = await esbuild.build({ entryPoints: [path.join(root, 'test/res-harness.jsx')], bundle: true, write: false, outdir: path.join(root, 'dist'), format: 'iife', target: ['chrome100'],
  jsx: 'automatic', jsxImportSource: 'preact', loader: { '.css': 'css', '.svg': 'text' }, define: { __BUILD_ID__: '"t"', __ONLY__: '""' }, plugins: [plugin], logLevel: 'warning' });
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = r.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
fs.writeFileSync(path.join(root, 'dist/res-harness.html'), `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Rezerwacje – test</title><style>body{margin:0}${css}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
console.log(`OK dist/res-harness.html (treści: ${useStub ? 'content-stub' : 'src/content'})`);
