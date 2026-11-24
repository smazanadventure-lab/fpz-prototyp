// Test współbieżności API (bez przeglądarki): równoczesne operacje z wielu urządzeń nie mogą się nadpisywać.
//   node tools/dev-server.mjs --fresh [--blobs] &   →   node test/srv-race.mjs
const base = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:8787').slice(7);
let fails = 0; const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? '')); };
const rpc = async (deviceId, ops, extra = {}) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId, since: 1e9, epoch: 'x', ...extra, ops }) })).json();
const sync = async (q = '') => (await fetch(base + '/api/sync?device=t' + q)).json();
const N = () => 'n' + Math.random().toString(36).slice(2) + Date.now().toString(36);
await fetch(base + '/api/reset', { method: 'POST' });
const s = (await sync()).keys; const ev = s.events.find((x) => x.ticketed && x.end > new Date().toISOString().slice(0, 16)); const prod = s.products.find((x) => x.eventId === ev.id); const user = s.users[0];
// zakup 1 biletu (sesja i koszyk przekazywane w migawce klienta – jak z aplikacji)
const cl0 = { lang: 'pl', userId: user.id, cart: [{ productId: prod.id, qty: 1 }] };
const co = await rpc('dev-a', [{ op: 'booking.checkout', args: [], nonce: N(), clientId: 'mobile', client: cl0 }]);
T('zamówienie', co.results[0].ok, JSON.stringify(co.results));
const order = (await sync()).keys.orders.find((o) => o.userId === user.id && o.status !== 'paid' && o.status !== 'cancelled') || (await sync()).keys.orders.at(-1);
const pay = await rpc('dev-a', [{ op: 'booking.pay', args: [order.id, { method: 'blik' }], nonce: N(), clientId: 'mobile', client: { lang: 'pl', userId: user.id, cart: [] } }]);
T('płatność', pay.results[0].ok, JSON.stringify(pay.results));
const st = (await sync()).keys; const ticket = st.tickets.find((t) => t.orderId === order.id); const staff = st.staff.find((x) => x.login === 'bileter');
T('bilet wystawiony', !!ticket);
// 8 bileterów waliduje ten sam bilet dokładnie w tej samej chwili
const res = await Promise.all(Array.from({ length: 8 }, (_, i) => rpc('gate-' + i, [{ op: 'tickets.validate', args: ['FPZ:T:' + ticket.code], nonce: N(), clientId: 'validator', client: { lang: 'pl', staffId: staff.id, cart: [] } }])));
const oks = res.filter((r) => r.results?.[0]?.ok).length;
T('równoczesna walidacja: dokładnie jedna przyjęta', oks === 1, 'przyjęte: ' + oks + ' ' + JSON.stringify(res.map((r) => r.results?.[0]?.ok ?? r.error)));
// 12 urządzeń równocześnie zgłasza pomysł – żaden nie może zginąć
const before = (await sync()).keys.ideas.length; const cat = st.ideaCategories[0].id;
const ideas = await Promise.all(Array.from({ length: 12 }, (_, i) => rpc('idea-' + i, [{ op: 'game.submitIdea', args: [{ categoryId: cat, title: 'Pomysł ' + i, text: 'Treść pomysłu numer ' + i + ' – test równoczesnych zapisów.', nick: 'tester' + i }], nonce: N(), clientId: 'mobile', client: { lang: 'pl', cart: [] } }])));
const after = (await sync()).keys.ideas.length; const okIdeas = ideas.filter((r) => r.results?.[0]?.ok).length;
T('równoczesne zapisy: nic nie ginie', okIdeas > 0 && after - before === okIdeas, `przyjęte ${okIdeas}, przybyło ${after - before}; ${JSON.stringify(ideas.find((r) => !r.results?.[0]?.ok) || '')}`.slice(0, 300));
// to samo żądanie wysłane dwa razy (ponowienie po utracie odpowiedzi) wykonuje się raz
const nonce = N(); const op = [{ op: 'game.submitIdea', args: [{ categoryId: cat, title: 'Duplikat', text: 'Ta sama operacja wysłana dwukrotnie.', nick: 'x' }], nonce, clientId: 'mobile', client: { lang: 'pl', cart: [] } }];
const b0 = (await sync()).keys.ideas.length; const d1 = await rpc('dup', op); const d2 = await rpc('dup', op); const b1 = (await sync()).keys.ideas.length;
T('ponowienie tej samej operacji nie dubluje danych', d1.results[0].ok && d2.results[0].duplicate === true && b1 - b0 === 1, JSON.stringify([d1.results, d2.results, b1 - b0]));
console.log(fails ? `\nNIEPOWODZENIA: ${fails}` : '\nTest współbieżności zaliczony.'); process.exit(fails ? 1 : 0);
