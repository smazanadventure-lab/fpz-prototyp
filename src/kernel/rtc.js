// Transmisja na żywo z kamery telefonu (WebRTC). Obraz i dźwięk płyną bezpośrednio z przeglądarki nadawcy do każdego
// odbiorcy; serwer (server/live-routes.mjs) służy tylko do wymiany oferty i odpowiedzi SDP.
//   nadawca:  const b = await startBroadcast(mediaStream, { streamId, key, onViewers });   b.stop(); b.replaceStream(nowy)
//   odbiorca: const w = watchLive(streamId, { onStream, onState });                         w.stop()
// Stany odbiorcy (onState): 'connecting' | 'live' | 'retry' | 'full' | 'ended' | 'unsupported'
// Wymaga trybu serwerowego (remoteEnabled) i przeglądarki z RTCPeerConnection.
import { getState } from './store.js';
import { apiCall, remoteEnabled } from './remote.js';

export const rtcSupported = () => typeof RTCPeerConnection !== 'undefined' && remoteEnabled();
const rnd = (n) => { const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; const b = new Uint8Array(n); (globalThis.crypto || {}).getRandomValues?.(b); for (let i = 0; i < n; i++) s += a[(b[i] || Math.floor(Math.random() * 256)) % a.length]; return s; };
/** Nowy identyfikator transmisji (jawny – trafia do stanu wspólnego) i klucz nadawcy (tajny – zna go tylko strona nadawania). */
export const newStreamId = () => rnd(14);
export const newStreamKey = () => rnd(28);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (path, body) => apiCall(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => ({ ok: false, error: 'NETWORK' }));
const get = (path) => apiCall(path).catch(() => ({ ok: false, error: 'NETWORK' }));
let iceCfg = null;
async function ice() { if (!iceCfg) { const r = await get('/live/config'); iceCfg = r && r.ok ? { iceServers: r.iceServers, maxViewers: r.maxViewers || 6 } : null; } return iceCfg || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], maxViewers: 6 }; }
/** Czeka, aż przeglądarka zbierze kandydatów ICE (wtedy są w SDP), ale nie dłużej niż `ms`. */
function gathered(pc, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((res) => { const done = () => { pc.removeEventListener('icegatheringstatechange', chk); clearTimeout(to); res(); }; const chk = () => { if (pc.iceGatheringState === 'complete') done(); }; const to = setTimeout(done, ms); pc.addEventListener('icegatheringstatechange', chk); });
}

/**
 * Nadawanie. `stream` – MediaStream z getUserMedia. opts: streamId, key, maxBitrate (b/s na odbiorcę, domyślnie 1,2 Mb/s),
 * onViewers(n) – liczba połączonych odbiorców, onError(kod) – 'FORBIDDEN' | 'NETWORK'.
 */
export async function startBroadcast(stream, { streamId, key, maxBitrate = 1200000, onViewers, onError } = {}) {
  if (!rtcSupported()) throw new Error('Ta przeglądarka nie obsługuje transmisji (WebRTC) albo system działa bez serwera.');
  const opened = await post('/live/open', { stream: streamId, key }); if (!opened.ok) throw new Error(opened.error === 'FORBIDDEN' ? 'Ta transmisja należy do innego nadawcy.' : 'Serwer nie przyjął transmisji – sprawdź połączenie.');
  const cfg = await ice(); const peers = new Map(); let cur = stream; let stopped = false; let lastCount = -1; let netFails = 0;
  const count = () => { const n = [...peers.values()].filter((p) => p.pc.connectionState === 'connected').length; if (n !== lastCount) { lastCount = n; onViewers?.(n); } };
  const drop = (viewer) => { const p = peers.get(viewer); if (p) { try { p.pc.close(); } catch { /* nic */ } clearTimeout(p.timer); peers.delete(viewer); count(); } };
  async function answer({ viewer, n, sdp }) {
    const old = peers.get(viewer); if (old && old.n === n) return; if (old) drop(viewer);
    if (peers.size >= cfg.maxViewers) { await post('/live/answer', { stream: streamId, key, viewer, n, sdp: 'FULL' }); return; }
    const pc = new RTCPeerConnection({ iceServers: cfg.iceServers }); const p = { pc, n, timer: null }; peers.set(viewer, p);
    pc.addEventListener('connectionstatechange', () => {
      clearTimeout(p.timer); const st = pc.connectionState;
      if (st === 'failed' || st === 'closed') drop(viewer); else if (st === 'disconnected') p.timer = setTimeout(() => drop(viewer), 12000);
      count();
    });
    p.timer = setTimeout(() => { if (pc.connectionState !== 'connected') drop(viewer); }, 30000); // oferta bez połączenia
    try {
      for (const t of cur.getTracks()) { const sender = pc.addTrack(t, cur); if (t.kind === 'video') { try { const prm = sender.getParameters(); prm.encodings = prm.encodings && prm.encodings.length ? prm.encodings : [{}]; prm.encodings[0].maxBitrate = maxBitrate; await sender.setParameters(prm); } catch { /* przeglądarka bez ograniczania strumienia */ } } }
      await pc.setRemoteDescription({ type: 'offer', sdp }); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
      const r = await post('/live/answer', { stream: streamId, key, viewer, n, sdp: pc.localDescription.sdp }); if (!r.ok) drop(viewer);
    } catch { drop(viewer); }
  }
  (async function loop() {
    while (!stopped) {
      const r = await get(`/live/offers?stream=${streamId}&key=${key}`);
      if (stopped) break;
      if (r.ok) { netFails = 0; for (const o of r.offers || []) await answer(o); }
      else if (r.error === 'FORBIDDEN') { onError?.('FORBIDDEN'); break; }
      else if (++netFails === 4) onError?.('NETWORK');
      await sleep(peers.size ? 2000 : 1500);
    }
  })();
  return {
    streamId,
    viewers: () => [...peers.values()].filter((p) => p.pc.connectionState === 'connected').length,
    /** Podmiana źródła bez zrywania połączeń (np. kamera przednia ↔ tylna, wyciszenie mikrofonu przez track.enabled robi się bez tego). */
    async replaceStream(next) { cur = next; for (const { pc } of peers.values()) for (const s of pc.getSenders()) { const t = s.track && next.getTracks().find((x) => x.kind === s.track.kind); if (t) { try { await s.replaceTrack(t); } catch { /* odbiorca połączy się ponownie */ } } } },
    async stop() { stopped = true; for (const v of [...peers.keys()]) drop(v); await post('/live/close', { stream: streamId, key }); },
  };
}

