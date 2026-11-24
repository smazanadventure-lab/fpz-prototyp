// Wspólny magazyn danych – symulacja warstwy backend (baza danych + sesje) dla wszystkich końcówek.
// Stan jest MUTOWALNY: zmiany wyłącznie przez update(fn) (zwykle pośrednio przez API z kernel/api.js).
import { useEffect, useState } from 'preact/hooks';

const KEY = 'fpz-prototyp-v1';
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
let state = null;
let version = 0;
let seedFn = null;
const subs = new Set();
let notifyQueued = false;
let saveTimer = null;

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.build === BUILD ? s : null; // nowa kompilacja = świeże dane demo
  } catch { return null; }
}
function persist() {
  try {
    const { apiLog, ...rest } = state; // dziennik API nie jest utrwalany
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...rest, apiLog: [] }));
  } catch { /* brak dostępu do pamięci przeglądarki albo przekroczony limit – prototyp działa dalej w pamięci */ }
}
function flush() {
  notifyQueued = false;
  for (const fn of [...subs]) { try { fn(state, version); } catch (e) { console.error('[store] subscriber error', e); } }
}
function touch(silent) {
  version++;
  if (!notifyQueued) { notifyQueued = true; queueMicrotask(flush); }
  if (!silent) { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 600); }
}

/** Klucze stanu, które należą do urządzenia (nie są synchronizowane z serwerem). Pozostałe klucze to dane wspólne. */
export const LOCAL_KEYS = ['clients', 'env', 'net', 'deviceId', 'build'];
function deviceId() {
  try { let id = globalThis.localStorage?.getItem('fpz-device'); if (!id) { id = 'd-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); globalThis.localStorage?.setItem('fpz-device', id); } return id; } catch { return 'd-' + Math.random().toString(36).slice(2, 10); }
}
function decorate() {
  state.build = BUILD; if (!state.apiLog) state.apiLog = [];
  if (!state.deviceId) state.deviceId = deviceId();
  if (!state.net) state.net = { mode: 'local', status: 'online', pending: 0, version: 0, epoch: null, etag: null };
}
export function initStore(makeSeed) {
  seedFn = makeSeed;
  state = load() || makeSeed();
  decorate();
  return state;
}
/** Serwer: podstawienie stanu na czas wykonania operacji. */
export function setState(obj) { state = obj; return state; }
/** Scalanie w miejscu: obiekty z `id` zachowują tożsamość (komponenty trzymające referencje widzą nowe wartości). */
function merge(t, src) {
  if (Array.isArray(src)) {
    if (!Array.isArray(t)) return src;
    const ids = src.length > 0 && src.every((x) => x && typeof x === 'object' && !Array.isArray(x) && x.id != null);
    let out;
    if (ids) { const old = new Map(); for (const x of t) if (x && typeof x === 'object' && x.id != null) old.set(x.id, x); out = src.map((x) => (old.has(x.id) ? merge(old.get(x.id), x) : x)); }
    else out = src.map((x, i) => (x && typeof x === 'object' ? merge(t[i], x) : x));
    t.length = 0; for (const x of out) t.push(x); return t;
  }
  if (src && typeof src === 'object') {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return src;
    for (const k of Object.keys(t)) if (!(k in src)) delete t[k];
    for (const k of Object.keys(src)) t[k] = merge(t[k], src[k]);
    return t;
  }
  return src;
}
/** Tryb serwerowy: przyjęcie danych wspólnych z serwera (klucze lokalne pozostają nietknięte). opts.newEpoch – dane na serwerze założono od nowa. */
export function applyShared(keys, net, opts = {}) {
  for (const [k, v] of Object.entries(keys || {})) {
    if (k === 'envShared') Object.assign(state.env, v);
    else if (!LOCAL_KEYS.includes(k)) state[k] = merge(state[k], v);
  }
  if (keys?.ideas) for (const i of state.ideas) i.mine = !!i.deviceId && i.deviceId === state.deviceId;
  if (opts.newEpoch) for (const c of Object.values(state.clients)) { c.cart = []; if (c.userId && !(state.users || []).some((u) => u.id === c.userId)) c.userId = null; if (c.staffId && !(state.staff || []).some((u) => u.id === c.staffId)) c.staffId = null; }
  if (net) state.net = { ...state.net, ...net };
  touch();
}
export function setNet(patch) { state.net = { ...state.net, ...patch }; touch(true); }
export const getState = () => state;
export const getVersion = () => version;
/** Zmiana stanu: update(s => { s.coś = …; }). opts.silent – bez zapisu do localStorage (np. telemetria). */
export function update(fn, opts = {}) { const r = fn(state); touch(opts.silent); return r; }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function resetStore() {
  try { globalThis.localStorage?.removeItem(KEY); } catch { /* nic */ }
  state = seedFn(); decorate();
  touch();
}
/** Hook: komponent odświeża się po każdej zmianie stanu. const s = useStore(); albo useStore(s => s.events) */
export function useStore(selector) {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => (n + 1) % 1e9)), []);
  return selector ? selector(state) : state;
}
/** Numer wersji stanu – używaj jako zależności useMemo/useEffect zamiast referencji obiektów (stan jest mutowany w miejscu). */
export function useStoreVersion() { useStore(); return version; }
