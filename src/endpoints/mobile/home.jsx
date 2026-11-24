// Ekran główny wg próbki C: nagłówek, filtry-pigułki, karty (powitanie, w pobliżu, transmisja, wyróżnione wpisy, wydarzenia, aktualności, skróty).
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDate, fmtDay, fmtTime, fmtDistance, paragraphs } from '../../kernel/util.js';
import { Button, Card, CardBody, Chips, CornerLink, Icon, IconButton, Media, Modal, Tag } from '../../ui/components.jsx';
import { useApp } from './ctx.js';
import { Screen, SectionHead, EntryCard, Skeleton } from './ui.jsx';
import { TestBadge } from './testmode.jsx';

strings({
  'm.f.all': ['Wszystko', 'All'], 'm.f.visit': ['Zwiedzanie', 'Visiting'], 'm.f.events': ['Wydarzenia', 'Events'], 'm.f.info': ['Informacje', 'Information'],
  'm.home.welcome': ['Witaj w Fabryce Pełnej Życia', 'Welcome to the Factory Full of Life'], 'm.home.filters': ['Filtruj treści', 'Filter content'],
  'm.home.near': ['Jesteś w pobliżu', 'You are near'], 'm.home.nearOpen': ['Zobacz treści', 'See content'], 'm.home.featured': ['Polecamy', 'Recommended'],
  'm.home.events': ['Najbliższe wydarzenia', 'Upcoming events'], 'm.home.allEvents': ['Wszystkie', 'All'], 'm.home.news': ['Aktualności', 'News'],
  'm.home.shortcuts': ['Na skróty', 'Shortcuts'], 'm.sc.scan': ['Skanuj', 'Scan'], 'm.sc.audio': ['Audio­przewodnik', 'Audio guide'], 'm.sc.coupons': ['Kupony', 'Coupons'], 'm.sc.route': ['Moja ścieżka', 'My route'],
  'm.home.live': ['Transmisja trwa', 'Live now'], 'm.home.watch': ['Oglądaj', 'Watch'], 'm.home.hours': ['Godziny otwarcia', 'Opening hours'],
  'm.home.practical': ['Informacje praktyczne', 'Visitor information'], 'm.home.tickets': ['Bilety i rezerwacje', 'Tickets & bookings'], 'm.home.ticketsLead': ['Koncerty, warsztaty, wystawy i oferta najemców – kup bilet w aplikacji.', 'Concerts, workshops, exhibitions and tenant offers – buy tickets in the app.'],
  'm.home.myTickets': ['Moje bilety', 'My tickets'], 'm.home.browse': ['Przeglądaj ofertę', 'Browse the offer'], 'm.home.free': ['Wstęp wolny', 'Free entry'],
  'm.ev.where': ['Miejsce', 'Venue'], 'm.ev.when': ['Termin', 'When'], 'm.ev.left': ['Wolnych miejsc: {n}', 'Places left: {n}'], 'm.showOnMap': ['Pokaż na mapie', 'Show on map'],
});

export function HomeScreen() {
  const app = useApp(); const { t, L, lang, client } = useClient(); const [f, setF] = useState('all'); const [ev, setEv] = useState(null);
  const s = getState(); const show = (...k) => f === 'all' || k.includes(f);
  const unread = sel.pushFor('mobile').filter((p) => !client.pushReadAt || p.at > client.pushReadAt).length;
  const near = sel.nearbyBeacons(80).find((b) => b.inRange && b.poi) || (() => { const n = sel.nearestPoi('fpz'); return n && n.distanceM < 40 ? { poi: n.poi, distanceM: n.distanceM } : null; })();
  const featured = sel.entries({ featured: true, channel: 'mobile' });
  const events = sel.events().slice(0, f === 'events' ? 6 : 2);
  const news = sel.news().slice(0, f === 'info' ? 5 : 2);
  const actions = <><IconButton icon="search" variant="plain" label={t('m.search')} onClick={() => app.push('search')} /><IconButton icon="bell" variant="plain" label={t('m.notifications')} badge={unread || null} onClick={() => app.push('notifications')} /></>;
  const filters = <Chips scroll value={f} onChange={setF} class="m-filters" options={[{ id: 'all', label: t('m.f.all') }, { id: 'visit', label: t('m.f.visit') }, { id: 'events', label: t('m.f.events') }, { id: 'info', label: t('m.f.info') }]} />;
  return (<Screen root title={app.platform === 'android' ? t('m.tab.home') : null} actions={<>{app.standalone && <TestBadge onClick={app.openTestMode} />}{actions}</>} below={filters}>
    <div class="m-stack" key={f}>
      {show('events', 'info') && s.live.onAir && <Card variant="deep" class="m-live" onClick={() => app.push('live')}><CardBody><Tag tone="live">{t('c.live')}</Tag><h2>{L(s.live.title)}</h2><span class="m-live__go"><Icon name="play" size={16} />{t('m.home.watch')}</span></CardBody></Card>}
      {show('info') && <Card class="m-welcome"><CardBody><h2>{t('m.home.welcome')}</h2><p class="m-clamp4">{paragraphs(L(s.site.about))[0]?.map((x) => x.text).join('')}</p><CornerLink onClick={() => app.push('aboutSite')}>{t('c.readMore')}</CornerLink></CardBody></Card>}
      {show('visit') && near && <Card variant="mint" class="m-near" onClick={() => app.openPoi(near.poi.id)}><CardBody><span class="m-near__ico"><Icon name="beacon" size={22} /></span><span><small>{t('m.home.near')} · {fmtDistance(near.distanceM)}</small><b>{L(near.poi.name)}</b><em>{t('m.home.nearOpen')} →</em></span></CardBody></Card>}
      {show('visit') && <div class="m-shortcuts" role="group" aria-label={t('m.home.shortcuts')}>
        {[['scan', 'm.sc.scan', () => app.openScanner('qr')], ['headphones', 'm.sc.audio', () => app.push('audio')], ['coupon', 'm.sc.coupons', () => app.openCoupons()], ['route', 'm.sc.route', () => app.push('routeBuilder', {})]].map(([ic, k, fn]) => <button key={k} type="button" class="m-shortcut" onClick={fn}><span><Icon name={ic} size={22} /></span><b>{t(k)}</b></button>)}
      </div>}
      {show('events') && events.map((e) => <EventCard key={e.id} ev={e} onMore={() => setEv(e.id)} />)}
      {f === 'events' && <Card class="m-tickets"><CardBody><h2>{t('m.home.tickets')}</h2><p>{t('m.home.ticketsLead')}</p><div class="m-btnrow"><Button icon="calendar" onClick={() => app.openReservation({ view: 'events' })}>{t('m.home.browse')}</Button><Button variant="secondary" icon="ticket" onClick={() => app.openReservation({ view: 'tickets' })}>{t('m.home.myTickets')}</Button></div></CardBody></Card>}
      {show('visit') && featured.length > 0 && <><SectionHead title={t('m.home.featured')} />
        <div class="m-hscroll">{featured.slice(0, 8).map((e) => <EntryCard key={e.id} entry={e} onClick={() => app.openEntry(e.id)} />)}</div></>}
      {show('info') && news.length > 0 && <><SectionHead title={t('m.home.news')} />{news.map((n) => <NewsCard key={n.id} n={n} />)}</>}
      {show('info') && <Card variant="mint" class="m-practical" onClick={() => app.push('info')}><CardBody><Icon name="clock" size={22} /><span><b>{t('m.home.hours')}</b><span>{L(s.site.hours)}</span></span><Icon name="arrowRight" size={18} /></CardBody></Card>}
    </div>
    {ev && <EventSheet id={ev} onClose={() => setEv(null)} />}
  </Screen>);
}

