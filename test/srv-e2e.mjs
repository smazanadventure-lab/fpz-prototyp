// Test trybu serwerowego: kilka „urządzeń” (osobne konteksty przeglądarki) na wspólnym backendzie.
//   node build.mjs --target=netlify && node tools/dev-server.mjs --fresh &   →   node test/srv-e2e.mjs [--base=http://localhost:8787]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const base = args.base || 'http://localhost:8787'; fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const errors = []; let fails = 0;
const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? '')); };
async function device(name, path, vp = { width: 1280, height: 800 }, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, ...opts }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text())) errors.push(`[${name}] console.error: ${m.text().slice(0, 300)}`); });
  await page.goto(base + path); await page.waitForFunction(() => window.__fpz && window.__fpz.getState().net.status === 'online' && window.__fpz.getState().net.version > 0, null, { timeout: 15000 });
  return { ctx, page, name, ev: (fn, arg) => page.evaluate(fn, arg), until: (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false) };
}
const stats = async () => (await (await fetch(base + '/__stats')).json());

// 1. wszystkie końcówki pod własnymi adresami
const shell = await device('powłoka', '/'); await shell.page.waitForSelector('.sh-root'); T('powłoka symulatora w trybie serwerowym', await shell.ev(() => window.__fpz.getState().net.mode === 'remote'));
await shell.page.screenshot({ path: 'shots/srv-shell.png' });
// test nie może zależeć od pory dnia: kioski i ekrany wyłączają się nocą wg harmonogramu, więc ustawiamy godzinę symulowaną
await shell.ev(() => window.__fpz.makeApi('sim').env.set({ simTime: '12:00' })); await shell.until(() => window.__fpz.getState().net.pending === 0);
const cms = await device('cms', '/cms', { width: 1400, height: 900 });
const kiosk = await device('kiosk', '/kiosk/TZ.T1.3', { width: 540, height: 960 });
const lcd = await device('lcd', '/lcd/LCD-01', { width: 1280, height: 720 });
const www = await device('www', '/www', { width: 1320, height: 860 });
const bil = await device('bileter', '/bileter', { width: 820, height: 1000 });
const mg = await device('ekspozycja', '/ekspozycja', { width: 1400, height: 900 });
const tel = await device('telefon', '/app', { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const tel2 = await device('telefon-2', '/app', { width: 360, height: 740 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const d of [cms, kiosk, lcd, www, bil, mg, tel]) { await d.page.waitForTimeout(600); await d.page.screenshot({ path: `shots/srv-${d.name}.png` }); }
T('kiosk: tylko ekran kiosku', await kiosk.page.locator('.sh-root').count() === 0 && (await kiosk.page.locator('body').innerText()).length > 20);
// noc wg harmonogramu: ekran czarny + podpowiedź dla testera; po powrocie do dnia kiosk działa
await shell.ev(() => window.__fpz.makeApi('sim').env.set({ simTime: '23:30' }));
T('kiosk nocą: wyłączony z informacją o harmonogramie', await kiosk.until(() => !!document.querySelector('.sa-power') && /harmonogram/.test(document.querySelector('.sa-power').innerText)));
await kiosk.page.screenshot({ path: 'shots/srv-kiosk-noc.png' });
await shell.ev(() => window.__fpz.makeApi('sim').env.set({ simTime: '12:00' }));
T('kiosk w dzień: włączony ponownie', await kiosk.until(() => !document.querySelector('.sa-power') && document.body.innerText.length > 20));
T('różne identyfikatory urządzeń', (await tel.ev(() => window.__fpz.getState().deviceId)) !== (await tel2.ev(() => window.__fpz.getState().deviceId)));

// 1a. aplikacja dla zwiedzających (/app – ta sama paczka co w APK): bez kodu i danych zaplecza
const appHtml = await (await fetch(base + '/app')).text();
T('aplikacja: paczka bez CMS, zarządzania i kont personelu', !/c-login|x-login-submit|v-login-submit|cms\.save|devices\.power|s-admin/.test(appHtml) && appHtml.length < 0.75 * (await (await fetch(base + '/')).text()).length);
T('aplikacja: brak operacji zaplecza w API klienta', await tel.ev(() => { const a = window.__fpz.makeApi('mobile'); return !a.cms && !a.staff && !a.devices && !a.sys && !a.tickets && !!a.game && !!a.booking; }));
T('aplikacja: serwer nie przysyła danych zaplecza', await tel.ev(() => { const s = window.__fpz.getState(); return s.staff.length === 0 && s.devices.length === 0 && s.audit.length === 0 && s.schedules.length === 0 && !s.players && s.entries.length > 10 && s.events.length > 5; }));
const appSync = await (await fetch(base + '/api/sync?role=app&device=d-x')).json(); const fullSync = await (await fetch(base + '/api/sync?device=d-x')).json();
T('API: widok „app” bez kluczy zaplecza, widok pełny je zawiera', !('staff' in appSync.keys) && !('devices' in appSync.keys) && !('players' in appSync.keys) && 'player' in appSync.keys && 'staff' in fullSync.keys && 'devices' in fullSync.keys);
const forb = await (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: 'd-x', role: 'app', ops: [{ op: 'cms.setSetting', args: ['moderation', false], nonce: 'forb1', clientId: 'mobile', client: {} }, { op: 'devices.powerAll', args: [false], nonce: 'forb2', clientId: 'mobile', client: {} }] }) })).json();
T('API: operacje zaplecza z aplikacji są odrzucane', forb.results.every((r) => r.ok === false && r.error === 'FORBIDDEN'));
T('API: reset danych niedostępny dla aplikacji', (await fetch(base + '/api/reset?role=app', { method: 'POST' })).status === 403);

