// Transmisja na żywo z kamery telefonu – sygnalizacja WebRTC (wymiana ofert i odpowiedzi SDP).
// Obraz i dźwięk płyną bezpośrednio z telefonu nadawcy do każdego odbiorcy (ekran, aplikacja, WWW); serwer tylko
// pomaga im się odnaleźć. Każdy odbiorca tworzy ofertę, nadawca odpowiada – po jednej wiadomości w każdą stronę
// (kandydaci ICE są już w SDP, bez „trickle”).
//   GET  /api/live/config                    – serwery ICE (STUN, opcjonalnie TURN ze zmiennych TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL)
//   POST /api/live/open    {stream,key}      – nadawca otwiera transmisję (klucz zna tylko on)
//   GET  /api/live/offers  ?stream&key       – nadawca: oczekujące oferty odbiorców (co ok. 1,5 s; to także sygnał „nadaję”)
//   POST /api/live/answer  {stream,key,viewer,n,sdp}
//   POST /api/live/close   {stream,key}
//   POST /api/live/offer   {stream,viewer,n,sdp}   – odbiorca
//   GET  /api/live/answer  ?stream&viewer&n         – odbiorca: odpowiedź nadawcy albo { wait: true }
import crypto from 'node:crypto';

const STREAM = /^[a-z0-9]{8,32}$/; const VIEWER = /^[A-Za-z0-9._:-]{3,64}$/; const KEY = /^[A-Za-z0-9]{16,64}$/;
const MAX_SDP = 24000; export const LIVE_MAX_VIEWERS = 6; const STALE_MS = 20000; const OFFER_TTL_MS = 45000;
const hash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
const env = (k) => { try { return (process.env[k] || '').trim(); } catch { return ''; } };
const iceServers = () => {
  const out = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const turn = env('TURN_URLS'); if (turn) out.push({ urls: turn.split(',').map((x) => x.trim()).filter(Boolean), username: env('TURN_USERNAME'), credential: env('TURN_CREDENTIAL') });
  return out;
};

export function createLiveRoutes({ json }) {
  const lastBeat = new Map(); // strumień → czas ostatniego zapisu sygnału nadawcy (nie częściej niż co 5 s)
  return async function liveRoute(route, request, url, q, storage, cors) {
    if (!route.startsWith('live/')) return null;
    const f = storage.files; if (!f || !f.list) return json({ ok: false, error: 'NO_STORAGE' }, 501, cors);
    const P = (stream, rest) => `live/${stream}/${rest}`;
    const body = request.method === 'POST' ? await request.json().catch(() => null) : null;
    const stream = String((body ? body.stream : q.stream) || '');
    if (route === 'live/config' && request.method === 'GET') return json({ ok: true, iceServers: iceServers(), maxViewers: LIVE_MAX_VIEWERS, turn: !!env('TURN_URLS') }, 200, cors);
    if (!STREAM.test(stream)) return json({ ok: false, error: 'BAD_REQUEST' }, 400, cors);
    const meta = await f.getJSON(P(stream, 'meta'));
    const owner = () => { const key = String((body ? body.key : q.key) || ''); return KEY.test(key) && meta && meta.kh === hash(key); };
    const alive = () => !!meta && Date.now() - (meta.at || 0) < STALE_MS;

    if (route === 'live/open' && request.method === 'POST') {
      const key = String(body?.key || ''); if (!KEY.test(key)) return json({ ok: false, error: 'BAD_REQUEST' }, 400, cors);
      if (meta && meta.kh !== hash(key)) return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
      await f.putJSON(P(stream, 'meta'), { kh: hash(key), at: Date.now(), openedAt: meta?.openedAt || Date.now() }); lastBeat.set(stream, Date.now());
      return json({ ok: true, iceServers: iceServers(), maxViewers: LIVE_MAX_VIEWERS }, 200, cors);
    }
    if (route === 'live/offers' && request.method === 'GET') {
      if (!owner()) return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
      if (Date.now() - (lastBeat.get(stream) || 0) > 5000) { await f.putJSON(P(stream, 'meta'), { ...meta, at: Date.now() }); lastBeat.set(stream, Date.now()); }
      const keys = await f.list(P(stream, 'o/')); const offers = [];
      for (const k of keys.slice(0, 20)) { const o = await f.getJSON(k); if (!o) continue; if (Date.now() - o.at > OFFER_TTL_MS) { await f.del(k); continue; } offers.push({ viewer: k.slice(P(stream, 'o/').length), n: o.n, sdp: o.sdp }); }
      return json({ ok: true, offers }, 200, cors);
    }
    if (route === 'live/answer' && request.method === 'POST') {
      if (!owner()) return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
      const viewer = String(body.viewer || ''); const sdp = String(body.sdp || ''); if (!VIEWER.test(viewer) || !sdp || sdp.length > MAX_SDP) return json({ ok: false, error: 'BAD_REQUEST' }, 400, cors);
      await f.putJSON(P(stream, 'a/' + viewer), { n: +body.n || 0, sdp, at: Date.now() }); await f.del(P(stream, 'o/' + viewer));
      return json({ ok: true }, 200, cors);
    }
    if (route === 'live/close' && request.method === 'POST') {
      if (!owner()) return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
      for (const k of await f.list(P(stream, ''))) await f.del(k); lastBeat.delete(stream);
      return json({ ok: true }, 200, cors);
    }
    if (route === 'live/offer' && request.method === 'POST') {
      const viewer = String(body?.viewer || ''); const sdp = String(body?.sdp || ''); if (!VIEWER.test(viewer) || !sdp || sdp.length > MAX_SDP) return json({ ok: false, error: 'BAD_REQUEST' }, 400, cors);
      if (!alive()) return json({ ok: false, error: 'NO_BROADCAST' }, 200, cors);
      const known = new Set([...(await f.list(P(stream, 'o/'))).map((k) => k.slice(P(stream, 'o/').length)), ...(await f.list(P(stream, 'a/'))).map((k) => k.slice(P(stream, 'a/').length))]);
      if (!known.has(viewer) && known.size >= LIVE_MAX_VIEWERS * 2) return json({ ok: false, error: 'FULL' }, 200, cors); // ostateczny limit odbiorców pilnuje nadawca; tu tylko ochrona przed zalewem
      await f.del(P(stream, 'a/' + viewer)); await f.putJSON(P(stream, 'o/' + viewer), { n: +body.n || 0, sdp, at: Date.now() });
      return json({ ok: true }, 200, cors);
    }
    if (route === 'live/answer' && request.method === 'GET') {
      const viewer = String(q.viewer || ''); if (!VIEWER.test(viewer)) return json({ ok: false, error: 'BAD_REQUEST' }, 400, cors);
      const a = await f.getJSON(P(stream, 'a/' + viewer));
      if (a && a.n === (+q.n || 0)) return json({ ok: true, sdp: a.sdp, full: a.sdp === 'FULL' || undefined }, 200, cors);
      return json(alive() ? { ok: true, wait: true } : { ok: false, error: 'NO_BROADCAST' }, 200, cors);
    }
    return json({ error: 'NOT_FOUND', route }, 404, cors);
  };
}
