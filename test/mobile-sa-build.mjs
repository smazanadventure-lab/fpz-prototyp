// Budowa harnessu trybu samodzielnego → dist/test-mobile-standalone.html
import * as esbuild from 'esbuild'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = await esbuild.build({ entryPoints: [path.join(root, 'test/mobile-standalone.jsx')], bundle: true, write: false, outdir: path.join(root, 'dist'), format: 'iife', jsx: 'automatic', jsxImportSource: 'preact', loader: { '.css': 'css', '.svg': 'text' }, define: { __BUILD_ID__: JSON.stringify(String(Date.now())), __ONLY__: '""' }, logLevel: 'error' });
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script'); const css = r.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
fs.writeFileSync('/tmp/mobagent/sa.html', `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>${css}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
console.log('OK /tmp/mobagent/sa.html');
