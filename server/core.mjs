// Backend pilotażowy: te same operacje domenowe (src/kernel/api.js) wykonywane na serwerze na wspólnym stanie.
// Stan to jeden dokument JSON w magazynie (Netlify Blobs / plik lokalny) zapisywany warunkowo (etag) z ponawianiem.
// Trasy:  GET /api/sync   POST /api/rpc   POST /api/reset   GET /api/info
import { setState } from '../src/kernel/store.js';
import { makeSeed, defaultPlayer, SEED_SCHEMA, BACKOFFICE_KEYS } from '../src/kernel/seed.js';
import { runOp, applySchedules, SHARED_ENV_KEYS } from '../src/kernel/api.js';

try { process.env.TZ = 'Europe/Warsaw'; } catch { /* daty lokalne liczone w czasie serwera */ }

const LOCAL = new Set(['clients', 'env', 'net', 'deviceId', 'build', 'player']);
const CORS_ORIGINS = /^(https?:\/\/localhost(:\d+)?|capacitor:\/\/localhost|ionic:\/\/localhost)$/; // aplikacja APK (WebView) i serwer deweloperski
const json = (body, status, headers) => new Response(JSON.stringify(body), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

/** Jednorazowe poprawki danych na serwerze – każda wykonuje się raz, przy pierwszym żądaniu po wdrożeniu (nowe dane mają je od razu odnotowane). */
const MIGRATIONS = [
  // logo Fabryki jest wbudowane w system – zdejmujemy plik wgrany wcześniej w CMS, który miał przed nim pierwszeństwo
  { id: '2026-11-25-logo-wbudowane', run: (d) => { if (d.settings) d.settings.logo = null; } },
];

function seedDoc() {
  const seed = makeSeed(); const data = {};
  for (const [k, v] of Object.entries(seed)) if (!LOCAL.has(k)) data[k] = v;
  data.players = {}; data.envShared = { simTime: seed.env.simTime ?? null, weather: seed.env.weather ?? null }; data.apiLog = [];
  const keyVer = {}; for (const k of Object.keys(data)) keyVer[k] = 1;
  return { schema: SEED_SCHEMA, epoch: 'e' + Date.now().toString(36), version: 1, keyVer, data, recent: [], migrations: MIGRATIONS.map((m) => m.id), seededAt: new Date().toISOString() };
}
/** Stan w kształcie oczekiwanym przez operacje: dane wspólne + kontekst wywołującego (sesja końcówki, czujniki telefonu, gracz urządzenia). */
function compose(doc, deviceId, req) {
  const s = { ...doc.data }; const pid = deviceId || 'anon';
  const fresh = s.players[pid] ? null : defaultPlayer();
  s.player = s.players[pid] || fresh;
  s.env = { position: req?.env?.position || { lat: s.site?.lat ?? 50.33, lng: s.site?.lng ?? 19.19, poiId: null }, network: req?.env?.network || 'online', qrInView: req?.env?.qrInView || null, arInView: req?.env?.arInView || null, ...s.envShared };
  const cid = req?.clientId || 'api';
  s.clients = { [cid]: { lang: 'pl', theme: 'light', contrast: 'normal', fs: 1, userId: null, staffId: null, cart: [], ...(req?.client || {}) } };
  s.deviceId = pid; s.net = { mode: 'server' };
  return { s, pid, fresh, freshJson: fresh ? JSON.stringify(fresh) : null, cid };
}
function decompose(doc, c) {
  const { s, pid, fresh, freshJson } = c;
  if (fresh && JSON.stringify(s.player) !== freshJson) s.players[pid] = s.player; // gracz powstaje przy pierwszej zmianie
  for (const [k, v] of Object.entries(s)) if (!LOCAL.has(k)) doc.data[k] = v;
  doc.data.envShared = Object.fromEntries(SHARED_ENV_KEYS.map((k) => [k, s.env[k] ?? null]));
}
const snapshot = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)]));
function bump(doc, before) {
  let changed = false;
  for (const [k, v] of Object.entries(doc.data)) { if (before[k] !== JSON.stringify(v)) { if (!changed) { doc.version++; changed = true; } doc.keyVer[k] = doc.version; } }
  return changed;
}
const APP_HIDDEN = new Set(BACKOFFICE_KEYS); const ADMIN_OP = /^(cms|devices|staff|sys|live|tickets)\./;
/** Dane dla urządzenia: całość albo tylko klucze zmienione po wersji `since`.
 *  Aplikacja dla zwiedzających (role = 'app') nie dostaje danych zaplecza ani postępów innych graczy – tylko własnego gracza. */
