// Stan rzeczywisty urządzeń w panelu „Zarządzanie ekspozycją” (sygnały /api/beat → /api/presence).
//   node build.mjs --target=netlify --site=site-b
//   FPZ_STALE_MS=4000 FPZ_OFFLINE_MS=8000 node tools/dev-server.mjs --port=8792 --site=site-b --data=.data-b --fresh &
//   node test/presence-flow.mjs --base=http://localhost:8792
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const base = args.base || 'http://localhost:8792'; fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const errors = []; let fails = 0;
const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function device(name, path, vp = { width: 1500, height: 950 }) {
  const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text())) errors.push(`[${name}] console.error: ${m.text().slice(0, 300)}`); });
  await page.goto(base + path); await page.waitForFunction(() => window.__fpz && window.__fpz.getState().net.status === 'online' && window.__fpz.getState().net.version > 0, null, { timeout: 15000 });
  return { ctx, page, name, ev: (fn, arg) => page.evaluate(fn, arg), until: (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false), sel: (s, timeout = 15000) => page.waitForSelector(s, { timeout }).then(() => true).catch(() => false) };
}
// Serwer testowy ma skrócony próg „brak sygnału” (FPZ_STALE_MS=4000), a strona melduje się co 30 s – na czas testu
// pobudzamy dodatkowe sygnały (zdarzenie visibilitychange wywołuje natychmiastowe zgłoszenie), żeby kiosk był stale „podłączony”.
const pump = (d) => { const t = setInterval(() => d.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {}), 1500); return () => clearInterval(t); };
const tab = async (d, label) => { await d.ev(() => { const b = document.querySelector('.fpz-modal__body'); if (b) b.scrollTop = 0; }); await d.page.click(`.fpz-modal .fpz-tab:has-text("${label}")`); await sleep(250); };
const shot = (d, n) => d.page.screenshot({ path: `shots/presence-${n}.png` });
const nav = async (d, label) => { if (await d.page.locator('.ep-mgmt .x-top__menu').isVisible()) { await d.page.click('.ep-mgmt .x-top__menu'); await sleep(250); } await d.page.click(`.ep-mgmt .x-nav__it:has-text("${label}")`); await sleep(300); };
const tick = () => fetch(base + '/api/sync?device=t&tick=1').then((r) => r.json()).catch(() => null);
const KIOSK = 'TZ.T1.3'; const row = `.x-devrow[data-dev="${KIOSK}"]`;
const agentBeat = (host = 'KIOSK-03', monitor = 'on') => fetch(base + '/api/beat', { method: 'POST', body: JSON.stringify({ id: KIOSK, src: 'agent', host, os: 'Windows 11', cpu: 23, memPct: 48, diskFreeGb: 120, uptimeH: 3.5, volume: 60, monitor }) }).then((r) => r.json());

// 0. panel; godzina symulowana – nocą urządzenia są wyłączone wg harmonogramu
const mg = await device('panel', '/ekspozycja');
await mg.ev(() => window.__fpz.makeApi('sim').env.set({ simTime: '12:00' })); await mg.until(() => window.__fpz.getState().net.pending === 0);
await mg.page.click('[data-testid=x-login-submit]'); await sleep(400);
await nav(mg, 'Urządzenia');
T('lista: znaczniki połączenia wczytane', await mg.until(() => document.querySelectorAll('.x-devrow[data-dev] [data-link]').length >= 12));
T('lista: wszystkie urządzenia „Nigdy niepodłączone”', await mg.ev(() => [...document.querySelectorAll('.x-devrow[data-dev] [data-link]')].every((e) => e.dataset.link === 'never' && /Nigdy niepodłączone/.test(e.textContent))));
T('lista: nagłówki „Zadane” / „Rzeczywiste”', await mg.ev(() => /Zadane/.test(document.querySelector('.x-devrow--head').textContent) && /Rzeczywiste/.test(document.querySelector('.x-devrow--head').textContent)));
await mg.page.click('[data-testid=x-only-online]'); await sleep(200);
T('filtr „tylko podłączone”: pusta lista', await mg.ev(() => document.querySelectorAll('.x-devrow[data-dev]').length === 0 && /Żadne urządzenie/.test(document.body.textContent)));
await mg.page.click('[data-testid=x-only-online]'); await sleep(200);
await shot(mg, 'list-never');
// szczegóły niepodłączonego kiosku: instrukcja z adresem
await mg.page.click(row); await sleep(300); await tab(mg, 'Stan rzeczywisty');
T('szczegóły: instrukcja i adres /kiosk/ID', await mg.ev((id) => document.querySelector('[data-testid=x-dev-url]')?.textContent === `${location.origin}/kiosk/${id}`, KIOSK));
await shot(mg, 'details-never');
await mg.page.keyboard.press('Escape'); await sleep(200);

