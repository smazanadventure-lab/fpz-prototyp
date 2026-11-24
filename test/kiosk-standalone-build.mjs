// node test/kiosk-standalone-build.mjs → dist/test-standalone.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
const r = await esbuild.build({ entryPoints: ['test/kiosk-standalone.jsx'], bundle: true, write: false, outdir: 'dist', format: 'iife', jsx: 'automatic', jsxImportSource: 'preact', loader: { '.css': 'css', '.svg': 'text' }, define: { __BUILD_ID__: '"sa"', __ONLY__: '""' }, logLevel: 'error' });
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script'); const css = r.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
fs.writeFileSync('dist/test-standalone.html', `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><style>html,body,#app{margin:0;height:100%;background:#000}${css}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
console.log('OK dist/test-standalone.html');