// 2. CMS → pozostałe urządzenia
const title = 'TYTUŁ ZMIENIONY NA SERWERZE ' + Date.now().toString(36).toUpperCase();
await cms.page.locator('[data-testid=c-login-submit]').click(); await cms.page.waitForTimeout(400);
T('CMS: logowanie makietą (wypełnione hasło)', await cms.ev(() => !!window.__fpz.getState().clients.cms?.staffId));
const entryId = await cms.ev((t) => { const { getState, makeApi } = window.__fpz; const e = getState().entries.find((x) => x.featured && x.channels.includes('web') && x.channels.includes('kiosk')); const r = makeApi('cms').cms.save('entries', { id: e.id, title: { pl: t, en: t } }); return r.ok ? e.id : null; }, title);
T('CMS: zapis wpisu', !!entryId);
const sees = (d) => d.until(([id, t]) => window.__fpz.getState().entries.find((x) => x.id === id)?.title.pl === t, [entryId, title]);
T('zmiana z CMS dociera do strony WWW', await sees(www)); T('…do kiosku', await sees(kiosk)); T('…do telefonu', await sees(tel)); T('…do ekranu LCD', await sees(lcd));
await www.page.waitForTimeout(300); T('strona WWW pokazuje nowy tytuł', (await www.page.locator('body').innerText()).toUpperCase().includes(title)); await www.page.screenshot({ path: 'shots/srv-www-po-zmianie.png' });

