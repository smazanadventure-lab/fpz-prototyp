// Test API plików multimedialnych i obecności urządzeń (bez przeglądarki).
//   FPZ_STALE_MS=1500 FPZ_OFFLINE_MS=3000 node tools/dev-server.mjs --fresh [--blobs] &   →   node test/srv-media.mjs
import crypto from 'node:crypto';
const base = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:8787').slice(7);
let fails = 0; const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? '')); };
const sha = (b) => crypto.createHash('sha1').update(b).digest('hex'); const CHUNK = 3 * 1024 * 1024;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function upload(id, buf, type, name = 'plik') { const parts = Math.max(1, Math.ceil(buf.length / CHUNK)); let last; for (let i = 0; i < parts; i++) { last = await fetch(`${base}/api/media/${id}?` + new URLSearchParams({ part: i, parts, size: buf.length, type, name }), { method: 'POST', body: buf.subarray(i * CHUNK, (i + 1) * CHUNK) }); if (!last.ok) return last; } return last; }

// 1. plik wideo 7,6 MB w trzech częściach
const big = crypto.randomBytes(Math.round(7.6 * 1024 * 1024)); const vid = 'm-test' + Date.now().toString(36);
T('wysłanie pliku w 3 częściach', (await upload(vid, big, 'video/mp4', 'film testowy.mp4')).ok);
const head = await fetch(`${base}/api/media/${vid}`, { method: 'HEAD' }); T('HEAD: rozmiar i typ', head.status === 200 && +head.headers.get('content-length') === big.length && head.headers.get('content-type') === 'video/mp4' && head.headers.get('accept-ranges') === 'bytes');
// odtwarzacz: kolejne zakresy „od miejsca do końca”
const got = []; let pos = 0; let n = 0;
while (pos < big.length && n++ < 20) { const r = await fetch(`${base}/api/media/${vid}`, { headers: { range: `bytes=${pos}-` } }); if (r.status !== 206) { T('zakres ' + pos, false, r.status); break; } const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(r.headers.get('content-range')); const b = Buffer.from(await r.arrayBuffer()); if (+m[1] !== pos || +m[3] !== big.length || b.length !== +m[2] - +m[1] + 1) { T('nagłówek Content-Range', false, r.headers.get('content-range')); break; } got.push(b); pos += b.length; }
T('odczyt zakresami składa się w identyczny plik (' + n + ' żądania)', sha(Buffer.concat(got)) === sha(big));
const mid = await fetch(`${base}/api/media/${vid}`, { headers: { range: 'bytes=3145000-3146999' } }); const midB = Buffer.from(await mid.arrayBuffer());
T('zakres przechodzący przez granicę części: poprawny początek', mid.status === 206 && midB.equals(big.subarray(3145000, 3145000 + midB.length)) && midB.length > 0);
const suf = await fetch(`${base}/api/media/${vid}`, { headers: { range: 'bytes=-1000' } }); T('zakres końcowy (ostatnie 1000 B)', suf.status === 206 && Buffer.from(await suf.arrayBuffer()).equals(big.subarray(big.length - 1000)));
T('zakres poza plikiem → 416', (await fetch(`${base}/api/media/${vid}`, { headers: { range: `bytes=${big.length + 5}-` } })).status === 416);
const whole = await fetch(`${base}/api/media/${vid}`); T('pobranie całości bez zakresu', whole.status === 200 && sha(Buffer.from(await whole.arrayBuffer())) === sha(big));
// 2. obraz w jednej części
const img = crypto.randomBytes(180000); const iid = 'm-img' + Date.now().toString(36); await upload(iid, img, 'image/jpeg', 'zdjęcie.jpg');
const ir = await fetch(`${base}/api/media/${iid}`); T('obraz: zwykłe żądanie zwraca cały plik, z pamięcią podręczną', ir.status === 200 && Buffer.from(await ir.arrayBuffer()).equals(img) && /immutable/.test(ir.headers.get('cache-control')) && ir.headers.get('access-control-allow-origin') === '*');
// 3. odmowy
T('niedozwolony typ pliku odrzucony', (await upload('m-bad' + Date.now().toString(36), Buffer.from('<svg/>'), 'image/svg+xml')).status === 400);
T('zła wielkość części odrzucona', (await fetch(`${base}/api/media/m-bad2xxxx?` + new URLSearchParams({ part: 0, parts: 2, size: CHUNK + 10, type: 'video/mp4', name: 'x' }), { method: 'POST', body: Buffer.alloc(100) })).status === 400);
T('aplikacja dla zwiedzających nie może wgrywać ani usuwać', (await fetch(`${base}/api/media/m-app${Date.now().toString(36)}?` + new URLSearchParams({ role: 'app', part: 0, parts: 1, size: 3, type: 'image/png', name: 'x' }), { method: 'POST', body: Buffer.from('abc') })).status === 403 && (await fetch(`${base}/api/media/${vid}?role=app`, { method: 'DELETE' })).status === 403);
T('usunięcie pliku', (await fetch(`${base}/api/media/${vid}`, { method: 'DELETE' })).ok && (await fetch(`${base}/api/media/${vid}`)).status === 404);
await fetch(`${base}/api/media/${iid}`, { method: 'DELETE' });

