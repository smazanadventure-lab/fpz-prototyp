// node test/maps-build.mjs [--stub=content] → dist/maps-harness.html
import * as esbuild from 'esbuild';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stub = process.argv.includes('--stub=content');
const plugin = { name: 'stub', setup(b) { b.onResolve({ filter: /content\/index\.js$/ }, () => (stub ? { path: path.join(root, 'content-stub/index.js') } : undefined)); } };
const r = await esbuild.build({ entryPoints: [path.join(root, 'test/maps-harness.jsx')], bundle: true, write: false, outdir: path.join(root, 'dist'), format: 'iife', jsx: 'automatic', jsxImportSource: 'preact', loader: { '.css': 'css', '.svg': 'text' }, define: { __BUILD_ID__: '"test"', __ONLY__: '""' }, plugins: [plugin], logLevel: 'error' });
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = r.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
const out = path.join(root, 'dist', stub ? 'maps-harness-stub.html' : 'maps-harness.html');
fs.writeFileSync(out, `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><style>${css} body{margin:0;background:#888}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
console.log('OK', path.relative(root, out));