// 3. zakup w telefonie → bileter → status biletu w telefonie
const buy = await tel.ev(() => { const { getState, makeApi } = window.__fpz; const api = makeApi('mobile'); const s = getState(); const li = api.auth.login('anna.kowalska@example.com', 'demo1234'); const e = s.events.find((x) => x.ticketed && x.end > new Date().toISOString().slice(0, 16)); const p = s.products.find((x) => x.eventId === e.id); api.booking.addToCart(p.id, 1); const o = api.booking.checkout(); const pay = api.booking.pay(o.order.id, { method: 'blik' }); return { login: li.ok, ok: pay.ok, code: pay.tickets?.[0]?.code, id: pay.tickets?.[0]?.id, orderId: o.order?.id }; });
T('telefon: zakup biletu (wynik natychmiast)', buy.ok && !!buy.code, JSON.stringify(buy));
T('telefon: kolejka wysłana na serwer', await tel.until(() => window.__fpz.getState().net.pending === 0));
T('telefon: po synchronizacji bilet ma ten sam kod', await tel.ev((b) => window.__fpz.getState().tickets.find((t) => t.id === b.id)?.code === b.code, buy));
T('bileter: widzi bilet kupiony w telefonie', await bil.until((c) => window.__fpz.getState().tickets.some((t) => t.code === c), buy.code));
await bil.page.locator('[data-testid=v-login-submit]').click(); await bil.page.waitForTimeout(300);
const v = await bil.ev((c) => { const r = window.__fpz.makeApi('validator').tickets.validate('FPZ:T:' + c); return { ok: r.ok, reason: r.reason }; }, buy.code);
T('bileter: walidacja biletu', v.ok, JSON.stringify(v));
T('telefon: bilet oznaczony jako wykorzystany', await tel.until((c) => window.__fpz.getState().tickets.find((t) => t.code === c)?.status === 'used', buy.code));
T('zarządzanie/CMS: zamówienie widoczne', await cms.until((id) => window.__fpz.getState().orders.some((o) => o.id === id && o.status === 'paid'), buy.orderId));

// 4. konflikt: drugi bileter (nieaktualny stan) waliduje ten sam bilet
const buy2 = await tel.ev(() => { const { getState, makeApi } = window.__fpz; const api = makeApi('mobile'); const s = getState(); const e = s.events.find((x) => x.ticketed && x.end > new Date().toISOString().slice(0, 16)); const p = s.products.find((x) => x.eventId === e.id); api.booking.addToCart(p.id, 1); const o = api.booking.checkout(); const pay = api.booking.pay(o.order.id, { method: 'card' }); return { ok: pay.ok, code: pay.tickets?.[0]?.code }; });
await bil.until((c) => window.__fpz.getState().tickets.some((t) => t.code === c), buy2.code); await mg.until((c) => window.__fpz.getState().tickets.some((t) => t.code === c), buy2.code);
const both = await Promise.all([bil, mg].map((d) => d.ev((c) => window.__fpz.makeApi('validator').tickets.validate(c).ok, buy2.code)));
T('dwie równoczesne walidacje lokalnie przechodzą (optymistycznie)', both[0] && both[1]);
const conflict = await Promise.race([bil, mg].map((d) => d.until(() => !!window.__fpz.getState().net.conflict, null, 12000)));
T('serwer przyjmuje tylko jedną – druga końcówka dostaje komunikat', conflict);
await bil.page.waitForTimeout(1500); const used = await bil.ev((c) => window.__fpz.getState().validations?.filter?.((x) => x.code === c).length ?? -1, buy2.code); console.log('   wpisy walidacji dla biletu na serwerze:', used);
await mg.page.screenshot({ path: 'shots/srv-konflikt.png' });

// 5. gra: postęp osobno na każdym telefonie
const g = await tel.ev(() => { const { getState, makeApi } = window.__fpz; const api = makeApi('mobile'); const r = getState().gameRoutes[0]; const st = api.game.startRoute(r.id, {}); api.visit.toggleFavorite(getState().pois[0].id); return { ok: st.ok, routeId: r.id }; });
T('telefon 1: start trasy gry', g.ok); await tel.until(() => window.__fpz.getState().net.pending === 0);
await tel2.page.waitForTimeout(5000);
T('telefon 2: własny, pusty postęp gry', await tel2.ev(() => { const p = window.__fpz.getState().player; return !p.activeRoute && p.favorites.length === 0; }));
T('telefon 1: postęp zachowany po synchronizacji', await tel.ev((id) => { const p = window.__fpz.getState().player; return p.activeRoute?.routeId === id || p.activeRoute === id || !!p.activeRoute; }, g.routeId));
await tel.page.reload(); await tel.page.waitForFunction(() => window.__fpz && window.__fpz.getState().net.version > 0 && window.__fpz.getState().net.status === 'online');
T('telefon 1: postęp po ponownym uruchomieniu', await tel.ev(() => { const p = window.__fpz.getState().player; return !!p.activeRoute && p.favorites.length === 1; }));
const info = await (await fetch(base + '/api/info')).json(); T('serwer: zapisany gracz', info.counts.players >= 1, JSON.stringify(info.counts));

