// „Teraz na ekranie”: strony urządzeń (/lcd/<id>, /kiosk/<id>) dołączają do sygnału raport o bieżącej treści i o tym, czy obraz naprawdę się przesuwa,
// a panel „Zarządzanie ekspozycją” pokazuje go przy urządzeniu (lista i szczegóły).
//   node build.mjs --target=netlify && node test/now-playing.mjs      (test sam uruchamia serwer na porcie 8801: FPZ_STALE_MS=4000 FPZ_OFFLINE_MS=8000, dane .tmp-now)
// Pliki testowe (/tmp/media-test): krotki-duzy.mp4 (H.264, 5 s), hevc60.mp4 (H.265 – Chrome tego nie odtworzy). Zob. nagłówek test/film-flow.mjs.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const PORT = +(args.port || 8801); const base = `http://localhost:${PORT}`; const dir = args.dir || '/tmp/media-test'; const F = (n) => path.join(dir, n);
for (const n of ['krotki-duzy.mp4', 'hevc60.mp4']) if (!fs.existsSync(F(n))) { console.error('Brak pliku testowego', F(n)); process.exit(2); }
if (!fs.existsSync(path.join(root, 'dist/site/index.html'))) { console.error('Brak dist/site – najpierw: node build.mjs --target=netlify'); process.exit(2); }
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });

