// Budowanie prototypu do jednego pliku HTML.
//   node build.mjs                      → dist/index.html (całość, zminifikowane)
//   node build.mjs --only=mobile,game   → dist/dev-mobile-game.html (pozostałe końcówki zaślepione)
//   node build.mjs --stub=maps,media    → użyj zaślepek ui/stubs/* zamiast ui/maps.jsx, ui/media.jsx, ui/illustrations.jsx
//   node build.mjs --stub=content       → użyj małego zestawu treści z content-stub/ (gdy src/content jest w trakcie edycji)
//   --out=nazwa.html  --dev (bez minifikacji)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const only = args.only ? String(args.only).split(',').filter(Boolean) : null;
const stub = args.stub ? String(args.stub).split(',').filter(Boolean) : [];
// Cele: (brak) – jeden plik działający lokalnie, bez serwera;  --target=netlify – strona + funkcja API dla Netlify (dist/site, server/build);
//       --target=apk --api=https://adres-serwera – zasoby aplikacji mobilnej dla powłoki Android (dist/apk);  --server – tylko funkcja API.
//       --api=<adres> włącza tryb serwerowy („” = ten sam adres, z którego podano stronę).
const target = args.target || 'file';
const apiBase = args.api === undefined ? (target === 'netlify' ? '' : null) : (args.api === true ? '' : String(args.api).replace(/\/+$/, ''));
if (target === 'apk' && !apiBase) { console.error('BŁĄD: --target=apk wymaga adresu serwera, np. --api=https://fpz-prototyp.netlify.app'); process.exit(1); }
const start = args.start || (target === 'apk' ? 'app' : '');
const siteDir = typeof args.site === 'string' ? args.site : 'site'; // --site=nazwa: inny katalog wyniku (równoległe prace nie nadpisują sobie plików)
const outName = args.out || (target === 'netlify' ? `${siteDir}/index.html` : target === 'apk' ? 'apk/index.html' : only ? `dev-${only.join('-')}.html` : 'index.html');
const minify = !only && !args.dev;
const buildId = String(Date.now());

/** Funkcja API: jądro + treści w jednym module ESM (server/build/handler.mjs); @netlify/blobs dołącza Netlify. */
async function buildServer() {
  const t = Date.now();
  await esbuild.build({ entryPoints: [path.join(root, 'server/netlify-fn.mjs')], bundle: true, format: 'esm', platform: 'node', target: 'node20', outfile: path.join(root, 'server/build/handler.mjs'),
    external: ['@netlify/blobs'], define: { __BUILD_ID__: JSON.stringify(buildId) }, legalComments: 'none', charset: 'utf8', logLevel: 'error', banner: { js: '// PLIK GENEROWANY: node build.mjs --server (źródło: server/netlify-fn.mjs, server/core.mjs, src/kernel, src/content)' } });
  console.log(`OK server/build/handler.mjs  ${(fs.statSync(path.join(root, 'server/build/handler.mjs')).size / 1024).toFixed(0)} kB  (${Date.now() - t} ms)`);
}
if (args.server) { await buildServer(); process.exit(0); }

const stubPlugin = {
  name: 'fpz-stubs',
  setup(b) {
    b.onResolve({ filter: /index\.jsx$/ }, (a) => {
      if (!only) return;
      const abs = path.resolve(a.resolveDir, a.path);
      const m = abs.match(/src\/endpoints\/([a-z]+)\/index\.jsx$/);
      if (m && !only.includes(m[1])) return { path: path.join(root, 'src/shell/stub-endpoint.jsx') };
    });
    b.onResolve({ filter: /content\/index\.js$/ }, (a) => {
      if (stub.includes('content')) return { path: path.join(root, 'content-stub/index.js') };
    });
    b.onResolve({ filter: /(maps|media|illustrations)\.jsx$/ }, (a) => {
      const abs = path.resolve(a.resolveDir, a.path);
      const m = abs.match(/src\/ui\/(maps|media|illustrations)\.jsx$/);
      if (m && stub.includes(m[1])) return { path: path.join(root, `src/ui/stubs/${m[1]}.jsx`) };
    });
  },
};

