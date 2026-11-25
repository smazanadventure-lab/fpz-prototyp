// Test płatności Tpay na poziomie serwera (bez przeglądarki): serwer systemu + atrapa Tpay (tools/tpay-mock.mjs).
//   node build.mjs --target=netlify && node test/srv-tpay.mjs
// Sprawdza: utworzenie transakcji, odrzucenie podrobionych powiadomień, rozliczenie po podpisanym powiadomieniu,
// zapasowe potwierdzenie przez API (gdy powiadomienie nie dotrze), blokadę płatności symulowanej, zwrot z panelu operatora.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 8791, MOCK = 9911; const base = `http://localhost:${PORT}`, mock = `http://localhost:${MOCK}`;
let fails = 0; const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : JSON.stringify(extra ?? '')); };
const procs = []; const run = (args, env) => { const p = spawn('node', args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d)); procs.push(p); p.log = () => out; return p; };
const stop = () => procs.forEach((p) => { try { p.kill('SIGTERM'); } catch { /* nic */ } });
const waitFor = async (url, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* jeszcze nie */ } await new Promise((r) => setTimeout(r, 200)); } return false; };
const j = async (url, init) => { const r = await fetch(url, init); const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; } return { status: r.status, body: b }; };
let n = 0; const rpc = (ops, role) => j(base + '/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: 'tel-1', role, ops: ops.map((o) => ({ nonce: 'tp' + Date.now() + (n++), clientId: 'mobile', ...o })) }) }).then((r) => r.body);
const state = async () => (await j(base + '/api/sync?since=0&device=tel-1')).body;

fs.rmSync('.tmp-tpay', { recursive: true, force: true });
const mockProc = run(['tools/tpay-mock.mjs', `--port=${MOCK}`]);
const TP = { TPAY_ENV: 'mock', TPAY_API_URL: mock, TPAY_SECURE_URL: mock, TPAY_CLIENT_ID: 'test-id', TPAY_CLIENT_SECRET: 'test-secret', TPAY_SECURITY_CODE: 'kod123', TPAY_MERCHANT_ID: '4010' };
const srv = run(['tools/dev-server.mjs', `--port=${PORT}`, '--fresh', '--data=.tmp-tpay'], TP);
try {
  if (!(await waitFor(mock + '/__log')) || !(await waitFor(base + '/api/info'))) { console.log(mockProc.log(), srv.log()); throw new Error('serwery testowe nie wystartowały'); }
  const info = (await j(base + '/api/info')).body; T('serwer zgłasza Tpay jako operatora płatności', info.payments?.provider === 'tpay' && info.payments.env === 'mock', info.payments);
  const chk = (await j(base + '/api/pay/check')).body; T('klucze przyjęte przez operatora (pay/check)', chk.ok && chk.auth === 'ok' && chk.md5 === true, chk);
  const s0 = await state(); T('synchronizacja niesie informację o operatorze', s0.pay?.provider === 'tpay', s0.pay);
  const user = s0.keys.users[0]; const prod = s0.keys.products.find((p) => p.active !== false && p.price > 0 && !p.eventId) || s0.keys.products.find((p) => p.price > 0);
  const client = { userId: user.id, cart: [{ productId: prod.id, qty: 2 }] };
  const order = async () => { const r = await rpc([{ op: 'booking.checkout', args: [], client }]); if (!r.results?.[0]?.ok) throw new Error('checkout: ' + JSON.stringify(r.results)); const s = await state(); return s.keys.orders.filter((o) => o.userId === user.id && o.status === 'pending').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]; };
  const orderOf = async (id) => (await state()).keys.orders.find((o) => o.id === id);
  const ticketsOf = async (id) => (await state()).keys.tickets.filter((t) => t.orderId === id);
  const start = (orderId, extra) => j(base + '/api/pay/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId, lang: 'pl', ...extra }) });
  const txOf = (url) => url.split('/pay/')[1];

  // 1. zamówienie → transakcja
  const o1 = await order(); T('zamówienie oczekuje na płatność', o1 && o1.status === 'pending' && o1.total === prod.price * 2, o1);
  const sim = await rpc([{ op: 'booking.pay', args: [o1.id, { method: 'blik', outcome: 'success' }], client }]);
  T('płatność symulowana jest zablokowana, gdy działa Tpay', sim.results?.[0]?.ok === false && sim.results[0].error === 'PAYMENT_EXTERNAL' && (await orderOf(o1.id)).status === 'pending', sim.results);
  const st1 = await start(o1.id); T('start płatności zwraca adres strony operatora', st1.status === 200 && st1.body.ok && st1.body.url.startsWith(mock + '/pay/'), st1);
  const st1b = await start(o1.id); T('ponowny start wraca do tej samej transakcji', st1b.body.ok && st1b.body.url === st1.body.url && st1b.body.reused === true, st1b.body);
  const log1 = (await j(mock + '/__log')).body.txs.find((t) => t.id === txOf(st1.body.url));
  T('transakcja ma kwotę, identyfikator zamówienia, płacącego i adresy zwrotne', log1 && log1.amount === o1.total && log1.hidden === o1.id && log1.payer.email === user.email && log1.notifyUrl === base + '/api/pay/notify' && log1.successUrl.startsWith(base + '/api/pay/return?z=' + o1.id), log1);
  const p1 = (await orderOf(o1.id)).payment; T('zamówienie pamięta transakcję (operator, numer, w toku)', p1?.provider === 'tpay' && p1.txId === txOf(st1.body.url) && p1.pending === true, p1);
  T('stan przed zapłatą: oczekuje', (await j(base + '/api/pay/status?z=' + o1.id)).body.status === 'pending');

  // 2. podrobione powiadomienia – żadne nie może rozliczyć zamówienia
  const forged = async (label, query, want) => { const r = (await j(`${mock}/pay/${txOf(st1.body.url)}/ok?${query}`)).body; T(`odrzucone: ${label}`, r.notify?.status === want && /^FALSE/.test(r.notify.text) && (await orderOf(o1.id)).status === 'pending', r.notify); };
  await forged('podpis nie pasuje do treści', 'badsig=1', 403);
  await forged('treść zmieniona po podpisaniu', 'tamper=1', 403);
  await forged('certyfikat spoza łańcucha operatora', 'evil=1', 403);
  await forged('certyfikat spoza domeny operatora', 'x5u=' + encodeURIComponent('http://localhost:1/x509/notifications-jws.pem'), 403);
  await forged('kwota inna niż w zamówieniu', 'amount=1.00', 400);
  await forged('zła suma kontrolna md5', 'badcode=1', 400);
  const nosig = await j(base + '/api/pay/notify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ tr_crc: o1.id, tr_status: 'TRUE', tr_amount: String(o1.total), tr_paid: String(o1.total) }).toString() });
  T('odrzucone: powiadomienie bez podpisu', nosig.status === 403 && (await orderOf(o1.id)).status === 'pending' && (await ticketsOf(o1.id)).length === 0, nosig);

  // 3. prawdziwa zapłata: podpisane powiadomienie → bilety
  const pay1 = (await j(`${mock}/pay/${txOf(st1.body.url)}/ok?json=1`)).body; T('operator dostał odpowiedź TRUE na powiadomienie', pay1.notify?.status === 200 && pay1.notify.text === 'TRUE', pay1);
  const o1p = await orderOf(o1.id); const t1 = await ticketsOf(o1.id);
  T('zamówienie opłacone po powiadomieniu', o1p.status === 'paid' && o1p.payment.provider === 'tpay' && o1p.payment.confirmedBy === 'webhook' && o1p.payment.pending === false, o1p.payment);
  T('bilety wydane (2 szt.)', t1.length >= 2 && t1.every((t) => t.status === 'valid' && t.code), t1.length);
  const again = (await j(`${mock}/renotify/${txOf(st1.body.url)}`)).body; T('powtórzone powiadomienie nie wydaje biletów drugi raz', again.notify?.text === 'TRUE' && (await ticketsOf(o1.id)).length === t1.length, again);
  T('stan po zapłacie: opłacone', (await j(base + '/api/pay/status?z=' + o1.id)).body.status === 'paid');
  const stPaid = await start(o1.id); T('start dla opłaconego zamówienia nie tworzy transakcji', stPaid.body.ok && stPaid.body.paid === true && !stPaid.body.url, stPaid.body);
  const mail = (await state()).keys.outbox?.find((m) => m.subject?.includes(o1.no)); T('wiadomość z biletami w skrzynce nadawczej', !!mail || (await state()).keys.outbox === undefined, mail);

  // 4. powiadomienie nie dotarło → potwierdzenie przez API przy powrocie płacącego
  const o2 = await order(); const st2 = await start(o2.id); await j(`${mock}/pay/${txOf(st2.body.url)}/ok?nonotify=1&json=1`);
  T('bez powiadomienia zamówienie jeszcze czeka', (await orderOf(o2.id)).status === 'pending');
  const ret = await fetch(`${base}/api/pay/return?z=${o2.id}&w=ok&l=pl`); const html = await ret.text();
  T('strona powrotu potwierdza płatność', ret.status === 200 && /Płatność przyjęta/.test(html) && html.includes(o2.no), html.slice(0, 200));
  const o2p = await orderOf(o2.id); T('zamówienie rozliczone po sprawdzeniu u operatora', o2p.status === 'paid' && o2p.payment.confirmedBy === 'api' && (await ticketsOf(o2.id)).length >= 2, o2p.payment);

  // 5. płatność odrzucona → nowa próba to nowa transakcja; odpytywanie stanu też potwierdza
  const o3 = await order(); const st3 = await start(o3.id);
  const fail = await fetch(`${mock}/pay/${txOf(st3.body.url)}/fail`); const failHtml = await fail.text();
  T('strona powrotu po odrzuceniu', /nie została dokończona/.test(failHtml) && (await orderOf(o3.id)).status === 'pending', failHtml.slice(0, 160));
  const st3b = await start(o3.id, { fresh: true }); T('ponowna próba tworzy nową transakcję', st3b.body.ok && st3b.body.url !== st3.body.url, st3b.body);
  await j(`${mock}/pay/${txOf(st3b.body.url)}/ok?nonotify=1&json=1`); let poll = null; for (let i = 0; i < 5 && poll?.status !== 'paid'; i++) { await new Promise((r) => setTimeout(r, 1500)); poll = (await j(base + '/api/pay/status?z=' + o3.id)).body; } // klient pyta co kilka sekund; serwer dopytuje operatora nie częściej niż co 4 s
  T('odpytywanie stanu potwierdza zapłatę (bez powiadomienia)', poll.status === 'paid' && (await orderOf(o3.id)).payment.confirmedBy === 'api', poll);

  // 6. anulowane w aplikacji, ale zapłacone u operatora → bilety wydajemy
  const o4 = await order(); const st4 = await start(o4.id); await rpc([{ op: 'booking.cancel', args: [o4.id], client }]);
  T('zamówienie anulowane w aplikacji', (await orderOf(o4.id)).status === 'cancelled');
  await j(`${mock}/pay/${txOf(st4.body.url)}/ok?json=1`); const o4p = await orderOf(o4.id);
  T('zapłata po anulowaniu: pieniądze wpłynęły, więc bilety są wydane', o4p.status === 'paid' && o4p.payment.paidAfterCancel === true && (await ticketsOf(o4.id)).length >= 2, o4p.payment);

  // 7. zwrot wykonany w panelu operatora
  const rf = (await j(`${mock}/renotify/${txOf(st1.body.url)}?status=CHARGEBACK`)).body; const o1r = await orderOf(o1.id);
  T('zwrot z panelu operatora unieważnia bilety', rf.notify?.text === 'TRUE' && o1r.status === 'refunded' && (await ticketsOf(o1.id)).every((t) => t.status === 'refunded'), o1r.status);

  // 8. aplikacja dla zwiedzających (role=app) widzi operatora, nieznane zamówienie → błąd
  T('aplikacja dla zwiedzających dostaje informację o operatorze', (await j(base + '/api/sync?since=0&device=tel-2&role=app')).body.pay?.provider === 'tpay');
  T('nieznane zamówienie', (await start('ord-nie-ma-takiego')).status === 404 && (await j(base + '/api/pay/status?z=ord-nie-ma')).status === 404);
  const mockLog = (await j(mock + '/__log')).body.log; T('wszystkie poprawne powiadomienia przyjęte (TRUE)', mockLog.filter((l) => l.text === 'TRUE').length >= 4, mockLog.map((l) => l.status));

  // 9. bez kluczy Tpay serwer zostaje przy płatności symulowanej
  srv.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 500));
  const srv2 = run(['tools/dev-server.mjs', `--port=${PORT}`, '--fresh', '--data=.tmp-tpay'], { TPAY_CLIENT_ID: '', TPAY_CLIENT_SECRET: '' }); await waitFor(base + '/api/info');
  const info2 = (await j(base + '/api/info')).body; T('bez kluczy: płatność symulowana', info2.payments?.provider === 'symulacja' && (await state()).pay === null, info2.payments);
  const o5 = await order(); T('bez kluczy: start płatności Tpay niedostępny', (await start(o5.id)).body.error === 'PAYMENTS_SIMULATED');
  const sim2 = await rpc([{ op: 'booking.pay', args: [o5.id, { method: 'blik', outcome: 'success' }], client }]); T('bez kluczy: płatność symulowana działa jak dotąd', sim2.results?.[0]?.ok === true && (await orderOf(o5.id)).status === 'paid', sim2.results);
  T('bez kluczy: powiadomienie odrzucone (404)', (await j(base + '/api/pay/notify', { method: 'POST', body: 'x=1' })).status === 404);
  void srv2;
} catch (e) { fails++; console.log('✗ BŁĄD TESTU:', e.stack || e); console.log(srv.log().slice(-1500)); }
finally { stop(); fs.rmSync('.tmp-tpay', { recursive: true, force: true }); }
console.log(fails ? `\n✗ NIEPOWODZENIA: ${fails}` : '\n✓ wszystkie sprawdzenia zaliczone'); process.exit(fails ? 1 : 0);
