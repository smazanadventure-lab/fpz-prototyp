// Trasy płatności Tpay:
//   POST /api/pay/start    – utworzenie transakcji dla zamówienia, zwraca adres strony płatności Tpay
//   POST /api/pay/notify   – powiadomienie z Tpay (webhook, podpis JWS) → rozliczenie zamówienia i wydanie biletów
//   GET  /api/pay/status   – stan zamówienia; gdy wciąż „oczekuje”, serwer sam pyta Tpay o stan transakcji (zapas na wypadek braku powiadomienia)
//   GET  /api/pay/return   – strona, na którą Tpay odsyła płacącego po płatności (sukces / błąd)
//   GET  /api/pay/check    – diagnostyka konfiguracji (czy klucze działają) – bez ujawniania kluczy
// Bilety powstają wyłącznie po potwierdzeniu z Tpay: podpisanym powiadomieniu albo stanie transakcji odczytanym z API Tpay.
import { setState } from '../src/kernel/store.js';
import { settleOrder, refundByOperator } from '../src/kernel/api.js';
import { tpayConfig, createTransaction, getTransaction, isPaid, sameAmount, verifyJws, parseNotification, checkAuth, TpayError } from './tpay.mjs';

const ORDER_ID = /^[A-Za-z0-9][\w-]{2,59}$/;
const REUSE_MS = 20 * 60e3; // ponowne wejście w płatność w tym czasie wraca do tej samej transakcji
const lastCheck = new Map(); // zamówienie → czas ostatniego pytania do Tpay (nie częściej niż co kilka sekund)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = (body, status, headers) => new Response(body, { status: status || 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const msg = (pl, en) => ({ pl, en });

/** Informacja dla klientów (dołączana do synchronizacji): kto obsługuje płatności. */
export function payInfo() { const cfg = tpayConfig(); return cfg ? { provider: 'tpay', env: cfg.mode } : null; }
/** Operacja „booking.pay” to płatność symulowana – przy włączonym Tpay serwer jej nie przyjmuje. */
export const blocksSimulatedPay = (op) => op === 'booking.pay' && !!tpayConfig();

function landing({ state, order, lang, native }) {
  const en = lang === 'en';
  const T = {
    paid: en ? ['Payment received', `Order ${order?.no || ''} is paid. Your tickets are waiting in the app and on the website.`] : ['Płatność przyjęta', `Zamówienie ${order?.no || ''} jest opłacone. Bilety czekają w aplikacji i na stronie WWW.`],
    waiting: en ? ['Waiting for confirmation', 'Tpay has not confirmed the payment yet. This usually takes a few seconds – this page refreshes by itself.'] : ['Czekamy na potwierdzenie', 'Tpay jeszcze nie potwierdził płatności. Zwykle trwa to kilka sekund – ta strona odświeży się sama.'],
    failed: en ? ['Payment not completed', 'No money was taken. Go back and try again – your order is still waiting.'] : ['Płatność nie została dokończona', 'Pieniądze nie zostały pobrane. Wróć i spróbuj ponownie – zamówienie nadal czeka.'],
    unknown: en ? ['Order not found', 'We could not find this order.'] : ['Nie znaleziono zamówienia', 'Nie udało się odnaleźć tego zamówienia.'],
  }[state];
  const back = native ? (en ? 'Go back to the Fabryka Pełna Życia app.' : 'Wróć do aplikacji Fabryka Pełna Życia.') : (en ? 'Go back to the previous tab – you can close this one.' : 'Wróć do poprzedniej karty – tę możesz zamknąć.');
  const color = state === 'paid' ? '#0a6b3d' : state === 'waiting' ? '#8a5a00' : '#a02323';
  return `<!doctype html><html lang="${en ? 'en' : 'pl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(T[0])} – Fabryka Pełna Życia</title>
<style>body{margin:0;font:17px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f3f6f4;color:#14261d;display:grid;min-height:100vh;place-items:center}main{background:#fff;border-radius:20px;padding:32px 28px;max-width:440px;margin:20px;box-shadow:0 8px 30px rgba(0,40,20,.12);text-align:center}h1{font-size:24px;margin:0 0 10px;color:${color}}p{margin:8px 0}.b{font-weight:600}.s{color:#51635a;font-size:14px;margin-top:18px}</style></head>
<body><main><h1>${esc(T[0])}</h1><p>${esc(T[1])}</p><p class="b">${esc(back)}</p><p class="s">Fabryka Pełna Życia · ${en ? 'payments by' : 'płatności obsługuje'} Tpay</p></main>
<script>${state === 'waiting' ? 'var n=+(new URLSearchParams(location.search).get("i")||0);if(n<12)setTimeout(function(){var u=new URL(location.href);u.searchParams.set("i",n+1);location.replace(u)},2500);' : state === 'paid' && !native ? 'setTimeout(function(){try{window.close()}catch(e){}},3500);' : ''}</script></body></html>`;
}