const FORBIDDEN_IN_APP = /src\/(endpoints\/(cms|mgmt|validator|kiosk|signage|web|broadcast)\/|shell\/(shell|about|standalone)\.jsx)/;
/** Kompilacja jednego pliku HTML. appOnly = aplikacja dla zwiedzających (bez końcówek i operacji zaplecza). */
async function bundle({ entry, appOnly = false, api = apiBase, startAt = start }) {
  const res = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true, write: false, outdir: path.join(root, 'dist'), metafile: true,
    format: 'iife', target: ['chrome100', 'safari15', 'firefox100'],
    jsx: 'automatic', jsxImportSource: 'preact',
    loader: { '.css': 'css', '.svg': 'text' },
    minify: appOnly ? true : minify, legalComments: 'none', charset: 'utf8',
    define: { __BUILD_ID__: JSON.stringify(buildId), __ONLY__: JSON.stringify(only ? only.join(',') : ''), __API_BASE__: JSON.stringify(api), __START__: JSON.stringify(startAt), __TARGET__: JSON.stringify(target), 'globalThis.FPZ_APP_ONLY': appOnly ? 'true' : 'false' },
    plugins: [stubPlugin], logLevel: 'silent',
  });
  if (appOnly) { const bad = Object.keys(res.metafile.inputs).filter((f) => FORBIDDEN_IN_APP.test(f)); if (bad.length) { console.error('BŁĄD: aplikacja dla zwiedzających nie może zawierać modułów zaplecza:\n  ' + bad.join('\n  ')); process.exit(1); } }
  return res;
}
const t0 = Date.now();
let result;
try {
  result = await bundle(target === 'apk' ? { entry: 'src/main-app.jsx', appOnly: true } : { entry: 'src/main.jsx' });
  /* poprzednia, bezpośrednia konfiguracja:
  result = await esbuild.build({
    entryPoints: [path.join(root, 'src/main.jsx')],
    bundle: true, write: false, outdir: path.join(root, 'dist'),
    format: 'iife', target: ['chrome100', 'safari15', 'firefox100'],
    jsx: 'automatic', jsxImportSource: 'preact',
    loader: { '.css': 'css', '.svg': 'text' },
    minify, legalComments: 'none', charset: 'utf8',
    define: { __BUILD_ID__: JSON.stringify(buildId), __ONLY__: JSON.stringify(only ? only.join(',') : ''), __API_BASE__: JSON.stringify(apiBase), __START__: JSON.stringify(start), __TARGET__: JSON.stringify(target) },
    plugins: [stubPlugin], logLevel: 'silent',
  }); */
} catch (e) {
  for (const er of e.errors || []) {
    const loc = er.location ? `${path.relative(root, er.location.file)}:${er.location.line}:${er.location.column}` : '';
    console.error(`BŁĄD ${loc} — ${er.text}`);
    if (er.location?.lineText) console.error('   ' + er.location.lineText.trim().slice(0, 160));
  }
  if (!e.errors) console.error(e);
  process.exit(1);
}
for (const w of (result.warnings || []).slice(0, 12)) console.warn(`uwaga ${w.location ? path.relative(root, w.location.file) + ':' + w.location.line : ''} — ${w.text}`);
function page(result, title) {
const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = (result.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '').replace(/<\/style/gi, '<\\/style');
return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover${target === 'apk' ? ', user-scalable=no' : ''}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#125930">${target === 'netlify' ? `
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">` : ''}
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>
`;
}
const APP_TITLE = 'Fabryka Pełna Życia – aplikacja (wersja testowa)';
const html = page(result, target === 'apk' ? APP_TITLE : 'Fabryka Pełna Życia – prototyp systemu (wersja testowa)');
fs.mkdirSync(path.dirname(path.join(root, 'dist', outName)), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', outName), html);
if (target === 'netlify') {
  const site = path.join(root, 'dist', siteDir);
  // /app – ta sama aplikacja dla zwiedzających, która trafia do APK (osobna, mniejsza paczka bez zaplecza)
  const app = page(await bundle({ entry: 'src/main-app.jsx', appOnly: true, api: '', startAt: 'app' }), APP_TITLE);
  fs.mkdirSync(path.join(site, 'app'), { recursive: true }); fs.writeFileSync(path.join(site, 'app/index.html'), app);
  console.log(`OK dist/${siteDir}/app/index.html  ${(app.length / 1024).toFixed(0)} kB  (aplikacja dla zwiedzających)`);
  // Adresy końcówek → jedna z dwóch stron. Plik _redirects trafia do katalogu publikacji (te same reguły są w netlify.toml).
  const SPA = [['app', '/app/index.html'], ['q', '/app/index.html'], ...['www', 'kiosk', 'lcd', 'bileter', 'cms', 'ekspozycja', 'nadawanie', 'kody'].map((r) => [r, '/index.html'])];
  fs.writeFileSync(path.join(site, '_redirects'), SPA.map(([r, to]) => `/${r}/*  ${to}  200`).join('\n') + '\n');
  for (const f of fs.readdirSync(path.join(root, 'public'))) { let buf = fs.readFileSync(path.join(root, 'public', f)); if (f === 'sw.js') buf = Buffer.from(String(buf).replace('__BUILD__', buildId)); fs.writeFileSync(path.join(site, f), buf); }
  if (siteDir === 'site') await buildServer();
}
console.log(`OK dist/${outName}  ${(html.length / 1024).toFixed(0)} kB  (${Date.now() - t0} ms)${only ? '  tylko: ' + only.join(',') : ''}${stub.length ? '  zaślepki: ' + stub.join(',') : ''}${apiBase !== null ? '  tryb serwerowy: ' + (apiBase || '(ten sam adres)') : ''}`);