function view(doc, { since, deviceId, epoch, role }) {
  const full = !since || epoch !== doc.epoch; const keys = {}; const app = role === 'app';
  for (const [k, v] of Object.entries(doc.data)) {
    if (!(full || doc.keyVer[k] > since)) continue;
    if (k === 'players') keys.player = v[deviceId] || defaultPlayer();
    if (app && APP_HIDDEN.has(k)) continue;
    keys[k] = v;
  }
  return { epoch: doc.epoch, version: doc.version, full, keys };
}

/* ───── Pliki multimedialne ─────
 * Plik jest dzielony przez przeglądarkę na części (CHUNK) i zapisywany w magazynie plików: m/<id>/<nr> + m/<id>/meta.
 * Odtwarzacze pobierają go zakresami (nagłówek Range) – każda odpowiedź to co najwyżej jedna część. */
export const MEDIA_CHUNK = 3 * 1024 * 1024; export const MEDIA_MAX_PARTS = 24; // do 72 MB na plik
const MEDIA_TYPES = /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm)|audio\/(mpeg|mp3|mp4|aac|ogg|wav|x-wav|webm|x-m4a))$/;
const MEDIA_ID = /^[a-z0-9][a-z0-9-]{5,39}$/; const DEVICE_ID = /^[A-Za-z0-9][A-Za-z0-9.\-]{2,23}$/;
const mediaHeaders = (meta, len, extra) => ({ 'content-type': meta.type, 'content-length': String(len), 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline', ...extra });
/** Urządzenie uznajemy za odłączone po tylu ms bez sygnału; po OFFLINE_INCIDENT_MS powstaje zgłoszenie. */
const envMs = (k, d) => { try { return +process.env[k] || d; } catch { return d; } }; // progi można skrócić w testach
export const BEAT_STALE_MS = envMs('FPZ_STALE_MS', 100000); const OFFLINE_INCIDENT_MS = envMs('FPZ_OFFLINE_MS', 300000);
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : v);
function cleanBeat(b, src) {
  const out = { src, at: Date.now() };
  for (const k of ['kind', 'instance', 'ver', 'ua', 'lang', 'host', 'os', 'appliedRestart', 'monitor', 'note']) if (b[k] != null) out[k] = clip(String(b[k]), 240);
  for (const k of ['boot', 'lastInput', 'cpu', 'memPct', 'diskFreeGb', 'uptimeH', 'volume', 'brightness', 'tempC']) if (Number.isFinite(+b[k]) && b[k] !== null && b[k] !== '') out[k] = +b[k];
  for (const k of ['fullscreen', 'visible', 'online', 'standalone']) if (typeof b[k] === 'boolean') out[k] = b[k];
  for (const k of ['screen', 'viewport']) if (Array.isArray(b[k])) out[k] = b[k].slice(0, 3).map((x) => +x || 0);
  return out;
}

export function createHandler(getStorage) {
  async function seed(storage, r) {
    const doc = seedDoc(); const etag = await storage.write(doc, r ? r.etag : null, !!r); if (etag) return { doc, etag };
    const again = await storage.read(); if (again) return again; throw new Error('Nie udało się założyć danych początkowych.');
  }
  async function load(storage) {
    let r = await storage.read(); if (!(r && r.doc && r.doc.schema === SEED_SCHEMA)) return seed(storage, r);
    for (let i = 0; i < 4; i++) { // zaległe poprawki danych (zapis warunkowy – gdy ubiegnie nas inne żądanie, sprawdzamy ponownie)
      const todo = MIGRATIONS.filter((m) => !(r.doc.migrations || []).includes(m.id)); if (!todo.length) return r;
      const before = snapshot(r.doc.data); for (const m of todo) m.run(r.doc.data);
      r.doc.migrations = [...(r.doc.migrations || []), ...todo.map((m) => m.id)]; bump(r.doc, before);
      const etag = await storage.write(r.doc, r.etag); if (etag) return { doc: r.doc, etag };
      r = await storage.read(); if (!r) break;
    }
    return r || seed(storage, null);
  }
  /** Odczyt–zmiana–zapis z kontrolą wersji (etag); przy kolizji z innym zapisem całość jest powtarzana na świeżym stanie. */
  async function mutate(storage, fn) {
    for (let i = 0; i < 6; i++) {
      const { doc, etag } = await load(storage); const before = snapshot(doc.data); const recentLen = doc.recent.length;
      const out = fn(doc); const changed = bump(doc, before) || doc.recent.length !== recentLen;
      if (!changed) return { doc, etag, out };
      const newEtag = await storage.write(doc, etag); if (newEtag) return { doc, etag: newEtag, out };
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 100 * (i + 1)));
    }
    throw new Error('Zbyt wiele równoczesnych zapisów – spróbuj ponownie.');
  }
  /** Harmonogramy + (gdy podano sygnały urządzeń) prawdziwy monitoring: zgłoszenie „brak sygnału” i jego automatyczne zamknięcie. */
  const tick = (doc, beats) => {
    const c = compose(doc, 'scheduler', null); setState(c.s); applySchedules(c.s);
    if (beats) {
      const s = c.s; const now = Date.now(); const iso = new Date(now).toISOString();
      for (const d of s.devices) {
        const b = beats[d.id]?.page || beats[d.id]?.agent; if (!b) continue; // nigdy niepodłączone – nie zgłaszamy
        const last = Math.max(beats[d.id]?.page?.at || 0, beats[d.id]?.agent?.at || 0); const open = s.incidents.find((i) => i.deviceId === d.id && String(i.id).startsWith('inc-mon-') && i.status !== 'closed' && i.status !== 'resolved'); // zgłoszenia automatu mają identyfikator inc-mon-…
        if (now - last > OFFLINE_INCIDENT_MS && d.power === 'on' && !open) {
          const inc = { id: 'inc-mon-' + d.id + '-' + last.toString(36), deviceId: d.id, title: `Brak sygnału z urządzenia od ${new Date(last).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`, severity: 'P2', status: 'open', createdAt: iso, reactedAt: null, resolvedAt: null, note: '', source: 'monitoring – brak sygnału' };
          if (!s.incidents.some((i) => i.id === inc.id)) { s.incidents.unshift(inc); for (const r of s.alertRules.filter((x) => x.active && x.event === 'offline')) { s.outbox.unshift({ id: 'out-' + inc.id + '-' + r.id, at: iso, kind: r.channel, to: r.recipient, subject: `[P2] Urządzenie offline: ${d.name}`, body: `${inc.title}. Zgłoszenie ${inc.id} (monitoring).` }); if (s.outbox.length > 200) s.outbox.length = 200; } }
        } else if (now - last <= BEAT_STALE_MS && open) { open.status = 'closed'; open.autoClosed = true; open.resolvedAt = iso; if (!open.reactedAt) open.reactedAt = iso; open.note = (open.note ? open.note + ' ' : '') + 'Połączenie przywrócone – zamknięte automatycznie.'; }
      }
    }
    decompose(doc, c);
  };
  const files = (storage) => { if (!storage.files) throw new Error('Magazyn plików nie jest skonfigurowany.'); return storage.files; };
  async function readBeats(storage, ids) {
    const f = files(storage); const out = {};
    await Promise.all(ids.flatMap((id) => ['page', 'agent'].map(async (src) => { const b = await f.getJSON(`beat/${id}/${src}`).catch(() => null); if (b) (out[id] = out[id] || {})[src] = b; })));
    return out;
  }

  return async function handle(request) {
    const url = new URL(request.url); const route = url.pathname.replace(/^.*\/api\//, '').replace(/\/+$/, '');
    const origin = request.headers.get('origin');
    const cors = origin && CORS_ORIGINS.test(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-max-age': '86400' } : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const storage = getStorage(); const q = Object.fromEntries(url.searchParams);
      if (route === 'info' && request.method === 'GET') {
        const { doc } = await load(storage); const d = doc.data;
        return json({ ok: true, service: 'fpz-pilot', schema: doc.schema, epoch: doc.epoch, version: doc.version, seededAt: doc.seededAt, logo: d.settings?.logo ? 'plik z CMS' : 'wbudowane', migrations: doc.migrations || [], counts: { entries: d.entries.length, events: d.events.length, orders: d.orders.length, tickets: d.tickets.length, players: Object.keys(d.players).length, devices: d.devices.length } }, 200, cors);
      }
      if (route === 'sync' && request.method === 'GET') {
        const ident = { since: +q.since || 0, epoch: q.epoch || '', deviceId: q.device || 'anon', role: q.role === 'app' ? 'app' : 'full' };
        if (q.tick) { const cur = await load(storage); const beats = storage.files ? await readBeats(storage, cur.doc.data.devices.map((d) => d.id)).catch(() => null) : null; const r = await mutate(storage, (doc) => tick(doc, beats)); return json({ ...view(r.doc, ident), etag: r.etag }, 200, cors); }
        if (q.etag && ident.since) { const r = await storage.readIfChanged(q.etag); if (!r) return json({ unchanged: true }, 200, cors); if (r.doc.schema === SEED_SCHEMA) return json({ ...view(r.doc, ident), etag: r.etag }, 200, cors); }
        const r = await load(storage); return json({ ...view(r.doc, ident), etag: r.etag }, 200, cors);
      }
      if (route === 'rpc' && request.method === 'POST') {
        const b = await request.json().catch(() => null); const ops = b && Array.isArray(b.ops) ? b.ops : null;
        if (!ops || ops.length > 60 || ops.some((o) => !o || typeof o.op !== 'string' || !Array.isArray(o.args))) return json({ error: 'BAD_REQUEST' }, 400, cors);
        const ident = { since: +b.since || 0, epoch: b.epoch || '', deviceId: String(b.deviceId || 'anon').slice(0, 40), role: b.role === 'app' ? 'app' : 'full' };
        const r = await mutate(storage, (doc) => {
          const results = [];
          for (const o of ops) {
            if (o.nonce && doc.recent.includes(o.nonce)) { results.push({ ok: true, duplicate: true }); continue; } // ponowienie po utraconej odpowiedzi
            if (ident.role === 'app' && ADMIN_OP.test(o.op)) { results.push({ ok: false, error: 'FORBIDDEN' }); continue; } // aplikacja dla zwiedzających nie wykonuje operacji zaplecza
            const c = compose(doc, ident.deviceId, o); setState(c.s); let res;
            try { res = runOp(c.s, o.op, { clientId: c.cid, client: c.s.clients[c.cid], deviceId: ident.deviceId, nonce: o.nonce || String(Date.now()) }, o.args); if (res === null) res = { ok: false, error: 'UNKNOWN_OP' }; }
            catch (e) { console.error('[api] operacja', o.op, e); res = { ok: false, error: 'SERVER_ERROR', message: { pl: 'Błąd operacji na serwerze.', en: 'Server operation error.' } }; }
            decompose(doc, c);
            if (o.nonce) doc.recent.push(o.nonce);
            results.push(res === undefined ? { ok: true } : res);
          }
          if (doc.recent.length > 600) doc.recent.splice(0, doc.recent.length - 600);
          tick(doc);
          return results;
        });
        // do klienta wraca tylko skrót wyniku (pełny wynik klient ma z wykonania lokalnego)
        const results = r.out.map((x) => ({ ok: x?.ok !== false, error: x?.error || null, message: x?.message || null, duplicate: x?.duplicate || undefined }));
        return json({ results, ...view(r.doc, ident), etag: r.etag }, 200, cors);
      }
      /* ── pliki multimedialne ── */
      const mm = route.match(/^media\/([^/]+)$/);
      if (mm) {
        const id = mm[1]; const f = files(storage); if (!MEDIA_ID.test(id)) return json({ error: 'BAD_ID' }, 400, cors);
        if (request.method === 'POST') { // jedna część pliku
          if (q.role === 'app') return json({ error: 'FORBIDDEN' }, 403, cors);
          const part = +q.part; const parts = +q.parts; const type = String(q.type || ''); const size = +q.size;
          if (!(parts >= 1 && parts <= MEDIA_MAX_PARTS && part >= 0 && part < parts) || !MEDIA_TYPES.test(type) || !(size > 0 && size <= parts * MEDIA_CHUNK)) return json({ error: 'BAD_REQUEST', message: 'Niedozwolony typ pliku albo rozmiar (maks. 72 MB; obrazy JPG/PNG/WebP, wideo MP4/WebM, audio MP3/M4A/OGG/WAV).' }, 400, cors);
          const buf = new Uint8Array(await request.arrayBuffer()); const expect = part < parts - 1 ? MEDIA_CHUNK : size - (parts - 1) * MEDIA_CHUNK;
          if (buf.length !== expect) return json({ error: 'BAD_PART', message: `Część ${part}: ${buf.length} B, oczekiwano ${expect} B.` }, 400, cors);
          await f.put(`m/${id}/${part}`, buf);
          if (part === parts - 1) await f.putJSON(`m/${id}/meta`, { type, size, parts, chunk: MEDIA_CHUNK, name: clip(String(q.name || ''), 160), at: Date.now() });
          return json({ ok: true, part, done: part === parts - 1 }, 200, cors);
        }
        if (request.method === 'DELETE') {
          if (q.role === 'app') return json({ error: 'FORBIDDEN' }, 403, cors);
          const meta = await f.getJSON(`m/${id}/meta`); await Promise.all([...Array.from({ length: meta?.parts || MEDIA_MAX_PARTS }, (_, i) => f.del(`m/${id}/${i}`).catch(() => null)), f.del(`m/${id}/meta`).catch(() => null)]);
          return json({ ok: true }, 200, cors);
        }
        if (request.method === 'GET' || request.method === 'HEAD') {
          const meta = await f.getJSON(`m/${id}/meta`); if (!meta) return new Response('Nie ma takiego pliku', { status: 404, headers: { 'access-control-allow-origin': '*' } });
          const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
          if (request.method === 'HEAD') return new Response(null, { status: 200, headers: mediaHeaders(meta, meta.size) });
          if (!range) { // całość: mały plik w jednej odpowiedzi, większy – strumieniem części
            if (meta.parts === 1) { const buf = await f.get(`m/${id}/0`); if (!buf) return new Response('Brak danych pliku', { status: 404 }); return new Response(buf, { status: 200, headers: mediaHeaders(meta, buf.length) }); }
            let i = 0; const stream = new ReadableStream({ async pull(ctl) { if (i >= meta.parts) { ctl.close(); return; } const buf = await f.get(`m/${id}/${i++}`); if (!buf) { ctl.error(new Error('brak części pliku')); return; } ctl.enqueue(buf); } });
            return new Response(stream, { status: 200, headers: mediaHeaders(meta, meta.size) });
          }
          let start; let end;
          if (range[1] === '') { const n = +range[2]; if (!n) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${meta.size}` } }); start = Math.max(0, meta.size - n); end = meta.size - 1; }
          else { start = +range[1]; end = range[2] === '' ? meta.size - 1 : Math.min(+range[2], meta.size - 1); }
          if (start >= meta.size || end < start) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${meta.size}`, 'access-control-allow-origin': '*' } });
          const idx = Math.floor(start / meta.chunk); const buf = await f.get(`m/${id}/${idx}`); if (!buf) return new Response('Brak danych pliku', { status: 404 });
          const off = start - idx * meta.chunk; const stop = Math.min(buf.length, end - idx * meta.chunk + 1); const body = buf.subarray(off, stop);
          return new Response(body, { status: 206, headers: mediaHeaders(meta, body.length, { 'content-range': `bytes ${start}-${start + body.length - 1}/${meta.size}` }) });
        }
      }
      /* ── obecność urządzeń (prawdziwy stan) ── */
      if (route === 'beat' && request.method === 'POST') {
        const b = await request.json().catch(() => null); const src = b?.src === 'agent' ? 'agent' : 'page';
        if (!b || !DEVICE_ID.test(String(b.id || ''))) return json({ error: 'BAD_REQUEST' }, 400, cors);
        const beat = cleanBeat(b, src); const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for'); if (ip) beat.ip = String(ip).split(',')[0].trim().slice(0, 45);
        await files(storage).putJSON(`beat/${b.id}/${src}`, beat);
        return json({ ok: true, now: beat.at }, 200, cors);
      }
      if (route === 'presence' && request.method === 'GET') {
        if (q.role === 'app') return json({ error: 'FORBIDDEN' }, 403, cors);
        const { doc } = await load(storage); const beats = await readBeats(storage, doc.data.devices.map((d) => d.id));
        return json({ now: Date.now(), staleMs: BEAT_STALE_MS, beats }, 200, cors);
      }
      const dm = route.match(/^device\/([^/]+)$/);
      if (dm && request.method === 'GET') { // stan jednego urządzenia – dla programu sterującego na komputerze kiosku (bez danych wrażliwych)
        const { doc } = await load(storage); const id = decodeURIComponent(dm[1]); const d = doc.data.devices.find((x) => x.id === id); if (!d) return json({ error: 'NOT_FOUND' }, 404, cors);
        return json({ id: d.id, name: d.name, kind: d.kind, power: d.power, schedule: d.schedule, night: !!d.night, brightness: d.brightness ?? 100, volume: d.volume ?? 100, restartedAt: d.restartedAt || null, now: Date.now() }, 200, { ...cors, 'access-control-allow-origin': '*' });
      }
      if (route === 'reset' && request.method === 'POST') {
        if (q.role === 'app') return json({ error: 'FORBIDDEN' }, 403, cors);
        const doc = seedDoc(); const cur = await storage.read(); const etag = await storage.write(doc, cur ? cur.etag : null, true);
        return json({ ...view(doc, { since: 0, deviceId: q.device || 'anon' }), etag }, 200, cors);
      }
      return json({ error: 'NOT_FOUND', route }, 404, cors);
    } catch (e) { console.error('[api]', e); return json({ error: 'SERVER_ERROR', message: String(e?.message || e) }, 500, cors); }
  };
}
