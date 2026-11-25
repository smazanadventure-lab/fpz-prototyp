// Tryb serwerowy: synchronizacja wspólnego stanu z backendem (/api/*).
// Operacje API są wykonywane lokalnie od razu (wynik natychmiast, działa też offline), a tutaj trafiają do kolejki
// i są w tej samej kolejności powtarzane na serwerze. Serwer jest źródłem prawdy: jego stan zastępuje dane wspólne,
// gdy kolejka jest pusta. Zmiany z innych urządzeń przychodzą przy cyklicznym odpytywaniu (częściej, gdy coś się dzieje).
import { getState, applyShared, setNet, resetStore } from './store.js';
import { setRemoteHook } from './api.js';

const QKEY = 'fpz-kolejka-v1';
const ROLE = globalThis.FPZ_APP_ONLY ? 'app' : 'full'; // aplikacja dla zwiedzających dostaje z serwera tylko dane publiczne i własne
let base = null; let queue = []; let sending = false; let syncing = false; let timer = null;
let opSeq = 0; let lastActivity = Date.now(); let lastSyncAt = 0; let lastTick = 0; let lastFull = 0; let fails = 0; let needFull = true;

export const remoteEnabled = () => base !== null;
export const apiBase = () => base;
const saveQueue = () => { try { localStorage.setItem(QKEY, JSON.stringify(queue.slice(-300))); } catch { /* brak pamięci – kolejka tylko w pamięci */ } };
const url = (p) => base + '/api' + p;
async function call(path, init) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const to = setTimeout(() => ctl?.abort(), 25000);
  try {
    const r = await fetch(url(path), { ...init, signal: ctl?.signal, cache: 'no-store', credentials: 'omit' });
    const type = r.headers.get('content-type') || '';
    if (!type.includes('json')) throw Object.assign(new Error('Serwer niedostępny (HTTP ' + r.status + ')'), { http: r.status });
    const body = await r.json(); if (!r.ok) throw Object.assign(new Error(body?.message || body?.error || 'HTTP ' + r.status), { http: r.status, code: body?.error });
    return body;
  } finally { clearTimeout(to); }
}
const online = () => { fails = 0; if (getState().net.status !== 'online') setNet({ status: 'online' }); };
const offline = (e) => { fails++; setNet({ status: 'offline', error: String(e?.message || e || '') }); };

function apply(r) {
  const st = getState().net; const newEpoch = !!st.epoch && r.epoch !== st.epoch;
  const n = Object.keys(r.keys || {}).filter((k) => k !== 'apiLog').length; if (n) lastActivity = Date.now();
  if (r.full) { lastFull = Date.now(); needFull = false; }
  applyShared(r.keys, { status: 'online', version: r.version, epoch: r.epoch, etag: r.etag, lastSync: Date.now(), pending: queue.length, pay: r.pay || null }, { newEpoch });
}
function interval() {
  if (typeof document !== 'undefined' && document.hidden) return 0;
  if (getState().net.status === 'offline') return Math.min(30000, 2000 * 2 ** Math.min(fails, 4));
  const idle = Date.now() - lastActivity; return idle < 90000 ? 4000 : idle < 600000 ? 10000 : 30000;
}
let nextAt = 0;
function schedule() { clearTimeout(timer); const ms = interval(); nextAt = ms ? Date.now() + ms : 0; if (ms) timer = setTimeout(cycle, ms); }
function cycle() { if (queue.length) pump(); else sync(); }

