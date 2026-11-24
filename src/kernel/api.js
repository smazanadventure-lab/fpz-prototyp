// Symulowana warstwa backend: API domenowe wspólne dla wszystkich końcówek.
// - sel.*  : odczyty (czyste funkcje na stanie, bez logowania)
// - makeApi(clientId).* : operacje zmieniające stan – każda trafia do dziennika API (state.apiLog)
// Operacje zwracają { ok: true, … } albo { ok: false, error: 'KOD', message: {pl,en} }.
import { getState, update } from './store.js';
import { uid, code, byId, sum, distanceM, localIso, nowIso, matches, deepClone, clamp, pad2, withIdSeed, newNonce, warsawNow } from './util.js';

const L = (pl, en) => ({ pl, en });
const fail = (error, pl, en) => ({ ok: false, error, message: L(pl, en) });
const ok = (data = {}) => ({ ok: true, ...data });

export const ROLES = globalThis.FPZ_APP_ONLY ? {} : {
  admin: { name: 'Administrator', perms: ['*'] },
  editor: { name: 'Redaktor', perms: ['content.view', 'content.edit', 'content.submit', 'media', 'translations', 'game.edit', 'offer.edit', 'triggers', 'stats'] },
  moderator: { name: 'Moderator', perms: ['content.view', 'ugc.moderate', 'inquiries', 'stats'] },
  cashier: { name: 'Kasa / bileter', perms: ['tickets.validate', 'orders.view', 'orders.refund', 'inquiries'] },
  technician: { name: 'Służby techniczne', perms: ['devices', 'playlists', 'schedules', 'incidents', 'stats'] },
};
export const SLA = { P1: { reactH: 1, fixH: 12, label: 'krytyczny' }, P2: { reactH: 4, fixH: 24, label: 'wysoki' }, P3: { reactH: 24, fixH: 120, label: 'średni' }, P4: { reactH: null, fixH: 480, label: 'niski' } };
export const DIFFICULTY = { easy: 0.8, medium: 1, hard: 1.25 };
export const LEVEL_W = { easy: 1, medium: 1.5, hard: 2 };
export const CLIENT_DEFAULTS = { lang: 'pl', theme: 'light', contrast: 'normal', fs: 1, userId: null, staffId: null, cart: [], lector: false };

export function ensureClient(s, id, defaults) {
  if (!s.clients[id]) s.clients[id] = { ...deepClone(CLIENT_DEFAULTS), lang: s.settings.defaultLang, ...(defaults || {}) };
  return s.clients[id];
}
const inWindow = (hhmm, from, to) => (from <= to ? hhmm >= from && hhmm < to : hhmm >= from || hhmm < to);