// 6. praca bez sieci: zmiany czekają w kolejce i trafiają na serwer po odzyskaniu połączenia
await tel2.ctx.setOffline(true);
const off = await tel2.ev(() => { const { getState, makeApi } = window.__fpz; const api = makeApi('mobile'); const s = getState(); const cat = s.ideaCategories[0]; const r = api.game.startRoute(s.gameRoutes[0].id, {}); api.visit.toggleFavorite(s.pois[1].id); return { ok: r.ok, poi: s.pois[1].id }; });
T('telefon 2 offline: operacja wykonana lokalnie', off.ok);
T('telefon 2 offline: stan „brak połączenia”, zmiany w kolejce', await tel2.until(() => { const n = window.__fpz.getState().net; return n.status === 'offline' && n.pending >= 2; }), JSON.stringify(await tel2.ev(() => window.__fpz.getState().net)));
await tel2.page.screenshot({ path: 'shots/srv-telefon-offline.png' });
await tel2.ctx.setOffline(false);
T('telefon 2: po odzyskaniu sieci kolejka pusta', await tel2.until(() => { const n = window.__fpz.getState().net; return n.status === 'online' && n.pending === 0; }, null, 40000));
T('telefon 2: ulubione zachowane', await tel2.ev((id) => window.__fpz.getState().player.favorites.includes(id), off.poi));
const info2 = await (await fetch(base + '/api/info')).json(); T('serwer: dwóch graczy', info2.counts.players >= 2, JSON.stringify(info2.counts));

// 7. ruch w tle: liczba wywołań API przy bezczynnych końcówkach
const s0 = await stats(); await shell.page.waitForTimeout(30000); const s1 = await stats();
const idle = s1.calls - s0.calls; console.log(`   wywołania API przez 30 s bezczynności (9 kart): ${idle}`, JSON.stringify(Object.fromEntries(Object.entries(s1.stats).map(([k, v]) => [k, v - (s0.stats[k] || 0)]).filter(([, v]) => v))));
T('bezczynne końcówki nie zapisują nic na serwerze', (s1.stats['POST /api/rpc'] || 0) === (s0.stats['POST /api/rpc'] || 0));

// 8. reset danych na serwerze z powłoki
const epoch0 = await shell.ev(() => window.__fpz.getState().net.epoch);
await shell.page.locator('.sh-toolbtn', { hasText: 'Reset' }).click(); await shell.page.locator('.sh-confirm .sh-toolbtn.is-on').click();
T('reset: nowa wersja danych w powłoce', await shell.until((e) => window.__fpz.getState().net.epoch && window.__fpz.getState().net.epoch !== e, epoch0));
T('reset: dociera do CMS (tytuł przywrócony)', await cms.until(([id, t]) => window.__fpz.getState().entries.find((x) => x.id === id)?.title.pl !== t, [entryId, title], 40000));
T('reset: telefon bez biletów z testu', await tel.until((c) => !window.__fpz.getState().tickets.some((t) => t.code === c), buy.code, 40000));

await browser.close();
if (errors.length) console.error(`BŁĘDY KONSOLI (${errors.length}):\n` + [...new Set(errors)].slice(0, 20).join('\n'));
console.log(fails || errors.length ? `\nNIEPOWODZENIA: ${fails}, błędy konsoli: ${errors.length}` : '\nWszystkie testy trybu serwerowego zaliczone.');
process.exit(fails || errors.length ? 1 : 0);