// 1. kiosk się zgłasza
let ki = await device('kiosk', '/kiosk/' + KIOSK, { width: 540, height: 960 });
const origin0 = await ki.ev(() => performance.timeOrigin); let stopPump = pump(ki);
T('lista: kiosk „Podłączone” w ≤ 15 s', await mg.sel(`${row} [data-link=online]`, 15000));
T('lista: czas ostatniego sygnału', /Podłączone.*temu/.test(await mg.page.textContent(`${row} [data-link]`)));
await mg.page.click('[data-testid=x-only-online]'); await sleep(200);
T('filtr „tylko podłączone”: tylko kiosk', await mg.ev((id) => { const r = [...document.querySelectorAll('.x-devrow[data-dev]')]; return r.length === 1 && r[0].dataset.dev === id; }, KIOSK));
await mg.page.click('[data-testid=x-only-online]'); await sleep(200);
await shot(mg, 'list');
await mg.page.click(row); await sleep(300); await tab(mg, 'Stan rzeczywisty');
T('szczegóły: przeglądarka i system', /Chrome \d+ · /.test(await mg.page.textContent('[data-testid=x-real-ua]')));
T('szczegóły: rozdzielczość 540 × 960', /540 × 960/.test(await mg.page.textContent('[data-testid=x-real-viewport]')) && /540 × 960/.test(await mg.page.textContent('[data-testid=x-real-screen]')));
const ver = await mg.page.textContent('[data-testid=x-real-ver]');
T('szczegóły: wersja aplikacji zgodna', /aktualna/.test(ver) && !/nieaktualna/.test(ver), ver);
await shot(mg, 'details-page');

// 2. restart z panelu → strona kiosku naprawdę się przeładowuje
await tab(mg, 'Sterowanie');
T('sterowanie: strona podłączona, brak programu sterującego (czarna plansza / KIOSK-WINDOWS)', /KIOSK-WINDOWS/.test(await mg.page.textContent('[data-testid=x-power-real]')));
const nav1 = ki.page.waitForEvent('framenavigated', { timeout: 30000 }).then(() => true).catch(() => false);
await mg.page.click('[data-testid=x-dev-restart]');
T('restart: „wysłano – czekam na urządzenie”', await mg.sel('[data-testid=x-restart-state][data-st=wait]', 5000));
await shot(mg, 'restart-wait');
T('restart: strona kiosku przeładowana', await nav1);
await ki.page.waitForLoadState('load'); await ki.until(() => window.__fpz && window.__fpz.getState().net.status === 'online', null, 15000);
T('restart: performance.timeOrigin się zmienił', (await ki.ev(() => performance.timeOrigin)) !== origin0);
T('restart: panel pokazuje „wykonano”', await mg.sel('[data-testid=x-restart-state][data-st=done]', 30000));
T('restart: treść potwierdzenia', /Restart wykonany \d\d:\d\d:\d\d/.test(await mg.page.textContent('[data-testid=x-restart-state]')));
await shot(mg, 'restart-done');

// 3. program sterujący (agent) – prawdziwe wartości
T('agent: sygnał przyjęty', (await agentBeat()).ok === true);
T('sterowanie: stan monitora z programu sterującego', await mg.until(() => /Monitor: włączony.*zgodnie z zadanym/.test(document.querySelector('[data-testid=x-power-real]')?.textContent || ''), null, 15000));
await tab(mg, 'Stan rzeczywisty');
T('agent: komputer, CPU, głośność, monitor', /KIOSK-03/.test(await mg.page.textContent('[data-testid=x-real-host]')) && /23%/.test(await mg.page.textContent('[data-testid=x-real-cpu]')) && /60%/.test(await mg.page.textContent('[data-testid=x-real-vol]')) && /włączony/.test(await mg.page.textContent('[data-testid=x-real-monitor]')));
await shot(mg, 'details-agent');
await tab(mg, 'Wyposażenie');
T('wyposażenie: CPU i czas pracy „z urządzenia”, reszta „symulowane”', await mg.ev(() => { const t = document.querySelector('.x-kv').textContent; return /23% z urządzenia/.test(t) && /3\.5 h z urządzenia/.test(t) && /symulowane/.test(t); }));
await shot(mg, 'details-info');
await mg.page.keyboard.press('Escape'); await sleep(200);
T('lista: CPU z urządzenia (kropka)', await mg.ev((r) => /23%/.test(document.querySelector(r + ' .x-c-tel').textContent) && !!document.querySelector(r + ' .x-c-tel .x-realdot'), row));
await nav(mg, 'Pulpit');
T('pulpit: „Podłączone naprawdę: 1 z 8”', await mg.until(() => document.querySelector('[data-testid=x-real-count]')?.textContent === '1 z 8'));
T('pulpit: lista urządzeń bez sygnału', await mg.ev(() => document.querySelectorAll('[data-testid=x-real-off] li').length === 7));
await mg.page.click('.x-reallinks .x-help summary'); await sleep(150);
await shot(mg, 'dashboard');

