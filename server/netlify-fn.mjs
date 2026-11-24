// Funkcja Netlify (źródło). `node build.mjs --server` składa ją z jądrem i treściami w server/build/handler.mjs,
// a netlify/functions/api.mjs tylko ją wystawia pod adresem /api/*.
// Dane: Netlify Blobs – magazyn „fpz-pilot”, klucz „state”, spójność silna, zapis warunkowy (onlyIfMatch).
import { getStore } from '@netlify/blobs';
import { createHandler } from './core.mjs';

function blobStorage() {
  const store = getStore({ name: 'fpz-pilot', consistency: 'strong' });
  // '*' = wpis istnieje, ale magazyn nie podał etykiety wersji (etag) – wtedy zapis jest bezwarunkowy (zamiast błędu)
  const tag = async (r) => r.etag || (await store.getMetadata('state').catch(() => null))?.etag || '*';
  return {
    async read() { const r = await store.getWithMetadata('state', { type: 'json' }); return r && r.data ? { doc: r.data, etag: await tag(r) } : null; },
    /** null = bez zmian od podanej wersji (odpowiedź 304 – bez pobierania danych) */
    async readIfChanged(etag) { if (!etag || etag === '*') return this.read(); const r = await store.getWithMetadata('state', { type: 'json', etag }); if (!r || r.data === null || r.data === undefined) return null; return { doc: r.data, etag: await tag(r) }; },
    /** Zapis warunkowy: nowy wpis tylko gdy go nie ma, zmiana tylko gdy nikt inny nie zapisał w międzyczasie. Zwraca nową etykietę albo null. */
    async write(doc, etag, force) {
      const opts = force || etag === '*' ? {} : etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
      const r = await store.setJSON('state', doc, opts); if (r && r.modified === false) return null;
      return (r && r.etag) || '*';
    },
  };
}
const handle = createHandler(blobStorage);
export default async (req) => handle(req);