// 4. obecność urządzeń
const dev = 'TZ.T1.3'; const beat = (src, extra = {}) => fetch(`${base}/api/beat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: dev, src, kind: 'kiosk', instance: 'd-test', boot: Date.now() - 60000, ver: 'test', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Edg/130.0', screen: [1080, 1920, 1], viewport: [1080, 1920], fullscreen: true, visible: true, online: true, ...extra }) });
T('sygnał ze strony kiosku przyjęty', (await beat('page')).ok); T('sygnał z programu sterującego przyjęty', (await beat('agent', { host: 'KIOSK-03', os: 'Windows 11', cpu: 12, memPct: 41, uptimeH: 5.5, volume: 60, monitor: 'on' })).ok);
const pr = await (await fetch(`${base}/api/presence`)).json(); const b = pr.beats?.[dev];
T('panel widzi oba sygnały', !!b?.page && !!b?.agent && b.page.fullscreen === true && b.agent.host === 'KIOSK-03' && b.agent.cpu === 12 && Math.abs(pr.now - b.page.at) < 5000, JSON.stringify(b).slice(0, 200));
T('urządzenia bez sygnału nie ma na liście', !pr.beats['TZ.T1.1']);
T('obecność niedostępna dla aplikacji zwiedzających', (await fetch(`${base}/api/presence?role=app`)).status === 403);
const dv = await (await fetch(`${base}/api/device/${dev}`)).json(); T('stan urządzenia dla programu sterującego', dv.id === dev && ['on', 'off', 'service', 'fault'].includes(dv.power) && typeof dv.volume === 'number' && typeof dv.brightness === 'number' && 'restartedAt' in dv && !('ip' in dv), JSON.stringify(dv));
T('nieznane urządzenie → 404', (await fetch(`${base}/api/device/NIE-MA`)).status === 404);
T('błędny identyfikator w sygnale odrzucony', (await fetch(`${base}/api/beat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: '../x' }) })).status === 400);

// 5. prawdziwy monitoring (wymaga skróconych progów: FPZ_STALE_MS, FPZ_OFFLINE_MS)
if (pr.staleMs <= 5000) {
  const state = async () => (await (await fetch(`${base}/api/sync?device=t&tick=1`)).json()).keys; const rpc = (ops) => fetch(`${base}/api/rpc`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: 't', ops }) }).then((r) => r.json());
  await rpc([{ op: 'env.set', args: [{ simTime: '12:00' }], nonce: 'sim' + Date.now(), clientId: 'mgmt', client: {} }]); // dzień – urządzenie włączone wg harmonogramu
  await beat('page'); let s = await state(); const mon = (st) => st.incidents.filter((i) => i.deviceId === dev && i.id.startsWith('inc-mon-'));
  T('świeży sygnał: brak zgłoszenia', mon(s).filter((i) => i.status !== 'closed').length === 0);
  await wait(3600); s = await state(); const open = mon(s).filter((i) => i.status !== 'closed');
  T('brak sygnału: powstaje zgłoszenie „brak sygnału” i alert', open.length === 1 && /Brak sygnału/.test(open[0].title) && s.outbox.some((o) => /offline/i.test(o.subject) && o.body.includes(open[0].id)), JSON.stringify(mon(s)).slice(0, 300));
  s = await state(); T('kolejne sprawdzenie nie dubluje zgłoszenia', mon(s).filter((i) => i.status !== 'closed').length === 1);
  await beat('page'); s = await state(); T('powrót sygnału: zgłoszenie zamknięte automatycznie', mon(s).every((i) => i.status === 'closed') && /przywrócone/.test(mon(s)[0].note));
} else console.log('  (monitoring pominięty – uruchom serwer z FPZ_STALE_MS=1500 FPZ_OFFLINE_MS=3000)');
console.log(fails ? `\nNIEPOWODZENIA: ${fails}` : '\nTest plików i obecności zaliczony.'); process.exit(fails ? 1 : 0);
