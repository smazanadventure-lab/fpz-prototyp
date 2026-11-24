// Magazyn lokalny (plik JSON) – do uruchamiania serwera testowego poza Netlify: node tools/dev-server.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
export function fileStorage(file) {
  const etagOf = (txt) => '"' + crypto.createHash('sha1').update(txt).digest('hex').slice(0, 16) + '"';
  const readTxt = () => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
  return {
    async read() { const t = readTxt(); return t ? { doc: JSON.parse(t), etag: etagOf(t) } : null; },
    async readIfChanged(etag) { const t = readTxt(); if (!t) return null; const e = etagOf(t); return e === etag ? null : { doc: JSON.parse(t), etag: e }; },
    async write(doc, etag, force) { const cur = readTxt(); if (!force && ((etag && (!cur || etagOf(cur) !== etag)) || (!etag && cur))) return null; const t = JSON.stringify(doc); fs.writeFileSync(file, t); return etagOf(t); },
  };
}
