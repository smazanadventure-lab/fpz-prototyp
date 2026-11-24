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

function seedDoc() {
  const seed = makeSeed(); const data = {};
  for (const [k, v] of Object.entries(seed)) if (!LOCAL.has(k)) data[k] = v;
  data.players = {}; data.envShared = { simTime: seed.env.simTime ?? null, weather: seed.env.weather ?? null }; data.apiLog = [];
  const keyVer = {}; for (const k of Object.keys(data)) keyVer[k] = 1;
  return { schema: SEED_SCHEMA, epoch: 'e' + Date.now().toString(36), version: 1, keyVer, data, recent: [], seededAt: new Date().toISOString() };
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

export function createHandler(getStorage) {
  async function load(storage) {
    const r = await storage.read(); if (r && r.doc && r.doc.schema === SEED_SCHEMA) return r;
    const doc = seedDoc(); const etag = await storage.write(doc, r ? r.etag : null, !!r); if (etag) return { doc, etag };
    const again = await storage.read(); if (again) return again; throw new Error('Nie udało się założyć danych początkowych.');
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
  const tick = (doc) => { const c = compose(doc, 'scheduler', null); setState(c.s); applySchedules(c.s); decompose(doc, c); };

  return async function handle(request) {
    const url = new URL(request.url); const route = url.pathname.replace(/^.*\/api\//, '').replace(/\/+$/, '');
    const origin = request.headers.get('origin');
    const cors = origin && CORS_ORIGINS.test(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-max-age': '86400' } : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const storage = getStorage(); const q = Object.fromEntries(url.searchParams);
      if (route === 'info' && request.method === 'GET') {
        const { doc } = await load(storage); const d = doc.data;
        return json({ ok: true, service: 'fpz-pilot', schema: doc.schema, epoch: doc.epoch, version: doc.version, seededAt: doc.seededAt, counts: { entries: d.entries.length, events: d.events.length, orders: d.orders.length, tickets: d.tickets.length, players: Object.keys(d.players).length, devices: d.devices.length } }, 200, cors);
      }
      if (route === 'sync' && request.method === 'GET') {
        const ident = { since: +q.since || 0, epoch: q.epoch || '', deviceId: q.device || 'anon', role: q.role === 'app' ? 'app' : 'full' };
        if (q.tick) { const r = await mutate(storage, tick); return json({ ...view(r.doc, ident), etag: r.etag }, 200, cors); }
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
      if (route === 'reset' && request.method === 'POST') {
        if (q.role === 'app') return json({ error: 'FORBIDDEN' }, 403, cors);
        const doc = seedDoc(); const cur = await storage.read(); const etag = await storage.write(doc, cur ? cur.etag : null, true);
        return json({ ...view(doc, { since: 0, deviceId: q.device || 'anon' }), etag }, 200, cors);
      }
      return json({ error: 'NOT_FOUND', route }, 404, cors);
    } catch (e) { console.error('[api]', e); return json({ error: 'SERVER_ERROR', message: String(e?.message || e) }, 500, cors); }
  };
}
