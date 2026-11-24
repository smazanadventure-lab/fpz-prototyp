// System rezerwacji – wspólny moduł osadzany w aplikacji mobilnej (channel="mobile") i na stronie WWW (channel="web").
// Korzysta z useClient() gospodarza (sesja, koszyk, język). Układ zależy od szerokości kontenera (@container).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import './strings.js';
import './reservation.css';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { fmtMoney, clsx } from '../../kernel/util.js';
import { Button, IconButton, Icon, Notice } from '../../ui/components.jsx';
import { ResCtx, Skeleton } from './common.jsx';
import { HomeView, EventsView, EventView, VenuesView, VenueView } from './browse.jsx';
import { CartView, CartAside, CheckoutView, PayView, OrderView } from './shop.jsx';
import { AccountView, TicketsView, InquiriesView } from './account.jsx';

const SECTIONS = [
  { view: 'home', icon: 'home', key: 'r.nav.home' }, { view: 'events', icon: 'calendar', key: 'r.nav.events' },
  { view: 'venues', icon: 'building', key: 'r.nav.venuesShort' }, { view: 'tickets', icon: 'ticket', key: 'r.nav.tickets' },
];
const SECTION_OF = { home: 'home', events: 'events', event: 'events', venues: 'venues', venue: 'venues', tickets: 'tickets', order: 'tickets', pay: 'tickets', inquiries: 'account', account: 'account', cart: 'cart', checkout: 'cart' };
const VIEWS = { home: HomeView, events: EventsView, event: EventView, venues: VenuesView, venue: VenueView, cart: CartView, checkout: CheckoutView, pay: PayView, order: OrderView, account: AccountView, tickets: TicketsView, inquiries: InquiriesView };
const WITH_ASIDE = ['home', 'events', 'venues'];
const NO_BAR = ['cart', 'checkout', 'pay'];

function initialStack(initial) {
  const v = initial?.view && VIEWS[initial.view] ? initial.view : 'home';
  const entry = { view: v, id: initial?.id || null, p: initial?.p || null };
  if (v === 'home') return [entry];
  const parent = { event: 'events', venue: 'venues', order: 'tickets', pay: 'tickets', checkout: 'cart', inquiries: 'account' }[v];
  return [{ view: 'home' }, ...(parent ? [{ view: parent }] : []), entry];
}