const srv = spawn(process.execPath, ['tools/dev-server.mjs', `--port=${PORT}`, '--fresh', '--blobs', '--data=.tmp-now'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FPZ_STALE_MS: '4000', FPZ_OFFLINE_MS: '8000' } });
let srvLog = ''; srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
const stop = () => { try { srv.kill('SIGTERM'); } catch { /* nic */ } };
process.on('exit', stop);
for (let i = 0; i < 60 && !/Serwer testowy/.test(srvLog); i++) await new Promise((r) => setTimeout(r, 200));
if (!/Serwer testowy/.test(srvLog)) { console.error('Serwer nie wystartował:\n' + srvLog); process.exit(2); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = []; let fails = 0;
const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? '')); return ok; };
const IGNORE = /Failed to load resource|net::ERR_|ERR_FAILED|ERR_ABORTED/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function device(name, p, vp = { width: 1280, height: 720 }) {
  const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`));
  // H.265: przeglądarka zgłasza błąd dekodowania – to zamierzony scenariusz, nie błąd strony
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`[${name}] console.error: ${m.text().slice(0, 300)}`); });
  await page.goto(base + p); await page.waitForFunction(() => window.__fpz && window.__fpz.getState().net.status === 'online' && window.__fpz.getState().net.version > 0, null, { timeout: 20000 });
  return { ctx, page, name, ev: (fn, arg) => page.evaluate(fn, arg), until: (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 200 }).then(() => true).catch(() => false), shot: (n) => page.screenshot({ path: `shots/${n}.png` }) };
}
const settle = (d) => d.until(() => window.__fpz.getState().net.pending === 0, null, 10000);
// strona melduje się co 30 s; zdarzenie visibilitychange wywołuje natychmiastowy sygnał – „pompujemy” je, żeby urządzenie było stale podłączone
const pump = (d) => { const t = setInterval(() => d.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {}), 1500); return () => clearInterval(t); };
const presence = () => fetch(base + '/api/presence').then((r) => r.json());
const nowOf = async (id) => (await presence()).beats?.[id]?.page?.now || null;
/** Czeka, aż raport urządzenia spełni warunek (sygnały pompowane co 1,5 s). */
async function waitNow(id, fn, timeout = 25000) { const t0 = Date.now(); let n = null; while (Date.now() - t0 < timeout) { n = await nowOf(id); try { if (n && fn(n)) return { ok: true, n }; } catch { /* jeszcze nie */ } await sleep(700); } return { ok: false, n }; }
const row = (id) => `.x-devrow[data-dev="${id}"] [data-testid=x-now]`;
const rowTxt = (d, id) => d.ev((s) => document.querySelector(s)?.innerText || '', row(id));
const nav = async (d, label) => { await d.page.click(`.ep-mgmt .x-nav__it:has-text("${label}")`); await sleep(300); };

// ── 0. panel: godzina dzienna, logowanie, wgranie filmów H.264 i H.265 do playlisty LCD-01 ──
const mg = await device('ekspozycja', '/ekspozycja', { width: 1500, height: 950 });
await mg.ev(() => window.__fpz.makeApi('sim').env.set({ simTime: '12:00' })); await settle(mg);
await mg.page.click('[data-testid=x-login-submit]'); await sleep(300);
await nav(mg, 'Treści i playlisty'); await mg.page.click('[data-pl=pl-scena]'); await sleep(300);
await mg.page.setInputFiles('[data-testid=x-add-upload-file]', F('krotki-duzy.mp4'));
T('wgrano krotki-duzy.mp4', await mg.until(() => window.__fpz.getState().media.some((m) => m.name === 'krotki-duzy.mp4'), null, 60000));
await settle(mg); await sleep(500);
await mg.page.setInputFiles('[data-testid=x-add-upload-file]', F('hevc60.mp4'));
T('wgrano hevc60.mp4', await mg.until(() => window.__fpz.getState().media.some((m) => m.name === 'hevc60.mp4'), null, 60000));
await settle(mg);
const its = await mg.ev(() => { const s = window.__fpz.getState(); const pl = s.playlists.find((p) => p.id === 'pl-scena'); const by = (n) => { const m = s.media.find((x) => x.name === n); return pl.items.find((i) => i.ref === 'media:' + m.id); }; return { h264: by('krotki-duzy.mp4'), hevc: by('hevc60.mp4'), plName: pl.name, lcdPl: s.devices.find((d) => d.id === 'LCD-01').playlistId }; });
T('pozycje filmów w playliście LCD-01', its.h264 && its.hevc && its.lcdPl === 'pl-scena', JSON.stringify(its));
const setItems = async (items) => { await mg.ev((it) => window.__fpz.makeApi('mgmt').cms.save('playlists', { id: 'pl-scena', items: it, updatedAt: new Date().toISOString() }), items); await settle(mg); };
await setItems([{ ...its.h264, title: 'super film', durationSec: 30 }]);

// ── 1. urządzenie bez sygnału → „brak danych o treści” ──
await nav(mg, 'Urządzenia');
T('lista: urządzenie bez sygnału – „brak danych o treści (urządzenie nie zgłosiło)”', await mg.until((s) => /brak danych o treści \(urządzenie nie zgłosiło\)/.test(document.querySelector(s)?.innerText || ''), row('PRJ-01')));
T('lista: serwer / sieć bez wiersza „Teraz na ekranie”', await mg.ev(() => { const d = window.__fpz.getState().devices.find((x) => x.kind === 'server' || x.kind === 'network'); return !d || !document.querySelector(`.x-devrow[data-dev="${d.id}"] [data-testid=x-now]`); }));

// ── 2. ekran LCD-01 gra plik z pamięci ekranu ──
const lcd = await device('lcd', '/lcd/LCD-01'); let unLcd = pump(lcd);
T('ekran: film gra (element <video> z blob:)', await lcd.until(() => { const v = document.querySelector('video'); return v && /^blob:/.test(v.currentSrc) && v.currentTime > 0.3 && !v.paused; }, null, 40000));
let r = await waitNow('LCD-01', (n) => n.state === 'gra playlistę' && n.item?.src === 'plik' && n.media?.advancing === true);
T('raport: gra playlistę, plik, obraz się przesuwa', r.ok, JSON.stringify(r.n));
T('raport: playlista, tytuł, pozycja 1 z 1', r.n?.playlist === its.plName && r.n?.item?.title === 'super film' && r.n?.pos?.[0] === 1 && r.n?.pos?.[1] === 1, JSON.stringify(r.n));
T('raport: źródło „pamięć ekranu”, element video, rozmiar obrazu, czas trwania', r.n?.media?.src === 'pamięć ekranu' && r.n.media.el === 'video' && r.n.media.w > 0 && r.n.media.dur > 4 && r.n.media.dur < 6 && typeof r.n.at === 'number', JSON.stringify(r.n?.media));
T('panel (lista): „odtwarza się, m:ss z m:ss” i pozycja w playliście', await mg.until((s) => { const t = document.querySelector(s)?.innerText || ''; return /Film „super film” \(plik\) – odtwarza się, \d:\d\d z 0:0\d · pozycja 1 z 1 playlisty/.test(t) && /stan sprzed \d+ s/.test(t); }, row('LCD-01'), 25000), await rowTxt(mg, 'LCD-01'));
await mg.page.locator('.x-devrow[data-dev="LCD-01"]').scrollIntoViewIfNeeded(); await mg.shot('now-list');
await mg.page.click('.x-devrow[data-dev="LCD-01"]'); await sleep(500);
T('panel (szczegóły): blok „Teraz na ekranie” z odtwarzaniem i źródłem obrazu', await mg.until(() => { const t = document.querySelector('.fpz-modal [data-testid=x-now]')?.innerText || ''; return /odtwarza się/.test(t) && /źródło obrazu: pamięć ekranu/.test(t); }, null, 15000));
await mg.shot('now-detail'); await mg.page.keyboard.press('Escape'); await sleep(300);

// ── 3. wideo zatrzymane przez test → „stoi w miejscu” ──
await lcd.ev(() => { window.__hold = setInterval(() => document.querySelectorAll('video').forEach((v) => v.pause()), 100); });
r = await waitNow('LCD-01', (n) => n.media && n.media.advancing === false && n.media.paused === true);
T('raport: wideo wstrzymane – nie przesuwa się', r.ok, JSON.stringify(r.n?.media));
T('panel: „stoi w miejscu – obraz się nie przesuwa” (ostrzeżenie)', await mg.until((s) => { const e = document.querySelector(s); return e && /stoi w miejscu – obraz się nie przesuwa/.test(e.innerText) && e.dataset.now === 'warn'; }, row('LCD-01'), 25000), await rowTxt(mg, 'LCD-01'));
await mg.shot('now-still');
await lcd.ev(() => { clearInterval(window.__hold); document.querySelectorAll('video').forEach((v) => v.play().catch(() => {})); });

// ── 4. tylko H.265 → playlista nie ma nic do pokazania, pominięta pozycja z powodem ──
await setItems([{ ...its.hevc, title: 'film hevc' }]);
r = await waitNow('LCD-01', (n) => n.state === 'playlista nie ma nic do pokazania' && n.skipped?.length === 1 && n.media === null, 40000);
T('raport: nic do pokazania, pominięty „film hevc” z powodem H.265', r.ok && r.n.skipped[0].title === 'film hevc' && /H\.265/.test(r.n.skipped[0].reason) && r.n.media === null, JSON.stringify(r.n));
T('panel: „Playlista … nie ma nic do pokazania” + „Pominięte: „film hevc” (…H.265…)”', await mg.until((s) => { const t = document.querySelector(s)?.innerText || ''; return /Playlista „[^”]+” nie ma nic do pokazania/.test(t) && /Pominięte: „film hevc” \(ten ekran nie odtwarza formatu H\.265/.test(t); }, row('LCD-01'), 25000), await rowTxt(mg, 'LCD-01'));
await mg.shot('now-hevc');

// ── 5. ekran wyłączony w panelu ──
await mg.ev(() => window.__fpz.makeApi('mgmt').devices.power('LCD-01', 'off')); await settle(mg);
r = await waitNow('LCD-01', (n) => n.state === 'wyłączony w panelu');
T('raport: „wyłączony w panelu”', r.ok, JSON.stringify(r.n));
T('panel: „Wyłączony w panelu”', await mg.until((s) => /Wyłączony w panelu/.test(document.querySelector(s)?.innerText || ''), row('LCD-01'), 25000), await rowTxt(mg, 'LCD-01'));
await mg.ev(() => window.__fpz.makeApi('mgmt').devices.power('LCD-01', 'on')); await settle(mg);

// ── 6. kiosk: ekran startowy → wpis → bezczynność ──
const ki = await device('kiosk', '/kiosk/TZ.T1.1', { width: 608, height: 1080 }); const unKi = pump(ki);
r = await waitNow('TZ.T1.1', (n) => n.kind === 'kiosk' && n.view === 'Ekran startowy' && n.idle === false);
T('raport kiosku: „Ekran startowy”, nie bezczynny', r.ok, JSON.stringify(r.n));
T('panel: kiosk „Ekran startowy”', await mg.until((s) => /Teraz na ekranie: Ekran startowy/.test(document.querySelector(s)?.innerText || ''), row('TZ.T1.1'), 25000), await rowTxt(mg, 'TZ.T1.1'));
const card = ki.page.locator('.k-home .k-col .k-card:not(.k-card--about)').first(); const title = (await card.locator('h2').innerText()).trim();
await card.click(); await sleep(400);
r = await waitNow('TZ.T1.1', (n) => n.view && n.view.startsWith('Wpis: '));
T(`raport kiosku: „Wpis: ${title.slice(0, 40)}…”`, r.ok && r.n.view.startsWith('Wpis: ' + title.slice(0, 40)), JSON.stringify(r.n));
T('panel: kiosk „Wpis: …”', await mg.until((t) => (document.querySelector('.x-devrow[data-dev="TZ.T1.1"] [data-testid=x-now]')?.innerText || '').includes('Wpis: ' + t), title.slice(0, 40), 25000), await rowTxt(mg, 'TZ.T1.1'));
await ki.ev(() => { window.__fpzKiosk.idleMs = 1500; });
r = await waitNow('TZ.T1.1', (n) => n.idle === true && n.view === 'Ekran startowy');
T('raport kiosku: bezczynny (wygaszacz), ekran startowy', r.ok, JSON.stringify(r.n));
T('panel: „Ekran startowy · bezczynny”', await mg.until((s) => /Ekran startowy · bezczynny/.test(document.querySelector(s)?.innerText || ''), row('TZ.T1.1'), 25000), await rowTxt(mg, 'TZ.T1.1'));
await mg.page.click('.x-devrow[data-dev="TZ.T1.1"]'); await sleep(500); await mg.shot('now-detail-kiosk'); await mg.page.keyboard.press('Escape'); await sleep(300);

// ── 7. śmieci i zbyt duże raporty wysłane prosto do /api/beat ──
const post = (body) => fetch(base + '/api/beat', { method: 'POST', body: JSON.stringify(body) }).then((x) => x.json());
await post({ id: 'LCD-02', src: 'page', kind: 'lcd', now: { kind: 'screen', state: 'gra playlistę', playlist: 'x'.repeat(600), item: { type: 'video', title: 'ż'.repeat(300), src: 'plik' }, pos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], deep: { a: { b: { c: { d: { e: 1 } } } } }, skipped: [1, null, 'a', { title: 'b' }], media: { advancing: 'tak', pos: 'abc', dur: null, src: 'pamięć ekranu' }, __proto__x: 1 } });
let b = (await presence()).beats['LCD-02']?.page?.now;
T('serwer: teksty przycięte do 160 znaków, tablice do 8 pozycji, głębokie zagnieżdżenie odcięte', b && b.playlist.length === 160 && b.item.title.length === 160 && b.pos.length === 8 && b.deep?.a?.b && b.deep.a.b.c === undefined, JSON.stringify(b).slice(0, 400));
T('panel: dziwny raport nie psuje widoku', await mg.until(() => !!document.querySelector('.x-devrow[data-dev="LCD-02"] [data-testid=x-now]'), null, 15000) && !errors.length, errors.join('\n'));
await post({ id: 'LCD-02', src: 'page', kind: 'lcd', now: { kind: 'screen', big: 'y'.repeat(3000) } });
b = (await presence()).beats['LCD-02']?.page;
T('serwer: raport > 2500 znaków JSON odrzucony (sygnał przyjęty bez „now”)', b && b.now === undefined && b.kind === 'lcd', JSON.stringify(b).slice(0, 200));
for (const bad of ['tekst', [1, 2, 3], 42, null]) { await post({ id: 'LCD-02', src: 'page', kind: 'lcd', now: bad }); b = (await presence()).beats['LCD-02']?.page; if (!T(`serwer: „now” = ${JSON.stringify(bad)} pominięte`, b && b.now === undefined)) break; }
T('panel: sygnał bez „now” (starsza wersja strony) → „brak danych o treści”', await mg.until(() => /brak danych o treści/.test(document.querySelector('.x-devrow[data-dev="LCD-02"] [data-testid=x-now]')?.innerText || ''), null, 25000));
await post({ id: 'LCD-02', src: 'page', kind: 'lcd', now: { kind: 5, state: { x: 1 }, item: 'abc', pos: 'x', skipped: [1, null], media: { advancing: 'tak', error: 7 } } });
await sleep(11000);
T('panel: raport o złym kształcie nie wywołuje błędów strony ani „[object Object]”', await mg.ev(() => { const e = document.querySelector('.x-devrow[data-dev="LCD-02"] [data-testid=x-now]'); return !!e && !/object Object|undefined|NaN/.test(e.innerText); }) && !errors.length, (await rowTxt(mg, 'LCD-02')) + errors.join('\n'));

// ── 8. karta w tle i brak sygnału ──
await ki.ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
r = await waitNow('TZ.T1.1', () => true); await sleep(2500);
T('panel: karta w tle – ostrzeżenie', await mg.until((s) => /karta w tle – przeglądarka mogła wstrzymać obraz/.test(document.querySelector(s)?.innerText || ''), row('TZ.T1.1'), 25000), await rowTxt(mg, 'TZ.T1.1'));
unKi(); await ki.ctx.close();
T('panel: po utracie sygnału „Ostatnio: …” (wyszarzone) przy „Brak sygnału”', await mg.until(() => { const rw = document.querySelector('.x-devrow[data-dev="TZ.T1.1"]'); const e = rw?.querySelector('[data-testid=x-now]'); return e && e.dataset.now === 'stale' && /Ostatnio: Ekran startowy/.test(e.innerText) && /raport nieaktualny/.test(e.innerText) && /Brak sygnału/.test(rw.innerText); }, null, 30000), await rowTxt(mg, 'TZ.T1.1'));
await mg.page.locator('.x-devrow[data-dev="TZ.T1.1"]').scrollIntoViewIfNeeded(); await mg.shot('now-stale');
await mg.page.click('.x-devrow[data-dev="TZ.T1.1"]'); await sleep(500);
T('szczegóły: raport nieaktualny pod informacją o braku sygnału', await mg.until(() => /Ostatnio:/.test(document.querySelector('.fpz-modal [data-testid=x-now]')?.innerText || '')));
await mg.shot('now-detail-stale'); await mg.page.keyboard.press('Escape');

unLcd(); await lcd.ctx.close();

// ══ Część 2: transmisja z kamery telefonu – raport „Transmisja z kamery – obraz płynie”, podgląd w panelu, układ napisów na LCD, telefon w pionie ══
// osobna przeglądarka z atrapą kamery; obraz pionowy – getUserMedia podmienione na kadr 360×640 z płótna (canvas.captureStream)
const cb = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
async function camPage(name, p, { vp = { width: 390, height: 844 }, portrait = false } = {}) {
  const ctx = await cb.newContext({ viewport: vp, permissions: ['camera', 'microphone'] }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`[${name}] console.error: ${m.text().slice(0, 300)}`); });
  if (portrait) await page.addInitScript(() => {
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const real = await orig(c); if (!c || !c.video) return real;
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = new MediaStream(real.getVideoTracks()); await v.play();
      const cv = document.createElement('canvas'); cv.width = 360; cv.height = 640; const g = cv.getContext('2d');
      const t = setInterval(() => { const w = v.videoHeight * 9 / 16; g.drawImage(v, (v.videoWidth - w) / 2, 0, w, v.videoHeight, 0, 0, 360, 640); g.fillStyle = '#FFE600'; g.font = 'bold 40px sans-serif'; g.fillText('PION', 120, 600); }, 33);
      const out = cv.captureStream(30); const vt = out.getVideoTracks()[0]; const st = vt.stop.bind(vt); vt.stop = () => { clearInterval(t); real.getTracks().forEach((x) => x.stop()); st(); };
      real.getAudioTracks().forEach((a) => out.addTrack(a)); return out;
    };
  });
  await page.goto(base + p); return { ctx, page, name, ev: (fn, arg) => page.evaluate(fn, arg), until: (fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 200 }).then(() => true).catch(() => false), shot: (n) => page.screenshot({ path: `shots/${n}.png` }) };
}
const camPlaying = (d, sel, ms = 40000) => d.until(async (sel) => { const v = document.querySelector(sel); if (!v || !(v.srcObject instanceof MediaStream) || !v.videoWidth) return false; const a = v.currentTime; await new Promise((r) => setTimeout(r, 600)); return v.currentTime > a + 0.2; }, sel, ms);
const capsLayout = (d) => d.ev(() => { const c = document.querySelector('.s-caps'); const v = document.querySelector('.s-caps__video video'); const vr = v?.getBoundingClientRect(); const sr = document.querySelector('.s-screen')?.getBoundingClientRect(); return { layout: c?.dataset.layout, vw: v?.videoWidth, vh: v?.videoHeight, boxW: vr ? vr.width / sr.width : 0, boxX: vr ? (vr.left + vr.width / 2 - sr.left) / sr.width : 0, lines: !!document.querySelector('.s-caps__lines') }; });
const api = (fn, arg) => mg.ev(fn, arg).then(() => settle(mg));
await api(() => { const a = window.__fpz.makeApi('mgmt'); a.cms.save('playlists', { id: 'pl-scena', items: [{ id: 'ps-caps', type: 'captions', title: 'Napisy na żywo', durationSec: 600 }], updatedAt: new Date().toISOString() }); });

// telefon w poziomie (atrapa kamery 16:9)
const B = await camPage('nadawca', '/nadawanie');
await B.page.click('[data-testid=b-login-submit]'); await B.page.waitForSelector('[data-testid=b-start]');
await B.page.click('[data-testid=b-preview]');
T('nadawca: podgląd kamery', await camPlaying(B, '[data-testid=b-video]', 15000));
T('nadawca (przygotowanie): podpowiedź „Trzymaj telefon poziomo…”, bez uwagi o pionie', await B.until(() => /Trzymaj telefon poziomo – obraz wypełni ekrany\./.test(document.querySelector('[data-testid=b-orient]')?.textContent || '') && !document.querySelector('[data-testid=b-portrait]')));
await B.shot('cam-setup-landscape');
await B.page.fill('[data-testid=b-title]', 'Próba kamery'); await B.page.click('[data-testid=b-start]');
T('nadawca: na antenie, podpowiedź o trzymaniu poziomo', await B.until(() => !!document.querySelector('[data-testid=b-onair] [data-testid=b-orient]') && !document.querySelector('[data-testid=b-portrait]')));
await mg.until(() => window.__fpz.getState().live.onAir && !!window.__fpz.getState().live.streamId, null, 15000);
await api(() => window.__fpz.makeApi('mgmt').live.clear());
const L1 = await camPage('LCD-01 (kamera)', '/lcd/LCD-01', { vp: { width: 1920, height: 1080 } }); await L1.until(() => window.__fpz?.getState().net.status === 'online'); const unL1 = pump(L1);
T('LCD-01: obraz z kamery gra', await camPlaying(L1, '.s-caps__video video'));
const landOk = await L1.until(() => { const c = document.querySelector('.s-caps'); const v = document.querySelector('.s-caps__video video'); if (c?.dataset.layout !== 'nocaps' || document.querySelector('.s-caps__lines') || !(v?.videoWidth > v?.videoHeight)) return false; const vr = v.getBoundingClientRect(); const sr = document.querySelector('.s-screen').getBoundingClientRect(); return vr.width / sr.width > 0.85 && Math.abs((vr.left + vr.width / 2 - sr.left) / sr.width - 0.5) < 0.03; });
let lay = await capsLayout(L1);
T('LCD-01 bez napisów, obraz poziomy: sam obraz, duży, na środku', landOk, lay);
await L1.page.waitForTimeout(500); await L1.shot('cam-lcd-landscape-nocaps');
r = await waitNow('LCD-01', (n) => n.item?.type === 'captions' && n.item.src === 'transmisja z kamery' && n.media?.src === 'kamera – transmisja' && n.media.advancing === true && n.media.dur === null, 30000);
T('raport: napisy na żywo, „transmisja z kamery”, obraz z MediaStream płynie (bez czasu trwania)', r.ok, JSON.stringify(r.n));
await nav(mg, 'Urządzenia');
T('panel: „Transmisja z kamery – obraz płynie”', await mg.until((s) => /Transmisja z kamery – obraz płynie/.test(document.querySelector(s)?.innerText || ''), row('LCD-01'), 25000), await rowTxt(mg, 'LCD-01'));
await mg.page.locator('.x-devrow[data-dev="LCD-01"]').scrollIntoViewIfNeeded(); await mg.shot('now-list-camera');
await api(() => window.__fpz.makeApi('mgmt').live.caption('Dzień dobry, sprawdzamy obraz z kamery i napisy na żywo.'));
T('LCD-01 z napisami, obraz poziomy: obraz u góry, napisy pod nim', await L1.until(() => document.querySelector('.s-caps')?.dataset.layout === 'landscape' && /sprawdzamy obraz/.test(document.querySelector('.s-caps__lines')?.textContent || '')), await capsLayout(L1));
lay = await L1.ev(() => { const v = document.querySelector('.s-caps__video').getBoundingClientRect(); const l = document.querySelector('.s-caps__lines').getBoundingClientRect(); return { below: l.top >= v.bottom - 2, vh: v.height }; });
T('… napisy pod obrazem, obraz zajmuje większość wysokości', lay.below && lay.vh > 500, lay);
await L1.page.waitForTimeout(400); await L1.shot('cam-lcd-landscape-caps');

// panel „Transmisje i napisy”: prawdziwy obraz w podglądzie, notka o odbiorcach, licznik odbiorników
await nav(mg, 'Transmisje i napisy');
T('panel: podgląd ekranu napisów z prawdziwym obrazem z kamery', await camPlaying(mg, '[data-testid=x-lcdprev] .x-lcdprev__video video', 30000), await mg.ev(() => document.querySelector('[data-testid=x-lcdprev]')?.outerHTML.slice(0, 300)));
T('panel: napisy w podglądzie i notka „Podgląd liczy się jako jeden z 6 odbiorców…”', await mg.until(() => /sprawdzamy obraz/.test(document.querySelector('[data-testid=x-lcdprev] .x-lcdprev__caps')?.textContent || '') && /Podgląd liczy się jako jeden z 6 odbiorców, dopóki ta zakładka jest otwarta\./.test(document.querySelector('[data-testid=x-lcdprev-note]')?.textContent || '')));
T('panel: „Odbiorniki obrazu” ≥ 2 (ekran + podgląd) i zgodne z s.live.viewers', await mg.until(() => { const n = parseInt(document.querySelector('[data-testid=x-viewers]')?.textContent, 10); return n >= 2 && n === window.__fpz.getState().live.viewers; }, null, 25000), await mg.ev(() => [document.querySelector('[data-testid=x-viewers]')?.textContent, window.__fpz.getState().live.viewers]));
await mg.page.waitForTimeout(400); await mg.shot('cam-panel-preview');
await nav(mg, 'Urządzenia');
T('panel: po wyjściu z „Transmisji” podgląd przestaje odbierać (odbiorców znów 1)', await mg.until(() => window.__fpz.getState().live.viewers === 1, null, 25000), await mg.ev(() => window.__fpz.getState().live.viewers));
await B.page.click('[data-testid=b-stop]'); await B.page.click('[data-testid=b-confirm-yes]'); await mg.until(() => !window.__fpz.getState().live.onAir, null, 15000);
await B.ctx.close();

// telefon w pionie (kadr 360×640)
const P = await camPage('nadawca-pion', '/nadawanie', { portrait: true });
await P.page.click('[data-testid=b-login-submit]'); await P.page.waitForSelector('[data-testid=b-start]'); await P.page.click('[data-testid=b-preview]');
T('nadawca w pionie (przygotowanie): uwaga „Nadajesz w pionie – na ekranach obraz będzie wąski.”', await P.until(() => /Nadajesz w pionie – na ekranach obraz będzie wąski\./.test(document.querySelector('[data-testid=b-portrait]')?.textContent || '')), await P.ev(() => { const v = document.querySelector('[data-testid=b-video]'); return v && [v.videoWidth, v.videoHeight]; }));
await P.page.waitForTimeout(800); await P.shot('cam-setup-portrait');
await P.page.fill('[data-testid=b-title]', 'Próba kamery – pion'); await P.page.click('[data-testid=b-start]');
T('nadawca w pionie: na antenie uwaga o pionie', await P.until(() => !!document.querySelector('[data-testid=b-onair] [data-testid=b-portrait]')));
await P.page.waitForTimeout(800); await P.shot('cam-onair-portrait');
await mg.until(() => window.__fpz.getState().live.onAir && !!window.__fpz.getState().live.streamId, null, 15000);
T('LCD-01: obraz pionowy gra', await camPlaying(L1, '.s-caps__video video'));
T('LCD-01 bez napisów, obraz pionowy: na środku, cała szerokość ramki (contain)', await L1.until(() => { const c = document.querySelector('.s-caps'); const v = document.querySelector('.s-caps__video video'); if (c?.dataset.layout !== 'nocaps' || !(v?.videoHeight > v?.videoWidth)) return false; const vr = v.getBoundingClientRect(); const sr = document.querySelector('.s-screen').getBoundingClientRect(); return vr.width / sr.width > 0.85 && Math.abs((vr.left + vr.width / 2 - sr.left) / sr.width - 0.5) < 0.03; }), await capsLayout(L1));
await L1.page.waitForTimeout(400); await L1.shot('cam-lcd-portrait-nocaps');
await api(() => window.__fpz.makeApi('mgmt').live.caption('Telefon trzymany pionowo – obraz po lewej, napisy po prawej.'));
T('LCD-01 z napisami, obraz pionowy: obraz po lewej na całą wysokość, napisy po prawej', await L1.until(() => { const c = document.querySelector('.s-caps'); if (c?.dataset.layout !== 'portrait') return false; const v = document.querySelector('.s-caps__video').getBoundingClientRect(); const l = document.querySelector('.s-caps__lines').getBoundingClientRect(); const b = document.querySelector('.s-caps__body').getBoundingClientRect(); return l.left >= v.right - 2 && v.height > b.height * 0.9; }), await capsLayout(L1));
await L1.page.waitForTimeout(400); await L1.shot('cam-lcd-portrait-caps');
await P.page.click('[data-testid=b-stop]'); await P.page.click('[data-testid=b-confirm-yes]'); await mg.until(() => !window.__fpz.getState().live.onAir, null, 15000);
unL1(); await L1.ctx.close(); await P.ctx.close(); await cb.close();

T('brak błędów stron', !errors.length, '\n' + errors.join('\n'));
await browser.close(); stop();
console.log(fails ? `\n${fails} NIEPOWODZEŃ` : '\nWSZYSTKO OK'); process.exit(fails ? 1 : 0);
