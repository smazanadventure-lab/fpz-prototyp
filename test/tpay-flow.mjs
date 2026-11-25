// Test przeglądarkowy płatności Tpay w sklepie (aplikacja /app i strona /www) na atrapie Tpay (tools/tpay-mock.mjs).
//   node build.mjs --target=netlify && node test/tpay-flow.mjs
// Sam uruchamia atrapę Tpay (port 9913) i serwer systemu (port 8793, dane w .tmp-tpay-ui) i zamyka je na końcu.
// Sprawdza prawdziwymi kliknięciami: kasę bez listy metod, ekran płatności Tpay (z informacją o środowisku testowym),
// otwarcie strony Tpay w nowej karcie, potwierdzenie (powiadomienie albo odpytywanie), płatność odrzuconą i ponowną próbę,
// powrót do rozpoczętej płatności później, końcowy ekran zamówienia z biletami. Zrzuty: shots/tpay-*.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { boot } from './mobile-lib.mjs';

const PORT = 8793, MOCK = 9913; const base = `http://localhost:${PORT}`, mock = `http://localhost:${MOCK}`;
let fails = 0; const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : JSON.stringify(extra ?? '')); return ok; };
const procs = []; const run = (args, env) => { const p = spawn('node', args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d)); procs.push(p); p.log = () => out; return p; };
const stop = () => procs.forEach((p) => { try { p.kill('SIGTERM'); } catch { /* nic */ } });
const waitFor = async (url, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* jeszcze nie */ } await new Promise((r) => setTimeout(r, 200)); } return false; };
fs.mkdirSync('shots', { recursive: true });