export default function ReservationApp({ channel = 'web', initial, nav }) {
  useStore();
  const { t, L, client, user, lang } = useClient();
  const s = useStore(); const env = s.env || {};
  const [stack, setStack] = useState(() => initialStack(initial));
  const cur = stack[stack.length - 1];
  const rootRef = useRef(null); const headRef = useRef(null); const scrollRef = useRef(null); const navigated = useRef(false);
  const [wide, setWide] = useState(channel === 'web');
  const [live, setLive] = useState('');
  const [loading, setLoading] = useState(false);
  const offline = env.network === 'offline';

  useLayoutEffect(() => {
    const el = rootRef.current; if (!el) return;
    const fit = () => { const w = el.getBoundingClientRect().width; if (w) setWide(w >= 900); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);

  const navKey = `${stack.length}:${cur.view}:${cur.id || ''}`;
  useEffect(() => {
    if (!navigated.current) return;
    scrollRef.current?.scrollTo?.({ top: 0 });
    if (env.network === 'slow') { setLoading(true); const tm = setTimeout(() => { setLoading(false); headRef.current?.focus({ preventScroll: true }); }, 500 + Math.round(Math.random() * 300)); return () => clearTimeout(tm); }
    headRef.current?.focus({ preventScroll: true });
  }, [navKey]);

  const go = (view, id = null, p = null) => {
    navigated.current = true;
    setStack((st) => { const top = st[st.length - 1]; if (top.view === view && (top.id || null) === (id || null)) return [...st.slice(0, -1), { view, id, p: p || top.p }]; const next = [...st, { view, id, p }]; return next.length > 12 ? [next[0], ...next.slice(-11)] : next; });
  };
  const section = (view) => { navigated.current = true; setStack(view === 'home' ? [{ view: 'home' }] : [{ view: 'home' }, { view }]); };
  const replace = (view, id = null, p = null) => { navigated.current = true; setStack((st) => [...st.slice(0, -1), { view, id, p }]); };
  const reset = (arr) => { navigated.current = true; setStack(arr); };
  const back = () => { navigated.current = true; setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)); };
  const setParam = (p) => setStack((st) => [...st.slice(0, -1), { ...st[st.length - 1], p }]);
  const announce = (text) => { setLive(''); setTimeout(() => setLive(text), 30); };
  const ctx = { channel, go, replace, reset, back, section, setParam, wide, offline, announce, sheet: wide ? 'center' : 'sheet', nav };

  const cart = sel.cart(client);
  const title = (() => {
    if (cur.view === 'event') { const e = sel.event(cur.id); return e ? L(e.title) : t('r.nav.event'); }
    if (cur.view === 'venue') { const v = sel.venue(cur.id); return v ? L(v.name) : t('r.nav.venue'); }
    if (cur.view === 'order') { const o = sel.order(cur.id); return o ? o.no : t('r.nav.order'); }
    return { home: t('r.title'), events: t('r.nav.events'), venues: t('r.nav.venues'), cart: t('r.nav.cart'), checkout: t('r.nav.checkout'), pay: t('r.nav.pay'), account: t('r.nav.account'), tickets: t('r.nav.tickets'), inquiries: t('r.nav.inquiries') }[cur.view];
  })();
  const crumbs = stack.length > 1 ? stack.slice(0, -1).slice(-2).map((x) => ({ home: t('r.nav.home'), events: t('r.nav.events'), venues: t('r.nav.venues'), cart: t('r.nav.cart'), tickets: t('r.nav.tickets'), account: t('r.nav.account'), event: t('r.nav.event'), venue: t('r.nav.venue'), checkout: t('r.nav.checkout'), order: t('r.nav.order'), inquiries: t('r.nav.inquiries'), pay: t('r.nav.pay') }[x.view])) : null;
  const View = VIEWS[cur.view] || HomeView;
  const sec = SECTION_OF[cur.view];
  const showAside = wide && WITH_ASIDE.includes(cur.view);
  const showBar = !wide && cart.count > 0 && !NO_BAR.includes(cur.view);

  return (
    <ResCtx.Provider value={ctx}>
      <div class={clsx('ep-res', wide ? 'is-wide' : 'is-narrow')} data-channel={channel} ref={rootRef}>
        <header class="r-head">
          <div class="r-head__row">
            {stack.length > 1 ? <IconButton icon="back" label={t('c.back')} onClick={back} class="r-back" /> : <span class="r-head__ic" aria-hidden="true"><Icon name="ticket" size={20} /></span>}
            <div class="r-head__titles">
              {crumbs ? <span class="r-crumbs">{t('r.title')} / {crumbs.join(' / ')}</span> : <span class="r-crumbs">{channel === 'web' ? 'Fabryka Pełna Życia' : t('r.test')}</span>}
              <h1 class="r-head__title" tabIndex={-1} ref={headRef}>{title}</h1>
            </div>
            <div class="r-head__tools">
              <IconButton icon="user" variant={sec === 'account' ? 'round' : 'mint'} label={user ? `${t('r.nav.account')}: ${user.name}` : t('r.a.accountLogin')} onClick={() => (cur.view === 'account' ? null : go('account'))} class="r-acc" />
              <IconButton icon="cart" variant={sec === 'cart' ? 'round' : 'mint'} label={t('r.cartBtn', { n: cart.count })} badge={cart.count || null} onClick={() => (cur.view === 'cart' ? null : go('cart'))} class="r-cartbtn" />
            </div>
          </div>
          <nav class="r-secnav" aria-label={t('r.sections')}>
            {SECTIONS.map((x) => <button key={x.view} type="button" class={clsx('r-secnav__b', sec === x.view && 'is-active')} aria-current={sec === x.view ? 'page' : undefined} onClick={() => section(x.view)}><Icon name={x.icon} size={16} />{t(x.key)}</button>)}
          </nav>
        </header>
        {offline && <div class="r-offline" role="status"><Icon name="wifiOff" size={18} /><span>{t('r.off.banner')}</span></div>}
        <div class="r-scroll" ref={scrollRef}>
          <div class={clsx('r-body', showAside && 'has-aside')}>
            <main class="r-view" key={navKey} data-view={cur.view}>
              {loading ? <Skeleton n={cur.view === 'event' || cur.view === 'venue' ? 2 : 4} /> : <View id={cur.id} p={cur.p} />}
            </main>
            {showAside && <CartAside />}
          </div>
        </div>
        {showBar && (
          <div class="r-cartbar">
            <span class="r-cartbar__sum"><Icon name="cart" size={20} /><span><b>{fmtMoney(cart.total, lang)}</b><small>{t('r.cart.tickets', { n: cart.count })}</small></span></span>
            <Button variant="mint" size="sm" onClick={() => go('cart')}>{t('r.cart.show')}</Button>
          </div>
        )}
        <div class="fpz-sr" aria-live="polite" role="status">{live}</div>
      </div>
    </ResCtx.Provider>
  );
}