export function createPayRoutes({ load, mutate, compose, decompose, json }) {
  /** Zmiana stanu zamówienia w kształcie oczekiwanym przez operacje domenowe. */
  const withState = (storage, fn) => mutate(storage, (doc) => { const c = compose(doc, 'tpay', null); setState(c.s); const out = fn(c.s); decompose(doc, c); return out; });
  const paymentOf = (cfg, extra) => ({ operator: cfg.mode === 'production' ? 'Tpay' : cfg.mode === 'mock' ? 'Tpay (atrapa testowa)' : 'Tpay (sandbox)', provider: 'tpay', env: cfg.mode, method: 'tpay', ...extra });

  /** Zapasowe potwierdzenie: pytamy Tpay o stan transakcji i – gdy opłacona – rozliczamy zamówienie. */
  async function verifyWithTpay(storage, cfg, order, { force = false } = {}) {
    const p = order.payment; if (!p || p.provider !== 'tpay' || !p.txId || !['pending', 'cancelled'].includes(order.status)) return null;
    const last = lastCheck.get(order.id) || 0; if (!force && Date.now() - last < 4000) return null; lastCheck.set(order.id, Date.now()); if (lastCheck.size > 500) lastCheck.clear();
    for (const txId of [...new Set([p.txId, ...(p.tx || [])])].slice(0, 4)) {
      const tx = await getTransaction(cfg, txId);
      if (isPaid(tx, order.total, order.id)) { await withState(storage, (s) => settleOrder(s, order.id, paymentOf(cfg, { txId, title: tx.title || p.title || null, confirmedBy: 'api' }))); return 'paid'; }
    }
    return 'pending';
  }

  return async function payRoute(route, request, url, q, storage, cors) {
    if (!route.startsWith('pay/')) return null;
    const cfg = tpayConfig();

    if (route === 'pay/check' && request.method === 'GET') {
      if (!cfg) return json({ ok: true, provider: null, message: 'Klucze Tpay nie są ustawione – działa płatność symulowana.' }, 200, cors);
      try { await checkAuth(cfg); return json({ ok: true, provider: 'tpay', env: cfg.mode, auth: 'ok', md5: cfg.securityCode !== null, notifyUrl: url.origin + '/api/pay/notify' }, 200, cors); }
      catch (e) { return json({ ok: false, provider: 'tpay', env: cfg.mode, auth: 'error', message: String(e?.message || e) }, 200, cors); }
    }

    if (route === 'pay/start' && request.method === 'POST') {
      if (!cfg) return json({ ok: false, error: 'PAYMENTS_SIMULATED', message: msg('Płatności Tpay nie są włączone na serwerze.', 'Tpay payments are not enabled on the server.') }, 409, cors);
      const b = await request.json().catch(() => null); const orderId = String(b?.orderId || ''); if (!ORDER_ID.test(orderId)) return json({ ok: false, error: 'BAD_REQUEST' }, 400, cors);
      const { doc } = await load(storage); const o = doc.data.orders.find((x) => x.id === orderId);
      if (!o) return json({ ok: false, error: 'NOT_FOUND', message: msg('Zamówienie nie dotarło jeszcze na serwer. Spróbuj ponownie za chwilę.', 'The order has not reached the server yet. Try again in a moment.') }, 404, cors);
      if (o.status === 'paid') return json({ ok: true, paid: true }, 200, cors);
      if (o.status !== 'pending') return json({ ok: false, error: 'STATE', message: msg('Zamówienie nie oczekuje na płatność.', 'This order is not awaiting payment.') }, 409, cors);
      if (!(o.total > 0)) { await withState(storage, (s) => settleOrder(s, o.id, { operator: 'Bez płatności', provider: 'free', method: 'free', txId: null })); return json({ ok: true, paid: true }, 200, cors); }
      const p = o.payment;
      if (!b.fresh && p?.provider === 'tpay' && p.env === cfg.mode && p.url && p.pending && Date.now() - Date.parse(p.startedAt || 0) < REUSE_MS) return json({ ok: true, url: p.url, reused: true }, 200, cors);
      const u = doc.data.users.find((x) => x.id === o.userId); const lang = b.lang === 'en' ? 'en' : 'pl';
      const ret = (w) => `${url.origin}/api/pay/return?z=${encodeURIComponent(o.id)}&w=${w}&l=${lang}${b.native ? '&n=1' : ''}`;
      let tx;
      try { tx = await createTransaction(cfg, { amount: o.total, description: `Fabryka Pełna Życia – bilety, zamówienie ${o.no}`, crc: o.id, email: u?.email, name: u?.name, lang, successUrl: ret('ok'), errorUrl: ret('blad'), notifyUrl: `${url.origin}/api/pay/notify` }); }
      catch (e) { console.error('[tpay] start', e); return json({ ok: false, error: 'TPAY_ERROR', message: msg('Operator płatności nie przyjął zlecenia. Spróbuj ponownie za chwilę.', 'The payment operator did not accept the request. Please try again in a moment.'), detail: e instanceof TpayError ? e.message : undefined }, 502, cors); }
      const res = await withState(storage, (s) => {
        const cur = s.orders.find((x) => x.id === o.id); if (!cur || cur.status !== 'pending') return { ok: false };
        cur.payment = paymentOf(cfg, { txId: tx.transactionId, title: tx.title, url: tx.url, startedAt: new Date().toISOString(), pending: true, tx: [...new Set([...(cur.payment?.tx || []), tx.transactionId])].slice(-4) });
        return { ok: true };
      });
      if (!res.out?.ok) return json({ ok: false, error: 'STATE', message: msg('Zamówienie nie oczekuje już na płatność.', 'This order is no longer awaiting payment.') }, 409, cors);
      return json({ ok: true, url: tx.url }, 200, cors);
    }

    if (route === 'pay/notify' && request.method === 'POST') {
      if (!cfg) return text('FALSE - Tpay nie jest skonfigurowany', 404);
      const raw = await request.text(); const sig = await verifyJws(cfg, request.headers.get('x-jws-signature'), raw);
      if (!sig.ok) { console.warn('[tpay] odrzucone powiadomienie:', sig.reason); return text('FALSE - ' + sig.reason, 403); }
      const n = parseNotification(cfg, raw); if (!n.ok) { console.warn('[tpay] odrzucone powiadomienie:', n.reason); return text('FALSE - ' + n.reason, 400); }
      const r = await withState(storage, (s) => {
        const o = s.orders.find((x) => x.id === n.crc); if (!o) return { note: 'nieznane zamówienie ' + n.crc };
        if (n.kind === 'paid') {
          if (!sameAmount(n.amount, o.total) || !(n.paid + 0.005 >= o.total)) return { reject: `kwota ${n.fields.tr_paid ?? n.fields.tr_amount} nie zgadza się z zamówieniem (${o.total})` };
          const res = settleOrder(s, o.id, paymentOf(cfg, { txId: o.payment?.txId || null, title: n.title || o.payment?.title || null, confirmedBy: 'webhook' })); return { note: res.ok ? (res.already ? 'już opłacone' : 'opłacone') : 'stan zamówienia: ' + (res.status || res.error) };
        }
        if (n.kind === 'refund') { const res = refundByOperator(s, o.id); return { note: res.ok ? 'zwrot' : 'zwrot pominięty: ' + res.error }; }
        return { note: 'stan ' + n.fields.tr_status + ' – bez zmian' };
      });
      if (r.out?.reject) { console.warn('[tpay] odrzucone powiadomienie:', r.out.reject); return text('FALSE - ' + r.out.reject, 400); }
      console.log('[tpay] powiadomienie', n.title, n.crc, r.out?.note);
      return text('TRUE');
    }

    if ((route === 'pay/status' || route === 'pay/return') && request.method === 'GET') {
      const id = String(q.z || ''); const isReturn = route === 'pay/return'; const lang = q.l === 'en' ? 'en' : 'pl';
      const html = (state, order) => new Response(landing({ state, order, lang, native: q.n === '1' }), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      if (!ORDER_ID.test(id)) return isReturn ? html('unknown') : json({ ok: false, error: 'BAD_REQUEST' }, 400, cors);
      let { doc } = await load(storage); let o = doc.data.orders.find((x) => x.id === id);
      if (!o) return isReturn ? html('unknown') : json({ ok: false, error: 'NOT_FOUND' }, 404, cors);
      let checkError = null;
      if (cfg && o.status !== 'paid') { try { if (await verifyWithTpay(storage, cfg, o, { force: isReturn && !q.i }) === 'paid') { ({ doc } = await load(storage)); o = doc.data.orders.find((x) => x.id === id) || o; } } catch (e) { console.error('[tpay] status', e); checkError = String(e?.message || e).slice(0, 200); } }
      if (isReturn) return html(o.status === 'paid' ? 'paid' : q.w === 'ok' ? 'waiting' : 'failed', o);
      return json({ ok: true, status: o.status, provider: o.payment?.provider || null, env: o.payment?.env || null, url: o.status === 'pending' && o.payment?.pending ? o.payment.url || null : null, ...(checkError ? { checkError } : {}) }, 200, cors);
    }
    return json({ error: 'NOT_FOUND', route }, 404, cors);
  };
}
