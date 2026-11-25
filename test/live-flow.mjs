// Transmisja z kamery telefonu – cały przebieg w interfejsie: strona /nadawanie (telefon z atrapą kamery) → obraz na ekranach LCD,
// w aplikacji /app i na stronie /www, napisy z panelu na obrazie, licznik odbiorców, przełączenie kamery, wyciszenie,
// zakończenie z telefonu i z panelu, brak zgody na kamerę, transmisja symulowana bez zmian.
//   node build.mjs --target=netlify && node test/live-flow.mjs        (zrzuty: shots/live-*.png)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 8799; const base = `http://localhost:${PORT}`; const DATA = '.tmp-live';
let fails = 0; const T = (n, ok, x) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', n, ok ? '' : JSON.stringify(x ?? '')); };
fs.mkdirSync('shots', { recursive: true });
fs.rmSync(DATA, { recursive: true, force: true });
const srv = spawn('node', ['tools/dev-server.mjs', `--port=${PORT}`, '--fresh', '--blobs', `--data=${DATA}`], { stdio: 'ignore' });
let browser = null;
const done = async (code) => { try { await browser?.close(); } catch { /* nic */ } try { srv.kill('SIGTERM'); } catch { /* nic */ } await new Promise((r) => setTimeout(r, 300)); fs.rmSync(DATA, { recursive: true, force: true }); process.exit(code); };
process.on('unhandledRejection', (e) => { console.error('BŁĄD:', e?.message || e); done(1); });
for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/api/info')).ok) break; } catch { /* jeszcze nie */ } await new Promise((r) => setTimeout(r, 250)); }

browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const errors = [];
const open = async (name, path, { w = 1280, h = 800, cam = false, mobile = false } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(cam ? { permissions: ['camera', 'microphone'] } : {}), ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  if (path) await p.goto(base + path); p.ctx = ctx; return p;
};
const until = (p, fn, arg, ms = 20000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
const shot = async (p, n, opts) => { await p.screenshot({ path: `shots/${n}.png`, ...(opts || {}) }); console.log('  zrzut shots/' + n + '.png'); };
/** Odtwarzacz z prawdziwym strumieniem (MediaStream) gra: ma obraz i czas płynie. */
const playing = (p, sel, ms = 25000) => until(p, async (sel) => { const v = document.querySelector(sel); if (!v || !(v.srcObject instanceof MediaStream) || !v.videoWidth) return false; const a = v.currentTime; await new Promise((r) => setTimeout(r, 700)); return v.currentTime > a + 0.3; }, sel, ms);
const CAM = '.md-video--cam video';

// ── przygotowanie: panel zarządzania (godzina symulowana 12:00 – ekrany pracują; playlisty LCD-01 z napisami, LCD-02 z filmem „na żywo”)
const M = await open('panel', '/ekspozycja', { w: 1500, h: 950 });
await M.click('[data-testid=x-login-submit]'); await M.waitForSelector('.x-nav');
const prep = await M.evaluate(async () => {
  const { makeApi, getState } = window.__fpz; makeApi('sim').env.set({ simTime: '12:00' });
  const s = getState(); const liveVid = s.videos.find((v) => v.kind === 'live');
  const api = makeApi('mgmt');
  const scena = s.playlists.find((p) => p.id === 'pl-scena'); if (!scena.items.some((i) => i.type === 'captions')) api.cms.save('playlists', { ...scena, items: [{ id: 'ps-1', type: 'captions', title: 'Napisy na żywo', durationSec: 0 }, ...scena.items] });
  api.cms.save('playlists', { id: 'pl-info', name: 'Informator – pętla dzienna', items: [{ id: 'pi-live', type: 'video', title: liveVid.title.pl, ref: liveVid.id, durationSec: 600 }, { id: 'pi-5', type: 'ticker', title: 'Pasek informacyjny', text: 'Transmisja na żywo z Hali Tworzeń', durationSec: 0 }] });
  for (const id of ['LCD-01', 'LCD-02']) { const d = getState().devices.find((x) => x.id === id); if (d.power !== 'on') api.devices.power(id, 'on'); }
  await new Promise((r) => { const t0 = Date.now(); const chk = () => (getState().net.pending === 0 || Date.now() - t0 > 8000 ? r() : setTimeout(chk, 150)); chk(); });
  const st = getState(); return { lcd1: st.devices.find((d) => d.id === 'LCD-01').playlistId, lcd2: st.devices.find((d) => d.id === 'LCD-02').playlistId, power: st.devices.filter((d) => /^LCD/.test(d.id)).map((d) => d.power), liveVid: liveVid.id, onAir: st.live.onAir };
});
T('przygotowanie: LCD-01 → playlista z napisami, LCD-02 → film „na żywo”, ekrany włączone', prep.lcd1 === 'pl-scena' && prep.lcd2 === 'pl-info' && prep.power.every((x) => x === 'on') && !prep.onAir, prep);
await M.locator('.x-nav__it', { hasText: 'Transmisje i napisy' }).click(); await M.waitForSelector('[data-testid=x-phonecast]');
T('panel: karta „Nadawaj z telefonu” z linkiem /nadawanie i kodem QR', (await M.getAttribute('[data-testid=x-phonecast-link]', 'href')) === base + '/nadawanie' && await M.locator('[data-testid=x-phonecast-qr] svg').isVisible());
await M.locator('.x-phonecast').scrollIntoViewIfNeeded(); await shot(M, 'live-panel-card');

// ── telefon nadawcy (390×844, zgoda na kamerę i mikrofon)
const B = await open('nadawca', '/nadawanie', { w: 390, h: 844, cam: true, mobile: true });
await B.waitForSelector('[data-testid=b-login-submit]'); await shot(B, 'live-login');
await B.click('[data-testid=b-login-submit]'); await B.waitForSelector('[data-testid=b-start]');
T('nadawca: tytuł domyślny z s.live.title', (await B.inputValue('[data-testid=b-title]')) === 'Transmisja z wirtualnego studia', await B.inputValue('[data-testid=b-title]'));
await B.click('[data-testid=b-preview]'); T('nadawca: podgląd kamery po dotknięciu przycisku', await playing(B, '[data-testid=b-video]', 10000));
await B.fill('[data-testid=b-title]', 'Koncert w Hali Tworzeń – kamera'); await B.waitForTimeout(300); await shot(B, 'live-setup');
await B.click('[data-testid=b-start]');
T('nadawca: ekran „na antenie”', await until(B, () => !!document.querySelector('[data-testid=b-onair]'), null, 15000));
await until(M, () => window.__fpz.getState().live.onAir, null, 15000);
const st1 = await M.evaluate(() => { const l = window.__fpz.getState().live; return { onAir: l.onAir, src: l.source, id: l.streamId, title: l.title.pl }; });
T('stan wspólny: na antenie, źródło „camera”, streamId, tytuł', st1.onAir && st1.src === 'camera' && /^[a-z0-9]{14}$/.test(st1.id || '') && st1.title === 'Koncert w Hali Tworzeń – kamera', st1);
T('nadawca: sessionStorage pamięta transmisję (wznowienie)', await B.evaluate((id) => JSON.parse(sessionStorage.getItem('fpz-nadawanie-v1') || '{}').streamId === id, st1.id));

// ── odbiorcy
const L1 = await open('LCD-01', '/lcd/LCD-01', { w: 1920, h: 1080 });
const L2 = await open('LCD-02', '/lcd/LCD-02', { w: 1280, h: 720 });
const A = await open('aplikacja', '/app', { w: 390, h: 844, mobile: true });
const W = await open('www', '/www', { w: 1366, h: 900 });
await A.waitForSelector('.m-onb', { timeout: 15000 }); await A.click('.m-onb .fpz-btn'); await A.click('.m-tut__skip button'); await A.waitForSelector('.m-bnav');
await A.evaluate(() => window.__fpzMobile.push('live', {}));
await W.getByRole('button', { name: 'Akceptuję wszystkie' }).click().catch(() => {}); await W.locator('.w-nav a', { hasText: 'Transmisje' }).first().click();
if (await W.waitForSelector('.md-video--cam[data-live=connecting] .md-live__wait', { timeout: 6000 }).then(() => true).catch(() => false)) await W.locator('.md-video--cam').screenshot({ path: 'shots/live-www-connecting.png' }); // plansza „Łączenie z transmisją…” (krótka – zrzut, gdy zdążymy)
const t0 = Date.now();
T('LCD-01 (napisy): obraz z kamery gra', await playing(L1, '.s-caps__video video', 40000), await L1.evaluate(() => ({ cam: document.querySelector('.s-caps')?.dataset.cam, cls: document.querySelector('.s-caps')?.className })));
console.log(`  (pierwszy obraz po ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
T('LCD-02 (film „na żywo” w playliście): obraz z kamery gra', await playing(L2, '.s-video ' + CAM, 30000), await L2.evaluate(() => document.querySelector('.s-slide')?.innerHTML.slice(0, 200)));
T('aplikacja /app: odtwarzacz na żywo pokazuje obraz z kamery', await playing(A, CAM, 30000), await A.evaluate(() => document.querySelector('.md-video')?.className));
T('strona /www „Transmisje”: odtwarzacz pokazuje obraz z kamery', await playing(W, CAM, 30000), await W.evaluate(() => document.querySelector('.md-video')?.className));
T('aplikacja: bez przewijania i zmiany prędkości (tylko kontrolki na żywo)', await until(A, () => { const f = document.querySelector('.md-video--cam'); return !!f && !f.querySelector('input[type=range]') && ![...f.querySelectorAll('button')].some((b) => /1×|1,5×/.test(b.textContent)) && !!f.querySelector('.md-video__livebadge'); }, null, 8000), await A.evaluate(() => { const f = document.querySelector('.md-video--cam'); return f && { live: f.dataset.live, html: f.innerHTML.slice(0, 300) }; }));
T('strona: znacznik NA ŻYWO i licznik na obrazie', await until(W, () => !!document.querySelector('.md-video--cam .md-video__livebadge') && !!document.querySelector('.md-video--cam .md-video__viewers'), null, 8000), await W.evaluate(() => document.querySelector('.md-video--cam')?.dataset.live));

// ── napis wpisany w panelu pojawia się na LCD nad obrazem
await M.fill('[data-testid=x-caption-input]', 'Witamy na koncercie – obraz prosto z telefonu'); await M.press('[data-testid=x-caption-input]', 'Enter');
T('napis z panelu na LCD-01 (pod obrazem z kamery)', await until(L1, () => document.querySelector('.s-caps--cam .s-caps__lines')?.textContent.includes('obraz prosto z telefonu'), null, 15000));
T('napis z panelu na obrazie w aplikacji', await until(A, () => document.querySelector('.md-video--cam .md-video__caps')?.textContent.includes('obraz prosto z telefonu'), null, 15000));
await M.fill('[data-testid=x-caption-input]', 'Za chwilę pierwszy utwór.'); await M.press('[data-testid=x-caption-input]', 'Enter');
await until(L1, () => document.querySelector('.s-caps__lines')?.textContent.includes('pierwszy utwór'), null, 12000);
await L1.waitForTimeout(600); await shot(L1, 'live-lcd01-captions'); await shot(L2, 'live-lcd02-video'); await A.waitForTimeout(300); await shot(A, 'live-app-player'); await shot(W, 'live-www-player');

// ── liczba odbiorców: nadawca i panel
T('nadawca: co najmniej 3 odbiorców', await until(B, () => +document.querySelector('[data-testid=b-viewers]')?.textContent.replace(/\D.*$/, '') >= 3, null, 20000), await B.textContent('[data-testid=b-viewers]'));
await shot(B, 'live-onair');
T('panel: źródło „kamera telefonu” i licznik odbiorników ≥ 3', await until(M, () => document.querySelector('[data-testid=x-live-source]')?.dataset.source === 'camera' && document.querySelector('[data-testid=x-live-source]').textContent.includes('kamera telefonu') && parseInt(document.querySelector('[data-testid=x-viewers]').textContent, 10) >= 3, null, 20000), await M.evaluate(() => [document.querySelector('[data-testid=x-live-source]')?.textContent, document.querySelector('[data-testid=x-viewers]')?.textContent]));
await M.evaluate(() => document.querySelector('.x-main')?.scrollTo?.(0, 0)); await shot(M, 'live-panel-camera');

// ── przełączenie kamery i wyciszenie mikrofonu
await B.click('[data-testid=b-flip]'); await B.waitForTimeout(2500);
T('po przełączeniu kamery obraz na LCD-01 dalej płynie', await playing(L1, '.s-caps__video video', 15000));
T('po przełączeniu kamery nadawca ma żywą ścieżkę obrazu', await B.evaluate(() => document.querySelector('[data-testid=b-video]').srcObject.getVideoTracks()[0].readyState === 'live'));
await B.click('[data-testid=b-mic]');
T('wyciszenie mikrofonu (track.enabled = false)', await B.evaluate(() => { const t = document.querySelector('[data-testid=b-video]').srcObject.getAudioTracks()[0]; return !!t && t.enabled === false && document.querySelector('[data-testid=b-mic]').getAttribute('aria-pressed') === 'true'; }));
await B.click('[data-testid=b-mic]');

// ── przypadkowe przeładowanie strony nadawcy → „Wznów transmisję” (ten sam streamId)
await B.reload(); await B.waitForSelector('[data-testid=b-resume]', { timeout: 15000 });
const afterReload = await until(M, () => window.__fpz.getState().live.onAir === false, null, 12000);
T('przeładowanie: zamknięcie strony zakończyło transmisję (sendBeacon) i strona proponuje wznowienie', afterReload && await B.isVisible('[data-testid=b-resume-card]'));
await shot(B, 'live-resume');
await B.click('[data-testid=b-resume]');
T('wznowienie: na antenie z tym samym streamId', await until(B, () => !!document.querySelector('[data-testid=b-onair]'), null, 15000) && await until(M, (id) => { const l = window.__fpz.getState().live; return l.onAir && l.streamId === id; }, st1.id, 15000));
T('wznowienie: obraz znów na LCD-01', await playing(L1, '.s-caps__video video', 40000));

// ── zakończenie z telefonu
await B.click('[data-testid=b-stop]'); await B.waitForSelector('[data-testid=b-confirm-yes]'); await shot(B, 'live-confirm-end'); await B.click('[data-testid=b-confirm-yes]');
T('nadawca: ekran zakończenia', await until(B, () => document.querySelector('[data-testid=b-ended]')?.dataset.why === 'user', null, 8000));
T('stan wspólny: live.onAir === false', await until(M, () => window.__fpz.getState().live.onAir === false, null, 15000));
T('odbiorcy wychodzą ze stanu na żywo (LCD-01, LCD-02, aplikacja, WWW)', (await Promise.all([
  until(L1, () => !document.querySelector('.s-caps--cam') && !!document.querySelector('.s-caps--wait'), null, 20000),
  until(L2, () => !document.querySelector('.md-video--cam'), null, 20000),
  until(A, () => !document.querySelector('.md-video--cam'), null, 20000),
  until(W, () => !document.querySelector('.md-video--cam'), null, 20000)])).every(Boolean));
T('nadawca: kamera wyłączona (brak strumienia)', await B.evaluate(() => !document.querySelector('[data-testid=b-video]')));

// ── ponownie, a potem zakończenie z panelu
await B.click('[data-testid=b-again]'); await B.waitForSelector('[data-testid=b-start]');
T('po świadomym zakończeniu nie ma propozycji wznowienia', !(await B.isVisible('[data-testid=b-resume-card]')) && await B.evaluate(() => !sessionStorage.getItem('fpz-nadawanie-v1')));
await B.click('[data-testid=b-start]');
T('druga transmisja: na antenie', await until(B, () => !!document.querySelector('[data-testid=b-onair]'), null, 15000));
T('druga transmisja: obraz na LCD-01', await playing(L1, '.s-caps__video video', 40000));
await until(M, () => !!document.querySelector('[data-testid=x-live-stop]'), null, 10000); await M.click('[data-testid=x-live-stop]');
T('zakończenie z panelu → telefon zatrzymuje kamerę z komunikatem', await until(B, () => document.querySelector('[data-testid=b-ended]')?.dataset.why === 'panel' && document.querySelector('[data-testid=b-ended-msg]').textContent === 'Transmisję zakończono z panelu' && !document.querySelector('[data-testid=b-video]'), null, 20000), await B.evaluate(() => document.body.innerText.slice(0, 200)));
await B.waitForTimeout(500); await shot(B, 'live-ended-panel');

// ── brak zgody na kamerę
// osobna przeglądarka: atrapa kamery, ale okno zgody odrzucane (zamiast automatycznie akceptowanego)
const browser2 = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--deny-permission-prompts'] });
const D = await (await browser2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
D.on('pageerror', (e) => errors.push(`[bez-zgody] ${e.message}`)); D.on('console', (m) => { if (m.type() === 'error') errors.push(`[bez-zgody] console: ${m.text()}`); });
await D.goto(base + '/nadawanie'); await D.click('[data-testid=b-login-submit]'); await D.click('[data-testid=b-preview]');
T('brak zgody na kamerę → konkretny komunikat', await until(D, () => document.querySelector('[data-testid=b-error]')?.dataset.code === 'denied' && document.querySelector('[data-testid=b-error]').textContent.includes('Brak zgody na użycie kamery'), null, 8000), await D.evaluate(() => document.querySelector('[data-testid=b-error]')?.textContent));
await D.waitForTimeout(300); await shot(D, 'live-denied'); await browser2.close();

// ── transmisja symulowana z panelu (bez streamId) – wszędzie dawna symulacja
await M.click('[data-testid=x-live-start]'); await M.waitForTimeout(1200);
const sim = await M.evaluate(() => { const l = window.__fpz.getState().live; return { onAir: l.onAir, id: l.streamId, src: l.source }; });
T('symulacja: na antenie bez streamId', sim.onAir && !sim.id && sim.src === 'studio', sim);
T('symulacja: panel pokazuje źródło „symulacja”', await until(M, () => document.querySelector('[data-testid=x-live-source]')?.dataset.source === 'studio', null, 5000));
T('symulacja na LCD-01: plansza samych napisów (bez kamery)', await until(L1, () => !!document.querySelector('.s-caps') && !document.querySelector('.s-caps--wait') && !document.querySelector('.s-caps--cam') && !document.querySelector('video'), null, 20000));
T('symulacja na LCD-02: symulowany film „na żywo”', await until(L2, () => !!document.querySelector('.s-video .md-video .md-video__kb') && !document.querySelector('.md-video--cam'), null, 20000));
T('symulacja w aplikacji i na stronie: odtwarzacz symulowany', (await Promise.all([A, W].map((p) => until(p, () => !!document.querySelector('.md-video .md-video__kb') && !document.querySelector('.md-video--cam') && !!document.querySelector('.md-video__livebadge'), null, 20000)))).every(Boolean));
await B.click('[data-testid=b-again]');
T('telefon: informacja o trwającej transmisji symulowanej', await until(B, () => document.querySelector('[data-testid=b-already]')?.dataset.source === 'studio' && document.querySelector('[data-testid=b-start]').disabled, null, 8000));
await shot(B, 'live-already-sim');
await B.click('[data-testid=b-end-other]'); await B.click('[data-testid=b-confirm-yes]');
T('telefon kończy transmisję symulowaną, przycisk startu odblokowany', await until(B, () => !document.querySelector('[data-testid=b-already]') && !document.querySelector('[data-testid=b-start]').disabled, null, 8000) && await until(M, () => window.__fpz.getState().live.onAir === false, null, 15000));

// ── układ na innych rozmiarach (zrzuty do obejrzenia)
await B.setViewportSize({ width: 844, height: 390 }); await B.waitForTimeout(3300); await shot(B, 'live-setup-landscape');
const B2 = await open('nadawca-komputer', '/nadawanie', { w: 1280, h: 800, cam: true });
await B2.click('[data-testid=b-login-submit]'); await B2.click('[data-testid=b-preview]');
T('komputer: podgląd kamery', await playing(B2, '[data-testid=b-video]', 15000), await B2.evaluate(() => document.querySelector('.b-pv')?.textContent)); await B2.waitForTimeout(2500); await shot(B2, 'live-setup-desktop');
await M.setViewportSize({ width: 820, height: 1000 }); await M.waitForTimeout(300); await M.locator('.x-phonecast').scrollIntoViewIfNeeded(); await shot(M, 'live-panel-card-narrow');

const errs = [...new Set(errors)];
T('brak błędów stron i konsoli', errs.length === 0, errs.slice(0, 10));
console.log(fails ? `✗ NIEPOWODZENIA: ${fails}` : '✓ wszystkie sprawdzenia zaliczone');
await done(fails ? 1 : 0);
