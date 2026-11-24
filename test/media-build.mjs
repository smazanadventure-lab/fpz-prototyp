// Buduje stronę testową komponentów multimedialnych → dist/media-harness.html
import * as esbuild from 'esbuild';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stubContent = process.argv.includes('--stub=content');
const r = await esbuild.build({ entryPoints: [path.join(root, 'test/media-harness.jsx')], bundle: true, write: false, outdir: path.join(root, 'dist'), format: 'iife', target: ['chrome100'], jsx: 'automatic', jsxImportSource: 'preact', loader: { '.css': 'css' }, define: { __BUILD_ID__: '"t"', __ONLY__: '""' }, logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /content\/index\.js$/ }, () => (stubContent ? { path: path.join(root, 'content-stub/index.js') } : undefined)); } }] });
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text; const css = r.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
fs.writeFileSync(path.join(root, 'dist/media-harness.html'), `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>media</title><style>${css}</style></head><body><div id="app"></div><script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`);
console.log('dist/media-harness.html', Math.round((js.length + css.length) / 1024), 'kB');