const mockProc = run(['tools/tpay-mock.mjs', `--port=${MOCK}`]);
const TP = { TPAY_ENV: 'mock', TPAY_API_URL: mock, TPAY_SECURE_URL: mock, TPAY_CLIENT_ID: 'test-id', TPAY_CLIENT_SECRET: 'test-secret', TPAY_SECURITY_CODE: 'kod123', TPAY_MERCHANT_ID: '4010' };
const srv = run(['tools/dev-server.mjs', `--port=${PORT}`, '--fresh', '--data=.tmp-tpay-ui'], TP);
let browser; const errors = [];
try {
  if (!(await waitFor(mock + '/__log')) || !(await waitFor(base + '/api/info'))) { console.log(mockProc.log(), srv.log()); throw new Error('serwery testowe nie wystartowały'); }
  browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });

  async function device(name, path, vp, opts = {}) {
    const ctx = await browser.newContext({ viewport: vp, ...opts });
    const watch = (pg, label) => {
      pg.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`));
      pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push(`[${label}] console.error: ${m.text().slice(0, 300)}`); });
    };
    ctx.on('page', (pg) => watch(pg, name + '/tpay'));
    const page = await ctx.newPage(); watch(page, name);
    await page.goto(base + path);
    await page.waitForFunction(() => window.__fpz && window.__fpz.getState().net.status === 'online' && window.__fpz.getState().net.pay?.provider === 'tpay', null, { timeout: 15000 });
    const until = (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);
    return { ctx, page, name, ev: (fn, arg) => page.evaluate(fn, arg), until };
  }
  /** Kliknięcie, które otwiera stronę Tpay w nowej karcie: zwraca nową kartę po przejściu na atrapę. */
  async function opensTpay(d, click) {
    const [pop] = await Promise.all([d.ctx.waitForEvent('page', { timeout: 10000 }), click()]);
    await pop.waitForURL(new RegExp('^' + mock + '/pay/'), { timeout: 10000 });
    return pop;
  }
  /** Strona wyniku po powrocie z atrapy (serwer: /api/pay/return). Strona sama się zamyka po kilku sekundach – czytamy od razu. */
  async function resultText(pop) { await pop.waitForURL(/\/api\/pay\/return/, { timeout: 10000 }); return pop.locator('h1').innerText({ timeout: 5000 }); }
  const lastOrder = (d) => d.ev(() => { const s = window.__fpz.getState(); return [...s.orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]; });
  const orderOf = (d, id) => d.ev((i) => window.__fpz.getState().orders.find((o) => o.id === i), id);
  const cartEmpty = (d) => d.ev(() => Object.values(window.__fpz.getState().clients || {}).every((c) => !c?.cart?.length));
  const endsOnOrder = (d, id) => d.until((i) => { const s = window.__fpz.getState(); return document.querySelector('.r-view[data-view=order]') && document.querySelector('.r-success') && document.querySelectorAll('.r-ticket').length > 0 && s.orders.find((o) => o.id === i)?.status === 'paid'; }, id, 25000);
  const R = (d) => d.page.locator('.ep-res');
  const quiet = (pg) => pg.waitForFunction(() => !document.querySelector('.fpz-toast'), null, { timeout: 8000 }).catch(() => {}); // zrzut bez dymków powiadomień

  // ── 1. aplikacja (telefon): zakup, zapłata z powiadomieniem ──
  const tel = await device('telefon', '/app', { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await boot(tel.page);
  const buyMobile = async () => {
    await tel.page.locator('.m-screen:not([hidden]) .fpz-chip', { hasText: 'Wydarzenia' }).first().click(); await tel.page.waitForTimeout(400);
    await tel.page.locator('.m-screen:not([hidden]) button', { hasText: 'Kup bilet' }).first().click(); await tel.page.waitForTimeout(700);
    await R(tel).locator('.r-prod').first().getByRole('button', { name: 'Dodaj do koszyka' }).click(); await tel.page.waitForTimeout(300);
    await R(tel).locator('.r-cartbar').getByRole('button').click(); await tel.page.waitForTimeout(300);
    await R(tel).getByRole('button', { name: 'Przejdź do kasy' }).click(); await tel.page.waitForTimeout(300);
  };
  await buyMobile();
  await R(tel).getByRole('button', { name: 'Zaloguj', exact: true }).click(); await tel.page.waitForTimeout(500);
  T('kasa: zalogowany użytkownik demo', await tel.ev(() => !!Object.values(window.__fpz.getState().clients).find((c) => c?.userId)));
  T('kasa (Tpay): brak listy metod płatności', await R(tel).locator('.r-methods, input[name=method]').count() === 0);
  T('kasa (Tpay): informacja, że metodę wybiera się u Tpay', /wybierzesz na stronie Tpay/.test(await R(tel).locator('.r-tpnote').innerText()));
  await R(tel).getByText('Akceptuję regulamin sprzedaży').click();
  await tel.page.screenshot({ path: 'shots/tpay-m-checkout.png' });
  await R(tel).getByRole('button', { name: /Zamawiam i płacę/ }).click(); await tel.page.waitForTimeout(400);
  const o1 = await lastOrder(tel);
  T('ekran płatności Tpay (bez symulowanej bramki)', await R(tel).locator('.r-tp').count() === 1 && await R(tel).locator('.r-gw').count() === 0);
  const intro = await R(tel).locator('.r-tp').innerText();
  T('ekran płatności: numer zamówienia, kwota, Tpay, metody na stronie Tpay', intro.includes(o1.no) && /Tpay/.test(intro) && /BLIK/.test(intro) && /zł/.test(intro), intro.slice(0, 300));
  T('ekran płatności: oznaczenie środowiska testowego', /bez prawdziwych pieniędzy/.test(intro) && /Środowisko testowe/.test(intro));
  await quiet(tel.page); await tel.page.screenshot({ path: 'shots/tpay-m-intro.png' });
  const pop1 = await opensTpay(tel, () => R(tel).getByRole('button', { name: 'Zapłać przez Tpay' }).click());
  T('nowa karta: strona płatności atrapy Tpay', /Atrapa strony płatności Tpay/.test(await pop1.locator('h1').innerText()));
  T('nowa karta bez dostępu do karty sklepu (opener = null)', await pop1.evaluate(() => window.opener === null));
  T('karta sklepu: stan oczekiwania z odnośnikiem do strony Tpay', await tel.until(() => !!document.querySelector('.r-tp__wait') && !!document.querySelector('[data-testid=r-tp-link]')));
  T('stan oczekiwania: komunikat w regionie statusu', /Czekamy na potwierdzenie/.test(await R(tel).locator('.r-tp__wait [role=status]').innerText()));
  T('fokus przeniesiony na komunikat oczekiwania', await tel.ev(() => document.activeElement?.closest('.r-tp__wait') != null));
  await tel.page.screenshot({ path: 'shots/tpay-m-wait.png' });
  await R(tel).locator('.r-tp > .r-actions').scrollIntoViewIfNeeded(); await tel.page.screenshot({ path: 'shots/tpay-m-wait-actions.png' });
  await pop1.locator('#ok').click();
  T('strona wyniku: „Płatność przyjęta”', /Płatność przyjęta/.test(await resultText(pop1)));
  T('aplikacja: ekran zamówienia z biletami, zamówienie opłacone', await endsOnOrder(tel, o1.id));
  T('aplikacja: koszyk pusty', await cartEmpty(tel));
  const o1p = await orderOf(tel, o1.id);
  T('zamówienie: płatność Tpay potwierdzona powiadomieniem', o1p.payment?.provider === 'tpay' && o1p.payment.confirmedBy === 'webhook', o1p.payment);
  const line1 = await R(tel).locator('.r-panel .r-prod__small').first().innerText();
  T('zamówienie: opis płatności z operatorem i tytułem transakcji Tpay', /Opłacone przez Tpay/.test(line1) && line1.includes(o1p.payment.title), line1);
  await tel.page.waitForTimeout(400); await tel.page.screenshot({ path: 'shots/tpay-m-order.png' });
  await pop1.close().catch(() => {});

  // ── 2. aplikacja: płatność odrzucona → ponowna próba → zapłata bez powiadomienia (potwierdzenie odpytywaniem) ──
  await R(tel).locator('.r-secnav__b', { hasText: 'Wydarzenia' }).click(); await tel.page.waitForTimeout(400);
  await R(tel).getByRole('button', { name: 'Kup bilet' }).first().click(); await tel.page.waitForTimeout(600);
  await R(tel).locator('.r-prod').first().getByRole('button', { name: 'Dodaj do koszyka' }).click(); await tel.page.waitForTimeout(300);
  await R(tel).locator('.r-cartbar').getByRole('button').click(); await tel.page.waitForTimeout(300);
  await R(tel).getByRole('button', { name: 'Przejdź do kasy' }).click(); await tel.page.waitForTimeout(300);
  await R(tel).getByText('Akceptuję regulamin sprzedaży').click();
  await R(tel).getByRole('button', { name: /Zamawiam i płacę/ }).click(); await tel.page.waitForTimeout(400);
  const o2 = await lastOrder(tel); T('drugie zamówienie oczekuje na płatność', o2.id !== o1.id && o2.status === 'pending');
  const pop2 = await opensTpay(tel, () => R(tel).getByRole('button', { name: 'Zapłać przez Tpay' }).click());
  const url2 = pop2.url();
  await pop2.locator('#fail').click();
  T('strona wyniku po odrzuceniu: „nie została dokończona”', /nie została dokończona/.test(await resultText(pop2)));
  await tel.page.bringToFront(); await tel.page.waitForTimeout(3800); // co najmniej jedno odpytanie stanu
  T('po odrzuceniu: karta sklepu nadal czeka, zamówienie oczekuje', await R(tel).locator('.r-tp__wait').count() === 1 && (await orderOf(tel, o2.id)).status === 'pending');
  await R(tel).getByRole('button', { name: 'Sprawdź teraz' }).click();
  T('„Sprawdź teraz”: informacja, że płatność nie jest potwierdzona', await tel.until(() => /nie jest potwierdzona/.test(document.querySelector('.r-tp')?.innerText || ''), null, 8000));
  await pop2.close().catch(() => {});
  const pop3 = await opensTpay(tel, () => R(tel).getByRole('button', { name: 'Spróbuj ponownie' }).click());
  T('ponowna próba: nowa transakcja Tpay', pop3.url() !== url2, [url2, pop3.url()]);
  T('odnośnik w karcie sklepu wskazuje nową transakcję', await tel.until((u) => document.querySelector('[data-testid=r-tp-link]')?.href === u, pop3.url(), 5000));
  await pop3.locator('#ok-nonotify').click();
  await pop3.waitForURL(/\/api\/pay\/return/, { timeout: 10000 }).catch(() => {});
  T('aplikacja: po zapłacie bez powiadomienia – ekran zamówienia z biletami', await endsOnOrder(tel, o2.id));
  const o2p = await orderOf(tel, o2.id);
  T('zamówienie potwierdzone zapytaniem do Tpay (bez powiadomienia)', o2p.payment?.confirmedBy === 'api', o2p.payment);
  T('aplikacja: koszyk pusty po drugim zakupie', await cartEmpty(tel));
  await pop3.close().catch(() => {});

  // ── 3. strona WWW: zakup i zapłata ──
  const www = await device('www', '/www', { width: 1320, height: 860 });
  await www.page.getByRole('button', { name: 'Tylko niezbędne' }).click({ timeout: 3000 }).catch(() => {}); // baner cookies
  await www.page.locator('a, button', { hasText: 'Wydarzenia' }).first().click(); await www.page.waitForTimeout(600);
  await R(www).getByRole('button', { name: 'Kup bilet' }).first().click(); await www.page.waitForTimeout(600);
  await R(www).locator('.r-prod').first().getByRole('button', { name: 'Dodaj do koszyka' }).click(); await www.page.waitForTimeout(300);
  await R(www).locator('.r-cartbtn').click(); await www.page.waitForTimeout(300);
  await R(www).getByRole('button', { name: 'Przejdź do kasy' }).first().click(); await www.page.waitForTimeout(300);
  await R(www).getByRole('button', { name: 'Zaloguj', exact: true }).click(); await www.page.waitForTimeout(500);
  T('WWW kasa (Tpay): brak listy metod', await R(www).locator('.r-methods').count() === 0 && await R(www).locator('.r-tpnote').count() === 1);
  await R(www).getByText('Akceptuję regulamin sprzedaży').click();
  await www.page.screenshot({ path: 'shots/tpay-w-checkout.png' });
  await R(www).getByRole('button', { name: /Zamawiam i płacę/ }).click(); await www.page.waitForTimeout(400);
  const o3 = await lastOrder(www);
  T('WWW: ekran płatności Tpay z oznaczeniem testowym', /bez prawdziwych pieniędzy/.test(await R(www).locator('.r-tp').innerText()));
  await quiet(www.page); await www.page.screenshot({ path: 'shots/tpay-w-intro.png' });
  await R(www).locator('.r-tp > .r-actions').scrollIntoViewIfNeeded(); await www.page.screenshot({ path: 'shots/tpay-w-intro-actions.png' });
  const pop4 = await opensTpay(www, () => R(www).getByRole('button', { name: 'Zapłać przez Tpay' }).click());
  await www.until(() => !!document.querySelector('.r-tp__wait')); await quiet(www.page); await www.page.screenshot({ path: 'shots/tpay-w-wait.png' });
  await R(www).locator('.r-tp > .r-actions').scrollIntoViewIfNeeded(); await www.page.screenshot({ path: 'shots/tpay-w-wait-actions.png' });
  await pop4.locator('#ok').click();
  T('WWW: strona wyniku „Płatność przyjęta”', /Płatność przyjęta/.test(await resultText(pop4)));
  T('WWW: ekran zamówienia z biletami, zamówienie opłacone', await endsOnOrder(www, o3.id));
  T('WWW: koszyk pusty', await cartEmpty(www));
  await www.page.waitForTimeout(400); await www.page.screenshot({ path: 'shots/tpay-w-order.png' });
  await pop4.close().catch(() => {});

  // ── 4. powrót później do rozpoczętej płatności ──
  await R(www).locator('.r-secnav__b', { hasText: 'Wydarzenia' }).click(); await www.page.waitForTimeout(400);
  await R(www).getByRole('button', { name: 'Kup bilet' }).first().click(); await www.page.waitForTimeout(600);
  await R(www).locator('.r-prod').first().getByRole('button', { name: 'Dodaj do koszyka' }).click(); await www.page.waitForTimeout(300);
  await R(www).locator('.r-cartbtn').click(); await www.page.waitForTimeout(300);
  await R(www).getByRole('button', { name: 'Przejdź do kasy' }).first().click(); await www.page.waitForTimeout(300);
  await R(www).getByText('Akceptuję regulamin sprzedaży').click();
  await R(www).getByRole('button', { name: /Zamawiam i płacę/ }).click(); await www.page.waitForTimeout(400);
  const o4 = await lastOrder(www);
  await www.ev(() => { window.open = () => null; }); // przeglądarka blokuje nowe okno
  await R(www).getByRole('button', { name: 'Zapłać przez Tpay' }).click();
  T('zablokowana nowa karta: komunikat i przycisk-odnośnik do strony Tpay', await www.until(() => /nie otworzyła nowej karty/.test(document.querySelector('.r-tp')?.innerText || '') && !!document.querySelector('a[data-testid=r-tp-link].fpz-btn--primary[target=_blank]')));
  await www.page.screenshot({ path: 'shots/tpay-w-blocked.png' });
  const pop5 = await opensTpay(www, () => R(www).locator('[data-testid=r-tp-link]').click()); const url5 = pop5.url();
  await pop5.close(); // płacący zamknął stronę Tpay bez płacenia
  await www.until((i) => window.__fpz.getState().orders.find((o) => o.id === i)?.payment?.pending === true, o4.id, 10000);
  const ver = await www.ev(() => window.__fpz.getState().net.version);
  await www.page.reload(); await www.page.waitForFunction((v) => { const n = window.__fpz?.getState().net; return n?.status === 'online' && n.pay?.provider === 'tpay' && n.pending === 0 && n.version >= v; }, ver, { timeout: 15000 });
  await www.page.locator('a, button', { hasText: 'Wydarzenia' }).first().click(); await www.page.waitForTimeout(500);
  await R(www).locator('.r-secnav__b', { hasText: 'Moje bilety' }).click(); await www.page.waitForTimeout(300);
  await R(www).getByRole('tab', { name: /Zamówienia/ }).click(); await www.page.waitForTimeout(300);
  await R(www).locator('.r-orow', { hasText: o4.no }).click(); await www.page.waitForTimeout(300);
  T('zamówienie w toku: opis „Płatność rozpoczęta w Tpay”', /Płatność rozpoczęta w Tpay/.test(await R(www).locator('.r-panel').first().innerText()));
  await R(www).getByRole('button', { name: 'Dokończ płatność' }).click(); await www.page.waitForTimeout(300);
  T('powrót później: od razu stan oczekiwania', await R(www).locator('.r-tp__wait').count() === 1 && await R(www).getByRole('button', { name: 'Zapłać przez Tpay' }).count() === 0);
  const href = await R(www).locator('[data-testid=r-tp-link]').getAttribute('href');
  T('powrót później: odnośnik do rozpoczętej transakcji (nowa karta, noopener)', href === url5 && await R(www).locator('[data-testid=r-tp-link]').getAttribute('target') === '_blank' && /noopener/.test(await R(www).locator('[data-testid=r-tp-link]').getAttribute('rel')), href);
  await www.page.screenshot({ path: 'shots/tpay-w-resume.png' });
  const pop6 = await opensTpay(www, () => R(www).locator('[data-testid=r-tp-link]').click());
  T('odnośnik otwiera tę samą transakcję', pop6.url() === url5);
  await pop6.locator('#ok').click(); await resultText(pop6).catch(() => '');
  T('powrót później: po zapłacie ekran zamówienia z biletami', await endsOnOrder(www, o4.id));
  await pop6.close().catch(() => {});

  // ── 5. CMS: informacja, którego operatora używa serwer ──
  const cms = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  cms.on('pageerror', (e) => errors.push('[cms] pageerror: ' + e.message)); cms.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('[cms] console.error: ' + m.text().slice(0, 300)); });
  await cms.goto(base + '/cms'); await cms.waitForFunction(() => window.__fpz?.getState().net.pay?.provider === 'tpay', null, { timeout: 15000 });
  await cms.locator('[data-testid=c-login-submit]').click(); await cms.waitForTimeout(400);
  await cms.locator('.c-side__it', { hasText: 'Ustawienia' }).click(); await cms.waitForTimeout(300);
  await cms.getByRole('button', { name: 'Płatności', exact: true }).first().click(); await cms.waitForTimeout(300);
  const cmsText = await cms.locator('.c-page').innerText();
  T('CMS: „Operator na serwerze: Tpay” i informacja o wyborze metody u Tpay', /Operator na serwerze: Tpay/.test(cmsText) && /na stronie Tpay/.test(cmsText), cmsText.slice(0, 300));
  await cms.screenshot({ path: 'shots/tpay-cms.png' });

  T('bez błędów konsoli i stron', errors.length === 0, errors);
} catch (e) {
  fails++; console.log('✗ WYJĄTEK:', e?.stack || e);
} finally {
  await browser?.close().catch(() => {});
  stop(); fs.rmSync('.tmp-tpay-ui', { recursive: true, force: true });
}
if (errors.length) console.log(errors.join('\n'));
console.log(fails ? `NIEPOWODZENIA: ${fails}` : 'Wszystkie testy przeszły.');
process.exit(fails ? 1 : 0);