/* ───────────────────────────── ODCZYTY ───────────────────────────── */
export const sel = {
  // treści
  category: (id) => byId(getState().categories, id),
  categoryTree() { const c = getState().categories; return c.filter((x) => !x.parentId).sort((a, b) => a.order - b.order).map((x) => ({ ...x, children: c.filter((y) => y.parentId === x.id).sort((a, b) => a.order - b.order) })); },
  categoryIds(id) { return [id, ...getState().categories.filter((c) => c.parentId === id).map((c) => c.id)]; },
  entry: (id) => byId(getState().entries, id),
  /** Wpisy: { categoryId (z podkategoriami), channel: 'mobile'|'web'|'kiosk', poiId, eraId, districtId, q, featured, all (także nieopublikowane) } */
  entries(f = {}) {
    const ids = f.categoryId ? sel.categoryIds(f.categoryId) : null;
    return getState().entries.filter((e) => (f.all || e.status === 'published') && (!ids || ids.includes(e.categoryId)) && (!f.channel || (e.channels || []).includes(f.channel))
      && (!f.poiId || e.poiId === f.poiId) && (!f.eraId || e.eraId === f.eraId) && (!f.districtId || e.districtId === f.districtId) && (!f.featured || e.featured)
      && (!f.q || matches(f.q, e.title.pl, e.title.en, e.lead.pl, e.lead.en, (e.tags || []).join(' '))));
  },
  poi: (id) => byId(getState().pois, id),
  pois(f = {}) { return getState().pois.filter((p) => p.active !== false && (!f.scope || p.scope === f.scope) && (!f.kind || [].concat(f.kind).includes(p.kind)) && (!f.accessible || p.accessible) && (!f.q || matches(f.q, p.name.pl, p.name.en, (p.tags || []).join(' ')))); },
  news: () => getState().news.filter((n) => n.status !== 'draft').slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
  // oferta i rezerwacje
  venue: (id) => byId(getState().venues, id),
  event: (id) => byId(getState().events, id),
  /** Wydarzenia posortowane od najbliższego; { category, poiId, includePast } */
  events(f = {}) { const now = localIso(new Date(Date.now() - 3 * 3600e3)); return getState().events.filter((e) => e.active !== false && (f.includePast || e.end >= now) && (!f.category || e.category === f.category) && (!f.poiId || e.poiId === f.poiId) && (!f.ticketed || e.ticketed)).slice().sort((a, b) => (a.start < b.start ? -1 : 1)); },
  product: (id) => byId(getState().products, id),
  productsFor: (eventId) => getState().products.filter((p) => p.active !== false && p.eventId === eventId),
  zoneProducts: () => getState().products.filter((p) => p.active !== false && p.kind === 'zone'),
  packages: () => getState().products.filter((p) => p.active !== false && p.kind === 'package'),
  remaining(eventId) { const e = sel.event(eventId); return e ? Math.max(0, (e.capacity || 0) - (e.sold || 0)) : Infinity; },
  user: (id) => byId(getState().users, id),
  session: (client) => (client?.userId ? byId(getState().users, client.userId) : null),
  cart(client) {
    const items = (client?.cart || []).map((it) => { const p = sel.product(it.productId); return p ? { ...it, product: p, event: p.eventId ? sel.event(p.eventId) : null, lineTotal: p.price * it.qty } : null; }).filter(Boolean);
    return { items, count: sum(items, (i) => i.qty), total: sum(items, (i) => i.lineTotal) };
  },
  ordersOf: (userId) => getState().orders.filter((o) => o.userId === userId).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  order: (id) => byId(getState().orders, id),
  ticketsOf: (userId) => getState().tickets.filter((t) => t.userId === userId),
  ticketsOfOrder: (orderId) => getState().tickets.filter((t) => t.orderId === orderId),
  ticketPayload: (t) => `FPZ:T:${t.code}`,
  inquiriesOf: (userId) => getState().inquiries.filter((i) => i.userId === userId).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  /** Czy zamówienie można zwrócić samodzielnie (regulamin: do N godzin przed wydarzeniem, bilety niewykorzystane). */
  refundInfo(order) {
    if (!order || order.status !== 'paid') return { ok: false, reason: L('Zwrot możliwy tylko dla opłaconych zamówień.', 'Only paid orders can be refunded.') };
    if (sel.ticketsOfOrder(order.id).some((t) => t.status === 'used')) return { ok: false, reason: L('Co najmniej jeden bilet został już wykorzystany.', 'At least one ticket has already been used.') };
    for (const it of order.items) { const p = sel.product(it.productId); const e = it.eventId && sel.event(it.eventId); if (e) { const limit = new Date(e.start).getTime() - (p?.refundableHours ?? 24) * 3600e3; if (Date.now() > limit) return { ok: false, reason: L(`Termin zwrotu minął (${p?.refundableHours ?? 24} godz. przed wydarzeniem).`, `The refund deadline has passed (${p?.refundableHours ?? 24} h before the event).`) }; } }
    return { ok: true, reason: L('Zwrot środków tą samą metodą płatności w ciągu 3 dni roboczych.', 'Refund to the original payment method within 3 working days.') };
  },
  // wyzwalacze QR / BLE / AR
  trigger: (id) => byId(getState().triggers, id),
  triggerByCode: (c) => getState().triggers.find((t) => t.code.toLowerCase() === String(c || '').trim().toLowerCase()) || null,
  triggersFor: (type, id) => getState().triggers.filter((t) => t.active !== false && t.target?.type === type && t.target.id === id),
  qrPayload: (t) => `https://app.fpz.example/q/${t.code}`,
  /** Beacony BLE w otoczeniu symulowanej pozycji: [{ trigger, poi, distanceM, inRange }] posortowane wg odległości. */
  nearbyBeacons(maxM = 400) {
    const s = getState(); const pos = s.env.position;
    return s.triggers.filter((t) => t.kind === 'ble' && t.active !== false).map((t) => { const poi = sel.poi(t.poiId); const d = poi ? distanceM(pos, poi) : Infinity; return { trigger: t, poi, distanceM: d, inRange: d <= (t.ble?.rangeM || 20) }; })
      .filter((x) => x.distanceM <= maxM).sort((a, b) => a.distanceM - b.distanceM);
  },
  /** Punkty AR dostępne w miejscu, w którym stoi zwiedzający. */
  arHere() { const s = getState(); return s.triggers.filter((t) => t.kind === 'ar' && t.active !== false).filter((t) => { const poi = sel.poi(t.poiId); return poi && distanceM(s.env.position, poi) <= 60; }); },
  distanceTo(poiOrId) { const p = typeof poiOrId === 'string' ? sel.poi(poiOrId) : poiOrId; return p ? distanceM(getState().env.position, p) : Infinity; },
  nearestPoi(scope) { const s = getState(); let best = null, bd = Infinity; for (const p of s.pois) { if (scope && p.scope !== scope) continue; const d = distanceM(s.env.position, p); if (d < bd) { bd = d; best = p; } } return best ? { poi: best, distanceM: bd } : null; },
  // gra terenowa
  route: (id) => byId(getState().gameRoutes, id),
  mission(id) { for (const r of getState().gameRoutes) { const m = byId(r.missions, id); if (m) return m; } return null; },
  routeOfMission(id) { return getState().gameRoutes.find((r) => r.missions.some((m) => m.id === id)) || null; },
  quiz: (id) => byId(getState().quizzes, id),
  /** Misje trasy z uwzględnieniem wybranej długości (trasa przyrodnicza) i trybu „dostępna”. */
  routeMissions(routeId, opts) {
    const r = sel.route(routeId); if (!r) return [];
    const o = opts || (getState().player.activeRoute?.routeId === routeId ? getState().player.activeRoute : {});
    let ms = r.missions.filter((m) => m.active !== false);
    const len = o.length && (r.lengths || []).find((l) => l.id === o.length); if (len) ms = len.missionIds.map((id) => byId(ms, id)).filter(Boolean);
    if (o.mode === 'access') ms = ms.filter((m) => m.accessible);
    return ms;
  },
  routeProgress(routeId, opts) { const ms = sel.routeMissions(routeId, opts); const done = getState().player.done; const d = ms.filter((m) => done[m.id]); return { total: ms.length, done: d.length, percent: ms.length ? Math.round((d.length / ms.length) * 100) : 0, points: sum(d, (m) => done[m.id].points), complete: ms.length > 0 && d.length === ms.length }; },
  /** Czy misję można teraz zaliczyć w symulowanym otoczeniu: { ok, need: 'qr'|'ble'|'ar'|'gps', trigger, distanceM } */
  missionCheck(mission) {
    const s = getState(); const poi = sel.poi(mission.poiId); const d = poi ? distanceM(s.env.position, poi) : Infinity;
    const trig = (k) => s.triggers.find((t) => t.kind === k && t.active !== false && t.target?.type === 'mission' && t.target.id === mission.id) || s.triggers.find((t) => t.kind === k && t.active !== false && t.target?.type === 'poi' && t.target.id === mission.poiId) || null;
    if (s.player.done[mission.id]) return { ok: false, done: true, need: null, distanceM: d };
    if (mission.kind === 'qr') { const t = trig('qr'); const inView = !!s.env.qrInView && !!t && (s.env.qrInView === t.code || s.triggers.some((x) => x.code === s.env.qrInView && ((x.target?.type === 'mission' && x.target.id === mission.id) || (x.target?.type === 'poi' && x.target.id === mission.poiId)))); return { ok: inView, need: 'qr', trigger: t, distanceM: d }; }
    if (mission.kind === 'ble') { const t = trig('ble'); return { ok: !!t && d <= (t.ble?.rangeM || 20), need: 'ble', trigger: t, distanceM: d }; }
    if (mission.kind === 'ar') { const t = trig('ar'); return { ok: d <= (mission.radiusM || 40), need: 'ar', trigger: t, distanceM: d }; }
    return { ok: d <= (mission.radiusM || 40), need: 'gps', trigger: null, distanceM: d };
  },
  pointsEarned() { const p = getState().player; return sum(Object.values(p.done), (x) => x.points) + sum(Object.values(p.quiz), (x) => x.points) + (p.ideaBonus || 0); },
  points() { const s = getState(); return sel.pointsEarned() - sum(s.player.rewards, (r) => byId(s.rewards, r.rewardId)?.cost || 0); },
  pointsSynced() { const p = getState().player; return sum(Object.values(p.done).filter((x) => x.synced), (x) => x.points) + sum(Object.values(p.quiz), (x) => x.points) + (p.ideaBonus || 0); },
  districtsVisited() { const done = getState().player.done; const r = sel.route('history'); return [...new Set((r?.missions || []).filter((m) => done[m.id] && m.districtId).map((m) => m.districtId))]; },
  erasVisited() { const done = getState().player.done; const r = sel.route('history'); return [...new Set((r?.missions || []).filter((m) => done[m.id] && m.eraId).map((m) => m.eraId))]; },
  leaderboard() { const s = getState(); return [...s.leaderboard.map((x) => ({ ...x, me: false })), { nick: s.player.nick, points: sel.pointsSynced(), me: true }].sort((a, b) => b.points - a.points).map((x, i) => ({ ...x, rank: i + 1 })); },
  /** Stan kuponu dla gracza: { claimed, code, available, hint } */
  couponState(c) {
    const s = getState(); const mine = s.player.coupons.find((x) => x.couponId === c.id); if (mine) return { claimed: true, code: mine.code, used: !!mine.used, available: true };
    const t = c.condition?.type || 'none', v = c.condition?.value;
    if (t === 'points') { const have = sel.pointsEarned(); return { claimed: false, available: have >= v, hint: L(`Zdobądź ${v} pkt w grze (masz ${have}).`, `Earn ${v} pts in the game (you have ${have}).`) }; }
    if (t === 'mission') { const m = sel.mission(v); return { claimed: false, available: !!s.player.done[v], hint: L(`Ukończ misję „${m?.title.pl || v}”.`, `Complete the mission “${m?.title.en || v}”.`) }; }
    if (t === 'route') { const r = sel.route(v); const lens = r?.lengths || []; const pr = sel.routeProgress(v, lens.length ? { length: lens[0].id } : {}); return { claimed: false, available: pr.complete, hint: L(`Ukończ trasę „${r?.name.pl || v}” (${pr.done}/${pr.total}).`, `Finish the “${r?.name.en || v}” trail (${pr.done}/${pr.total}).`) }; }
    return { claimed: false, available: true, hint: null };
  },
  ideas: (f = {}) => getState().ideas.filter((i) => (f.all || i.status === 'approved' || (f.mine && i.mine)) && (!f.categoryId || i.categoryId === f.categoryId)).slice().sort((a, b) => b.votes - a.votes),
  // personel i urządzenia
  staff: (id) => byId(getState().staff, id),
  staffOf: (client) => (client?.staffId ? byId(getState().staff, client.staffId) : null),
  can(staff, perm) { const r = staff && ROLES[staff.role]; return !!r && (r.perms.includes('*') || r.perms.includes(perm)); },
  device: (id) => byId(getState().devices, id),
  clock() { const s = getState(); return s.env.simTime || warsawNow().hhmm; },
  incidentSla(inc) { const sla = SLA[inc.severity] || SLA.P3; const t0 = new Date(inc.createdAt).getTime(); const end = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : Date.now(); const fixDue = t0 + sla.fixH * 3600e3; const reactDue = sla.reactH ? t0 + sla.reactH * 3600e3 : null; return { ...sla, fixDue, reactDue, fixBreached: end > fixDue, reactBreached: !!reactDue && (inc.reactedAt ? new Date(inc.reactedAt).getTime() : Date.now()) > reactDue, elapsedH: (end - t0) / 3600e3 }; },
  availability() { const d = getState().devices; const on = d.filter((x) => x.power === 'on').length; return { total: d.length, on, off: d.filter((x) => x.power === 'off').length, service: d.filter((x) => x.power === 'service').length, fault: d.filter((x) => x.power === 'fault').length }; },
  pushFor(clientId) { const s = getState(); return s.outbox.filter((o) => o.kind === 'push' && (!o.to || o.to === 'all' || o.to === clientId) && (!o.device || o.device === (s.deviceId || 'local'))); },
};

