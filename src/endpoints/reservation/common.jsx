// Wspólne elementy systemu rezerwacji: kontekst nawigacji, karty, liczniki, bilety, logowanie.
import { createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { sel } from '../../kernel/api.js';
import { fmtDate, fmtDay, fmtTime, fmtDateTime, fmtMoney, clsx, localIso } from '../../kernel/util.js';
import { Button, IconButton, Card, CardBody, CornerLink, Tag, Media, QR, Field, Input, Checkbox, Notice, Tabs, Icon } from '../../ui/components.jsx';

export const ResCtx = createContext(null);
/** { channel, go(view,id,p), replace(view,id,p), back(), wide, offline, announce(text), sheet ('sheet'|'center'), nav } */
export const useRes = () => useContext(ResCtx);

export const EVENT_CATS = ['koncert', 'warsztaty', 'wystawa', 'targi', 'spotkanie', 'sport', 'dzieci', 'film'];
export const VENUE_CATS = ['gastro', 'attraction', 'institution', 'tenant', 'culture'];
export const VENUE_ICON = { gastro: 'utensils', attraction: 'star', institution: 'building', tenant: 'store', culture: 'music' };

export const nowLocal = () => localIso(new Date());
export function eventState(e) { const n = nowLocal(); return e.end < n ? 'past' : e.start <= n ? 'ongoing' : 'future'; }
export function minPrice(eventId) { const ps = sel.productsFor(eventId); return ps.length ? Math.min(...ps.map((p) => p.price)) : null; }
export const inCartQty = (client, productId) => (client.cart || []).find((x) => x.productId === productId)?.qty || 0;

/** Karta wydarzenia (wzorzec: próbka C – karta z „Kup bilet” i „Dowiedz się więcej”). */
export function EventCard({ e, compact }) {
  const { t, L, lang } = useClient(); const { go, wide } = useRes();
  const poi = sel.poi(e.poiId); const rem = sel.remaining(e.id); const st = eventState(e); const price = e.ticketed ? minPrice(e.id) : null;
  return (
    <Card variant="mint" class={clsx('r-ecard', compact && 'r-ecard--compact')} as="article">
      <Media ill={e.ill} src={e.src} ratio={compact ? '16/7' : wide ? '16/8' : '2/1'} shape="plain" alt={L(e.title)}>
        <div class="r-ecard__badges">
          {e.live && <Tag tone="live">{t('c.live')}</Tag>}
          {st === 'ongoing' && <Tag tone="deep">{t('r.ev.ongoing')}</Tag>}
        </div>
      </Media>
      <CardBody>
        <div class="r-meta"><span class="r-date"><Icon name="calendar" size={15} />{fmtDay(e.start, lang)}, {fmtTime(e.start, lang)}</span>{t('r.cat.' + e.category) !== 'r.cat.' + e.category && <Tag>{t('r.cat.' + e.category)}</Tag>}</div>
        <h3 class="r-ecard__title"><button type="button" class="r-link" onClick={() => go('event', e.id)}>{L(e.title)}</button></h3>
        {poi && <span class="r-muted r-ico"><Icon name="mapPin" size={15} />{L(poi.name)}</span>}
        <div class="r-ecard__avail">
          {!e.ticketed ? <Tag tone="green">{t('c.free')}</Tag> : rem <= 0 ? <Tag tone="danger">{t('c.soldOut')}</Tag>
            : <>{price != null && <b class="r-price">{t('r.ev.from', { p: fmtMoney(price, lang) })}</b>}<Tag tone={rem <= 10 ? 'warn' : 'neutral'}>{t(rem <= 10 ? 'r.ev.few' : 'r.ev.left', { n: rem })}</Tag></>}
        </div>
        <div class="r-ecard__actions">
          {e.ticketed && rem > 0 && st !== 'past' && <Button icon="ticket" size="sm" onClick={() => go('event', e.id)}>{t('c.buyTicket')}</Button>}
          <Button variant="secondary" size="sm" onClick={() => go('event', e.id)} aria-label={`${t('c.more')}: ${L(e.title)}`}>{t('c.more')}</Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Pozycja oferty (bilet / strefa / pakiet) z licznikiem ilości i dodawaniem do koszyka. */
export function ProductRow({ p }) {
  const { t, L, lang, client, api, toast } = useClient(); const { offline, announce, go } = useRes();
  const [qty, setQty] = useState(1);
  const have = inCartQty(client, p.id); const lim = p.maxPerOrder || 10; const rem = p.eventId ? sel.remaining(p.eventId) : Infinity;
  const max = Math.max(0, Math.min(lim - have, rem - have)); const soldOut = rem <= 0; const q = Math.min(Math.max(1, qty), Math.max(1, max));
  const add = () => {
    const r = api.booking.addToCart(p.id, q);
    if (!r.ok) { toast(L(r.message), 'error'); announce(L(r.message)); return; }
    const msg = t('r.p.added', { n: `${q} × ${L(p.name)}` }); toast(msg, 'ok'); announce(t('r.cart.updated', { n: r.cart.count, sum: fmtMoney(r.cart.total, lang) })); setQty(1);
  };
  const ev = p.eventId && sel.event(p.eventId);
  return (
    <div class={clsx('r-prod', soldOut && 'is-soldout')}>
      <div class="r-prod__info">
        <div class="r-prod__head">
          {p.kind !== 'ticket' && <Tag tone={p.kind === 'package' ? 'deep' : 'info'} icon={p.kind === 'package' ? 'package' : 'ticket'}>{t(p.kind === 'package' ? 'r.p.package' : 'r.p.zone')}</Tag>}
          <b class="r-prod__name">{L(p.name)}</b>
        </div>
        {p.description && <span class="r-prod__desc">{L(p.description)}</span>}
        {p.kind === 'package' && p.includes?.length > 0 && (
          <div class="r-incl"><span class="r-label">{t('r.p.includes')}</span><ul>{p.includes.map((pid, i) => { const ip = sel.product(pid); const ie = ip?.eventId && sel.event(ip.eventId); return ip ? <li key={pid + i}><Icon name="check" size={14} />{L(ip.name)}{ie ? ` – ${L(ie.title)}, ${fmtDay(ie.start, lang)}` : ''}</li> : null; })}</ul></div>
        )}
        <span class="r-prod__small">{t('r.p.limit', { n: lim })}{ev ? ' · ' + t('r.p.refundable', { h: p.refundableHours ?? 24 }) : ''}</span>
        {have > 0 && <button type="button" class="r-incart" onClick={() => go('cart')}><Icon name="cart" size={14} />{t('r.p.inCart', { n: have })}</button>}
      </div>
      <div class="r-prod__buy">
        <b class="r-price r-price--lg">{fmtMoney(p.price, lang)}</b>
        {soldOut ? <Tag tone="danger">{t('c.soldOut')}</Tag> : max <= 0 ? <span class="r-prod__small r-warn">{t('r.p.limitReached')}</span> : (
          <div class="r-buyrow">
            <Stepper value={q} min={1} max={max} onChange={setQty} label={L(p.name)} />
            <Button icon="cart" size="sm" onClick={add} disabled={offline} title={offline ? t('r.off.blocked') : undefined}>{t('r.p.add')}</Button>
          </div>
        )}
        {soldOut && <span class="r-prod__small r-warn" role="status">{t('r.p.soldOutMsg')}</span>}
      </div>
    </div>
  );
}

export function Stepper({ value, min = 0, max = 10, onChange, label, disabled }) {
  const { t } = useClient();
  return (
    <div class="r-stepper" role="group" aria-label={t('r.p.qty', { name: label })}>
      <IconButton icon="minus" variant="mint" size="sm" label={`${t('r.p.less')}: ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} />
      <output class="r-stepper__val" aria-live="polite">{value}</output>
      <IconButton icon="plus" variant="mint" size="sm" label={`${t('r.p.more')}: ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} />
    </div>
  );
}

export const ORDER_TONE = { pending: 'warn', paid: 'green', cancelled: 'neutral', refunded: 'info' };
export const OrderStatus = ({ o }) => { const { t } = useClient(); return <Tag tone={ORDER_TONE[o.status]}>{t('r.o.' + o.status)}</Tag>; };

export function TicketStatus({ tk }) {
  const { t, lang } = useClient();
  if (tk.status === 'used') return <Tag tone="neutral" icon="circleCheck">{t('r.t.usedAt', { time: fmtDateTime(tk.usedAt, lang), gate: tk.gate || '—' })}</Tag>;
  if (tk.status === 'refunded') return <Tag tone="info" icon="refresh">{t('r.t.refunded')}</Tag>;
  return <Tag tone="green" icon="check">{t('r.t.valid')}</Tag>;
}

/** Bilet z kodem QR i statusem na żywo (zmienia go stanowisko bileterskie). */
export function TicketCard({ tk }) {
  const { t, L, lang } = useClient(); const ev = tk.eventId && sel.event(tk.eventId); const poi = ev && sel.poi(ev.poiId);
  return (
    <article class={clsx('r-ticket', `r-ticket--${tk.status}`)} aria-label={`${L(tk.productName)} – ${tk.code}`} data-code={tk.code}>
      <div class="r-ticket__qr"><QR value={sel.ticketPayload(tk)} size={132} label={tk.code} /></div>
      <div class="r-ticket__body">
        <span class="r-label">{t('r.t.ticket')} · FPŻ</span>
        <b class="r-ticket__name">{ev ? L(ev.title) : L(tk.productName)}</b>
        {ev && <span class="r-muted">{L(tk.productName)}</span>}
        <span class="r-ico"><Icon name="calendar" size={14} />{ev ? `${fmtDate(ev.start, lang, { weekday: 'short', day: 'numeric', month: 'long' })}, ${fmtTime(ev.start, lang)}` : t('r.t.validFrom', { d: fmtDate(tk.validFrom, lang) })}</span>
        {poi && <span class="r-ico"><Icon name="mapPin" size={14} />{L(poi.name)}</span>}
        <span class="r-ticket__code"><span class="r-label">{t('r.t.code')}</span> <code>{tk.code}</code></span>
        <div class="r-ticket__status" aria-live="polite"><TicketStatus tk={tk} /></div>
      </div>
    </article>
  );
}

const DEMO_EMAIL = 'anna.kowalska@example.com'; const DEMO_PASS = 'demo1234';
/** Logowanie / rejestracja w miejscu. onDone() po zalogowaniu. */
export function AuthPanel({ onDone, initialTab = 'login' }) {
  const { t, L, api, toast } = useClient(); const { announce } = useRes();
  const [tab, setTab] = useState(initialTab);
  const [f, setF] = useState({ email: '', password: '', name: '', terms: false, rodo: false, marketing: false });
  /* Makieta logowania (SPEC pkt 12): formularz logowania ma wypełnione dane konta testowego; rejestracja – pola puste. */
  const [lf, setLf] = useState({ email: DEMO_EMAIL, password: DEMO_PASS });
  const updL = (k) => (e) => setLf({ ...lf, [k]: e.currentTarget.value });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState('');
  const upd = (k) => (e) => setF({ ...f, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value });
  const done = (r, key) => { if (!r.ok) { setMsg(L(r.message)); announce(L(r.message)); return; } setMsg(''); toast(t(key, { name: r.user.name }), 'ok'); announce(t(key, { name: r.user.name })); onDone?.(); };
  const login = (e) => {
    e.preventDefault(); const er = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lf.email.trim())) er.email = t('r.a.badEmail'); if (!lf.password) er.password = t('r.a.passReq');
    setErr(er); if (Object.keys(er).length) return; done(api.auth.login(lf.email.trim(), lf.password), 'r.a.welcome');
  };
  const register = (e) => {
    e.preventDefault(); const er = {};
    if (!f.name.trim()) er.name = t('r.a.nameReq'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) er.email = t('r.a.badEmail'); if (f.password.length < 6) er.password = t('r.a.shortPass');
    if (!f.terms || !f.rodo) er.consents = t('r.a.consentsReq');
    setErr(er); if (Object.keys(er).length) return; done(api.auth.register({ name: f.name, email: f.email, password: f.password, marketing: f.marketing }), 'r.a.registered');
  };
  return (
    <div class="r-auth">
      <Tabs variant="pill" value={tab} onChange={(v) => { setTab(v); setErr({}); setMsg(''); }} tabs={[{ id: 'login', label: t('r.a.login'), icon: 'key' }, { id: 'register', label: t('r.a.register'), icon: 'user' }]} />
      {tab === 'register' && <Notice tone="warn">{t('r.a.testNote')}</Notice>}
      {msg && <Notice tone="danger">{msg}</Notice>}
      {tab === 'login' ? (
        <form class="r-form" onSubmit={login} noValidate>
          <Field label={t('r.a.email')} error={err.email}><Input type="email" name="email" autocomplete="username" value={lf.email} onInput={updL('email')} aria-invalid={!!err.email} /></Field>
          <Field label={t('r.a.password')} error={err.password}><Input type="password" name="password" autocomplete="current-password" value={lf.password} onInput={updL('password')} aria-invalid={!!err.password} /></Field>
          <Button type="submit" icon="key" block class="r-login-submit" data-testid="r-login-submit">{t('r.a.signInBtn')}</Button>
          <p class="r-mock"><Icon name="info" size={14} />{t('r.a.mockNote')}</p>
        </form>
      ) : (
        <form class="r-form" onSubmit={register} noValidate>
          <Field label={t('r.a.name')} error={err.name}><Input name="name" autocomplete="name" value={f.name} onInput={upd('name')} aria-invalid={!!err.name} /></Field>
          <Field label={t('r.a.email')} error={err.email}><Input type="email" name="email" autocomplete="email" value={f.email} onInput={upd('email')} aria-invalid={!!err.email} /></Field>
          <Field label={t('r.a.password')} error={err.password}><Input type="password" name="password" autocomplete="new-password" value={f.password} onInput={upd('password')} aria-invalid={!!err.password} /></Field>
          <div class="r-consents">
            <Checkbox name="terms" label={t('r.a.terms')} checked={f.terms} onChange={upd('terms')} />
            <Checkbox name="rodo" label={t('r.a.rodo')} checked={f.rodo} onChange={upd('rodo')} />
            <Checkbox name="marketing" label={t('r.a.marketing')} checked={f.marketing} onChange={upd('marketing')} />
            {err.consents && <span class="fpz-field__error" role="alert">{err.consents}</span>}
          </div>
          <Button type="submit" icon="user" block>{t('r.a.signUp')}</Button>
        </form>
      )}
      <p class="r-prod__small">{t('r.a.why')}</p>
    </div>
  );
}

export function SectionHead({ title, action, onAction, icon }) {
  return <div class="r-shead"><h2>{icon && <Icon name={icon} size={20} />}{title}</h2>{action && <CornerLink onClick={onAction}>{action}</CornerLink>}</div>;
}

export function Skeleton({ n = 3 }) {
  const { t } = useClient();
  return <div class="r-skel" role="status" aria-label={t('r.loading')}>{Array.from({ length: n }, (_, i) => <div key={i} class="r-skel__card"><i class="r-skel__img" /><i /><i class="r-skel__short" /></div>)}</div>;
}
