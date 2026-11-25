// Koszyk, kasa, bramka operatora płatności (środowisko testowe, SCA), potwierdzenie zamówienia.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { payProvider, payEnv, startPayment, paymentStatus, refreshNow } from '../../kernel/pay.js';
import { isNative } from '../../shell/native.js';
import { fmtDay, fmtTime, fmtMoney, fmtDateTime, clsx } from '../../kernel/util.js';
import { Button, IconButton, Tag, Empty, Notice, Icon, Checkbox, Modal, Progress } from '../../ui/components.jsx';
import { useRes, Stepper, TicketCard, AuthPanel, OrderStatus } from './common.jsx';

export const METHOD_ICON = { blik: 'phone', card: 'card', transfer: 'building' };
const TEST_CARDS = [
  { id: 'visa', label: 'Visa •••• 4242', note: ['karta testowa – 12/30', 'test card – 12/30'] },
  { id: 'mc', label: 'Mastercard •••• 5454', note: ['karta testowa – 3-D Secure', 'test card – 3-D Secure'] },
  { id: 'visa2', label: 'Visa •••• 0002', note: ['karta testowa – dowolny wynik', 'test card – any outcome'] },
];
const TEST_BANKS = ['Bank Testowy A', 'Bank Testowy B', 'Bank Spółdzielczy (test)', 'Bank Cyfrowy (test)'];