/* ───────────────────────────── OPERACJE ───────────────────────────── */
function audit(ctx, action, target) { ctx.s.audit.unshift({ at: nowIso(), staffId: ctx.client.staffId || null, client: ctx.clientId, action, target: String(target ?? '') }); if (ctx.s.audit.length > 300) ctx.s.audit.length = 300; }
function outbox(s, kind, to, subject, body, extra) { s.outbox.unshift({ id: uid('out'), at: nowIso(), kind, to, subject, body, ...(extra || {}) }); if (s.outbox.length > 200) s.outbox.length = 200; }
function bump(s, key, n = 1) { const d = s.stats.daily[s.stats.daily.length - 1]; if (d && key in d) d[key] += n; }
function issueTickets(s, order) {
  const out = [];
  const one = (p, it) => { const e = p.eventId ? byId(s.events, p.eventId) : null; const t = { id: uid('tic'), code: code(10), orderId: order.id, userId: order.userId, productId: p.id, productName: p.name, eventId: p.eventId || null, validFrom: e ? e.start : order.createdAt, status: 'valid', usedAt: null, gate: null }; s.tickets.push(t); out.push(t); if (e) e.sold = (e.sold || 0) + 1; };
  for (const it of order.items) { const p = byId(s.products, it.productId); if (!p) continue; for (let i = 0; i < it.qty; i++) { if (p.kind === 'package' && p.includes?.length) p.includes.forEach((pid) => { const ip = byId(s.products, pid); if (ip) one(ip, it); }); else one(p, it); } }
  return out;
}
function syncGame(s) {
  const p = s.player; let n = 0;
  for (const id of p.pending) { const d = p.done[id]; if (d && !d.synced) { d.synced = true; n++; s.gameStats.missionsDone++; if (d.routeId && s.gameStats.byRoute[d.routeId] != null) s.gameStats.byRoute[d.routeId]++; } }
  p.pending = []; return n;
}
export function applySchedules(s) {
  const wn = warsawNow(); const hhmm = s.env.simTime || wn.hhmm; const day = wn.day;
  const act = s.schedules.filter((x) => x.active && (x.days || []).includes(day)); const hits = (sch, d) => sch.targets.includes('all') || sch.targets.includes(d.id) || sch.targets.includes(d.zone);
  for (const d of s.devices) {
    d.night = d.nightManual != null ? !!d.nightManual : act.some((x) => x.kind === 'night' && hits(x, d) && inWindow(hhmm, x.from, x.to)); // ręczne przełączenie ma pierwszeństwo do „Przywróć harmonogram”
    if (d.schedule !== 'auto') continue;
    const svc = act.some((x) => x.kind === 'service' && hits(x, d) && inWindow(hhmm, x.from, x.to));
    if (svc && d.power === 'on') { d.power = 'service'; d.serviceBySchedule = true; continue; }
    if (!svc && d.serviceBySchedule) { d.power = 'on'; d.serviceBySchedule = false; }
    const pw = act.filter((x) => x.kind === 'power' && hits(x, d));
    if (pw.length && (d.power === 'on' || d.power === 'off')) d.power = pw.some((x) => inWindow(hhmm, x.from, x.to)) ? 'on' : 'off';
  }
}
const COLLECTIONS = ['entries', 'categories', 'pois', 'news', 'videos', 'gallery', 'media', 'venues', 'events', 'products', 'coupons', 'triggers', 'quizzes', 'rewards', 'ideaCategories', 'futureHotspots', 'districts', 'eras', 'staff', 'playlists', 'schedules', 'alertRules', 'zones', 'devices', 'users', 'ideas'];
const nextCode = (s, kind) => { const pre = { qr: 'FPZ-Q-', ble: 'FPZ-B-', ar: 'FPZ-A-' }[kind]; const max = Math.max(0, ...s.triggers.filter((t) => t.code.startsWith(pre)).map((t) => parseInt(t.code.slice(pre.length), 10) || 0)); return pre + String(max + 1).padStart(3, '0'); };