/** Karta wydarzenia jak w próbce C: zdjęcie archiwalne, jasnomiętowe tło, „Kup bilet” + „Dowiedz się więcej”. */
export function EventCard({ ev, onMore }) {
  const app = useApp(); const { t, L, lang } = useClient(); const left = sel.remaining(ev.id);
  return (<Card variant="mint" class="m-evcard">
    <Media ill={ev.ill} src={ev.src} tone="archival" ratio={getState().env.network === 'slow' ? '3/1' : '16/7'} shape="plain" alt="">{ev.live && <Tag tone="live">{t('c.live')}</Tag>}</Media>
    <CardBody><small class="m-kicker"><Icon name="calendar" size={13} />{fmtDay(ev.start, lang)} · {fmtTime(ev.start, lang)}</small><h2>{L(ev.title)}</h2><p class="m-clamp2">{L(ev.description)}</p>
      <div class="m-btnrow">{ev.ticketed ? (left > 0 ? <Button icon="ticket" onClick={() => app.openReservation({ view: 'event', id: ev.id })}>{t('c.buyTicket')}</Button> : <Tag tone="danger">{t('c.soldOut')}</Tag>) : <Tag tone="green">{t('m.home.free')}</Tag>}
        <Button variant="secondary" onClick={onMore}>{t('c.more')}</Button></div></CardBody></Card>);
}

export function EventSheet({ id, onClose }) {
  const app = useApp(); const { t, L, lang } = useClient(); const e = sel.event(id); if (!e) return null; const poi = e.poiId && sel.poi(e.poiId);
  return (<Modal open variant="sheet" onClose={onClose} title={L(e.title)} closeLabel={t('c.close')} footer={<div class="m-btnrow">{e.ticketed && sel.remaining(e.id) > 0 && <Button icon="ticket" onClick={() => { onClose(); app.openReservation({ view: 'event', id: e.id }); }}>{t('c.buyTicket')}</Button>}{poi && <Button variant="secondary" icon="map" onClick={() => { onClose(); app.showOnMap(poi.id); }}>{t('m.showOnMap')}</Button>}</div>}>
    <Media ill={e.ill} src={e.src} tone="archival" ratio="16/9" shape="arc-tr" alt="" />
    <dl class="m-dl"><dt>{t('m.ev.when')}</dt><dd>{fmtDate(e.start, lang)}, {fmtTime(e.start, lang)}–{fmtTime(e.end, lang)}</dd>{poi && <><dt>{t('m.ev.where')}</dt><dd>{L(poi.name)}</dd></>}{e.ticketed && <><dt>{t('c.buyTicket')}</dt><dd>{t('m.ev.left', { n: sel.remaining(e.id) })}</dd></>}</dl>
    <p>{L(e.description)}</p>
  </Modal>);
}

function NewsCard({ n }) {
  const { L, lang, t } = useClient(); const [open, setOpen] = useState(false);
  return (<Card class="m-news"><CardBody><small class="m-kicker">{fmtDate(n.date, lang)}</small><h3>{L(n.title)}</h3><p class={clsx(!open && 'm-clamp3')}>{L(n.body)}</p><CornerLink onClick={() => setOpen(!open)}>{open ? t('c.close') : t('c.readMore')}</CornerLink></CardBody></Card>);
}
export { Skeleton };
