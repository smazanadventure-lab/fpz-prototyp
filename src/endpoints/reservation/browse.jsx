// Przeglądanie oferty: start, wydarzenia (lista + kalendarz), szczegóły wydarzenia, baza obiektów, szczegóły obiektu, kontakty.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { fmtDate, fmtDay, fmtTime, fmtMoney, dayStr, addDays, matches, clsx, pad2 } from '../../kernel/util.js';
import { Button, IconButton, Card, CardBody, Tag, Media, Chips, SearchInput, Empty, Notice, Rich, Icon, Modal, Field, Input, Textarea, Tabs } from '../../ui/components.jsx';
import { useRes, EventCard, ProductRow, SectionHead, EVENT_CATS, VENUE_CATS, VENUE_ICON, eventState, AuthPanel } from './common.jsx';

/* ───────── Start ───────── */
export function HomeView() {
  const { t, L, user } = useClient(); const { go } = useRes();
  const upcoming = sel.events().filter((e) => eventState(e) !== 'past').slice(0, 4);
  const zones = sel.zoneProducts(); const packs = sel.packages();
  const shortcuts = [
    { id: 'events', icon: 'calendar', label: t('r.home.allEvents') }, { id: 'events', p: { mode: 'cal' }, icon: 'grid', label: t('r.home.calendar') },
    { id: 'venues', icon: 'utensils', label: t('r.home.places') }, { id: 'tickets', icon: 'ticket', label: t('r.home.myTickets') },
  ];
  return (
    <div class="r-stack">
      <Card class="r-hero">
        <CardBody>
          <h2 class="r-hero__title">{t('r.home.hello')}</h2>
          <p class="r-hero__lead">{t('r.home.lead')}</p>
          {user && <span class="r-ico r-muted"><Icon name="user" size={15} />{t('r.a.hello', { name: user.name })}</span>}
        </CardBody>
      </Card>
      <nav class="r-shortcuts" aria-label={t('r.sections')}>
        {shortcuts.map((s, i) => <button key={i} type="button" class="r-shortcut" onClick={() => go(s.id, null, s.p)}><span class="r-shortcut__ic"><Icon name={s.icon} size={22} /></span><span>{s.label}</span></button>)}
      </nav>
      <section class="r-stack-sm">
        <SectionHead title={t('r.home.upcoming')} action={t('r.home.allEvents')} onAction={() => go('events')} />
        {upcoming.length ? <div class="r-grid">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div> : <Empty icon="calendar" title={t('r.ev.none')} />}
      </section>
      {zones.length > 0 && <section class="r-stack-sm"><SectionHead title={t('r.home.zones')} icon="ticket" /><div class="r-plist">{zones.map((p) => <ProductRow key={p.id} p={p} />)}</div></section>}
      {packs.length > 0 && <section class="r-stack-sm"><SectionHead title={t('r.home.packages')} icon="package" /><div class="r-plist">{packs.map((p) => <ProductRow key={p.id} p={p} />)}</div></section>}
    </div>
  );
}