/* ───── odbiór ───── */
const watchers = new Map(); // streamId → wspólne połączenie tej strony (kilka odtwarzaczy na jednej stronie = jeden odbiorca)
const viewerId = () => { const st = getState(); if (!watchLive.tab) watchLive.tab = rnd(6); return `${String(st.deviceId || 'anon').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 40)}.${watchLive.tab}`; };

/**
 * Odbiór transmisji. Zwraca { stop() }. onStream(MediaStream|null) – strumień do podpięcia jako video.srcObject;
 * onState(stan). Połączenie jest wspólne dla wszystkich odtwarzaczy na stronie i zamykane, gdy ostatni przestanie oglądać.
 */
export function watchLive(streamId, { onStream, onState } = {}) {
  let w = watchers.get(streamId);
  if (!w) { w = createWatcher(streamId); watchers.set(streamId, w); }
  const sub = { onStream, onState }; w.subs.add(sub); onState?.(w.state); if (w.stream) onStream?.(w.stream);
  return { stop() { w.subs.delete(sub); if (!w.subs.size) { w.close(); watchers.delete(streamId); } } };
}
function createWatcher(streamId) {
  const w = { subs: new Set(), state: 'connecting', stream: null, closed: false, pc: null };
  const set = (state) => { if (w.state !== state) { w.state = state; w.subs.forEach((s) => s.onState?.(state)); } };
  const give = (stream) => { w.stream = stream; w.subs.forEach((s) => s.onStream?.(stream)); };
  w.close = () => { w.closed = true; try { w.pc?.close(); } catch { /* nic */ } w.pc = null; };
  if (!rtcSupported()) { w.state = 'unsupported'; return w; }
  const id = viewerId(); let n = Math.floor(Date.now() / 1000) % 100000;
  (async function run() {
    let attempt = 0;
    while (!w.closed) {
      attempt++; n++; let pc = null; let outcome = 'retry';
      try {
        const cfg = await ice(); pc = new RTCPeerConnection({ iceServers: cfg.iceServers }); w.pc = pc;
        pc.addTransceiver('video', { direction: 'recvonly' }); pc.addTransceiver('audio', { direction: 'recvonly' });
        const ms = new MediaStream(); pc.addEventListener('track', (e) => { ms.addTrack(e.track); });
        await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
        const sent = await post('/live/offer', { stream: streamId, viewer: id, n, sdp: pc.localDescription.sdp });
        if (w.closed) break;
        if (!sent.ok) outcome = sent.error === 'NO_BROADCAST' ? 'ended' : sent.error === 'FULL' ? 'full' : 'retry';
        else {
          let ans = null; const t0 = Date.now();
          while (!w.closed && Date.now() - t0 < 20000) { await sleep(1000); const r = await get(`/live/answer?stream=${streamId}&viewer=${encodeURIComponent(id)}&n=${n}`); if (r.ok && r.sdp) { ans = r; break; } if (!r.ok && r.error === 'NO_BROADCAST') { outcome = 'ended'; break; } }
          if (ans && ans.sdp === 'FULL') outcome = 'full';
          else if (ans) {
            await pc.setRemoteDescription({ type: 'answer', sdp: ans.sdp });
            // czekamy na połączenie, a potem trzymamy je, dopóki działa
            outcome = await new Promise((res) => {
              let lost = null; const to = setTimeout(() => { if (pc.connectionState !== 'connected') res('retry'); }, 15000);
              const chk = () => { const st = pc.connectionState; if (w.closed) { clearTimeout(to); clearTimeout(lost); return res('closed'); } if (st === 'connected') { clearTimeout(to); clearTimeout(lost); attempt = 0; give(ms); set('live'); } else if (st === 'failed' || st === 'closed') { clearTimeout(to); clearTimeout(lost); res('retry'); } else if (st === 'disconnected') { clearTimeout(lost); lost = setTimeout(() => res('retry'), 6000); } };
              pc.addEventListener('connectionstatechange', chk); chk();
            });
          }
        }
      } catch { outcome = 'retry'; }
      try { pc?.close(); } catch { /* nic */ } if (w.pc === pc) w.pc = null;
      if (w.closed || outcome === 'closed') break;
      if (w.stream) give(null);
      set(outcome === 'retry' ? (attempt > 1 ? 'retry' : 'connecting') : outcome);
      // ponowienia: szybko po zerwaniu, rzadziej gdy nadawcy nie ma albo jest komplet odbiorców
      await sleep(outcome === 'ended' ? 5000 : outcome === 'full' ? 8000 : Math.min(8000, 1000 * attempt));
    }
  })();
  return w;
}
