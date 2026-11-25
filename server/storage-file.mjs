// Magazyn lokalny (plik JSON) – do uruchamiania serwera testowego poza Netlify: node tools/dev-server.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
export function fileStorage(file) {
  const etagOf = (txt) => '"' + crypto.createHash('sha1').update(txt).digest('hex').slice(0, 16) + '"';
  const readTxt = () => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
  // magazyn plików (multimedia, sygnały urządzeń) – zwykłe pliki w katalogu obok
  const dir = file.replace(/\.json$/, '') + '-files'; const pathOf = (key) => { const p = path.join(dir, key.replace(/[^A-Za-z0-9._/-]/g, '_')); fs.mkdirSync(path.dirname(p), { recursive: true }); return p; };
  const files = {
    async put(key, bytes) { fs.writeFileSync(pathOf(key), bytes); },
    async get(key) { try { return new Uint8Array(fs.readFileSync(pathOf(key))); } catch { return null; } },
    async del(key) { try { fs.unlinkSync(pathOf(key)); } catch { /* nie było */ } },
    async putJSON(key, obj) { fs.writeFileSync(pathOf(key), JSON.stringify(obj)); },
    async getJSON(key) { try { return JSON.parse(fs.readFileSync(pathOf(key), 'utf8')); } catch { return null; } },
  };
  return {
    files,
    async read() { const t = readTxt(); return t ? { doc: JSON.parse(t), etag: etagOf(t) } : null; },
    async readIfChanged(etag) { const t = readTxt(); if (!t) return null; const e = etagOf(t); return e === etag ? null : { doc: JSON.parse(t), etag: e }; },
    async write(doc, etag, force) { const cur = readTxt(); if (!force && ((etag && (!cur || etagOf(cur) !== etag)) || (!etag && cur))) return null; const t = JSON.stringify(doc); fs.writeFileSync(file, t); return etagOf(t); },
  };
}