// Definicje operacji: [przestrzeń.nazwa, metoda, ścieżka, funkcja(ctx, …args), opcje]
// Operacje zaplecza (CMS, urządzenia, personel, transmisje, walidacja biletów). Kompilacja aplikacji dla zwiedzających (APK, /app)
// ustawia globalThis.FPZ_APP_ONLY – wtedy ten blok w ogóle nie trafia do paczki.
const ADMIN_OPS = globalThis.FPZ_APP_ONLY ? [] : [
  /** Walidacja kodu przy wejściu (bilet, nagroda z gry, kupon). Zwraca { ok, kind, reason, message, ticket|reward|coupon }. */
  ['tickets.validate', 'POST', '/tickets/validate', (ctx, raw, { gate = 'Wejście główne' } = {}) => {
    const s = ctx.s; const txt = String(raw || '').trim(); const m = txt.match(/^FPZ:([TNK]):(.+)$/i); const kind = m ? m[1].toUpperCase() : 'T'; const c = (m ? m[2] : txt).toUpperCase();
    const rec = (res) => { s.stats.validations.unshift({ at: nowIso(), code: c, ok: res.ok, reason: res.reason || null, gate, staffId: ctx.client.staffId || null, label: res.label || '' }); if (s.stats.validations.length > 100) s.stats.validations.length = 100; return res; };
    const players = [s.player, ...Object.values(s.players || {})]; // serwer: wszyscy gracze; lokalnie: gracz tego urządzenia + kopie z serwera
    if (kind === 'N') { const r = players.flatMap((p) => p.rewards).find((x) => x.code === c); if (!r) return rec({ ok: false, kind: 'reward', reason: 'NOT_FOUND', message: L('Nie znaleziono kodu nagrody.', 'Reward code not found.') }); const rw = byId(s.rewards, r.rewardId); if (r.status === 'collected') return rec({ ok: false, kind: 'reward', reason: 'ALREADY_USED', label: rw?.name.pl, message: L('Nagroda została już odebrana.', 'This reward has already been collected.') }); r.status = 'collected'; r.collectedAt = nowIso(); return rec({ ok: true, kind: 'reward', reward: rw, label: rw?.name.pl, message: L(`Wydaj nagrodę: ${rw?.name.pl}`, `Hand over: ${rw?.name.en}`) }); }
    if (kind === 'K') { const k = players.flatMap((p) => p.coupons).find((x) => x.code === c); if (!k) return rec({ ok: false, kind: 'coupon', reason: 'NOT_FOUND', message: L('Nie znaleziono kuponu.', 'Coupon not found.') }); const cp = byId(s.coupons, k.couponId); if (k.used) return rec({ ok: false, kind: 'coupon', reason: 'ALREADY_USED', label: cp?.title.pl, message: L('Kupon został już wykorzystany.', 'This coupon has already been used.') }); k.used = nowIso(); return rec({ ok: true, kind: 'coupon', coupon: cp, label: cp?.title.pl, message: L(`Kupon przyjęty: ${cp?.title.pl}`, `Coupon accepted: ${cp?.title.en}`) }); }
    const t = s.tickets.find((x) => x.code === c); if (!t) return rec({ ok: false, kind: 'ticket', reason: 'NOT_FOUND', message: L('Nie znaleziono biletu o tym kodzie.', 'No ticket with this code.') });
    const label = t.productName.pl + (t.eventId ? ' – ' + (byId(s.events, t.eventId)?.title.pl || '') : '');
    if (t.status === 'refunded') return rec({ ok: false, kind: 'ticket', reason: 'REFUNDED', ticket: t, label, message: L('Bilet został zwrócony – wejście niemożliwe.', 'This ticket was refunded – no entry.') });
    if (t.status === 'used') return rec({ ok: false, kind: 'ticket', reason: 'ALREADY_USED', ticket: t, label, message: L('Bilet został już wykorzystany.', 'This ticket has already been used.') });
    t.status = 'used'; t.usedAt = nowIso(); t.gate = gate; return rec({ ok: true, kind: 'ticket', ticket: t, label, message: L('Bilet ważny – zapraszamy.', 'Valid ticket – welcome.') });
  }],
  /* ── transmisje, napisy na żywo, tłumacz PJM ── */
  ['live.start', 'POST', '/live/start', (ctx, title) => { const l = ctx.s.live; l.onAir = true; l.startedAt = nowIso(); l.captions = []; l.viewers = 12; if (title) l.title = typeof title === 'string' ? { pl: title, en: title } : title; outbox(ctx.s, 'push', 'all', 'Transmisja na żywo', l.title.pl); return ok(); }],
  ['live.stop', 'POST', '/live/stop', (ctx) => { ctx.s.live.onAir = false; return ok(); }],
  ['live.caption', 'POST', '/live/captions', (ctx, text) => { const t = String(text || '').trim(); if (!t) return fail('VALIDATION', 'Pusty tekst.', 'Empty text.'); const c = ctx.s.live.captions; c.push({ id: uid('cap'), at: nowIso(), text: t }); if (c.length > 60) c.splice(0, c.length - 60); return ok(); }, { quiet: true }],
  ['live.clear', 'DELETE', '/live/captions', (ctx) => { ctx.s.live.captions = []; return ok(); }],
  /* ── personel: logowanie do CMS / systemu zarządzania / stanowiska bileterskiego ── */
  ['staff.login', 'POST', '/staff/login', (ctx, login, password) => { const st = ctx.s.staff.find((x) => x.active !== false && x.login === String(login || '').trim() && x.password === password); if (!st) return fail('BAD_CREDENTIALS', 'Nieprawidłowy login lub hasło.', 'Wrong login or password.'); ctx.client.staffId = st.id; audit(ctx, 'Logowanie', ctx.clientId); return ok({ staff: st }); }],
  ['staff.logout', 'POST', '/staff/logout', (ctx) => { ctx.client.staffId = null; return ok(); }],
  /* ── CMS ── */
  /** Zapis rekordu dowolnej kolekcji (utworzenie, gdy brak id). Kolekcje: entries, categories, pois, news, videos, gallery, media, venues, events, products, coupons, triggers, quizzes, rewards, ideaCategories, futureHotspots, districts, eras, staff, playlists, schedules, alertRules, zones, devices */
  ['cms.save', 'PUT', (col, item) => `/cms/${col}/${item?.id || ''}`, (ctx, col, item) => {
    if (!COLLECTIONS.includes(col)) return fail('NOT_FOUND', 'Nieznana kolekcja.', 'Unknown collection.'); const arr = ctx.s[col]; let rec = item.id && byId(arr, item.id); const created = !rec;
    if (rec) Object.assign(rec, item); else { rec = { ...item, id: item.id || uid(col.slice(0, 3)) }; if (col === 'entries') { rec.status = rec.status || 'draft'; rec.views = 0; rec.author = sel.staffOf(ctx.client)?.login || 'cms'; rec.channels = rec.channels || ['mobile', 'web', 'kiosk']; rec.media = rec.media || []; } if (col === 'triggers' && !rec.code) { rec.code = nextCode(ctx.s, rec.kind); rec.scans = 0; rec.active = rec.active ?? true; } if (col === 'events') { rec.sold = rec.sold || 0; rec.active = rec.active ?? true; } arr.push(rec); }
    if (col === 'events' && rec.start && !rec.end) rec.end = localIso(new Date(new Date(rec.start).getTime() + (rec.durationMin || 90) * 60000));
    if (col === 'entries' || col === 'news') rec.updatedAt = nowIso();
    if (col === 'schedules') applySchedules(ctx.s);
    audit(ctx, (created ? 'Utworzenie' : 'Edycja') + ` – ${col}`, rec.title?.pl || rec.name?.pl || rec.name || rec.label || rec.code || rec.id); return ok({ item: rec, created });
  }],
  ['cms.remove', 'DELETE', (col, id) => `/cms/${col}/${id}`, (ctx, col, id) => { if (!COLLECTIONS.includes(col)) return fail('NOT_FOUND', 'Nieznana kolekcja.', 'Unknown collection.'); const rec = byId(ctx.s[col], id); if (!rec) return fail('NOT_FOUND', 'Nie znaleziono rekordu.', 'Record not found.'); ctx.s[col] = ctx.s[col].filter((x) => x.id !== id); audit(ctx, `Usunięcie – ${col}`, rec.title?.pl || rec.name?.pl || rec.name || rec.label || id); return ok(); }],
  /** Workflow publikacji wpisu: draft → review → published (→ archived). Publikacja wymaga uprawnienia content.publish (administrator). */
  ['cms.setStatus', 'PATCH', (id) => `/cms/entries/${id}/status`, (ctx, id, status) => { const e = byId(ctx.s.entries, id); if (!e) return fail('NOT_FOUND', 'Nie znaleziono wpisu.', 'Entry not found.'); const st = sel.staffOf(ctx.client); if (status === 'published' && !sel.can(st, 'content.publish')) return fail('FORBIDDEN', 'Publikacja wymaga akceptacji administratora – wyślij wpis do akceptacji.', 'Publishing needs administrator approval – submit the entry for review.'); e.status = status; e.updatedAt = nowIso(); audit(ctx, { draft: 'Cofnięcie do szkicu', review: 'Wysłanie do akceptacji', published: 'Publikacja wpisu', archived: 'Archiwizacja wpisu' }[status] || 'Zmiana statusu', e.title.pl); return ok({ item: e }); }],
  ['cms.saveMission', 'PUT', (rid, m) => `/cms/game/routes/${rid}/missions/${m?.id || ''}`, (ctx, routeId, mission) => { const r = byId(ctx.s.gameRoutes, routeId); if (!r) return fail('NOT_FOUND', 'Nie ma takiej trasy.', 'No such trail.'); let m = mission.id && byId(r.missions, mission.id); if (m) Object.assign(m, mission); else { m = { id: mission.id || uid('m'), kind: 'gps', points: 50, quizId: null, eraId: null, districtId: null, variantText: null, accessible: true, radiusM: 40, active: true, ...mission }; r.missions.push(m); } audit(ctx, 'Edycja misji gry', m.title?.pl); return ok({ item: m }); }],
  ['cms.removeMission', 'DELETE', (rid, id) => `/cms/game/routes/${rid}/missions/${id}`, (ctx, routeId, id) => { const r = byId(ctx.s.gameRoutes, routeId); if (!r) return fail('NOT_FOUND', 'Nie ma takiej trasy.', 'No such trail.'); r.missions = r.missions.filter((m) => m.id !== id); (r.lengths || []).forEach((l) => { l.missionIds = l.missionIds.filter((x) => x !== id); }); audit(ctx, 'Usunięcie misji gry', id); return ok(); }],
  ['cms.moveMission', 'PATCH', (rid, id) => `/cms/game/routes/${rid}/missions/${id}/order`, (ctx, routeId, id, dir) => { const r = byId(ctx.s.gameRoutes, routeId); const i = r?.missions.findIndex((m) => m.id === id) ?? -1; const j = i + dir; if (i < 0 || j < 0 || j >= r.missions.length) return fail('STATE', 'Nie można przesunąć.', 'Cannot move.'); [r.missions[i], r.missions[j]] = [r.missions[j], r.missions[i]]; return ok(); }, { quiet: true }],
  ['cms.saveRoute', 'PATCH', (rid) => `/cms/game/routes/${rid}`, (ctx, routeId, patch) => { const r = byId(ctx.s.gameRoutes, routeId); if (!r) return fail('NOT_FOUND', 'Nie ma takiej trasy.', 'No such trail.'); Object.assign(r, patch); audit(ctx, 'Edycja trasy gry', r.name.pl); return ok({ item: r }); }],
  ['cms.setTranslation', 'PUT', (lang) => `/cms/i18n/${lang}`, (ctx, lang, key, value) => { const o = ctx.s.i18n.overrides; o[lang] = o[lang] || {}; if (value == null || value === '') delete o[lang][key]; else o[lang][key] = value; return ok(); }, { quiet: true }],
  ['cms.addLanguage', 'POST', '/cms/languages', (ctx, { code: c, name } = {}) => { c = String(c || '').trim().toLowerCase(); if (!/^[a-z]{2}$/.test(c) || !name) return fail('VALIDATION', 'Podaj dwuliterowy kod języka i nazwę.', 'Enter a two-letter code and a name.'); if (ctx.s.settings.languages.some((l) => l.code === c)) return fail('EXISTS', 'Taki język już istnieje.', 'This language already exists.'); ctx.s.settings.languages.push({ code: c, name, enabled: true }); ctx.s.i18n.overrides[c] = {}; audit(ctx, 'Dodanie wersji językowej', name); return ok(); }],
  ['cms.setLanguage', 'PATCH', (c) => `/cms/languages/${c}`, (ctx, c, patch) => { const l = ctx.s.settings.languages.find((x) => x.code === c); if (!l) return fail('NOT_FOUND', 'Nie ma takiego języka.', 'No such language.'); if (c === 'pl' && patch.enabled === false) return fail('STATE', 'Języka polskiego nie można wyłączyć.', 'Polish cannot be disabled.'); Object.assign(l, patch); return ok(); }],
  ['cms.setSetting', 'PATCH', '/cms/settings', (ctx, patch) => { Object.assign(ctx.s.settings, patch); audit(ctx, 'Zmiana ustawień', Object.keys(patch).join(', ')); return ok(); }],
  ['cms.setSite', 'PATCH', '/cms/site', (ctx, patch) => { Object.assign(ctx.s.site, patch); audit(ctx, 'Edycja danych obiektu', ''); return ok(); }],
  ['cms.moderateIdea', 'PATCH', (id) => `/cms/ideas/${id}`, (ctx, id, status) => { const i = byId(ctx.s.ideas, id); if (!i) return fail('NOT_FOUND', 'Nie ma takiego zgłoszenia.', 'No such submission.'); const was = i.status; i.status = status; const author = i.deviceId ? (i.deviceId === (ctx.s.deviceId || 'local') ? ctx.s.player : (ctx.s.players || {})[i.deviceId]) : (i.mine ? ctx.s.player : null); if (status === 'approved' && was !== 'approved' && author) { author.ideaBonus = (author.ideaBonus || 0) + 30; outbox(ctx.s, 'push', 'mobile', 'Twój pomysł został opublikowany', 'Dziękujemy! Otrzymujesz 30 punktów w grze.', { device: i.deviceId || 'local' }); } audit(ctx, status === 'approved' ? 'Akceptacja zgłoszenia' : 'Odrzucenie zgłoszenia', i.text.pl.slice(0, 40)); return ok({ item: i }); }],
  ['cms.replyInquiry', 'PATCH', (id) => `/cms/inquiries/${id}`, (ctx, id, { status, reply } = {}) => { const q = byId(ctx.s.inquiries, id); if (!q) return fail('NOT_FOUND', 'Nie ma takiego zapytania.', 'No such enquiry.'); q.status = status || 'answered'; q.reply = reply || q.reply; q.repliedAt = nowIso(); const u = byId(ctx.s.users, q.userId); outbox(ctx.s, 'email', u?.email, 'Odpowiedź na zapytanie o termin', q.reply || ''); audit(ctx, 'Odpowiedź na zapytanie', byId(ctx.s.venues, q.venueId)?.name.pl); return ok({ item: q }); }],
  ['cms.sendPush', 'POST', '/cms/push', (ctx, { title, body, to = 'all' } = {}) => { if (!title) return fail('VALIDATION', 'Podaj tytuł powiadomienia.', 'Enter a title.'); outbox(ctx.s, 'push', to, title, body || ''); audit(ctx, 'Wysłanie powiadomienia push', title); return ok(); }],
  /* ── system zarządzania ekspozycją ── */
  ['devices.power', 'POST', (id) => `/devices/${id}/power`, (ctx, id, power) => { const d = byId(ctx.s.devices, id); if (!d) return fail('NOT_FOUND', 'Nie ma takiego urządzenia.', 'No such device.'); if (d.power === 'fault' && power === 'on') return fail('FAULT', 'Urządzenie zgłasza awarię – zamknij najpierw zgłoszenie.', 'The device reports a fault – close the incident first.'); d.power = power; d.schedule = d.schedule === 'always' ? 'always' : 'manual'; d.serviceBySchedule = false; if (power === 'on') { d.uptimeH = 0; d.lastSeen = nowIso(); } audit(ctx, { on: 'Włączenie', off: 'Wyłączenie', service: 'Tryb serwisowy' }[power] + ' urządzenia', d.name); return ok({ device: d }); }],
  /** Jeden przycisk: uruchomienie / wyłączenie całej ekspozycji (pomija serwer i sieć oraz urządzenia w awarii/serwisie). */
  ['devices.powerAll', 'POST', '/devices/power', (ctx, power) => { let n = 0; for (const d of ctx.s.devices) { if (d.schedule === 'always' || d.power === 'fault' || d.power === 'service') continue; d.power = power; d.schedule = 'manual'; if (power === 'on') d.uptimeH = 0; n++; } audit(ctx, power === 'on' ? 'Uruchomienie całej ekspozycji' : 'Wyłączenie całej ekspozycji', `${n} urządzeń`); return ok({ count: n }); }],
  ['devices.setAuto', 'POST', '/devices/schedule/auto', (ctx, id = 'all') => { for (const d of ctx.s.devices) if (id === 'all' || d.id === id) { if (d.schedule === 'manual') d.schedule = 'auto'; d.nightManual = null; } applySchedules(ctx.s); return ok(); }],
  ['devices.set', 'PATCH', (id) => `/devices/${id}`, (ctx, id, patch) => { const d = byId(ctx.s.devices, id); if (!d) return fail('NOT_FOUND', 'Nie ma takiego urządzenia.', 'No such device.'); Object.assign(d, patch); if ('night' in patch) d.nightManual = !!patch.night; return ok({ device: d }); }, { quiet: true }],
  ['devices.restart', 'POST', (id) => `/devices/${id}/restart`, (ctx, id) => { const d = byId(ctx.s.devices, id); if (!d) return fail('NOT_FOUND', 'Nie ma takiego urządzenia.', 'No such device.'); d.uptimeH = 0; d.cpu = 5; d.restartedAt = nowIso(); audit(ctx, 'Restart aplikacji na urządzeniu', d.name); return ok(); }],
  ['devices.simulateFault', 'POST', (id) => `/devices/${id}/fault`, (ctx, id, { title, severity } = {}) => {
    const s = ctx.s; const d = byId(s.devices, id); if (!d) return fail('NOT_FOUND', 'Nie ma takiego urządzenia.', 'No such device.'); const sev = severity || (['server', 'network'].includes(d.kind) ? 'P1' : d.kind === 'kiosk' ? 'P3' : 'P4');
    d.power = 'fault'; const inc = { id: uid('inc'), deviceId: id, title: title || 'Utrata komunikacji z urządzeniem', severity: sev, status: 'open', createdAt: nowIso(), reactedAt: null, resolvedAt: null, note: '', source: 'monitoring' }; s.incidents.unshift(inc);
    for (const r of s.alertRules.filter((x) => x.active)) { if (r.event === 'fault' || (r.event === 'fault-critical' && ['P1', 'P2'].includes(sev))) outbox(s, r.channel, r.recipient, `[${sev}] Awaria: ${d.name}`, `${inc.title}. Zgłoszenie ${inc.id} utworzone automatycznie przez monitoring.`); }
    return ok({ incident: inc });
  }],
  /** Ręczne zgłoszenie usterki (opcjonalnie z wyłączeniem urządzenia z pracy). */
  ['devices.reportIncident', 'POST', '/incidents', (ctx, { deviceId, title, severity = 'P3', stopDevice = false } = {}) => {
    const s = ctx.s; const d = byId(s.devices, deviceId); if (!d) return fail('NOT_FOUND', 'Nie ma takiego urządzenia.', 'No such device.'); if (stopDevice) d.power = 'fault';
    const inc = { id: uid('inc'), deviceId, title: String(title || 'Zgłoszenie usterki'), severity, status: 'open', createdAt: nowIso(), reactedAt: null, resolvedAt: null, note: '', source: 'zgłoszenie ręczne' }; s.incidents.unshift(inc);
    for (const r of s.alertRules.filter((x) => x.active)) { if (r.event === 'fault' || (r.event === 'fault-critical' && ['P1', 'P2'].includes(severity))) outbox(s, r.channel, r.recipient, `[${severity}] Usterka: ${d.name}`, `${inc.title}. Zgłoszenie ${inc.id} (ręczne).`); }
    audit(ctx, 'Ręczne zgłoszenie usterki', d.name); return ok({ incident: inc });
  }],
  /** Wpis do dziennika zdarzeń (np. test odtworzeniowy kopii zapasowej). */
  ['sys.audit', 'POST', '/audit', (ctx, action, target) => { audit(ctx, String(action || 'Zdarzenie'), target); return ok(); }],
  ['devices.ackIncident', 'PATCH', (id) => `/incidents/${id}/ack`, (ctx, id) => { const i = byId(ctx.s.incidents, id); if (!i) return fail('NOT_FOUND', 'Nie ma takiego zgłoszenia.', 'No such incident.'); i.reactedAt = i.reactedAt || nowIso(); i.status = 'in_progress'; i.assignee = sel.staffOf(ctx.client)?.name || 'obsługa'; return ok({ incident: i }); }],
  ['devices.resolveIncident', 'PATCH', (id) => `/incidents/${id}/resolve`, (ctx, id, note) => { const s = ctx.s; const i = byId(s.incidents, id); if (!i) return fail('NOT_FOUND', 'Nie ma takiego zgłoszenia.', 'No such incident.'); i.reactedAt = i.reactedAt || nowIso(); i.resolvedAt = nowIso(); i.status = 'closed'; i.note = note || i.note || 'Usunięto usterkę.'; const d = byId(s.devices, i.deviceId); if (d && d.power === 'fault' && !s.incidents.some((x) => x.deviceId === d.id && x.status !== 'closed')) { d.power = 'on'; d.uptimeH = 0; } audit(ctx, 'Zamknięcie zgłoszenia awarii', i.title); return ok({ incident: i }); }],
];
const OPS = [
  /* ── konta klientów (system rezerwacji) ── */
  ['auth.register', 'POST', '/auth/register', (ctx, { name, email, password, marketing } = {}) => {
    email = String(email || '').trim().toLowerCase();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || String(password || '').length < 6) return fail('VALIDATION', 'Podaj imię i nazwisko, poprawny e-mail oraz hasło (min. 6 znaków).', 'Enter your name, a valid e-mail and a password (min. 6 characters).');
    if (ctx.s.users.some((u) => u.email === email)) return fail('EMAIL_TAKEN', 'Konto z tym adresem e-mail już istnieje.', 'An account with this e-mail already exists.');
    const u = { id: uid('u'), email, name: String(name).trim(), password, phone: '', createdAt: nowIso(), consents: { terms: true, marketing: !!marketing } }; ctx.s.users.push(u); ctx.client.userId = u.id;
    outbox(ctx.s, 'email', email, 'Witamy w systemie rezerwacji Fabryki Pełnej Życia', 'Konto zostało utworzone. (wiadomość testowa)');
    return ok({ user: u });
  }],
  ['auth.login', 'POST', '/auth/login', (ctx, email, password) => { const u = ctx.s.users.find((x) => x.email === String(email || '').trim().toLowerCase() && x.password === password); if (!u) return fail('BAD_CREDENTIALS', 'Nieprawidłowy e-mail lub hasło.', 'Wrong e-mail or password.'); ctx.client.userId = u.id; return ok({ user: u }); }],
  ['auth.logout', 'POST', '/auth/logout', (ctx) => { ctx.client.userId = null; return ok(); }],
  ['auth.updateProfile', 'PATCH', '/users/me', (ctx, patch) => { const u = byId(ctx.s.users, ctx.client.userId); if (!u) return fail('AUTH_REQUIRED', 'Zaloguj się.', 'Please sign in.'); Object.assign(u, { name: patch.name ?? u.name, phone: patch.phone ?? u.phone }); return ok({ user: u }); }],
  /* ── koszyk, zamówienia, płatności, bilety ── */
  ['booking.addToCart', 'POST', '/cart/items', (ctx, productId, qty = 1) => {
    const p = byId(ctx.s.products, productId); if (!p || p.active === false) return fail('NOT_FOUND', 'Produkt niedostępny.', 'Product unavailable.');
    const it = ctx.client.cart.find((x) => x.productId === productId); const want = (it?.qty || 0) + qty;
    if (want > (p.maxPerOrder || 10)) return fail('LIMIT', `Maksymalnie ${p.maxPerOrder || 10} szt. w jednym zamówieniu.`, `Up to ${p.maxPerOrder || 10} per order.`);
    if (p.eventId && want > sel.remaining(p.eventId)) return fail('SOLD_OUT', 'Brak wystarczającej liczby wolnych miejsc.', 'Not enough places left.');
    if (it) it.qty = want; else ctx.client.cart.push({ productId, qty }); return ok({ cart: sel.cart(ctx.client) });
  }],
  ['booking.setQty', 'PATCH', '/cart/items', (ctx, productId, qty) => { const p = byId(ctx.s.products, productId); const it = ctx.client.cart.find((x) => x.productId === productId); if (!it) return fail('NOT_FOUND', 'Brak pozycji w koszyku.', 'Item not in cart.'); if (qty <= 0) ctx.client.cart = ctx.client.cart.filter((x) => x !== it); else it.qty = clamp(qty, 1, Math.min(p?.maxPerOrder || 10, p?.eventId ? sel.remaining(p.eventId) : 99)); return ok({ cart: sel.cart(ctx.client) }); }],
  ['booking.clearCart', 'DELETE', '/cart', (ctx) => { ctx.client.cart = []; return ok(); }],
  ['booking.checkout', 'POST', '/orders', (ctx) => {
    const u = byId(ctx.s.users, ctx.client.userId); if (!u) return fail('AUTH_REQUIRED', 'Aby kupić bilet, zaloguj się lub załóż konto.', 'Sign in or create an account to buy tickets.');
    const cart = sel.cart(ctx.client); if (!cart.items.length) return fail('EMPTY_CART', 'Koszyk jest pusty.', 'Your basket is empty.');
    for (const it of cart.items) if (it.product.eventId && it.qty > sel.remaining(it.product.eventId)) return fail('SOLD_OUT', 'Część biletów została w międzyczasie wyprzedana.', 'Some tickets have sold out in the meantime.');
    const n = ctx.s.orders.length + 101; const o = { id: uid('ord'), no: `FPZ/${new Date().getFullYear()}/${String(n).padStart(6, '0')}`, userId: u.id, channel: ctx.clientId.split(':')[0], createdAt: nowIso(), status: 'pending', total: cart.total, items: cart.items.map((i) => ({ productId: i.productId, name: i.product.name, unitPrice: i.product.price, qty: i.qty, eventId: i.product.eventId || null })), payment: null };
    ctx.s.orders.push(o); return ok({ order: o });
  }],
  /** Płatność u zewnętrznego operatora (symulacja, z krokiem silnego uwierzytelnienia SCA). outcome: 'success' | 'fail' */
  ['booking.pay', 'POST', (id) => `/orders/${id}/payment`, (ctx, orderId, { method = 'blik', outcome = 'success' } = {}) => {
    const o = byId(ctx.s.orders, orderId); if (!o) return fail('NOT_FOUND', 'Nie znaleziono zamówienia.', 'Order not found.'); if (o.status !== 'pending') return fail('STATE', 'Zamówienie nie oczekuje na płatność.', 'This order is not awaiting payment.');
    if (outcome !== 'success') { o.payment = { operator: ctx.s.settings.payments.operator, method, txId: 'TX-' + code(8), sca: true, at: nowIso(), failed: true }; return fail('PAYMENT_DECLINED', 'Płatność odrzucona przez operatora. Spróbuj ponownie.', 'Payment declined by the operator. Please try again.'); }
    o.status = 'paid'; o.payment = { operator: ctx.s.settings.payments.operator, method, txId: 'TX-' + code(8), sca: true, at: nowIso() };
    const tickets = issueTickets(ctx.s, o); ctx.client.cart = []; bump(ctx.s, 'tickets', tickets.length);
    const u = byId(ctx.s.users, o.userId); outbox(ctx.s, 'email', u?.email, `Bilety – zamówienie ${o.no}`, `Dziękujemy za zakup. Liczba biletów: ${tickets.length}. Kody QR są dostępne w aplikacji i na stronie WWW.`);
    return ok({ order: o, tickets });
  }],
  ['booking.cancel', 'DELETE', (id) => `/orders/${id}`, (ctx, orderId) => { const o = byId(ctx.s.orders, orderId); if (!o || o.status !== 'pending') return fail('STATE', 'Nie można anulować.', 'Cannot cancel.'); o.status = 'cancelled'; return ok({ order: o }); }],
  ['booking.refund', 'POST', (id) => `/orders/${id}/refund`, (ctx, orderId, { force = false } = {}) => {
    const o = byId(ctx.s.orders, orderId); if (!o) return fail('NOT_FOUND', 'Nie znaleziono zamówienia.', 'Order not found.');
    const info = sel.refundInfo(o); if (!info.ok && !(force && o.status === 'paid')) return { ok: false, error: 'REFUND_DENIED', message: info.reason };
    o.status = 'refunded'; o.refundedAt = nowIso();
    for (const t of ctx.s.tickets.filter((x) => x.orderId === o.id)) { if (t.status === 'valid') { t.status = 'refunded'; const e = t.eventId && byId(ctx.s.events, t.eventId); if (e) e.sold = Math.max(0, e.sold - 1); } }
    const u = byId(ctx.s.users, o.userId); outbox(ctx.s, 'email', u?.email, `Zwrot – zamówienie ${o.no}`, `Zwrot ${o.total.toFixed(2)} zł został zlecony operatorowi płatności.`);
    if (force) audit(ctx, 'Zwrot zamówienia (obsługa)', o.no); return ok({ order: o });
  }],
  ['booking.inquire', 'POST', '/inquiries', (ctx, { venueId, date, people, message } = {}) => {
    const u = byId(ctx.s.users, ctx.client.userId); if (!u) return fail('AUTH_REQUIRED', 'Aby wysłać zapytanie, zaloguj się.', 'Sign in to send an enquiry.');
    const v = byId(ctx.s.venues, venueId); if (!v) return fail('NOT_FOUND', 'Nie znaleziono obiektu.', 'Venue not found.'); if (!date) return fail('VALIDATION', 'Wybierz termin.', 'Choose a date.');
    const q = { id: uid('inq'), userId: u.id, venueId, date, people: +people || 1, message: String(message || ''), status: 'new', reply: null, createdAt: nowIso(), channel: ctx.clientId.split(':')[0] }; ctx.s.inquiries.push(q);
    outbox(ctx.s, 'email', v.contact?.email || 'obiekt@fpz.example', `Nowe zapytanie o termin – ${v.name.pl}`, `${u.name}, ${q.people} os., ${q.date}. ${q.message}`); return ok({ inquiry: q });
  }],
  /* ── wyzwalacze QR / BLE / AR ── */
  /** Rozpoznanie zeskanowanego kodu: { ok, trigger, target: {type:'poi'|'entry'|'mission'|'coupon'|'ticket'|'event'|'venue', id}, item }.
   *  Obsługuje kody wyzwalaczy (FPZ-Q-101, także jako URL …/q/FPZ-Q-101), bilety (FPZ:T:KOD) oraz kody „Zabierz na telefon” wyświetlane np. na kioskach:
   *  E:<entryId>, P:<poiId>, M:<missionId>, C:<couponId>, V:<eventId>, O:<venueId>, F:<videoId>. */
  ['triggers.resolve', 'GET', (c) => `/triggers/${encodeURIComponent(String(c).slice(0, 40))}`, (ctx, raw, via = 'qr') => {
    const s = ctx.s; let c = String(raw || '').trim(); const url = c.match(/\/q\/([A-Za-z0-9-]+)$/); if (url) c = url[1];
    const item = (type, id) => ({ poi: () => byId(s.pois, id), entry: () => byId(s.entries, id), mission: () => sel.mission(id), coupon: () => byId(s.coupons, id), event: () => byId(s.events, id), venue: () => byId(s.venues, id), video: () => byId(s.videos, id) }[type]?.() || null);
    if (/^FPZ:T:/i.test(c)) { const t = s.tickets.find((x) => x.code === c.slice(6).toUpperCase()); return t ? ok({ trigger: null, target: { type: 'ticket', id: t.id }, item: t }) : fail('NOT_FOUND', 'Nieznany kod biletu.', 'Unknown ticket code.'); }
    const imp = c.match(/^([EPMCVOF]):(.+)$/); if (imp) { const type = { E: 'entry', P: 'poi', M: 'mission', C: 'coupon', V: 'event', O: 'venue', F: 'video' }[imp[1]]; const it = item(type, imp[2]); return it ? ok({ trigger: null, target: { type, id: imp[2] }, item: it }) : fail('NOT_FOUND', 'Kod nie prowadzi do żadnej treści.', 'This code does not lead to any content.'); }
    const t = s.triggers.find((x) => x.code.toLowerCase() === c.toLowerCase()); if (!t) return fail('NOT_FOUND', 'Nie rozpoznano kodu.', 'Code not recognised.'); if (t.active === false) return fail('INACTIVE', 'Ten kod jest nieaktywny.', 'This code is inactive.');
    t.scans = (t.scans || 0) + 1; s.stats.scans[t.kind] = (s.stats.scans[t.kind] || 0) + 1; bump(s, t.kind);
    return ok({ trigger: t, target: t.target, item: item(t.target.type, t.target.id) });
  }],
  /* ── gra terenowa ── */
  ['game.setProfile', 'PUT', '/game/profile', (ctx, patch) => { const p = ctx.s.player; if (patch.nick != null) p.nick = String(patch.nick).slice(0, 24) || 'Odkrywca'; Object.assign(p.profile, { age: patch.age ?? p.profile.age, difficulty: patch.difficulty ?? p.profile.difficulty, mode: patch.mode ?? p.profile.mode }); return ok({ player: p }); }],
  ['game.startRoute', 'POST', (id) => `/game/routes/${id}/start`, (ctx, routeId, opts = {}) => { const r = sel.route(routeId); if (!r) return fail('NOT_FOUND', 'Nie ma takiej trasy.', 'No such trail.'); ctx.s.player.activeRoute = { routeId, mode: opts.mode || r.modes?.[0]?.id || null, length: opts.length || r.lengths?.[0]?.id || null, variant: opts.variant || r.variants?.[0]?.id || null, startedAt: nowIso() }; return ok({ activeRoute: ctx.s.player.activeRoute }); }],
  ['game.setRouteOptions', 'PATCH', '/game/routes/active', (ctx, opts) => { const a = ctx.s.player.activeRoute; if (!a) return fail('STATE', 'Brak aktywnej trasy.', 'No active trail.'); Object.assign(a, opts); return ok({ activeRoute: a }); }],
  ['game.leaveRoute', 'DELETE', '/game/routes/active', (ctx) => { ctx.s.player.activeRoute = null; return ok(); }],
  /** Zaliczenie misji. opts: { via: 'qr'|'ble'|'ar'|'gps'|'panorama'|'idea'|'quiz', force } – bez force sprawdzany jest warunek w otoczeniu (sel.missionCheck). */
  ['game.completeMission', 'POST', (id) => `/game/missions/${id}/complete`, (ctx, missionId, opts = {}) => {
    const s = ctx.s; const m = sel.mission(missionId); if (!m) return fail('NOT_FOUND', 'Nie ma takiej misji.', 'No such mission.'); const p = s.player;
    if (p.done[missionId]) return ok({ already: true, points: 0, total: sel.points() });
    if (!opts.force) { const chk = sel.missionCheck(m); if (!chk.ok) return { ok: false, error: 'NOT_IN_RANGE', need: chk.need, message: { qr: L('Zeskanuj kod QR na miejscu.', 'Scan the QR code on site.'), ble: L('Podejdź bliżej – nadajnik jest poza zasięgiem.', 'Move closer – the beacon is out of range.'), ar: L('Podejdź do punktu AR.', 'Walk up to the AR point.'), gps: L('Musisz znaleźć się w wyznaczonym miejscu.', 'You need to be at the marked location.') }[chk.need] }; }
    const r = sel.routeOfMission(missionId); const pts = Math.round(m.points * (DIFFICULTY[p.profile.difficulty] || 1)); const offline = s.env.network === 'offline';
    p.done[missionId] = { at: nowIso(), points: pts, via: opts.via || m.kind, routeId: r?.id, synced: !offline };
    if (offline) p.pending.push(missionId); else { s.gameStats.missionsDone++; if (r && s.gameStats.byRoute[r.id] != null) s.gameStats.byRoute[r.id]++; }
    const pr = r ? sel.routeProgress(r.id) : null;
    return ok({ points: pts, total: sel.points(), queued: offline, routeCompleted: !!pr?.complete, route: r?.id });
  }],
  ['game.submitQuiz', 'POST', (id) => `/game/quizzes/${id}/answers`, (ctx, quizId, answers = []) => {
    const q = byId(ctx.s.quizzes, quizId); if (!q) return fail('NOT_FOUND', 'Nie ma takiego quizu.', 'No such quiz.'); const p = ctx.s.player; const first = !p.quiz[quizId];
    const res = q.questions.map((x, i) => answers[i] === x.correct); const score = res.filter(Boolean).length;
    const pts = first ? Math.round(sum(q.questions, (x, i) => (answers[q.questions.indexOf(x)] === x.correct ? 10 * (LEVEL_W[x.level] || 1) : 0)) * (DIFFICULTY[p.profile.difficulty] || 1)) : 0;
    if (first) p.quiz[quizId] = { score, total: q.questions.length, points: pts, at: nowIso() }; else p.quiz[quizId].best = Math.max(p.quiz[quizId].best || p.quiz[quizId].score, score);
    return ok({ score, total: q.questions.length, points: pts, results: res, first });
  }],
  ['game.redeemReward', 'POST', (id) => `/game/rewards/${id}/redeem`, (ctx, rewardId) => { const s = ctx.s; const r = byId(s.rewards, rewardId); if (!r || r.active === false) return fail('NOT_FOUND', 'Nagroda niedostępna.', 'Reward unavailable.'); if (r.stock <= 0) return fail('OUT_OF_STOCK', 'Nagroda chwilowo niedostępna.', 'Out of stock.'); if (s.env.network === 'offline') return fail('OFFLINE', 'Odbiór nagrody wymaga połączenia z internetem.', 'You need to be online to claim a reward.'); if (sel.points() < r.cost) return fail('NOT_ENOUGH_POINTS', `Potrzebujesz ${r.cost} pkt.`, `You need ${r.cost} pts.`); const rec = { rewardId, code: code(8), at: nowIso(), status: 'to_collect' }; s.player.rewards.push(rec); r.stock--; return ok({ reward: r, code: rec.code, payload: `FPZ:N:${rec.code}` }); }],
  ['game.claimCoupon', 'POST', (id) => `/coupons/${id}/claim`, (ctx, couponId) => { const c = byId(ctx.s.coupons, couponId); if (!c) return fail('NOT_FOUND', 'Nie ma takiego kuponu.', 'No such coupon.'); const st = sel.couponState(c); if (st.claimed) return ok({ code: st.code, payload: `FPZ:K:${st.code}` }); if (!st.available) return { ok: false, error: 'CONDITION', message: st.hint }; const rec = { couponId, code: code(8), at: nowIso(), used: null }; ctx.s.player.coupons.push(rec); return ok({ code: rec.code, payload: `FPZ:K:${rec.code}` }); }],
  ['game.submitIdea', 'POST', '/ideas', (ctx, { categoryId, text, poiId = null, nick } = {}) => { const s = ctx.s; const t = String(text || '').trim(); if (t.length < 10) return fail('VALIDATION', 'Opisz pomysł w co najmniej kilku słowach.', 'Describe your idea in at least a few words.'); const idea = { id: uid('idea'), nick: nick || s.player.nick, categoryId: categoryId || s.ideaCategories[0]?.id, text: { pl: t, en: t }, poiId, votes: 0, status: s.settings.moderation ? 'pending' : 'approved', createdAt: nowIso(), device: ctx.clientId, deviceId: ctx.deviceId || 'local', mine: true }; s.ideas.unshift(idea); return ok({ idea, moderated: s.settings.moderation }); }],
  ['game.voteIdea', 'POST', (id) => `/ideas/${id}/vote`, (ctx, ideaId) => { const i = byId(ctx.s.ideas, ideaId); if (!i) return fail('NOT_FOUND', 'Nie ma takiego pomysłu.', 'No such idea.'); ctx.client.voted = ctx.client.voted || []; if (ctx.client.voted.includes(ideaId)) return fail('ALREADY', 'Twój głos został już oddany.', 'You have already voted.'); ctx.client.voted.push(ideaId); i.votes++; return ok({ votes: i.votes }); }],
  ['game.sync', 'POST', '/game/sync', (ctx) => { if (ctx.s.env.network === 'offline') return fail('OFFLINE', 'Brak połączenia – postępy czekają na synchronizację.', 'No connection – progress is waiting to sync.'); return ok({ synced: syncGame(ctx.s) }); }],
  ['game.reset', 'DELETE', '/game/progress', (ctx) => { const p = ctx.s.player; p.done = {}; p.quiz = {}; p.pending = []; p.activeRoute = null; p.rewards = []; p.coupons = []; p.ideaBonus = 0; return ok(); }],
  /* ── zwiedzanie: ulubione i własne ścieżki ── */
  ['visit.toggleFavorite', 'PUT', (id) => `/me/favorites/${id}`, (ctx, poiId) => { const f = ctx.s.player.favorites; const i = f.indexOf(poiId); if (i >= 0) f.splice(i, 1); else f.push(poiId); return ok({ favorite: i < 0 }); }, { quiet: true }],
  ['visit.saveRoute', 'POST', '/me/routes', (ctx, { id, name, poiIds } = {}) => { const rs = ctx.s.player.customRoutes; const r = id && byId(rs, id); if (r) Object.assign(r, { name, poiIds }); else rs.push({ id: uid('trasa'), name: name || 'Moja ścieżka', poiIds: poiIds || [], createdAt: nowIso() }); return ok({ routes: rs }); }],
  ['visit.deleteRoute', 'DELETE', (id) => `/me/routes/${id}`, (ctx, id) => { ctx.s.player.customRoutes = ctx.s.player.customRoutes.filter((r) => r.id !== id); return ok(); }],
  /** Propozycja indywidualnej ścieżki: { minutes, interests: [kind|tag…], accessibleOnly, scope } → { poiIds, minutes, distanceM } */
  ['visit.suggest', 'POST', '/routes/suggest', (ctx, { minutes = 60, interests = [], accessibleOnly = false, scope = 'fpz' } = {}) => {
    const s = ctx.s; let cand = s.pois.filter((p) => p.active !== false && p.scope === scope && (!accessibleOnly || p.accessible));
    const score = (p) => (interests.length ? interests.filter((i) => p.kind === i || (p.tags || []).includes(i)).length : 1) + (s.entries.some((e) => e.poiId === p.id) ? 0.5 : 0);
    cand = cand.map((p) => ({ p, sc: score(p) })).filter((x) => x.sc > 0 || !interests.length).sort((a, b) => b.sc - a.sc).map((x) => x.p);
    const stay = scope === 'fpz' ? 7 : 15, speed = scope === 'fpz' ? 70 : 250; const out = []; let pos = s.env.position, t = 0, dist = 0; const pool = cand.slice(0, 14);
    while (pool.length) { pool.sort((a, b) => distanceM(pos, a) - distanceM(pos, b)); const n = pool.shift(); const d = distanceM(pos, n); const dt = d / speed + stay; if (t + dt > minutes && out.length) break; out.push(n.id); t += dt; dist += d; pos = n; }
    return ok({ poiIds: out, minutes: Math.round(t), distanceM: Math.round(dist) });
  }],
  ['pjm.request', 'POST', '/access/pjm/calls', (ctx, where) => { const c = { id: uid('pjm'), clientId: ctx.clientId, where: where || ctx.clientId, startedAt: nowIso(), endedAt: null, status: 'active', interpreter: 'Tłumacz PJM (symulacja połączenia wideo)' }; ctx.s.pjmCalls.unshift(c); if (ctx.s.pjmCalls.length > 40) ctx.s.pjmCalls.length = 40; return ok({ call: c }); }],
  ['pjm.end', 'DELETE', (id) => `/access/pjm/calls/${id}`, (ctx, id) => { const c = byId(ctx.s.pjmCalls, id); if (c && !c.endedAt) { c.endedAt = nowIso(); c.status = 'ended'; } return ok(); }],
  /* ── otoczenie symulowane (pozycja, sieć, kamera, zegar) ── */
  ['env.set', 'PATCH', '/sim/env', (ctx, patch) => { const s = ctx.s; const wasOff = s.env.network === 'offline'; Object.assign(s.env, patch); if (wasOff && s.env.network !== 'offline' && s.player.pending.length) syncGame(s); if ('simTime' in patch) applySchedules(s); return ok(); }, { quiet: true }],
  ['env.moveTo', 'PATCH', '/sim/position', (ctx, target) => { const s = ctx.s; if (typeof target === 'string') { const p = byId(s.pois, target); if (!p) return fail('NOT_FOUND', 'Nie ma takiego punktu.', 'No such place.'); s.env.position = { lat: p.lat, lng: p.lng, poiId: p.id }; } else s.env.position = { lat: target.lat, lng: target.lng, poiId: null }; return ok(); }, { quiet: true }],
  /* ── analityka ── */
  ['stats.track', 'POST', '/analytics', (ctx, kind, id) => { const s = ctx.s; if (kind === 'entry') { const e = byId(s.entries, id); if (e) e.views = (e.views || 0) + 1; } else if (kind === 'session') bump(s, { mobile: 'app', web: 'web', kiosk: 'kiosk' }[ctx.clientId.split(':')[0]] || 'web'); else if (kind === 'touch') { const d = byId(s.devices, id); if (d) d.touchesToday = (d.touchesToday || 0) + 1; bump(s, 'kiosk'); } return ok(); }, { quiet: true, silent: true }],
  ...ADMIN_OPS,
];