/* ───────── Wydarzenia: lista + kalendarz ───────── */
export function EventsView({ p }) {
  const { t, L, lang } = useClient(); const { setParam } = useRes();
  const mode = p?.mode || 'list'; const cat = p?.cat || 'all'; const q = p?.q || '';
  const setP = (patch) => setParam({ ...p, ...patch });
  const cats = EVENT_CATS.filter((c) => getState().events.some((e) => e.active !== false && e.category === c));
  const filt = (e) => (cat === 'all' || e.category === cat) && matches(q, e.title.pl, e.title.en, e.description?.pl, e.description?.en, L(sel.poi(e.poiId)?.name));
  return (
    <div class="r-stack">
      <div class="r-toolbar">
        <SearchInput value={q} onInput={(v) => setP({ q: v })} placeholder={t('r.ev.search')} class="r-toolbar__search" />
        <Tabs variant="pill" value={mode} onChange={(v) => setP({ mode: v })} tabs={[{ id: 'list', label: t('r.ev.list'), icon: 'list' }, { id: 'cal', label: t('r.ev.cal'), icon: 'calendar' }]} />
      </div>
      <Chips scroll value={cat} onChange={(v) => setP({ cat: v })} options={[{ id: 'all', label: t('c.all') }, ...cats.map((c) => ({ id: c, label: t('r.cat.' + c) }))]} />
      {mode === 'list' ? <EventList filt={filt} /> : <Calendar filt={filt} p={p} setP={setP} />}
    </div>
  );
}
function EventList({ filt }) {
  const { t } = useClient(); const list = sel.events().filter(filt);
  return list.length ? <div class="r-grid">{list.map((e) => <EventCard key={e.id} e={e} />)}</div> : <Empty icon="calendar" title={t('r.ev.none')} />;
}
function Calendar({ filt, p, setP }) {
  const { t, L, lang } = useClient();
  const today = new Date(); const base = p?.month ? new Date(p.month + '-01T12:00') : new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const all = sel.events({ includePast: true }).filter(filt);
  const firstUp = all.find((e) => e.start.slice(0, 10) >= dayStr(today) && e.start.slice(0, 7) === dayStr(base).slice(0, 7));
  const sel_ = p?.day || (firstUp ? firstUp.start.slice(0, 10) : dayStr(today));
  const byDay = {}; for (const e of all) { const d = e.start.slice(0, 10); (byDay[d] = byDay[d] || []).push(e); }
  const first = new Date(base.getFullYear(), base.getMonth(), 1, 12); const off = (first.getDay() + 6) % 7; const start = addDays(first, -off);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = days[35].getMonth() !== base.getMonth() ? 5 : 6;
  const wd = Array.from({ length: 7 }, (_, i) => fmtDate(addDays(start, i).toISOString(), lang, { weekday: 'short' }));
  const shift = (n) => { const d = new Date(base.getFullYear(), base.getMonth() + n, 1, 12); setP({ month: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` }); };
  const dayEvents = byDay[sel_] || [];
  return (
    <div class="r-cal">
      <div class="r-cal__box">
        <div class="r-cal__head">
          <IconButton icon="back" variant="mint" size="sm" label={t('r.ev.prevMonth')} onClick={() => shift(-1)} />
          <b aria-live="polite">{fmtDate(base.toISOString(), lang, { month: 'long', year: 'numeric' })}</b>
          <IconButton icon="arrowRight" variant="mint" size="sm" label={t('r.ev.nextMonth')} onClick={() => shift(1)} />
        </div>
        <div class="r-cal__grid" role="grid">
          {wd.map((w, i) => <span key={'w' + i} class="r-cal__wd" role="columnheader">{w}</span>)}
          {days.slice(0, weeks * 7).map((d) => {
            const k = dayStr(d); const evs = byDay[k] || []; const out = d.getMonth() !== base.getMonth();
            return (
              <button key={k} type="button" role="gridcell" class={clsx('r-cal__day', out && 'is-out', k === dayStr(today) && 'is-today', k === sel_ && 'is-sel', evs.length && 'has-ev')}
                aria-pressed={k === sel_} aria-label={`${fmtDate(d.toISOString(), lang)}${evs.length ? ' – ' + t('r.ev.count', { n: evs.length }) : ''}`} onClick={() => setP({ day: k, month: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` })}>
                <span>{d.getDate()}</span>
                <span class="r-cal__dots" aria-hidden="true">{evs.slice(0, 3).map((e) => <i key={e.id} class={e.ticketed ? 'is-t' : ''} />)}</span>
              </button>
            );
          })}
        </div>
        <div class="r-cal__legend"><span><i class="is-t" />{t('r.ev.ticketsTitle')}</span><span><i />{t('c.free')}</span></div>
      </div>
      <section class="r-cal__list" aria-live="polite">
        <h3 class="r-h3">{t('r.ev.selDay', { d: fmtDate(sel_ + 'T12:00', lang, { weekday: 'long', day: 'numeric', month: 'long' }) })}</h3>
        {dayEvents.length ? <div class="r-stack-sm">{dayEvents.map((e) => <EventCard key={e.id} e={e} compact />)}</div> : <Empty icon="calendar" title={t('r.ev.noneDay')} />}
      </section>
    </div>
  );
}

