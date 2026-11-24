// Lokalny serwer testowy – to samo, co na Netlify: strona z dist/site + API /api/*.
//   node build.mjs --target=netlify && node tools/dev-server.mjs [--port=8787] [--blobs] [--fresh]
//   domyślnie dane w pliku .data/state.json; --blobs uruchamia lokalny serwer Netlify Blobs i PRODUKCYJNY moduł funkcji
//   (server/build/handler.mjs) – dokładnie ten kod, który działa na Netlify.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const port = +(args.port || 8787); const dataDir = path.join(root, args.data || '.data'); const site = path.join(root, 'dist/site');
if (args.fresh) fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

let handle;
if (args.blobs) {
  const { BlobsServer } = await import('@netlify/blobs/server');
  // Lokalny emulator różni się od usługi Netlify w dwóch miejscach istotnych dla zapisu warunkowego: nie podaje nagłówka ETag
  // przy odczycie oraz sprawdza wersję i zapisuje w dwóch krokach (usługa robi to niepodzielnie). Uzupełniamy ETag,
  // a odczyty i zapisy ustawiamy w jednej kolejce – wtedy emulator zachowuje się tak, jak opisuje dokumentacja usługi.
  let chain = Promise.resolve(); const serial = (fn) => { const run = chain.then(fn); chain = run.catch(() => {}); return run; };
  const origGet = BlobsServer.prototype.get; const origPut = BlobsServer.prototype.put;
  BlobsServer.prototype.put = function (req) { return serial(() => origPut.call(this, req)); };
  BlobsServer.prototype.get = function (req) {
    return serial(async () => {
      const res = await origGet.call(this, req); if (res.status !== 200) return res;
      try { const { dataPath } = this.getLocalPaths(new URL(req.url ?? '', this.address)); if (!dataPath) return res; const etag = await BlobsServer.generateETag(dataPath); if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { etag } }); const h = new Headers(res.headers); h.set('etag', etag); return new Response(await res.arrayBuffer(), { status: 200, headers: h }); } catch { return res; }
    });
  };
  const token = 'dev-token'; const bs = new BlobsServer({ directory: path.join(dataDir, 'blobs'), token, port: port + 1 }); await bs.start();
  const ctx = { edgeURL: `http://localhost:${port + 1}`, uncachedEdgeURL: `http://localhost:${port + 1}`, siteID: 'dev-site', token, deployID: 'dev' };
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(ctx)).toString('base64');
  handle = (await import(pathToFileURL(path.join(root, 'server/build/handler.mjs')).href)).default;
  console.log('Magazyn: lokalny serwer Netlify Blobs (moduł produkcyjny server/build/handler.mjs)');
} else {
  const esbuild = await import('esbuild');
  const out = path.join(dataDir, '_core.mjs');
  await esbuild.build({ stdin: { contents: `export { createHandler } from './server/core.mjs'; export { fileStorage } from './server/storage-file.mjs';`, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', platform: 'node', outfile: out, define: { __BUILD_ID__: '"dev"' }, logLevel: 'error' });
  const m = await import(pathToFileURL(out).href + '?' + Date.now()); const storage = m.fileStorage(path.join(dataDir, 'state.json')); handle = m.createHandler(() => storage);
  console.log('Magazyn: plik ' + path.relative(root, path.join(dataDir, 'state.json')));
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const SPA = /^\/(app|www|kiosk|lcd|bileter|cms|ekspozycja|q)(\/|$)/;
let calls = 0; const stats = {};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/__stats') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ calls, stats })); return; }
    if (url.pathname.startsWith('/api/')) {
      calls++; const key = req.method + ' ' + url.pathname + (url.searchParams.get('tick') ? '?tick' : ''); stats[key] = (stats[key] || 0) + 1;
      const chunks = []; for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      if (args.delay) await new Promise((r) => setTimeout(r, +args.delay));
      const r = await handle(request); const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(buf); return;
    }
    let file = path.join(site, decodeURIComponent(url.pathname));
    if (url.pathname === '/' || SPA.test(url.pathname) || !file.startsWith(site) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { if (url.pathname !== '/' && !SPA.test(url.pathname)) { res.writeHead(404); res.end('404'); return; } file = path.join(site, /^\/(app|q)(\/|$)/.test(url.pathname) ? 'app/index.html' : 'index.html'); } // jak w netlify.toml
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
});
server.listen(port, () => console.log(`Serwer testowy: http://localhost:${port}  (końcówki: /app /www /kiosk/TZ.T1.1 /lcd/LCD-01 /bileter /cms /ekspozycja)`));