function logCall(s, clientId, method, path, res) {
  const failed = res && res.ok === false; const status = !failed ? (method === 'POST' ? 201 : 200) : ({ AUTH_REQUIRED: 401, BAD_CREDENTIALS: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 422, PAYMENT_DECLINED: 402 }[res.error] || 409);
  s.apiLog.unshift({ id: uid('log'), t: Date.now(), client: clientId, method, path: '/api/v1' + path, status, error: failed ? res.error : null });
  if (s.apiLog.length > 250) s.apiLog.length = 250;
}
const OPS_BY_NAME = Object.fromEntries(OPS.map((o) => [o[0], o]));
/** Operacje wyłącznie lokalne (symulacja czujników telefonu) – nie są wysyłane na serwer. */
export const SHARED_ENV_KEYS = ['simTime', 'weather'];
const isLocalOnly = (name, args) => name === 'env.moveTo' || (name === 'env.set' && !Object.keys(args[0] || {}).some((k) => SHARED_ENV_KEYS.includes(k) || k === 'network'));
let remoteHook = null;
/** Rejestracja wysyłki operacji na serwer (kernel/remote.js). */
export function setRemoteHook(fn) { remoteHook = fn; }
/** Wykonanie operacji na podanym stanie – wspólne dla przeglądarki i serwera. Zwraca wynik operacji albo null, gdy operacja nie istnieje. */
export function runOp(s, name, { clientId, client, deviceId, nonce }, args) {
  const def = OPS_BY_NAME[name]; if (!def) return null; const [, method, path, fn, opts = {}] = def;
  const res = withIdSeed(nonce, () => fn({ s, clientId, client, deviceId: deviceId || 'local' }, ...args));
  if (!opts.quiet) logCall(s, clientId, method, typeof path === 'function' ? path(...args) : path, res);
  return res;
}
const cache = new Map();
/** API powiązane z końcówką (clientId trafia do dziennika i wyznacza sesję/koszyk). W komponentach używaj useClient().api */
export function makeApi(clientId) {
  if (cache.has(clientId)) return cache.get(clientId);
  const api = {};
  for (const [name, method, path, fn, opts = {}] of OPS) {
    const [ns, key] = name.split('.'); api[ns] = api[ns] || {};
    api[ns][key] = (...args) => {
      let res; const nonce = newNonce(); let snap = null; const send = remoteHook && !isLocalOnly(name, args);
      update((s) => {
        const client = ensureClient(s, clientId);
        if (send) snap = { client: deepClone(client), env: { position: s.env.position, network: s.env.network, qrInView: s.env.qrInView, arInView: s.env.arInView } };
        res = runOp(s, name, { clientId, client, deviceId: s.deviceId, nonce }, args);
      }, { silent: !!opts.silent });
      if (send) remoteHook({ op: name, args, nonce, clientId, client: snap.client, env: snap.env, lazy: !!opts.silent, localOk: !(res && res.ok === false) });
      return res;
    };
  }
  cache.set(clientId, api); return api;
}
export const apiOperations = () => OPS.map(([name, method, path]) => ({ name, method, path: typeof path === 'function' ? path(':id', { id: ':id' }) : path }));

let timers = false;
/** Tło „serwera”: telemetria urządzeń, harmonogramy, licznik widzów transmisji. */
export function startKernelTimers() {
  if (timers || typeof setInterval === 'undefined') return; timers = true;
  update((s) => applySchedules(s), { silent: true });
  setInterval(() => update((s) => {
    for (const d of s.devices) { if (d.power === 'on') { d.tempC = clamp(d.tempC + (Math.random() - 0.5) * 1.6, 34, 61); d.cpu = clamp(Math.round(d.cpu + (Math.random() - 0.5) * 8), 3, 92); d.uptimeH = +(d.uptimeH + 5 / 3600).toFixed(4); d.lastSeen = nowIso(); } }
    if (s.live.onAir) s.live.viewers = clamp(s.live.viewers + Math.round((Math.random() - 0.35) * 4), 3, 400);
  }, { silent: true }), 5000);
  setInterval(() => update((s) => applySchedules(s), { silent: true }), 20000);
}