// 4. kiosk znika → „Brak sygnału…”, zgłoszenie wykryte automatycznie
stopPump(); await ki.ctx.close();
await nav(mg, 'Urządzenia');
T('lista: „Brak sygnału od …” po zamknięciu kiosku', await mg.sel(`${row} [data-link=offline]`, 25000));
T('lista: tekst „Brak sygnału od”', /Brak sygnału od/.test(await mg.page.textContent(`${row} [data-link]`)));
await shot(mg, 'list-offline');
let incId = null;
for (let i = 0; i < 20 && !incId; i++) { await sleep(1500); const r = await tick(); incId = r && JSON.stringify(r).match(/inc-mon-TZ\.T1\.3-[a-z0-9]+/)?.[0]; }
T('monitoring: serwer założył zgłoszenie', !!incId);
T('panel: zgłoszenie dotarło', await mg.until((id) => window.__fpz.getState().incidents.some((i) => i.id === id), incId, 15000));
await nav(mg, 'Awarie');
T('awarie: „wykryte automatycznie (brak sygnału)”', await mg.until((id) => { const a = document.querySelector(`.x-inc[data-inc="${id}"]`); return !!a && a.dataset.origin === 'auto' && /wykryte automatycznie \(brak sygnału\)/.test(a.textContent) && /Brak sygnału z urządzenia od \d\d:\d\d/.test(a.textContent); }, incId));
T('awarie: symulowane i ręczne odróżnione', await mg.ev(() => { const api = window.__fpz.makeApi('mgmt'); api.devices.reportIncident({ deviceId: 'AUD-01', title: 'Test ręczny', severity: 'P4' }); api.devices.simulateFault('PRJ-01', { severity: 'P3' }); return true; }) && await mg.until(() => document.querySelector('.x-inc[data-origin=manual]') && document.querySelector('.x-inc[data-origin=sim]') && /zgłoszenie ręczne/.test(document.querySelector('.x-inc[data-origin=manual]').textContent) && /symulacja/.test(document.querySelector('.x-inc[data-origin=sim]').textContent)));
await sleep(800); await shot(mg, 'incidents');

// 5. kiosk wraca → zgłoszenie zamyka się samo
ki = await device('kiosk-2', '/kiosk/' + KIOSK, { width: 540, height: 960 }); stopPump = pump(ki);
let closed = false;
for (let i = 0; i < 20 && !closed; i++) { await sleep(1500); await tick(); closed = await mg.ev((id) => { const x = window.__fpz.getState().incidents.find((y) => y.id === id); return x?.status === 'closed' && x.autoClosed === true; }, incId); }
T('monitoring: zgłoszenie zamknięte automatycznie po powrocie sygnału', closed);
T('awarie: znika z otwartych', await mg.until((id) => !document.querySelector(`.x-inc[data-inc="${id}"]`), incId));
await mg.page.click('.ep-mgmt .fpz-chip:has-text("Zamknięte")'); await sleep(300);
T('awarie: na liście zamkniętych z notatką „Połączenie przywrócone”', await mg.ev((id) => { const a = document.querySelector(`.x-inc[data-inc="${id}"]`); return !!a && /Zamknięte automatycznie/.test(a.textContent) && /Połączenie przywrócone/.test(a.textContent); }, incId));
await sleep(800); await shot(mg, 'incidents-closed');

// 6. wąski ekran (tablet ~820 px)
await agentBeat();
const nw = await device('panel-wąski', '/ekspozycja', { width: 820, height: 1000 });
await nw.page.click('[data-testid=x-login-submit]'); await sleep(3500); // toast „Zalogowano” znika
await nw.sel('[data-testid=x-real-count]'); await nw.until(() => document.querySelector('[data-testid=x-real-count]')?.textContent !== '…'); await sleep(300);
await shot(nw, 'narrow-dashboard');
await nav(nw, 'Urządzenia'); await nw.sel(`${row} [data-link=online]`); await sleep(300);
await shot(nw, 'narrow-list');
await nw.page.click(row); await sleep(300); await tab(nw, 'Stan rzeczywisty');
T('wąski: szczegóły bez poziomego przewijania', await nw.ev(() => { const m = document.querySelector('.fpz-modal'); return m && m.scrollWidth <= m.clientWidth + 1; }));
await shot(nw, 'narrow-details');
await nw.page.keyboard.press('Escape'); await sleep(200);
await nav(nw, 'Awarie'); await sleep(800); await shot(nw, 'narrow-incidents');

stopPump(); await browser.close();
for (const e of errors) console.log('BŁĄD KONSOLI', e);
console.log(fails || errors.length ? `NIEPOWODZENIA: ${fails}, błędy konsoli: ${errors.length}` : 'WSZYSTKO OK');
process.exit(fails || errors.length ? 1 : 0);