/* ───────── Koszyk ───────── */
export function CartLines({ editable = true }) {
  const { t, L, lang, client, api, toast } = useClient(); const { announce, go } = useRes(); const cart = sel.cart(client);
  const setQ = (pid, q) => { const r = api.booking.setQty(pid, q); if (!r.ok) { toast(L(r.message), 'error'); return; } announce(t('r.cart.updated', { n: r.cart.count, sum: fmtMoney(r.cart.total, lang) })); };
  return (
    <ul class="r-lines">
      {cart.items.map((it) => {
        const max = Math.min(it.product.maxPerOrder || 10, it.product.eventId ? sel.remaining(it.product.eventId) : 99);
        return (
          <li key={it.productId} class="r-line">
            <div class="r-line__info">
              <b>{it.event ? L(it.event.title) : L(it.product.name)}</b>
              <span class="r-muted">{it.event ? `${L(it.product.name)} · ${fmtDay(it.event.start, lang)}, ${fmtTime(it.event.start, lang)}` : L(it.product.description)}</span>
              <span class="r-prod__small">{fmtMoney(it.product.price, lang)} × {it.qty}</span>
            </div>
            <div class="r-line__ctl">
              {editable ? <Stepper value={it.qty} min={0} max={max} onChange={(q) => setQ(it.productId, q)} label={L(it.product.name)} /> : <span>× {it.qty}</span>}
              <b class="r-price">{fmtMoney(it.lineTotal, lang)}</b>
              {editable && <IconButton icon="trash" variant="plain" size="sm" label={`${t('r.cart.remove')}: ${L(it.product.name)}`} onClick={() => setQ(it.productId, 0)} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
export function CartView() {
  const { t, lang, client, api } = useClient(); const { go, offline } = useRes(); const cart = sel.cart(client);
  if (!cart.items.length) return <Empty icon="cart" title={t('r.cart.empty')} text={t('r.cart.emptyText')}><Button icon="calendar" onClick={() => go('events')}>{t('r.home.allEvents')}</Button></Empty>;
  return (
    <div class="r-stack r-narrow">
      <CartLines />
      <div class="r-total"><span>{t('r.cart.total')}</span><b>{fmtMoney(cart.total, lang)}</b></div>
      {offline && <Notice tone="warn" icon="wifiOff">{t('r.off.blocked')}</Notice>}
      <div class="r-actions">
        <Button variant="ghost" icon="trash" onClick={() => api.booking.clearCart()}>{t('r.cart.clear')}</Button>
        <Button icon="arrowRight" size="lg" onClick={() => go('checkout')} disabled={offline}>{t('r.cart.toCheckout')}</Button>
      </div>
    </div>
  );
}
/** Panel boczny koszyka (układ szeroki). */
export function CartAside() {
  const { t, L, lang, client } = useClient(); const { go, offline } = useRes(); const cart = sel.cart(client);
  return (
    <aside class="r-aside" aria-labelledby="r-aside-h">
      <h2 class="r-h3" id="r-aside-h"><Icon name="cart" size={18} /> {t('r.cart.title')}</h2>
      {cart.items.length ? <>
        <ul class="r-mini">{cart.items.map((it) => <li key={it.productId}><span>{it.qty} × {it.event ? L(it.event.title) : L(it.product.name)}</span><b>{fmtMoney(it.lineTotal, lang)}</b></li>)}</ul>
        <div class="r-total r-total--sm"><span>{t('r.cart.total')}</span><b>{fmtMoney(cart.total, lang)}</b></div>
        <Button block icon="cart" variant="secondary" onClick={() => go('cart')}>{t('r.cart.show')}</Button>
        <Button block icon="arrowRight" onClick={() => go('checkout')} disabled={offline}>{t('r.cart.toCheckout')}</Button>
      </> : <p class="r-muted">{t('r.cart.emptyText')}</p>}
    </aside>
  );
}

/* ───────── Kasa ───────── */
export function CheckoutView() {
  const { t, L, lang, client, api, user, toast } = useClient(); const { go, replace, offline, announce } = useRes();
  const methods = getState().settings.payments.methods || ['blik']; const tpay = payProvider() === 'tpay';
  const [method, setMethod] = useState(methods[0]); const [terms, setTerms] = useState(false); const [err, setErr] = useState('');
  const cart = sel.cart(client);
  if (!cart.items.length) return <Empty icon="cart" title={t('r.cart.empty')}><Button onClick={() => go('events')}>{t('r.home.allEvents')}</Button></Empty>;
  const submit = (e) => {
    e.preventDefault(); if (!terms) { setErr(t('r.co.termsReq')); announce(t('r.co.termsReq')); return; }
    const r = api.booking.checkout(); if (!r.ok) { setErr(L(r.message)); toast(L(r.message), 'error'); return; }
    replace('pay', r.order.id, { method });
  };
  return (
    <div class="r-checkout">
      <section class="r-stack-sm r-panel">
        <h2 class="r-h3">{t('r.co.summary')}</h2>
        <CartLines />
        <div class="r-total"><span>{t('r.cart.total')}</span><b>{fmtMoney(cart.total, lang)}</b></div>
      </section>
      <section class="r-stack-sm r-panel">
        <h2 class="r-h3">{t('r.co.buyer')}</h2>
        {!user ? <><Notice tone="info" icon="user">{t('r.co.loginFirst')}</Notice><AuthPanel /></> : (
          <form class="r-form" onSubmit={submit} noValidate>
            <div class="r-buyer"><Icon name="user" size={20} /><div><b>{user.name}</b><span>{user.email}</span>{user.phone && <span>{user.phone}</span>}</div><Button variant="ghost" size="sm" icon="edit" onClick={() => go('account')}>{t('r.co.editProfile')}</Button></div>
            {tpay ? <div class="r-tpnote"><span class="r-label">{t('r.co.method')}</span><p><Icon name="shield" size={18} /><span>{t('r.co.tpayNote')}</span></p></div> : (
              <fieldset class="r-methods"><legend class="r-label">{t('r.co.method')}</legend>
                {methods.map((m) => <label key={m} class={clsx('r-method', method === m && 'is-sel')}><input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} /><Icon name={METHOD_ICON[m] || 'wallet'} size={20} /><span>{t('r.m.' + m)}</span></label>)}
              </fieldset>
            )}
            <Checkbox name="terms" label={t('r.co.terms')} checked={terms} onChange={(e) => { setTerms(e.currentTarget.checked); setErr(''); }} />
            <p class="r-prod__small">{t('r.co.mailInfo', { email: user.email })}</p>
            {err && <Notice tone="danger">{err}</Notice>}
            {offline && <Notice tone="warn" icon="wifiOff">{t('r.off.blocked')}</Notice>}
            <Button type="submit" size="lg" icon="wallet" block disabled={offline}>{t('r.co.pay', { sum: fmtMoney(cart.total, lang) })}</Button>
          </form>
        )}
      </section>
    </div>
  );
}

/* ───────── Płatność: Tpay (gdy serwer ma włączony Tpay) albo symulowana bramka operatora ───────── */
export function PayView(props) { return payProvider() === 'tpay' ? <TpayView {...props} /> : <SimPayView {...props} />; }

/* ───────── Bramka operatora płatności (symulacja zewnętrznego serwisu) ───────── */
function SimPayView({ id, p }) {
  const { t, L, lang, api, toast, user } = useClient(); const { replace, reset, go, offline, announce } = useRes();
  const o = sel.order(id); const op = getState().settings.payments; const methods = op.methods || ['blik'];
  const [method, setMethod] = useState(p?.method || methods[0]); const [step, setStep] = useState('method'); const [card, setCard] = useState(TEST_CARDS[0].id); const [bank, setBank] = useState(TEST_BANKS[0]);
  const [error, setError] = useState(null); const blik = useMemo(() => String(Math.floor(100000 + Math.random() * 900000)), [step === 'method']);
  if (!o) return <Empty icon="receipt" title={t('c.empty')} />;
  if (o.status !== 'pending') return <div class="r-narrow r-stack"><Notice tone="info">{t('r.pay.notPending')}</Notice><Button onClick={() => replace('order', o.id)}>{t('r.nav.order')} {o.no}</Button></div>;
  const finish = (outcome) => {
    setStep('processing');
    setTimeout(() => {
      const r = api.booking.pay(o.id, { method, outcome });
      if (r.ok) { toast(t('r.ok.title'), 'ok'); announce(t('r.ok.title')); reset([{ view: 'home' }, { view: 'tickets', p: { tab: 'orders' } }, { view: 'order', id: o.id, p: { fresh: true } }]); }
      else { setError(L(r.message)); setStep('failed'); announce(L(r.message)); }
    }, 600);
  };
  const cancel = () => { const r = api.booking.cancel(o.id); if (r.ok) { toast(t('r.o.cancelled.ok'), 'info'); reset([{ view: 'home' }, { view: 'tickets', p: { tab: 'orders' } }]); } else toast(L(r.message), 'error'); };
  return (
    <div class="r-gw" role="region" aria-label={`${t('r.pay.gateway')} – ${op.operator}`}>
      <div class="r-gw__bar"><Icon name="shield" size={18} /><b>{op.operator}</b><span class="r-gw__url">pay.sandbox.example / {o.no}</span><Tag tone="warn">{t('r.test')}</Tag></div>
      <div class="r-gw__body">
        <Notice tone="warn" icon="alert">{t('r.pay.sandbox')}</Notice>
        <dl class="r-gw__sum">
          <div><dt>{t('r.pay.merchant')}</dt><dd>Fabryka Pełna Życia</dd></div>
          <div><dt>{t('r.pay.orderNo')}</dt><dd>{o.no}</dd></div>
          <div><dt>{t('r.pay.amount')}</dt><dd class="r-gw__amt">{fmtMoney(o.total, lang)}</dd></div>
        </dl>
        {step === 'method' && <>
          <div class="r-gw__methods" role="radiogroup" aria-label={t('r.co.method')}>
            {methods.map((m) => <button key={m} type="button" role="radio" aria-checked={method === m} class={clsx('r-gw__m', method === m && 'is-sel')} onClick={() => setMethod(m)}><Icon name={METHOD_ICON[m] || 'wallet'} size={22} />{t('r.m.' + m)}</button>)}
          </div>
          {method === 'blik' && <div class="r-gw__panel"><span class="r-label">{t('r.pay.blikCode')}</span><output class="r-blik" aria-live="polite">{blik.slice(0, 3)} {blik.slice(3)}</output><span class="r-prod__small">{t('r.pay.blikInfo')}</span></div>}
          {method === 'card' && <fieldset class="r-gw__panel"><legend class="r-label">{t('r.pay.chooseCard')}</legend>{TEST_CARDS.map((c) => <label key={c.id} class={clsx('r-method', card === c.id && 'is-sel')}><input type="radio" name="card" checked={card === c.id} onChange={() => setCard(c.id)} /><Icon name="card" size={20} /><span><b>{c.label}</b><small class="r-prod__small"> · {lang === 'pl' ? c.note[0] : c.note[1]}</small></span></label>)}</fieldset>}
          {method === 'transfer' && <fieldset class="r-gw__panel"><legend class="r-label">{t('r.pay.chooseBank')}</legend><div class="r-banks">{TEST_BANKS.map((b) => <label key={b} class={clsx('r-method', bank === b && 'is-sel')}><input type="radio" name="bank" checked={bank === b} onChange={() => setBank(b)} /><Icon name="building" size={18} /><span>{b}</span></label>)}</div></fieldset>}
          <div class="r-actions">
            <Button variant="ghost" icon="back" onClick={() => go('tickets', null, { tab: 'orders' })}>{t('r.pay.back')}</Button>
            <Button icon="shield" onClick={() => setStep('sca')} disabled={offline}>{t('r.pay.continue')}</Button>
          </div>
        </>}
        {step === 'sca' && <Sca o={o} onResult={finish} />}
        {step === 'processing' && <div class="r-gw__panel r-center" role="status"><div class="fpz-spinner" /><span>{t('r.pay.processing')}</span></div>}
        {step === 'failed' && <div class="r-gw__panel r-stack-sm" role="alert">
          <b class="r-fail"><Icon name="circleX" size={22} /> {t('r.pay.failed')}</b><span>{error}</span>
          <div class="r-actions"><Button variant="secondary" icon="close" onClick={cancel}>{t('r.pay.cancelOrder')}</Button><Button icon="refresh" onClick={() => { setError(null); setStep('method'); }}>{t('r.pay.retry')}</Button></div>
        </div>}
      </div>
    </div>
  );
}
/* ───────── Płatność przez Tpay: strona operatora w nowej karcie (WWW) albo w przeglądarce systemowej (APK) ───────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function TpayView({ id }) {
  const { t, L, lang, api, toast } = useClient(); const { replace, reset, offline, announce } = useRes();
  const o = sel.order(id); const env = payEnv(); const test = env !== 'production'; const native = isNative();
  const resumable = !!(o && o.status === 'pending' && o.payment?.provider === 'tpay' && o.payment.pending && o.payment.url);
  const [phase, setPhase] = useState(resumable ? 'wait' : 'intro'); // intro → wait → done
  const [url, setUrl] = useState(resumable ? o.payment.url : null);
  const [busy, setBusy] = useState(false); const [checking, setChecking] = useState(false);
  const [err, setErr] = useState(''); const [blocked, setBlocked] = useState(false); const [note, setNote] = useState('');
  const wasPending = useRef(o?.status === 'pending'); // zamówienie czekało na płatność, gdy widok się otworzył
  const alive = useRef(true); const done = useRef(false); const inFlight = useRef(false); const off = useRef(offline); off.current = offline;
  const waitRef = useRef(null);
  useEffect(() => () => { alive.current = false; }, []);

  /** Zapłacone: czekamy, aż zamówienie i bilety dotrą do lokalnego stanu, potem ekran zamówienia. */
  const paid = async () => {
    if (done.current) return; done.current = true; setPhase('done'); announce(t('r.tp.confirmed'));
    const t0 = Date.now();
    while (alive.current && sel.order(id)?.status !== 'paid' && Date.now() - t0 < 20000) { refreshNow(); await sleep(600); }
    if (!alive.current) return;
    api.booking.clearCart(); toast(t('r.ok.title'), 'ok'); announce(t('r.ok.title'));
    reset([{ view: 'home' }, { view: 'tickets', p: { tab: 'orders' } }, { view: 'order', id, p: { fresh: true } }]);
  };
  const check = async (manual) => {
    if (done.current || inFlight.current || off.current) return; inFlight.current = true; if (manual) { setChecking(true); setNote(''); }
    const r = await paymentStatus(id); inFlight.current = false;
    if (!alive.current || done.current) return; if (manual) setChecking(false);
    if (r?.ok && r.status === 'paid') return paid();
    if (r?.ok && r.status !== 'pending') { refreshNow(); return; } // anulowane/zwrócone – widok pokaże stan zamówienia po synchronizacji
    if (r?.ok && r.url) setUrl(r.url);
    if (manual) { const m = r?.ok ? t('r.tp.stillPending') : L(r?.message) || t('r.tp.error'); setNote(m); announce(m); }
  };
  // zamówienie opłacone w stanie lokalnym (np. synchronizacja przyszła przed odpytywaniem)
  useEffect(() => { if (o?.status === 'paid' && wasPending.current) paid(); }, [o?.status]);
  // odpytywanie co 3 s i od razu po powrocie do karty / aplikacji
  useEffect(() => {
    if (phase !== 'wait') return;
    const iv = setInterval(() => check(false), 3000);
    const vis = () => { if (!document.hidden) check(false); };
    document.addEventListener('visibilitychange', vis); window.addEventListener('focus', vis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', vis); };
  }, [phase]);
  // płatność rozpoczęta wcześniej (np. na innym urządzeniu) dotarła z synchronizacją – od razu stan oczekiwania
  useEffect(() => { if (phase === 'intro' && !busy && resumable) { setUrl(o.payment.url); setPhase('wait'); } }, [resumable]);
  // fokus nie ginie, gdy znikają przyciski ekranu wstępnego (przenosimy go tylko, gdy był w tym widoku albo nigdzie)
  useEffect(() => { const a = document.activeElement; if (phase === 'wait' && (!a || a === document.body || a.closest?.('.r-tp'))) waitRef.current?.focus({ preventScroll: true }); }, [phase]);

  const start = async (fresh) => {
    if (busy || off.current || done.current) return;
    setErr(''); setNote(''); setBlocked(false);
    // nowa karta otwierana od razu w obsłudze kliknięcia – inaczej przeglądarka ją zablokuje; w APK nie (pusta strona zastąpiłaby aplikację)
    let w = null;
    if (!native) {
      try { w = window.open('', '_blank'); } catch { w = null; }
      if (w) { try { w.document.title = 'Tpay'; const pEl = w.document.createElement('p'); pEl.textContent = t('r.tp.tabText'); pEl.style.cssText = 'font:18px system-ui,sans-serif;margin:40px auto;max-width:440px;padding:0 16px;color:#333'; w.document.body.appendChild(pEl); } catch { /* nic */ } try { w.opener = null; } catch { /* nic */ } }
    }
    setBusy(true);
    const r = await startPayment(id, { lang, fresh: !!fresh, native });
    if (!alive.current) { try { w?.close(); } catch { /* nic */ } return; }
    setBusy(false);
    if (!r?.ok) {
      try { w?.close(); } catch { /* nic */ }
      const m = L(r?.message) || t('r.tp.error'); setErr(m); announce(m); if (r?.error === 'STATE') refreshNow(); return;
    }
    if (r.paid) { try { w?.close(); } catch { /* nic */ } return paid(); }
    setUrl(r.url);
    if (native) window.location.href = r.url; // Capacitor otwiera adresy zewnętrzne w przeglądarce systemowej, aplikacja zostaje na miejscu
    else if (w && !w.closed) w.location.href = r.url;
    else setBlocked(true);
    if (phase === 'wait') { announce(t('r.tp.waitTitle')); waitRef.current?.focus({ preventScroll: true }); } else setPhase('wait');
  };
  const cancel = () => { const r = api.booking.cancel(id); if (r.ok) { done.current = true; toast(t('r.o.cancelled.ok'), 'info'); reset([{ view: 'home' }, { view: 'tickets', p: { tab: 'orders' } }]); } else toast(L(r.message), 'error'); };

  if (!o) return <Empty icon="receipt" title={t('c.empty')} />;
  const confirming = phase === 'done' || (o.status === 'paid' && wasPending.current);
  if (!confirming && o.status !== 'pending') return <div class="r-narrow r-stack"><Notice tone="info">{t('r.pay.notPending')}</Notice><Button onClick={() => replace('order', o.id)}>{t('r.nav.order')} {o.no}</Button></div>;
  const linkTarget = native ? {} : { target: '_blank', rel: 'noopener' };
  return (
    <section class="r-tp r-panel" aria-labelledby="r-tp-h">
      <div class="r-tp__head">
        <span class="r-tp__ic" aria-hidden="true"><Icon name="shield" size={22} /></span>
        <div class="r-tp__titles"><h2 class="r-h3" id="r-tp-h">{t('r.tp.title')}</h2>{test && <Tag tone="warn">{t('r.tp.testTag')}</Tag>}</div>
      </div>
      <dl class="r-gw__sum">
        <div><dt>{t('r.pay.merchant')}</dt><dd>Fabryka Pełna Życia</dd></div>
        <div><dt>{t('r.pay.orderNo')}</dt><dd>{o.no}</dd></div>
        <div><dt>{t('r.pay.amount')}</dt><dd class="r-gw__amt">{fmtMoney(o.total, lang)}</dd></div>
      </dl>
      {test && <Notice tone="warn" icon="alert">{t('r.tp.testNote')}</Notice>}
      {confirming ? <div class="r-center" role="status"><div class="fpz-spinner" /><span>{t('r.tp.confirmed')}</span></div> : phase === 'intro' ? <>
        <p class="r-tp__lead">{t('r.tp.lead')}</p>
        <ul class="r-tp__methods" aria-label={t('r.co.method')}>{['blik', 'card', 'transfer'].map((m) => <li key={m}><Icon name={METHOD_ICON[m]} size={16} />{t('r.m.' + m)}</li>)}</ul>
        <p class="r-prod__small">{t(native ? 'r.tp.howApp' : 'r.tp.howWeb')}</p>
        {err && <div role="alert"><Notice tone="danger">{err}</Notice></div>}
        {offline && <Notice tone="warn" icon="wifiOff">{t('r.off.blocked')}</Notice>}
        <div class="r-actions">
          <Button variant="secondary" icon="close" onClick={cancel} disabled={busy}>{t('r.pay.cancelOrder')}</Button>
          <Button icon={busy ? null : 'shield'} size="lg" onClick={() => start(false)} disabled={offline} aria-disabled={busy ? 'true' : undefined} aria-busy={busy ? 'true' : undefined} data-testid="r-tp-pay">{busy ? t('r.tp.starting') : t('r.tp.pay')}</Button>
        </div>
      </> : <>
        <div class="r-tp__wait">
          <div class="fpz-spinner" aria-hidden="true" />
          <div role="status" aria-live="polite" class="r-tp__waittxt">
            <b tabIndex={-1} ref={waitRef}>{t('r.tp.waitTitle')}</b>
            <span>{t('r.tp.waitText')}</span>
          </div>
        </div>
        {blocked && <Notice tone="info" icon="external">{t('r.tp.blocked')}</Notice>}
        <div class="r-tp__row">
          {url && <a class="fpz-btn fpz-btn--primary" href={url} {...linkTarget} data-testid="r-tp-link"><Icon name="external" size={18} />{t('r.tp.reopen')}</a>}
          <Button variant="secondary" icon="check" onClick={() => check(true)} disabled={offline} aria-disabled={checking ? 'true' : undefined} aria-busy={checking ? 'true' : undefined}>{t('r.tp.checkNow')}</Button>
        </div>
        {note && <p class="r-prod__small">{note}</p>}
        {err && <div role="alert"><Notice tone="danger">{err}</Notice></div>}
        {offline && <Notice tone="warn" icon="wifiOff">{t('r.off.blocked')}</Notice>}
        <p class="r-prod__small">{t('r.tp.retryInfo')}</p>
        <div class="r-actions">
          <Button variant="ghost" icon="close" onClick={cancel} disabled={busy}>{t('r.pay.cancelOrder')}</Button>
          <Button variant="secondary" icon="refresh" onClick={() => start(true)} disabled={offline} aria-disabled={busy ? 'true' : undefined} aria-busy={busy ? 'true' : undefined}>{busy ? t('r.tp.starting') : t('r.tp.retry')}</Button>
        </div>
      </>}
    </section>
  );
}
function Sca({ o, onResult }) {
  const { t, lang } = useClient(); const [phase, setPhase] = useState('wait'); const [left, setLeft] = useState(60);
  useEffect(() => { const a = setTimeout(() => setPhase('ask'), 1500); return () => clearTimeout(a); }, []);
  useEffect(() => { if (phase !== 'ask') return; const i = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(i); }, [phase]);
  useEffect(() => { if (phase === 'ask' && left === 0) { setPhase('done'); onResult('fail'); } }, [left, phase]);
  return (
    <div class="r-gw__panel r-stack-sm">
      <span class="r-label"><Icon name="shield" size={14} /> {t('r.pay.sca')}</span>
      {phase === 'wait' ? <div class="r-center" role="status"><div class="fpz-spinner" /><span>{t('r.pay.scaWait')}</span></div> : (
        <div class="r-bank" role="alertdialog" aria-label={t('r.pay.scaBank')}>
          <div class="r-bank__head"><Icon name="phone" size={18} />{t('r.pay.scaBank')}</div>
          <p>{t('r.pay.scaAsk', { sum: fmtMoney(o.total, lang) })}</p>
          <Progress value={left} max={60} label={t('r.pay.scaLeft', { s: left })} />
          <span class="r-prod__small" aria-live="off">{t('r.pay.scaLeft', { s: left })}</span>
          <div class="r-actions"><Button variant="danger" icon="close" onClick={() => onResult('fail')}>{t('r.pay.reject')}</Button><Button icon="check" onClick={() => onResult('success')}>{t('r.pay.approve')}</Button></div>
        </div>
      )}
    </div>
  );
}

/* ───────── Zamówienie / potwierdzenie ───────── */
/** Opis płatności zamówienia: Tpay – operator i tytuł transakcji Tpay; płatność symulowana – metoda, operator, numer. */
function payLine(o, t) {
  const p = o.payment;
  if (p.provider === 'free') return t('r.m.free');
  if (p.provider === 'tpay') return t(o.status === 'paid' || o.status === 'refunded' ? 'r.o.paidTpay' : 'r.o.startedTpay', { op: p.operator || t('r.m.tpay'), tx: p.title || p.txId || '—' });
  return `${t('r.o.method', { m: t('r.m.' + p.method), op: p.operator })} · ${p.txId}`;
}
export function OrderView({ id, p }) {
  const { t, L, lang, api, toast } = useClient(); const { go, replace, offline, sheet, announce } = useRes(); const [ask, setAsk] = useState(false);
  const o = sel.order(id); if (!o) return <Empty icon="receipt" title={t('c.empty')} />;
  const tix = sel.ticketsOfOrder(o.id); const user = sel.user(o.userId); const ri = sel.refundInfo(o);
  const refund = () => { const r = api.booking.refund(o.id); setAsk(false); if (r.ok) { toast(t('r.o.refundDone'), 'ok'); announce(t('r.o.refundDone')); } else toast(L(r.message), 'error'); };
  const cancel = () => { const r = api.booking.cancel(o.id); if (r.ok) toast(t('r.o.cancelled.ok'), 'info'); else toast(L(r.message), 'error'); };
  return (
    <div class="r-stack">
      {p?.fresh && o.status === 'paid' && <div class="r-success" role="status"><Icon name="circleCheck" size={30} /><div><h2 class="r-h3">{t('r.ok.title')}</h2><p>{t('r.ok.mail', { email: user?.email || '' })}</p><p class="r-prod__small">{t('r.ok.show')}</p></div></div>}
      <section class="r-panel r-stack-sm">
        <div class="r-ohead"><h2 class="r-h3"><Icon name="receipt" size={18} /> {o.no}</h2><OrderStatus o={o} /></div>
        <span class="r-muted">{t('r.o.created', { d: fmtDateTime(o.createdAt, lang) })} · {t('r.o.via', { c: t('r.o.channel.' + (o.channel === 'web' ? 'web' : 'mobile')) })}</span>
        <ul class="r-mini">{o.items.map((it, i) => { const ev = it.eventId && sel.event(it.eventId); return <li key={i}><span>{it.qty} × {L(it.name)}{ev ? ` – ${L(ev.title)}` : ''}</span><b>{fmtMoney(it.unitPrice * it.qty, lang)}</b></li>; })}</ul>
        <div class="r-total r-total--sm"><span>{t('r.cart.total')}</span><b>{fmtMoney(o.total, lang)}</b></div>
        {o.payment && !o.payment.failed && <span class="r-prod__small">{payLine(o, t)}</span>}
        {o.status === 'pending' && <div class="r-actions"><Button variant="secondary" icon="close" onClick={cancel}>{t('r.pay.cancelOrder')}</Button><Button icon="wallet" disabled={offline} onClick={() => go('pay', o.id)}>{t('r.o.finish')}</Button></div>}
        {o.status === 'paid' && <div class="r-refund">
          <span class="r-label">{t('r.o.refundTerms')}</span>
          <Notice tone={ri.ok ? 'info' : 'warn'}>{L(ri.reason)}</Notice>
          {ri.ok && <Button variant="secondary" icon="refresh" disabled={offline} onClick={() => setAsk(true)}>{t('r.o.refund')}</Button>}
        </div>}
      </section>
      {tix.length > 0 && <section class="r-stack-sm"><h2 class="r-h3">{t('r.t.tickets')} ({tix.length})</h2><div class="r-tickets">{tix.map((tk) => <TicketCard key={tk.id} tk={tk} />)}</div></section>}
      {ask && <Modal class="r-modal" open onClose={() => setAsk(false)} title={t('r.o.refundTitle')} variant={sheet} size="sm" closeLabel={t('c.close')}
        footer={<><Button variant="secondary" onClick={() => setAsk(false)}>{t('c.cancel')}</Button><Button icon="refresh" onClick={refund}>{t('r.o.refundConfirm', { sum: fmtMoney(o.total, lang) })}</Button></>}>
        <p><b>{o.no}</b> – {fmtMoney(o.total, lang)}</p><Notice tone="info">{L(ri.reason)}</Notice>
      </Modal>}
    </div>
  );
}
