// Konto klienta: logowanie/rejestracja, profil, moje zamówienia i bilety, moje zapytania.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { sel } from '../../kernel/api.js';
import { fmtDate, fmtDateTime, fmtMoney, clsx } from '../../kernel/util.js';
import { Button, Tag, Empty, Notice, Icon, Field, Input, Tabs, Card, CardBody } from '../../ui/components.jsx';
import { useRes, AuthPanel, TicketCard, OrderStatus } from './common.jsx';

export function AccountView() {
  const { t, L, api, user, toast } = useClient(); const { go, announce } = useRes();
  if (!user) return <div class="r-narrow r-stack"><h2 class="r-h3">{t('r.a.required')}</h2><AuthPanel /></div>;
  return <Profile key={user.id} user={user} />;
}
function Profile({ user }) {
  const { t, L, api, toast } = useClient(); const { go, announce } = useRes();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '' }); const [err, setErr] = useState('');
  const save = (e) => { e.preventDefault(); if (!f.name.trim()) { setErr(t('r.a.nameReq')); return; } const r = api.auth.updateProfile({ name: f.name.trim(), phone: f.phone.trim() }); if (!r.ok) { setErr(L(r.message)); return; } setErr(''); toast(t('r.a.saved'), 'ok'); announce(t('r.a.saved')); };
  const out = () => { api.auth.logout(); toast(t('r.a.loggedOut'), 'info'); announce(t('r.a.loggedOut')); };
  const orders = sel.ordersOf(user.id); const tix = sel.ticketsOf(user.id).filter((x) => x.status === 'valid'); const inq = sel.inquiriesOf(user.id);
  return (
    <div class="r-account">
      <section class="r-panel r-stack-sm">
        <div class="r-ohead"><h2 class="r-h3"><Icon name="user" size={18} /> {t('r.a.profile')}</h2><Button variant="ghost" size="sm" icon="power" onClick={out}>{t('r.a.logout')}</Button></div>
        <form class="r-form" onSubmit={save} noValidate>
          <Field label={t('r.a.email')}><Input value={user.email} readOnly disabled /></Field>
          <Field label={t('r.a.name')} error={err}><Input name="name" autocomplete="name" value={f.name} onInput={(e) => setF({ ...f, name: e.currentTarget.value })} /></Field>
          <Field label={t('r.a.phone')}><Input type="tel" name="phone" autocomplete="tel" value={f.phone} onInput={(e) => setF({ ...f, phone: e.currentTarget.value })} /></Field>
          <Button type="submit" icon="save">{t('r.a.saveProfile')}</Button>
        </form>
        <Notice tone="info" icon="info">{t('r.a.sameAccount')}</Notice>
      </section>
      <nav class="r-tiles" aria-label={t('r.sections')}>
        <button type="button" class="r-tile" onClick={() => go('tickets', null, { tab: 'tickets' })}><Icon name="ticket" size={24} /><b>{tix.length}</b><span>{t('r.nav.tickets')}</span></button>
        <button type="button" class="r-tile" onClick={() => go('tickets', null, { tab: 'orders' })}><Icon name="receipt" size={24} /><b>{orders.length}</b><span>{t('r.t.orders')}</span></button>
        <button type="button" class="r-tile" onClick={() => go('inquiries')}><Icon name="message" size={24} /><b>{inq.length}</b><span>{t('r.nav.inquiries')}</span></button>
        <button type="button" class="r-tile" onClick={() => go('venues', null, { cat: 'contacts' })}><Icon name="phone" size={24} /><b>&nbsp;</b><span>{t('r.nav.contacts')}</span></button>
      </nav>
    </div>
  );
}

export function TicketsView({ p }) {
  const { t, L, lang, user } = useClient(); const { go, setParam, offline } = useRes();
  if (!user) return <div class="r-narrow r-stack"><h2 class="r-h3">{t('r.a.required')}</h2><AuthPanel /></div>;
  const tab = p?.tab || 'tickets'; const orders = sel.ordersOf(user.id);
  const tix = sel.ticketsOf(user.id).slice().sort((a, b) => ((a.status === 'valid') === (b.status === 'valid') ? (a.validFrom < b.validFrom ? -1 : 1) : a.status === 'valid' ? -1 : 1));
  return (
    <div class="r-stack">
      <Tabs variant="line" value={tab} onChange={(v) => setParam({ ...p, tab: v })} tabs={[{ id: 'tickets', label: t('r.t.tickets'), icon: 'ticket', badge: tix.filter((x) => x.status === 'valid').length || null }, { id: 'orders', label: t('r.t.orders'), icon: 'receipt', badge: orders.filter((o) => o.status === 'pending').length || null }]} />
      {tab === 'tickets' ? <>
        <Notice tone={offline ? 'warn' : 'ok'} icon={offline ? 'wifiOff' : 'download'}>{t('r.t.offline')}</Notice>
        {tix.length ? <div class="r-tickets">{tix.map((tk) => <TicketCard key={tk.id} tk={tk} />)}</div> : <Empty icon="ticket" title={t('r.t.none')}><Button icon="calendar" onClick={() => go('events')}>{t('r.home.allEvents')}</Button></Empty>}
      </> : orders.length ? (
        <ul class="r-orders">
          {orders.map((o) => (
            <li key={o.id}>
              <button type="button" class="r-orow" onClick={() => go('order', o.id)}>
                <span class="r-orow__main"><b>{o.no}</b><span class="r-muted">{fmtDateTime(o.createdAt, lang)} · {o.items.map((i) => `${i.qty}× ${L(i.name)}`).join(', ')}</span></span>
                <span class="r-orow__side"><OrderStatus o={o} /><b class="r-price">{fmtMoney(o.total, lang)}</b></span>
                <Icon name="arrowRight" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : <Empty icon="receipt" title={t('r.o.none')} />}
    </div>
  );
}

const Q_TONE = { new: 'warn', answered: 'info', confirmed: 'green', rejected: 'danger' };
export function InquiriesView() {
  const { t, L, lang, user } = useClient(); const { go } = useRes();
  if (!user) return <div class="r-narrow r-stack"><h2 class="r-h3">{t('r.a.required')}</h2><AuthPanel /></div>;
  const list = sel.inquiriesOf(user.id);
  if (!list.length) return <Empty icon="message" title={t('r.q.none')}><Button icon="building" onClick={() => go('venues')}>{t('r.nav.venues')}</Button></Empty>;
  return (
    <ul class="r-inq" aria-live="polite">
      {list.map((q) => { const v = sel.venue(q.venueId); return (
        <li key={q.id} class="r-panel r-stack-sm" data-status={q.status}>
          <div class="r-ohead"><h3 class="r-h3"><button type="button" class="r-link" onClick={() => v && go('venue', v.id)}>{v ? L(v.name) : q.venueId}</button></h3><Tag tone={Q_TONE[q.status] || 'neutral'}>{t('r.q.' + q.status) !== 'r.q.' + q.status ? t('r.q.' + q.status) : q.status}</Tag></div>
          <span class="r-ico r-muted"><Icon name="calendar" size={14} />{fmtDate(q.date, lang, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · {t('r.q.forPeople', { n: q.people })}</span>
          {q.message && <p class="r-quote">{q.message}</p>}
          {q.reply ? <div class="r-reply"><span class="r-label"><Icon name="message" size={14} /> {t('r.q.reply')}{q.repliedAt ? ' · ' + fmtDateTime(q.repliedAt, lang) : ''}</span><p>{q.reply}</p></div> : null}
        </li>
      ); })}
    </ul>
  );
}