async function sync() {
  if (sending || syncing) return; syncing = true; const seq = opSeq; const st = getState(); const full = needFull || Date.now() - lastFull > 600000;
  const p = new URLSearchParams({ device: st.deviceId, role: ROLE, since: full ? 0 : st.net.version || 0, epoch: st.net.epoch || '' });
  if (!full && st.net.etag) p.set('etag', st.net.etag);
  if (Date.now() - lastTick > 55000) { p.set('tick', '1'); lastTick = Date.now(); }
  try { const r = await call('/sync?' + p); lastSyncAt = Date.now(); online(); if (!r.unchanged && seq === opSeq && !queue.length) apply(r); else if (r.unchanged) setNet({ lastSync: Date.now() }); }
  catch (e) { offline(e); }
  finally { syncing = false; schedule(); }
}
async function pump() {
  if (sending || !queue.length) return; sending = true; clearTimeout(timer);
  while (queue.length) {
    const batch = queue.slice(0, 25); const st = getState();
    try {
      const r = await call('/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: st.deviceId, role: ROLE, since: needFull ? 0 : st.net.version || 0, epoch: st.net.epoch || '', ops: batch.map(({ lazy, localOk, ...o }) => o) }) });
      queue.splice(0, batch.length); saveQueue(); lastSyncAt = Date.now(); online();
      (r.results || []).forEach((res, i) => { const it = batch[i]; if (it && res && res.ok !== it.localOk && !res.duplicate) { needFull = true; setNet({ conflict: { at: Date.now(), op: it.op, serverOk: res.ok, error: res.error, message: res.message } }); } });
      if (!queue.length) { if (needFull && !r.full) { setNet({ pending: 0 }); sending = false; return sync(); } apply(r); } else setNet({ pending: queue.length });
    } catch (e) {
      if (e?.code === 'BAD_REQUEST') { queue.splice(0, batch.length); saveQueue(); needFull = true; setNet({ pending: queue.length, conflict: { at: Date.now(), op: batch[0].op, serverOk: false, error: 'BAD_REQUEST' } }); continue; } // odrzucona paczka nie blokuje kolejki
      offline(e); break;
    }
  }
  sending = false; schedule();
}
const kick = () => { clearTimeout(timer); cycle(); };

/** Uruchomienie synchronizacji; apiBase = '' (ten sam adres) albo pełny adres serwera (aplikacja APK). */
export function startRemote(apiBaseUrl) {
  if (base !== null) return; base = String(apiBaseUrl || '').replace(/\/+$/, '');
  try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]') || []; } catch { queue = []; }
  setNet({ mode: 'remote', status: 'connecting', pending: queue.length, conflict: null });
  setRemoteHook((item) => { opSeq++; queue.push(item); saveQueue(); lastActivity = Date.now(); setNet({ pending: queue.length }); if (!item.lazy) pump(); else if (!sending && !syncing && (!nextAt || nextAt - Date.now() > 4500)) schedule(); }); // statystyki czekają na najbliższy cykl (do ok. 4 s)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { fails = 0; kick(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); else clearTimeout(timer); });
    const act = () => { const idle = Date.now() - lastActivity > 90000; lastActivity = Date.now(); if (Date.now() - lastSyncAt > 2500 && !sending && !syncing) kick(); else if (idle) schedule(); };
    window.addEventListener('pointerdown', act, { capture: true, passive: true }); window.addEventListener('keydown', act, { capture: true, passive: true });
  }
  kick();
}
/** Przywrócenie danych początkowych NA SERWERZE (dla wszystkich urządzeń). */
export async function remoteReset() {
  queue = []; saveQueue(); opSeq++;
  const r = await call('/reset?device=' + encodeURIComponent(getState().deviceId), { method: 'POST' });
  resetStore(); setNet({ mode: 'remote', status: 'online', pending: 0, conflict: null }); apply({ ...r, full: true }); schedule();
}
export const dismissConflict = () => setNet({ conflict: null });
export const syncNow = () => kick();
/** Czeka, aż kolejka operacji dotrze na serwer (np. zamówienie przed rozpoczęciem płatności). Zwraca true, gdy kolejka jest pusta. */
export const whenSent = (ms = 8000) => new Promise((res) => { const t0 = Date.now(); const chk = () => { if (!queue.length && !sending) return res(true); if (Date.now() - t0 > ms) return res(false); setTimeout(chk, 120); }; chk(); });
/** Wywołanie dodatkowej trasy API (poza synchronizacją), np. płatności. Zwraca treść odpowiedzi także dla błędów HTTP. */
export async function apiCall(path, init) { const r = await fetch(url(path), { ...init, cache: 'no-store', credentials: 'omit' }); const j = await r.json().catch(() => null); return j || { ok: false, error: 'HTTP_' + r.status }; }
