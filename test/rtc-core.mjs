// Test jądra transmisji z kamery (WebRTC, src/kernel/rtc.js + server/live-routes.mjs) – bez interfejsu:
// nadawca z atrapą kamery przeglądarki i dwóch odbiorców na wspólnym serwerze testowym.
//   node build.mjs --target=netlify && node test/rtc-core.mjs
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import esbuild from 'esbuild';
const PORT = 8795; const base = `http://localhost:${PORT}`; let fails = 0; const T = (n, ok, x) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', n, ok ? '' : JSON.stringify(x ?? '')); };
// strona testowa: samo jądro (magazyn stanu, synchronizacja, rtc) bez interfejsu
await esbuild.build({ entryPoints: ['test/rtc/harness-entry.js'], bundle: true, format: 'iife', outfile: 'dist/site/_rtc.js', define: { 'globalThis.FPZ_APP_ONLY': 'false' }, loader: { '.css': 'empty', '.svg': 'text', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl' }, logLevel: 'error' });
fs.writeFileSync('dist/site/_rtc.html', '<!doctype html><meta charset=utf-8><title>rtc</title><video id=v autoplay playsinline muted style="width:320px"></video><script src="/_rtc.js"></script>');
fs.rmSync('.tmp-rtc', { recursive: true, force: true });
const srv = spawn('node', ['tools/dev-server.mjs', `--port=${PORT}`, '--fresh', '--blobs', '--data=.tmp-rtc'], { stdio: 'ignore' });
const done = () => { try { srv.kill('SIGTERM'); } catch { /* nic */ } for (const f of ['dist/site/_rtc.js', 'dist/site/_rtc.html']) fs.rmSync(f, { force: true }); fs.rmSync('.tmp-rtc', { recursive: true, force: true }); };
for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/api/info')).ok) break; } catch { /* jeszcze nie */ } await new Promise((r) => setTimeout(r, 250)); }
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const mk = async (name) => { const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] }); const p = await ctx.newPage(); p.on('pageerror', (e) => console.log(`[${name}]`, e.message)); await p.goto(base + '/_rtc.html'); await p.waitForFunction(() => window.rtcTest); return p; };
const B = await mk('nadawca'); const V1 = await mk('odbiorca1'); const V2 = await mk('odbiorca2');
const ids = await B.evaluate(async () => { const { startBroadcast, newStreamId, newStreamKey } = window.rtcTest; const streamId = newStreamId(), key = newStreamKey(); const ms = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: true }); window.viewers = 0; window.b = await startBroadcast(ms, { streamId, key, onViewers: (n) => (window.viewers = n) }); return { streamId, key }; });
T('nadawca otworzył transmisję', /^[a-z0-9]{14}$/.test(ids.streamId), ids);
const watch = (p, id) => p.evaluate((sid) => { window.states = []; window.w = window.rtcTest.watchLive(sid, { onState: (s) => window.states.push(s), onStream: (ms) => { const v = document.getElementById('v'); v.srcObject = ms; if (ms) v.play().catch(() => {}); } }); }, id);
const playing = (p, ms = 20000) => p.waitForFunction(() => { const v = document.getElementById('v'); return v.videoWidth > 0 && v.currentTime > 0.5; }, null, { timeout: ms }).then(() => true).catch(() => false);
await watch(V1, ids.streamId); const t0 = Date.now(); const ok1 = await playing(V1);
T(`odbiorca 1 widzi obraz z kamery (po ${((Date.now() - t0) / 1000).toFixed(1)} s)`, ok1, await V1.evaluate(() => ({ states: window.states, w: document.getElementById('v').videoWidth })));
T('odbiorca 1: dźwięk i obraz w strumieniu', await V1.evaluate(() => { const ms = document.getElementById('v').srcObject; return ms && ms.getVideoTracks().length === 1 && ms.getAudioTracks().length === 1; }));
await watch(V2, ids.streamId); T('odbiorca 2 widzi obraz', await playing(V2), await V2.evaluate(() => window.states));
await B.waitForFunction(() => window.viewers === 2, null, { timeout: 8000 }).catch(() => {}); T('nadawca widzi 2 odbiorców', (await B.evaluate(() => window.viewers)) === 2, await B.evaluate(() => window.viewers));
// obcy z innym kluczem nie przejmie transmisji
const hijack = await V2.evaluate(async (sid) => { const r = await fetch('/api/live/offers?stream=' + sid + '&key=' + 'x'.repeat(28)); return r.status; }, ids.streamId); T('cudzy klucz nie odczyta ofert (403)', hijack === 403, hijack);
// podmiana kamery bez zrywania połączeń
await B.evaluate(async () => { const ms = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true }); await window.b.replaceStream(ms); }); await V1.waitForTimeout(2500);
T('po podmianie źródła obraz dalej płynie', await V1.evaluate(async () => { const v = document.getElementById('v'); const a = v.currentTime; await new Promise((r) => setTimeout(r, 1200)); return v.currentTime > a + 0.5; }));
// odbiorca odchodzi, potem nadawca kończy
await V2.evaluate(() => window.w.stop()); await B.waitForFunction(() => window.viewers === 1, null, { timeout: 25000 }).catch(() => {}); T('po odejściu odbiorcy licznik spada do 1', (await B.evaluate(() => window.viewers)) === 1, await B.evaluate(() => window.viewers));
await B.evaluate(() => window.b.stop()); const ended = await V1.waitForFunction(() => window.states.includes('ended'), null, { timeout: 30000 }).then(() => true).catch(() => false);
T('po zakończeniu nadawania odbiorca dostaje stan „ended”', ended, await V1.evaluate(() => window.states));
await browser.close(); done(); console.log(fails ? `✗ NIEPOWODZENIA: ${fails}` : '✓ wszystkie sprawdzenia zaliczone'); process.exit(fails ? 1 : 0);