/* ───────── Szczegóły wydarzenia ───────── */
export function EventView({ id }) {
  const { t, L, lang, id: cid } = useClient(); const { go, nav } = useRes(); const tixId = `r-tix-${cid}`;
  const e = sel.event(id); if (!e) return <Empty icon="calendar" title={t('c.empty')} />;
  const poi = sel.poi(e.poiId); const venue = e.venueId && sel.venue(e.venueId); const prods = sel.productsFor(e.id); const st = eventState(e); const rem = sel.remaining(e.id);
  return (
    <div class="r-detail">
      <div class="r-detail__main r-stack">
        <Media ill={e.ill} src={e.src} ratio="16/8" shape="arc-tr" alt={L(e.title)} />
        <div class="r-meta">{e.live && <Tag tone="live">{t('c.live')}</Tag>}<Tag>{t('r.cat.' + e.category)}</Tag>{st === 'ongoing' && <Tag tone="deep">{t('r.ev.ongoing')}</Tag>}{st === 'past' && <Tag>{t('r.ev.past')}</Tag>}{!e.ticketed && <Tag tone="green">{t('c.free')}</Tag>}</div>
        <h2 class="r-h1x">{L(e.title)}</h2>
        {e.ticketed && st !== 'past' && rem > 0 && <Button class="r-jump" icon="ticket" onClick={() => document.getElementById(tixId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('c.buyTicket')}</Button>}
        <dl class="r-facts">
          <div><dt><Icon name="calendar" size={16} />{t('r.ev.when')}</dt><dd>{fmtDate(e.start, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {fmtTime(e.start, lang)}–{fmtTime(e.end, lang)}</dd></div>
          {poi && <div><dt><Icon name="mapPin" size={16} />{t('r.ev.place')}</dt><dd>{L(poi.name)} {nav?.showOnMap && <Button variant="ghost" size="sm" icon="map" onClick={() => nav.showOnMap(poi.id)}>{t('r.showOnMap')}</Button>}</dd></div>}
          {venue && <div><dt><Icon name="building" size={16} />{t('r.ev.organizer')}</dt><dd><button type="button" class="r-link r-link--u" onClick={() => go('venue', venue.id)}>{L(venue.name)}</button></dd></div>}
        </dl>
        {e.description && <Rich text={L(e.description)} />}
        {e.live && <Notice tone="info" icon="video">{t('r.ev.liveInfo')}</Notice>}
      </div>
      <aside class="r-detail__side r-stack-sm" aria-labelledby={tixId}>
        <h3 class="r-h3" id={tixId}><Icon name="ticket" size={18} /> {t('r.ev.ticketsTitle')}</h3>
        {!e.ticketed ? <Notice tone="ok">{t('r.ev.freeInfo')}</Notice>
          : st === 'past' ? <Notice tone="warn">{t('r.ev.past')}</Notice>
          : <>
            <Tag tone={rem <= 0 ? 'danger' : rem <= 10 ? 'warn' : 'green'}>{rem <= 0 ? t('c.soldOut') : t(rem <= 10 ? 'r.ev.few' : 'r.ev.left', { n: rem })}</Tag>
            {prods.length ? <div class="r-plist">{prods.map((p) => <ProductRow key={p.id} p={p} />)}</div> : <Empty icon="ticket" title={t('c.empty')} />}
          </>}
      </aside>
    </div>
  );
}

/* ───────── Baza obiektów ───────── */
export function VenuesView({ p }) {
  const { t, L } = useClient(); const { setParam } = useRes();
  const cat = p?.cat || 'all'; const q = p?.q || ''; const setP = (patch) => setParam({ ...p, ...patch });
  const list = getState().venues.filter((v) => v.active !== false && (cat === 'all' || cat === 'contacts' || v.category === cat) && matches(q, v.name.pl, v.name.en, v.description?.pl, v.description?.en, (v.tags || []).join(' ')));
  return (
    <div class="r-stack">
      <SearchInput value={q} onInput={(v) => setP({ q: v })} placeholder={t('r.v.search')} />
      <Chips scroll value={cat} onChange={(v) => setP({ cat: v })} options={[{ id: 'all', label: t('c.all') }, ...VENUE_CATS.map((c) => ({ id: c, label: t('r.vcat.' + c), icon: VENUE_ICON[c] })), { id: 'contacts', label: t('r.nav.contacts'), icon: 'phone' }]} />
      {cat === 'contacts' ? <Contacts list={list} /> : list.length ? <div class="r-grid">{list.map((v) => <VenueCard key={v.id} v={v} />)}</div> : <Empty icon="building" title={t('r.v.none')} />}
    </div>
  );
}
function VenueCard({ v }) {
  const { t, L } = useClient(); const { go } = useRes(); const n = sel.events().filter((e) => e.venueId === v.id).length;
  return (
    <Card class="r-vcard" as="article">
      <Media ill={v.ill} src={v.src} ratio="16/8" shape="plain" alt={L(v.name)} />
      <CardBody>
        <div class="r-meta"><Tag icon={VENUE_ICON[v.category]}>{t('r.vcat.' + v.category)}</Tag>{n > 0 && <Tag tone="green" icon="calendar">{t('r.ev.count', { n })}</Tag>}</div>
        <h3 class="r-ecard__title"><button type="button" class="r-link" onClick={() => go('venue', v.id)}>{L(v.name)}</button></h3>
        <p class="r-clamp">{L(v.description)}</p>
        <span class="r-muted r-ico"><Icon name="clock" size={14} />{L(v.hours)}</span>
        <div class="r-ecard__actions"><Button variant="secondary" size="sm" onClick={() => go('venue', v.id)} aria-label={`${t('c.more')}: ${L(v.name)}`}>{t('c.more')}</Button></div>
      </CardBody>
    </Card>
  );
}
function ContactLines({ c }) {
  const { t } = useClient(); if (!c) return null;
  return (
    <ul class="r-contact">
      {c.phone && <li><Icon name="phone" size={16} /><span class="fpz-sr">{t('r.v.phone')}: </span><a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></li>}
      {c.email && <li><Icon name="mail" size={16} /><span class="fpz-sr">{t('r.v.email')}: </span><a href={`mailto:${c.email}`}>{c.email}</a></li>}
      {c.www && <li><Icon name="globe" size={16} /><span class="fpz-sr">{t('r.v.www')}: </span><a href={c.www} target="_blank" rel="noopener noreferrer">{c.www.replace(/^https?:\/\//, '')}</a></li>}
      {c.address && <li><Icon name="mapPin" size={16} /><span class="fpz-sr">{t('r.v.address')}: </span><span>{c.address}</span></li>}
    </ul>
  );
}
function Contacts({ list }) {
  const { t, L } = useClient(); const { go } = useRes();
  return (
    <section class="r-stack-sm">
      <p class="r-muted">{t('r.v.contactsLead')}</p>
      <div class="r-contacts">
        {list.map((v) => (
          <Card key={v.id} variant="outline" class="r-ccard" as="article"><CardBody>
            <div class="r-meta"><Tag icon={VENUE_ICON[v.category]}>{t('r.vcat.' + v.category)}</Tag></div>
            <h3 class="r-h3"><button type="button" class="r-link" onClick={() => go('venue', v.id)}>{L(v.name)}</button></h3>
            <ContactLines c={v.contact} />
          </CardBody></Card>
        ))}
      </div>
    </section>
  );
}

/* ───────── Szczegóły obiektu ───────── */
export function VenueView({ id }) {
  const { t, L, lang } = useClient(); const { nav, go } = useRes(); const [ask, setAsk] = useState(false);
  const v = sel.venue(id); if (!v) return <Empty icon="building" title={t('c.empty')} />;
  const poi = v.poiId && sel.poi(v.poiId); const evs = sel.events().filter((e) => e.venueId === v.id);
  const prods = getState().products.filter((p) => p.active !== false && p.venueId === v.id && !p.eventId);
  const cps = getState().coupons.filter((c) => c.active !== false && c.venueId === v.id);
  return (
    <div class="r-detail">
      <div class="r-detail__main r-stack">
        <Media ill={v.ill} src={v.src} ratio="16/8" shape="arc-tr" alt={L(v.name)} />
        <div class="r-meta"><Tag icon={VENUE_ICON[v.category]}>{t('r.vcat.' + v.category)}</Tag>{v.sample && <Tag tone="warn">{t('r.v.sample')}</Tag>}</div>
        <h2 class="r-h1x">{L(v.name)}</h2>
        <Rich text={L(v.description)} />
        {evs.length > 0 && <section class="r-stack-sm"><h3 class="r-h3">{t('r.v.events')}</h3><div class="r-grid r-grid--2">{evs.map((e) => <EventCard key={e.id} e={e} compact />)}</div></section>}
        {prods.length > 0 && <section class="r-stack-sm"><h3 class="r-h3">{t('r.v.offer')}</h3><div class="r-plist">{prods.map((p) => <ProductRow key={p.id} p={p} />)}</div></section>}
        {cps.length > 0 && <section class="r-stack-sm"><h3 class="r-h3">{t('r.v.coupons')}</h3>{cps.map((c) => <div key={c.id} class="r-coupon"><Icon name="coupon" size={20} /><div><b>{L(c.title)}</b> <Tag tone="deep">{L(c.discount)}</Tag><div class="r-prod__desc">{L(c.description)}</div></div></div>)}</section>}
      </div>
      <aside class="r-detail__side r-stack-sm">
        <h3 class="r-h3"><Icon name="clock" size={18} /> {t('r.v.hours')}</h3>
        <p>{L(v.hours)}</p>
        <h3 class="r-h3"><Icon name="phone" size={18} /> {t('r.v.contact')}</h3>
        <ContactLines c={v.contact} />
        {poi && nav?.showOnMap && <Button variant="secondary" icon="map" block onClick={() => nav.showOnMap(poi.id)}>{t('r.showOnMap')}</Button>}
        {v.acceptsInquiries ? <Button icon="calendar" block onClick={() => setAsk(true)}>{t('r.v.inquire')}</Button> : <Notice>{t('r.v.noInquiry')}</Notice>}
      </aside>
      {ask && <InquiryModal v={v} onClose={() => setAsk(false)} />}
    </div>
  );
}

function InquiryModal({ v, onClose }) {
  const { t, L, api, user, toast } = useClient(); const { sheet, offline, announce, go } = useRes();
  const tomorrow = dayStr(addDays(new Date(), 1));
  const [f, setF] = useState({ date: tomorrow, time: '17:00', people: 2, message: '' }); const [err, setErr] = useState('');
  const upd = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const send = (e) => {
    e.preventDefault(); if (!f.date) { setErr(t('r.q.dateReq')); return; }
    const r = api.booking.inquire({ venueId: v.id, date: `${f.date}T${f.time || '12:00'}`, people: f.people, message: f.message });
    if (!r.ok) { setErr(L(r.message)); announce(L(r.message)); return; }
    toast(t('r.q.sent'), 'ok'); announce(t('r.q.sent')); onClose(); go('inquiries');
  };
  return (
    <Modal class="r-modal" open onClose={onClose} title={`${t('r.q.title')}: ${L(v.name)}`} variant={sheet} size="md" closeLabel={t('c.close')}>
      {!user ? <><Notice tone="info">{t('r.a.required')}</Notice><AuthPanel /></> : (
        <form class="r-form" onSubmit={send} noValidate>
          {offline && <Notice tone="warn" icon="wifiOff">{t('r.off.blocked')}</Notice>}
          {err && <Notice tone="danger">{err}</Notice>}
          <div class="r-form__row">
            <Field label={t('r.q.date')}><Input type="date" name="date" min={dayStr(new Date())} value={f.date} onInput={upd('date')} required /></Field>
            <Field label={t('r.q.time')}><Input type="time" name="time" value={f.time} onInput={upd('time')} /></Field>
            <Field label={t('r.q.people')}><Input type="number" name="people" min="1" max="500" value={f.people} onInput={upd('people')} /></Field>
          </div>
          <Field label={t('r.q.message')}><Textarea name="message" value={f.message} onInput={upd('message')} placeholder={t('r.q.msgPh')} /></Field>
          <Button type="submit" icon="send" block disabled={offline}>{t('r.q.send')}</Button>
        </form>
      )}
    </Modal>
  );
}
