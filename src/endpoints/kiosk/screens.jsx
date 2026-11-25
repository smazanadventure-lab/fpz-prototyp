// Ekrany kiosków informacyjnych (TZ.T1.1–T1.4) – używane też przez kiosk T1.5.
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useClient, useNow } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { clsx, fmtDate, fmtTime, dayStr, addDays, distanceM, fmtDistance, fmtDuration, matches } from '../../kernel/util.js';
import { Icon, IconButton, Button, Card, CardBody, CornerLink, Tag, Rich, Media, Logo, Chips, Tabs, Empty, Notice } from '../../ui/components.jsx';
import { SitePlan } from '../../ui/maps.jsx';
import { VideoSim, AudioGuide } from '../../ui/media.jsx';
import { useKiosk, ScreenHead, TakeHomeButton, PanZoom, Keyboard, ViewToggle, useSwipe, scaleOf } from './common.jsx';

const kioskEntries = (f = {}) => sel.entries({ ...f, channel: 'kiosk' });
const firstPara = (txt, max = 0) => { const p = String(txt || '').split(/\n\s*\n/)[0].replace(/\*\*/g, ''); if (!max || p.length <= max) return p; const cut = p.slice(0, max); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', ')); return (i > max * 0.5 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '')) + ' …'; };
export const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const imgOf = (e) => (e.media || []).find((m) => m.type === 'image' || m.ill)?.ill || 'factory-archival';
export const eraOf = (eras, year) => (year == null ? null : eras.find((r) => year >= r.from && year <= r.to) || null);

/* ───────── Ekran główny (wg próbki B) ───────── */
export function Home() {
  const { t, L, lang } = useClient(); const s = useStore(); const { nav, device, takeHome } = useKiosk();
  const here = sel.poi(device.poiId);
  const feat = kioskEntries({ featured: true }); const local = kioskEntries({ poiId: device.poiId });
  const cards = [...local, ...feat.filter((e) => !local.includes(e))].slice(0, 3);
  const ev = sel.events()[0]; const news = sel.news().slice(0, 5);
  const histCat = s.categories.find((c) => c.id === 'historia') || sel.categoryTree()[0];
  return (
    <div class="k-page k-home">
      <header class="k-welcome"><h1>{t('k.welcome')}</h1><Logo /></header>
      <div class="k-cols">
        <div class="k-col">
          <Card class="k-card k-card--about">
            <div class="k-card__body"><h2 class="k-card__title">{L(s.site.name)}</h2><p class="k-card__text">{firstPara(L(s.site.about), 260)}</p></div>
            <Media ill={here?.ill || 'hall-exterior'} shape="arc-bl" ratio="6/5" alt={L(here?.name || s.site.name)} class="k-card__inset" />
            <div class="k-card__foot"><CornerLink onClick={() => nav.go('about')}>{t('c.readMore')}</CornerLink></div>
          </Card>
          {cards.map((e) => (
            <Card key={e.id} class="k-card" onClick={() => nav.go('entry', { id: e.id })}>
              <Media ill={imgOf(e)} tone="archival" shape="rounded" ratio="3/2" alt={L(e.title)} class="k-card__pic" />
              <div class="k-card__body"><h2 class="k-card__title">{L(e.title)}</h2><p class="k-card__text">{L(e.lead)}</p></div>
              <div class="k-card__foot"><CornerLink as="span">{t('c.readMore')}</CornerLink></div>
            </Card>))}
        </div>
        <div class="k-col">
          <Card class="k-card k-card--hero" onClick={() => histCat && nav.section('cat', { id: histCat.id })}>
            <Media ill="steelworks" tone="archival" ratio="10/7" shape="plain" alt={t('k.discover')}>
              <h2 class="k-hero__t">{t('k.discover')}</h2>
              <span class="k-hero__b">{t('c.more')}</span>
            </Media>
          </Card>
          {ev && (
            <Card class="k-card">
              <Media ill={ev.ill} src={ev.src} tone="archival" ratio="6/5" shape="rounded" class="k-card__pic" alt={L(ev.title)} />
              <div class="k-card__body">
                <h2 class="k-card__title">{L(ev.title)}</h2>
                <p class="k-card__meta">{cap(fmtDate(ev.start, lang, { weekday: 'long', day: 'numeric', month: 'long' }))} · {fmtTime(ev.start, lang)} · {L(sel.poi(ev.poiId)?.name)}</p>
                <p class="k-card__text">{firstPara(L(ev.description), 180)}</p>
                <div class="k-btnrow k-btnrow--card">
                  {ev.ticketed ? <Button icon="ticket" size="sm" onClick={() => takeHome('V:' + ev.id, L(ev.title), { hint: t('k.buyHint'), label: t('c.buyTicket') })}>{t('c.buyTicket')}</Button> : <span class="k-free">{t('c.free')}</span>}
                  <Button variant="secondary" size="sm" onClick={() => nav.go('event', { id: ev.id })}>{t('c.more')}</Button>
                </div>
              </div>
            </Card>)}
          {news.length > 0 && <NewsCarousel news={news} />}
        </div>
      </div>
    </div>
  );
}

function NewsCarousel({ news }) {
  const { t, L, lang } = useClient(); const { nav } = useKiosk(); const [i, setI] = useState(0);
  const n = news.length; const go = (d) => setI((x) => (x + d + n) % n);
  useEffect(() => { const id = setInterval(() => go(1), 9000); return () => clearInterval(id); }, [n]);
  const sw = useSwipe(() => go(1), () => go(-1)); const it = news[i % n];
  return (
    <Card class="k-card k-news" variant="mint">
      <div class="k-news__head"><Tag icon="news">{t('k.news')}</Tag><span class="k-news__n">{(i % n) + 1}/{n}</span></div>
      <div class="k-swipe" {...sw} onClick={(e) => { if (!e.currentTarget.dataset.swiped) nav.go('news', { id: it.id }); }} role="button" tabIndex={0} aria-label={L(it.title)}>
        <div key={it.id} class="k-slide-in">
          <Media ill={it.ill} src={it.src} ratio="16/9" shape="rounded" alt={L(it.title)} />
          <p class="k-card__meta">{fmtDate(it.date, lang)}</p>
          <h3 class="k-card__title">{L(it.title)}</h3>
        </div>
      </div>
      <div class="k-dots" role="group">{news.map((x, k) => <button key={x.id} type="button" class={k === i % n ? 'is-on' : ''} aria-label={`${k + 1}`} onClick={() => setI(k)} />)}</div>
    </Card>
  );
}

/* ───────── O Fabryce / aktualność ───────── */
export function About() {
  const { t, L } = useClient(); const s = useStore();
  return (<div class="k-page"><ScreenHead title={L(s.site.name)} />
    <Media ill="hall-exterior" ratio="16/9" shape="arc-br" alt={L(s.site.name)} />
    <p class="k-lead">{L(s.site.tagline)}</p><Rich text={L(s.site.about)} class="k-rich" />
    <div class="k-facts"><div><Icon name="clock" size={16} /><b>{t('k.hours')}</b><span>{L(s.site.hours)}</span></div><div><Icon name="mapPin" size={16} /><b>{t('k.address')}</b><span>{s.site.address}</span></div></div>
  </div>);
}
export function NewsView({ id }) {
  const { t, L, lang } = useClient(); useStore(); const n = sel.news().find((x) => x.id === id);
  if (!n) return <div class="k-page"><ScreenHead title={t('k.news')} /><Empty title={t('c.empty')} /></div>;
  return (<div class="k-page"><ScreenHead title={L(n.title)} />
    <Media ill={n.ill} src={n.src} ratio="16/9" shape="arc-tl" alt={L(n.title)} /><p class="k-card__meta">{fmtDate(n.date, lang)}</p><Rich text={L(n.body)} class="k-rich" /></div>);
}

/* ───────── Mapa FPŻ z nawigacją i wyszukiwarką ───────── */
const FILTERS = { attractions: { icon: 'star' }, services: { icon: 'coffee' }, sights: { icon: 'eye' } };
function searchItems(s, f, q, from) {
  const pois = s.pois.filter((p) => p.active !== false && p.scope === 'fpz' && p.site);
  const out = [];
  for (const p of pois) {
    const cat = p.kind === 'service' ? 'services' : p.kind === 'spot' ? 'attractions' : 'sights';
    out.push({ key: 'p:' + p.id, type: 'poi', id: p.id, poi: p, name: p.name, sub: p.short, cat, icon: p.kind === 'hall' ? 'building' : p.kind === 'service' ? 'info' : p.kind === 'nature' || p.kind === 'park' ? 'tree' : 'mapPin', tags: p.tags || [] });
    if (p.kind === 'hall') out.push({ ...out[out.length - 1], key: 'pa:' + p.id, cat: 'sights', dup: true });
  }
  for (const v of s.venues) { const p = v.active !== false && v.poiId && pois.find((x) => x.id === v.poiId); if (!p) continue; out.push({ key: 'v:' + v.id, type: 'venue', id: v.id, venue: v, poi: p, name: v.name, sub: v.description, cat: ['gastro', 'tenant', 'institution'].includes(v.category) ? 'services' : 'attractions', icon: { gastro: 'utensils', tenant: 'store', institution: 'building', attraction: 'star', culture: 'music' }[v.category] || 'store', tags: v.tags || [] }); }
  return out.filter((x) => (f ? x.cat === f : !x.dup) && (!q || matches(q, x.name.pl, x.name.en, (x.tags || []).join(' '), x.sub?.pl, x.sub?.en)))
    .map((x) => ({ ...x, dist: from ? distanceM(from, x.poi) : null })).sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
}
export function MapScreen({ poiId: initial, venueId: initVenue }) {
  const { t, L } = useClient(); const s = useStore(); const { nav, device, takeHome, panelTop, zoneTop } = useKiosk();
  const [view, setView] = useState('iso'); const [f, setF] = useState(null); const [q, setQ] = useState(''); const [kbd, setKbd] = useState(false); const [fly, setFly] = useState(false);
  const [selKey, setSelKey] = useState(initVenue ? 'v:' + initVenue : 'p:' + (initial || device.poiId));
  const here = sel.poi(device.poiId);
  const items = searchItems(s, f, q, here);
  const all = searchItems(s, null, '', here);
  const cur = selKey ? [...items, ...all].find((x) => x.key === selKey) : null;
  const visible = new Set(items.map((x) => x.poi.id));
  const entries = cur ? kioskEntries({ poiId: cur.poi.id }) : [];
  const open = fly || kbd;
  const pick = (k) => { setSelKey(k); setFly(false); setKbd(false); };
  const more = () => { if (entries[0]) nav.go('entry', { id: entries[0].id }); else takeHome(cur.type === 'venue' ? 'O:' + cur.id : 'P:' + cur.poi.id, L(cur.name)); };
  const callout = cur ? (
    <div class="k-callout" key={cur.key}>
      <IconButton icon="close" variant="plain" label={t('c.close')} class="k-callout__x" iconSize={16} onClick={() => setSelKey(null)} />
      <h3>{L(cur.name)}</h3>
      <p class="k-callout__txt">{firstPara(L(cur.type === 'venue' ? cur.venue.description : cur.poi.short || cur.poi.description), 170)}</p>
      <p class="k-callout__meta"><Icon name="walk" size={14} /> {cur.poi.id === device.poiId ? t('c.youAreHere') : `${fmtDistance(cur.dist)} ${t('k.fromHere')}`}{cur.type === 'venue' ? ' · ' + L(cur.poi.name) : ''}{cur.poi.accessible ? <> · <Icon name="wheelchair" size={14} /></> : null}</p>
      <div class="k-callout__links">
        <button type="button" class="k-lcorner" onClick={more}>{t('c.more')}</button>
        <button type="button" class="k-lcorner k-lcorner--qr" onClick={() => takeHome(cur.type === 'venue' ? 'O:' + cur.id : 'P:' + cur.poi.id, L(cur.name))}><Icon name="phone" size={13} />{t('k.takeHome')}</button>
      </div>
    </div>) : null;
  return (
    <div class="k-map">
      <div class="k-map__pz">
        <SitePlan view={view} highlightId={device.poiId} hereId={device.poiId} selectedId={cur?.poi.id} focusId={cur?.poi.id} labels="selected" controls callout={callout} ariaLabel={t('k.nav.map')}
          filter={(f || q) ? (p) => visible.has(p.id) : undefined}
          onSelect={(p) => pick(all.find((x) => x.type === 'poi' && x.id === p.id)?.key || null)} />
      </div>
      <p class="k-map__note">{t('c.schematicMap')}</p>
      <aside class="k-navpanel" style={{ top: Math.max(8, (panelTop ?? 858) - (zoneTop ?? 0)) + 'px' }} aria-label={t('k.nav.map')}>
        <IconButton icon="back" label={t('k.back')} class="k-ctx__back" onClick={nav.back} />
        <b class="k-ctx__title">{t('k.nav.map')}</b>
        <div class="k-seg" role="group">
          <IconButton icon="cube" variant="plain" iconSize={20} label={t('k.view3d')} active={view === 'iso'} onClick={() => setView('iso')} />
          <IconButton icon="map" variant="plain" iconSize={20} label={t('k.viewPlan')} active={view === 'plan'} onClick={() => setView('plan')} />
        </div>
        <div class="fpz-search k-navpanel__search"><input class="fpz-input fpz-input--pill" type="search" value={q} placeholder={t('k.searchShort')} aria-label={t('k.search')} onFocus={() => { setKbd(true); setFly(true); }} onInput={(e) => { setQ(e.currentTarget.value); setFly(true); }} /><Icon name="search" size={14} /></div>
        <ul class="k-navpanel__f">{Object.keys(FILTERS).map((id) => <li key={id}><button type="button" class={clsx('k-pill', f === id && 'is-active')} aria-pressed={f === id} onClick={() => { setF(f === id ? null : id); setFly(f !== id); }}>{t('k.f.' + id)}</button></li>)}</ul>
      </aside>
      {open && <div class="k-flyout" style={{ top: Math.max(8, (panelTop ?? 858) - (zoneTop ?? 0)) + 'px' }} aria-live="polite">
        <div class="k-flyout__head"><b>{t('k.results', { n: items.length })}</b>
          <IconButton icon={kbd ? 'list' : 'edit'} variant="plain" iconSize={18} label={t('k.keyboard')} onClick={() => setKbd(!kbd)} />
          <IconButton icon="close" variant="plain" iconSize={18} label={t('c.close')} onClick={() => { setFly(false); setKbd(false); }} /></div>
        {kbd && <Keyboard value={q} onChange={(v) => setQ(v)} />}
        <ul class="k-results">{items.map((x) => (
          <li key={x.key}><button type="button" class={clsx('k-res', x.key === selKey && 'is-active')} onClick={() => pick(x.key)}>
            <span class="k-res__ic"><Icon name={x.icon} size={18} /></span>
            <span class="k-res__txt"><b>{L(x.name)}</b>{x.type === 'venue' && <small>{L(x.poi.name)}</small>}</span>
            <span class="k-res__d">{x.poi.id === device.poiId ? t('c.youAreHere') : fmtDistance(x.dist)}</span>
          </button></li>))}
          {!items.length && <li><Empty icon="search" title={t('c.empty')} /></li>}
        </ul>
      </div>}
    </div>
  );
}

/* ───────── Informator: wydarzenia, aktualności, informacje praktyczne ───────── */
export function InfoScreen({ tab: initial }) {
  const { t, L, lang } = useClient(); const s = useStore(); const { nav } = useKiosk();
  const evs = sel.events(); const tab = initial || 'today'; const [day, setDay] = useState(() => (evs.find((e) => e.start.slice(0, 10) >= dayStr()) || {}).start?.slice(0, 10) || dayStr());
  const today = dayStr(); const wk = dayStr(addDays(new Date(), 7));
  const list = tab === 'today' ? evs.filter((e) => e.start.slice(0, 10) <= today && e.end.slice(0, 10) >= today) : tab === 'week' ? evs.filter((e) => e.start.slice(0, 10) <= wk) : evs.filter((e) => e.start.slice(0, 10) === day);
  return (
    <div class="k-page">
      <ScreenHead title={{ today: t('k.today'), week: t('k.week'), cal: t('k.calendar'), news: t('k.news'), practical: t('k.practical') }[tab] || t('k.nav.info')} />
      <div class="k-fade" key={tab}>
        {tab === 'cal' && <MonthCal value={day} onChange={setDay} marks={evs.map((e) => e.start.slice(0, 10))} />}
        {['today', 'week', 'cal'].includes(tab) && (list.length ? <ul class="k-evlist">{list.map((e) => <li key={e.id}><EventRow e={e} /></li>)}</ul> : <>
          <Empty icon="calendar" title={t('k.noEvents')} />
          {evs.length > 0 && <><h2 class="k-sub">{t('k.upcoming')}</h2><ul class="k-evlist">{evs.slice(0, 4).map((e) => <li key={e.id}><EventRow e={e} /></li>)}</ul></>}</>)}
        {tab === 'news' && <ul class="k-newslist">{sel.news().map((n) => <li key={n.id}><Card class="k-card k-row" onClick={() => nav.go('news', { id: n.id })}><Media ill={n.ill} src={n.src} ratio="1/1" shape="arc-tl" alt="" /><div><p class="k-card__meta">{fmtDate(n.date, lang)}</p><h3 class="k-card__title">{L(n.title)}</h3><p class="k-card__text">{firstPara(L(n.body))}</p></div></Card></li>)}</ul>}
        {tab === 'practical' && <Practical />}
      </div>
    </div>
  );
}
function Practical() {
  const { t, L } = useClient(); const s = useStore(); const { nav } = useKiosk();
  const services = s.pois.filter((p) => p.scope === 'fpz' && p.kind === 'service' && p.active !== false);
  return (<div class="k-practical">
    <div class="k-facts">
      <div><Icon name="clock" size={16} /><b>{t('k.hours')}</b><span>{L(s.site.hours)}</span></div>
      <div><Icon name="mapPin" size={16} /><b>{t('k.address')}</b><span>{s.site.address}</span></div>
      <div><Icon name="phone" size={22} /><b>{t('k.contact')}</b><span>{s.site.contact?.phone}<br />{s.site.contact?.email}</span></div>
      <div><Icon name="wheelchair" size={22} /><b>{t('k.facilities')}</b><span>{t('k.facilitiesText')}</span></div>
    </div>
    {services.length > 0 && <ul class="k-evlist">{services.map((p) => <li key={p.id}><Card class="k-card k-row k-row--sm" onClick={() => nav.go('map', { poiId: p.id })}><span class="k-res__ic"><Icon name="info" size={20} /></span><div><h3 class="k-card__title">{L(p.name)}</h3><p class="k-card__text">{L(p.short)}</p></div><Icon name="mapPin" size={20} /></Card></li>)}</ul>}
    <Card variant="mint" class="k-card k-row k-row--sm"><span class="k-res__ic"><Icon name="phone" size={20} /></span><div><h3 class="k-card__title">{t('k.app')}</h3><p class="k-card__text">{t('k.appText')}</p></div><TakeHomeButton size="sm" code="P:hala-zabkowice" title={t('k.app')} icon="download" label="QR" /></Card>
  </div>);
}
export function EventRow({ e }) {
  const { L, lang, t } = useClient(); const { nav } = useKiosk(); const d = new Date(e.start);
  return (<Card class="k-card k-ev" onClick={() => nav.go('event', { id: e.id })}>
    <div class="k-ev__date"><b>{d.getDate()}</b><span>{fmtDate(e.start, lang, { month: 'short' })}</span><small>{fmtTime(e.start, lang)}</small></div>
    <div class="k-ev__txt"><h3 class="k-card__title">{L(e.title)}</h3><p class="k-card__meta"><Icon name="mapPin" size={15} /> {L(sel.poi(e.poiId)?.name)}{e.live ? ' · ' : ''}{e.live && <Tag tone="live">{t('c.live')}</Tag>}</p></div>
    {e.ticketed ? (sel.remaining(e.id) > 0 ? <Tag tone="deep" icon="ticket">{t('c.buyTicket')}</Tag> : <Tag tone="danger">{t('c.soldOut')}</Tag>) : <Tag tone="green">{t('c.free')}</Tag>}
  </Card>);
}
export function MonthCal({ value, onChange, marks = [] }) {
  const { lang } = useClient(); const [m, setM] = useState(() => { const d = new Date(value); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = (m.getDay() + 6) % 7; const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(); const today = dayStr();
  const cells = Array.from({ length: first }, () => null).concat(Array.from({ length: days }, (_, i) => new Date(m.getFullYear(), m.getMonth(), i + 1)));
  const wd = Array.from({ length: 7 }, (_, i) => fmtDate(new Date(2024, 0, 1 + i).toISOString(), lang, { weekday: 'short' }));
  const sw = useSwipe(() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1)), () => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1)));
  return (<div class="k-cal" {...sw}>
    <div class="k-cal__head"><IconButton icon="back" variant="mint" label="−" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} /><b>{fmtDate(m.toISOString(), lang, { month: 'long', year: 'numeric' })}</b><IconButton icon="arrowRight" variant="mint" label="+" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} /></div>
    <div class="k-cal__grid">{wd.map((w) => <span key={w} class="k-cal__wd">{w}</span>)}
      {cells.map((d, i) => { if (!d) return <span key={i} />; const k = dayStr(d); return <button key={i} type="button" class={clsx(k === value && 'is-sel', k === today && 'is-today', marks.includes(k) && 'has-ev')} onClick={() => onChange(k)}>{d.getDate()}</button>; })}</div>
  </div>);
}
export function EventView({ id }) {
  const { t, L, lang } = useClient(); useStore(); const { nav, takeHome } = useKiosk(); const e = sel.event(id);
  if (!e) return <div class="k-page"><ScreenHead title={t('k.nav.info')} /><Empty title={t('c.empty')} /></div>;
  const left = sel.remaining(e.id); const prods = sel.productsFor(e.id);
  return (<div class="k-page">
    <ScreenHead title={L(e.title)} />
    <Media ill={e.ill} src={e.src} ratio="16/9" shape="arc-tr" alt={L(e.title)} />
    <div class="k-facts">
      <div><Icon name="calendar" size={22} /><b>{fmtDate(e.start, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</b><span>{fmtTime(e.start, lang)}–{fmtTime(e.end, lang)}</span></div>
      <div><Icon name="mapPin" size={16} /><b>{L(sel.poi(e.poiId)?.name)}</b><button type="button" class="k-link" onClick={() => nav.go('map', { poiId: e.poiId })}>{t('k.showMap')}</button></div>
      {e.ticketed && <div><Icon name="ticket" size={22} /><b>{prods.map((p) => `${L(p.name)} ${p.price} zł`).join(' · ') || t('c.buyTicket')}</b><span>{t('k.placesLeft', { n: left })}</span></div>}
    </div>
    <Rich text={L(e.description)} class="k-rich" />
    <div class="k-btnrow">
      {e.ticketed && left > 0 && <Button icon="ticket" size="lg" onClick={() => takeHome('V:' + e.id, L(e.title), { hint: t('k.buyHint'), label: t('c.buyTicket') })}>{t('c.buyTicket')}</Button>}
      {!e.ticketed && <Tag tone="green">{t('c.free')}</Tag>}
      <TakeHomeButton code={'V:' + e.id} title={L(e.title)} />
    </div>
  </div>);
}

/* ───────── Kategoria treści (menu dynamiczne z CMS) ───────── */
export function CategoryScreen({ id }) {
  const { t, L } = useClient(); useStore(); const { nav } = useKiosk();
  const root = sel.categoryTree().find((c) => c.id === id); const [sub, setSub] = useState('all'); const [mode, setMode] = useState('grid');
  if (!root) return <div class="k-page"><ScreenHead title={t('c.empty')} /><Empty /></div>;
  const subs = root.children.filter((c) => kioskEntries({ categoryId: c.id }).length);
  const list = kioskEntries({ categoryId: sub === 'all' ? root.id : sub });
  const others = id === 'historia' ? sel.categoryTree().filter((c) => !['historia', 'spolecznosc'].includes(c.id) && kioskEntries({ categoryId: c.id }).length) : [];
  return (<div class="k-page">
    <ScreenHead title={L(root.name)} right={<ViewToggle value={mode} onChange={setMode} />} />
    {subs.length > 1 && <Chips scroll options={[{ id: 'all', label: t('c.all') }, ...subs.map((c) => ({ id: c.id, label: L(c.name) }))]} value={sub} onChange={setSub} />}
    {list.length ? <div class={clsx('k-fade', mode === 'grid' ? 'k-grid2' : 'k-listv')} key={sub + mode}>{list.map((e) => <EntryCard key={e.id} e={e} mode={mode} />)}</div> : <Empty title={t('c.empty')} />}
    {others.length > 0 && <><h2 class="k-sub">{t('k.moreCats')}</h2><div class="k-tiles">{others.map((c) => <button key={c.id} type="button" class="k-tile" onClick={() => nav.section('cat', { id: c.id })}><Icon name={c.icon || 'folder'} size={26} /><span>{L(c.name)}</span><small>{kioskEntries({ categoryId: c.id }).length}</small></button>)}</div></>}
  </div>);
}
export function EntryCard({ e, mode = 'grid' }) {
  const { t, L } = useClient(); const { nav } = useKiosk();
  return (<Card class={clsx('k-card', mode === 'list' && 'k-row')} onClick={() => nav.go('entry', { id: e.id })}>
    <Media ill={imgOf(e)} tone="archival" ratio={mode === 'list' ? '1/1' : '16/10'} shape={mode === 'list' ? 'arc-tl' : 'card'} alt={L(e.title)} class={mode === 'grid' ? 'k-card__img k-card__img--pad' : ''} />
    <div class={mode === 'grid' ? 'fpz-card__body' : ''}>{e.year && <p class="k-card__meta">{e.year}</p>}<h3 class="k-card__title">{L(e.title)}</h3><p class="k-card__text">{L(e.lead)}</p></div>
    {mode === 'grid' && <div class="k-card__foot"><CornerLink as="span">{t('c.readMore')}</CornerLink></div>}
  </Card>);
}

/* ───────── Wpis (ekran z informacjami tekstowymi) ───────── */
export function EntryView({ id }) {
  const { t, L, api, lang } = useClient(); const s = useStore(); const { nav } = useKiosk(); const e = sel.entry(id);
  const [mi, setMi] = useState(0); const [box, setBox] = useState(null);
  const imgs = ((e && e.media) || []).filter((m) => m.ill); const nI = Math.max(1, imgs.length);
  const sw = useSwipe(() => setMi((x) => (x + 1) % nI), () => setMi((x) => (x - 1 + nI) % nI));
  useEffect(() => { if (e) api.stats.track('entry', e.id); setMi(0); }, [id]);
  if (!e) return <div class="k-page"><ScreenHead title={t('c.empty')} /><Empty /></div>;
  const cat = sel.category(e.categoryId); const era = s.eras.find((r) => r.id === e.eraId);
  const m = imgs[mi]; const strip = imgs.length > 1 ? imgs.slice(0, 4) : [];
  const openBox = (k) => setBox({ items: imgs.map((x) => ({ ill: x.ill, src: x.src, title: L(x.caption), text: x.credit })), i: k });
  const paras = String(L(e.body) || '').split(/\n\s*\n/); const half = Math.ceil(paras.length / 2);
  return (<div class="k-page k-entry">
    <ScreenHead title={L(e.title)} />
    {m && <figure class="k-entry__fig">
      <div class="k-swipe" {...sw} onClick={(ev) => { if (!ev.currentTarget.dataset.swiped) openBox(mi); }} role="button" tabIndex={0} aria-label={L(m.caption)}>
        <Media key={mi} ill={m.ill} src={m.src} tone="archival" ratio="16/7" shape="rounded" alt={L(m.caption)} class="k-slide-in" />
      </div>
      <figcaption>{mi + 1}/{imgs.length} {L(m.caption)}{m.credit ? ` · ${m.credit}` : ''}</figcaption>
    </figure>}
    <div class="k-entry__col">
      <div class="k-tagrow">{e.year && <Tag icon="calendar">{e.year}</Tag>}{era && <Tag tone="green">{L(era.name)}</Tag>}{e.poiId && <Tag icon="mapPin">{L(sel.poi(e.poiId)?.name)}</Tag>}</div>
      <p class="k-lead">{L(e.lead)}</p>
      {e.audioGuide && <AudioGuide src={e.audioGuide.src} text={L(e.audioGuide.text)} title={t('k.listen')} lang={lang} />}
      <Rich text={paras.slice(0, half).join('\n\n')} class="k-rich" />
    </div>
    {strip.length > 0 && <div class="k-entry__strip">
      <div class="k-entry__thumbs">{strip.map((x, k) => <button key={k} type="button" onClick={() => openBox(k)} aria-label={L(x.caption)}><Media ill={x.ill} src={x.src} tone="archival" ratio="4/3" shape="rounded" alt={L(x.caption)} /></button>)}</div>
      <div class="k-entry__stripcap"><span>1–{strip.length}/{imgs.length} {L(strip[0].caption)}</span><button type="button" class="fpz-corner" onClick={() => openBox(0)}>{t('k.fullGallery')}</button></div>
    </div>}
    {half < paras.length && <div class="k-entry__col"><Rich text={paras.slice(half).join('\n\n')} class="k-rich" /></div>}
    <div class="k-entry__col k-btnrow">
      <TakeHomeButton code={'E:' + e.id} title={L(e.title)} variant="primary" size="sm" />
      {e.poiId && sel.poi(e.poiId)?.site && <Button variant="secondary" size="sm" icon="map" onClick={() => nav.go('map', { poiId: e.poiId })}>{t('k.showMap')}</Button>}
    </div>
    {box && <Lightbox {...box} onClose={() => setBox(null)} />}
  </div>);
}

/* ───────── Galeria zdjęć: mozaika / lista, filtry, podgląd ───────── */
export function GalleryScreen({ from }) {
  const { t, L, lang } = useClient(); const s = useStore();
  const [mode, setMode] = useState('grid'); const [dec, setDec] = useState('all'); const [tag, setTag] = useState('all'); const [box, setBox] = useState(null);
  const decades = [...new Set(s.gallery.filter((g) => g.year).map((g) => Math.floor(g.year / 10) * 10))].sort();
  const tagCount = {}; s.gallery.forEach((g) => (g.tags || []).forEach((x) => { tagCount[x] = (tagCount[x] || 0) + 1; }));
  const tags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]).slice(0, 8);
  const list = s.gallery.filter((g) => (dec === 'all' || Math.floor((g.year || 0) / 10) * 10 === +dec) && (tag === 'all' || (g.tags || []).includes(tag)));
  const open = (i) => setBox({ items: list.map((g) => ({ ill: g.ill, title: L(g.title), text: L(g.description), meta: [g.year, g.author].filter(Boolean).join(' · ') })), i });
  return (<div class="k-page">
    <ScreenHead title={t('k.gallery')} />
    {!list.length && <Empty icon="image" title={t('c.empty')} />}
    <div class={clsx('k-fade', mode === 'grid' ? 'k-mosaic' : 'k-listv')} key={mode + dec + tag}>
      {list.map((g, i) => mode === 'grid'
        ? <button key={g.id} type="button" class={clsx('k-mosaic__it', 'k-m' + (i % 7))} onClick={() => open(i)} aria-label={L(g.title)}><Media ill={g.ill} src={g.src} tone={g.year && g.year < 1990 ? 'archival' : 'duotone'} ratio={null} shape="plain" alt={L(g.title)} /><span class="k-mosaic__cap">{L(g.title)}{g.year ? ` · ${g.year}` : ''}</span></button>
        : <Card key={g.id} class="k-card k-row" onClick={() => open(i)}><Media ill={g.ill} src={g.src} tone="archival" ratio="1/1" shape="rounded" alt={L(g.title)} /><div><p class="k-card__meta">{[g.year, g.author].filter(Boolean).join(' · ')}</p><h3 class="k-card__title">{L(g.title)}</h3><p class="k-card__text">{L(g.description)}</p></div></Card>)}
    </div>
    <div class="k-filterbar">
      <ViewToggle value={mode} onChange={setMode} /><span class="k-filterbar__sep" /><span class="k-filterbar__lbl">{t('k.filter')}</span>
      <div class="k-filterbar__pills">
        {tags.map((x) => <button key={x} type="button" class={clsx('k-pill', tag === x && 'is-active')} aria-pressed={tag === x} onClick={() => setTag(tag === x ? 'all' : x)}>#{x}</button>)}
        {decades.map((d) => <button key={d} type="button" class={clsx('k-pill', dec === String(d) && 'is-active')} aria-pressed={dec === String(d)} onClick={() => setDec(dec === String(d) ? 'all' : String(d))}>{t('k.decade', { d })}</button>)}
      </div>
    </div>
    {box && <Lightbox {...box} onClose={() => setBox(null)} />}
  </div>);
}
/** Podgląd zdjęcia na pełnym ekranie: swipe = następne/poprzednie, szczypanie/przeciąganie = powiększenie. */
export function Lightbox({ items, i: start = 0, onClose }) {
  const { t, overlayRef } = useClient(); const [i, setI] = useState(start); const n = items.length; const it = items[i];
  const go = (d) => setI((x) => (x + d + n) % n); const sw = useSwipe(() => go(1), () => go(-1), 80);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  if (!overlayRef?.current) return null;
  return createPortal(<div class="k-lb" role="dialog" aria-modal="true" aria-label={it.title}>
    <div class="k-lb__top"><span>{t('k.photoOf', { i: i + 1, n })}</span><IconButton icon="close" label={t('c.close')} onClick={onClose} /></div>
    <div class="k-lb__img" {...sw}><PanZoom resetKey={i} controls><Media key={i} ill={it.ill} src={it.src} tone="archival" ratio="4/3" shape="plain" alt={it.title} class="k-slide-in" /></PanZoom></div>
    <div class="k-lb__nav"><IconButton icon="back" label={t('c.prev')} onClick={() => go(-1)} /><div class="k-lb__txt"><h3>{it.title}</h3>{it.meta && <p class="k-lb__meta">{it.meta}</p>}{it.text && <p>{it.text}</p>}</div><IconButton icon="arrowRight" label={t('c.next')} onClick={() => go(1)} /></div>
    <p class="k-lb__hint">{t('k.swipeHint')}</p>
  </div>, overlayRef.current);
}

/* ───────── Galeria filmów ───────── */
export function VideosScreen({ from }) {
  const { t, L } = useClient(); const s = useStore(); const { nav, takeHome } = useKiosk(); const [kind, setKind] = useState('all'); const [mode, setMode] = useState('grid');
  const kinds = [...new Set(s.videos.map((v) => v.kind))];
  const list = s.videos.filter((v) => kind === 'all' || v.kind === kind);
  const kl = { archive: ['Archiwalne', 'Archive'], studio: ['Wirtualne studio', 'Virtual studio'], live: ['Transmisje', 'Broadcasts'] };
  return (<div class="k-page">
    <ScreenHead title={t('k.videos')} />
    {!list.length && <Empty icon="film" title={t('c.empty')} />}
    <div class={clsx('k-fade', mode === 'grid' ? 'k-vgrid' : 'k-listv')} key={kind + mode}>{list.map((v) => (
      <Card key={v.id} class={clsx('k-card k-vcard', mode === 'list' && 'k-row')} onClick={() => nav.go('video', { id: v.id })}>
        <Media ill={v.ill} src={v.src} tone={v.kind === 'archive' ? 'archival' : 'duotone'} ratio="16/9" shape="plain" alt={L(v.title)}>
          <span class="k-vcard__play"><Icon name="play" size={22} /></span><span class="k-vcard__dur">{fmtDuration(v.durationSec)}</span>
          <button type="button" class="k-vcard__share" aria-label={t('k.video.share')} onClick={(e) => { e.stopPropagation(); takeHome('F:' + v.id, L(v.title), { label: t('k.video.share') }); }}><Icon name="share" size={16} /></button>
        </Media>
        <div class="k-vcard__body"><p class="k-card__meta">{v.year || '\u00a0'}</p><h3 class="k-card__title">{L(v.title)}</h3></div>
      </Card>))}</div>
    <div class="k-filterbar">
      <ViewToggle value={mode} onChange={setMode} /><span class="k-filterbar__sep" /><span class="k-filterbar__lbl">{t('k.filter')}</span>
      <div class="k-filterbar__pills">{kinds.map((k) => <button key={k} type="button" class={clsx('k-pill', kind === k && 'is-active')} aria-pressed={kind === k} onClick={() => setKind(kind === k ? 'all' : k)}>#{L({ pl: kl[k]?.[0] || k, en: kl[k]?.[1] || k }).toLowerCase()}</button>)}</div>
    </div>
  </div>);
}
export function VideoView({ id }) {
  const { t, L } = useClient(); const s = useStore(); const { nav } = useKiosk(); const v = s.videos.find((x) => x.id === id);
  const i = s.videos.indexOf(v); const nV = s.videos.length; const nextV = s.videos[(i + 1) % nV];
  const sw = useSwipe(() => nav.replace('video', { id: nextV.id }), () => nav.replace('video', { id: s.videos[(i - 1 + nV) % nV].id }), 90);
  if (!v) return <div class="k-page"><ScreenHead title={t('k.videos')} /><Empty /></div>;
  return (<div class="k-page">
    <ScreenHead title={L(v.title)} />
    <div class="k-video" {...sw}><VideoSim key={v.id} video={v} autoplay /></div>
    <div class="k-btnrow"><TakeHomeButton code={'F:' + v.id} title={L(v.title)} label={t('k.video.share')} icon="share" variant="primary" />{v.year && <Tag icon="calendar">{v.year}</Tag>}<Tag icon="clock">{fmtDuration(v.durationSec)}</Tag></div>
    <Rich text={L(v.description)} class="k-rich" />
    {s.videos.length > 1 && <><h2 class="k-sub">{t('c.next')}</h2><Card class="k-card k-row" onClick={() => nav.replace('video', { id: nextV.id })}><Media ill={nextV.ill} src={nextV.src} ratio="16/10" shape="arc-tl" alt="" /><div><h3 class="k-card__title">{L(nextV.title)}</h3><p class="k-card__meta">{fmtDuration(nextV.durationSec)}</p></div></Card></>}
  </div>);
}

/* ───────── Oś czasu (plansze epok – swipe) ───────── */
function datedItems(s, L) {
  const out = [];
  for (const e of kioskEntries()) if (e.year) out.push({ key: 'e:' + e.id, year: e.year, title: L(e.title), ill: imgOf(e), entryId: e.id });
  for (const g of s.gallery) if (g.year && !out.some((x) => x.year === g.year && x.title === L(g.title))) out.push({ key: 'g:' + g.id, year: g.year, title: L(g.title), ill: g.ill });
  return out.sort((a, b) => a.year - b.year);
}
export function TimelineScreen() {
  const { t, L } = useClient(); const s = useStore(); const { nav } = useKiosk(); const eras = s.eras; const [i, setI] = useState(0);
  const n = eras.length; const go = (d) => setI((x) => Math.max(0, Math.min(n - 1, x + d))); const sw = useSwipe(() => go(1), () => go(-1));
  if (!n) return <div class="k-page"><ScreenHead title={t('k.timeline')} /><Empty /></div>;
  const era = eras[i]; const items = datedItems(s, L).filter((x) => x.year >= era.from && x.year <= era.to);
  return (<div class="k-page">
    <ScreenHead title={t('k.timeline')} right={<Button size="sm" variant="secondary" icon="puzzle" onClick={() => nav.replace('puzzle')}>{t('k.puzzle')}</Button>} />
    <ol class="k-tl__bar">{eras.map((r, k) => <li key={r.id}><button type="button" class={k === i ? 'is-on' : ''} onClick={() => setI(k)} aria-label={L(r.name)}><b>{r.from}</b></button></li>)}</ol>
    <div class="k-tl__slide" {...sw}>
      <div key={era.id} class="k-slide-in">
        <p class="k-card__meta">{era.from}–{era.to}</p><h2 class="k-tl__name">{L(era.name)}</h2><p class="k-lead">{L(era.summary)}</p>
        <ul class="k-tl__items">{items.map((x) => <li key={x.key}><button type="button" class="k-tl__it" disabled={!x.entryId} onClick={() => x.entryId && nav.go('entry', { id: x.entryId })}><Media ill={x.ill} src={x.src} tone="archival" ratio="1/1" shape="circle" alt="" /><b>{x.year}</b><span>{x.title}</span></button></li>)}</ul>
        {!items.length && <Empty icon="history" title={t('c.empty')} />}
      </div>
    </div>
    <div class="k-btnrow k-btnrow--between"><Button variant="secondary" icon="back" disabled={i === 0} onClick={() => go(-1)}>{t('c.prev')}</Button><span class="k-card__meta k-hintc">{t('k.swipeHint')}</span><Button variant="secondary" iconRight="arrowRight" disabled={i === n - 1} onClick={() => go(1)}>{t('c.next')}</Button></div>
  </div>);
}

/* ───────── Mini-zadanie „Ułóż oś czasu” (drag-and-drop + obsługa przyciskami) ───────── */
function pickCards(s, L) {
  const items = datedItems(s, L).filter((x) => eraOf(s.eras, x.year)); const byEra = {}; items.forEach((x) => { const e = eraOf(s.eras, x.year).id; (byEra[e] = byEra[e] || []).push(x); });
  const out = []; let round = 0; const keys = Object.keys(byEra);
  while (out.length < 5 && keys.some((k) => byEra[k][round])) { for (const k of keys) { if (byEra[k][round] && out.length < 5) out.push(byEra[k][round]); } round++; }
  return out.sort(() => 0.5 - ((out.length * 7919) % 13) / 13).map((x) => ({ ...x, era: eraOf(s.eras, x.year).id }));
}
export function PuzzleScreen() {
  const { t, L } = useClient(); const s = useStore();
  const [seed, setSeed] = useState(0); const [cards] = useState(() => pickCards(s, L)); const [place, setPlace] = useState({}); const [selC, setSelC] = useState(null); const [checked, setChecked] = useState(false);
  const [drag, setDrag] = useState(null); const rootRef = useRef(null); const dragRef = useRef(null); dragRef.current = drag;
  const reset = () => { setPlace({}); setChecked(false); setSelC(null); setSeed(seed + 1); };
  const put = (key, eraId) => { setPlace((p) => ({ ...p, [key]: eraId })); setChecked(false); setSelC(null); };
  const local = (e) => { const r = rootRef.current.getBoundingClientRect(); const k = scaleOf(rootRef.current); return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
  const down = (e, c) => { const p = local(e); setDrag({ key: c.key, c, sx: p.x, sy: p.y, x: p.x, y: p.y, active: false, over: null }); };
  useEffect(() => {
    const move = (e) => { const d = dragRef.current; if (!d) return; const p = local(e); const active = d.active || Math.hypot(p.x - d.sx, p.y - d.sy) > 10; const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-era]'); setDrag({ ...d, x: p.x, y: p.y, active, over: el?.dataset.era || null }); };
    const up = () => { const d = dragRef.current; if (!d) return; if (d.active) { if (d.over === '__pool') { setPlace((pl) => { const n = { ...pl }; delete n[d.key]; return n; }); setChecked(false); } else if (d.over) put(d.key, d.over); } setDrag(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);
  if (cards.length < 2) return <div class="k-page"><ScreenHead title={t('k.puzzle')} /><Empty icon="puzzle" title={t('c.empty')} /></div>;
  const pool = cards.filter((c) => !place[c.key]); const okN = cards.filter((c) => place[c.key] === c.era).length;
  const card = (c) => (<button key={c.key} type="button" class={clsx('k-pc', selC === c.key && 'is-sel', checked && place[c.key] && (place[c.key] === c.era ? 'is-ok' : 'is-bad'), drag?.active && drag.key === c.key && 'is-ghosted')} style={{ touchAction: 'none' }}
    onPointerDown={(e) => down(e, c)} onClick={() => { if (!dragRef.current?.active) setSelC(selC === c.key ? null : c.key); }} aria-pressed={selC === c.key}>
    <Media ill={c.ill} src={c.src} tone="archival" ratio="1/1" shape="circle" alt="" /><span><b>{checked && place[c.key] ? c.year : '?'}</b>{c.title}</span>
    {checked && place[c.key] && <Icon name={place[c.key] === c.era ? 'circleCheck' : 'circleX'} size={22} />}</button>);
  return (<div class="k-page k-puzzle" ref={rootRef}>
    <ScreenHead title={t('k.puzzle')} />
    <p class="k-card__text">{t('k.puzzleIntro')}</p>
    <div class={clsx('k-pz-pool', drag?.over === '__pool' && 'is-over')} data-era="__pool" aria-label={t('k.cards')}>{pool.map(card)}{!pool.length && <span class="k-card__meta">{t('k.cards')}: 0</span>}</div>
    <ol class="k-pz-eras">{s.eras.map((r) => { const here = cards.filter((c) => place[c.key] === r.id); return (
      <li key={r.id} data-era={r.id} class={clsx('k-pz-era', drag?.over === r.id && 'is-over', selC && 'is-target')} onClick={(e) => { if (selC && !e.target.closest('.k-pc')) put(selC, r.id); }}>
        <div class="k-pz-era__h"><b>{L(r.name)}</b><span>{r.from}–{r.to}</span>{selC && <span class="k-pz-era__cta">{t('k.placeHere')}</span>}</div>
        {here.length > 0 && <div class="k-pz-era__cards">{here.map(card)}</div>}
      </li>); })}</ol>
    <div class="k-btnrow" aria-live="polite">
      <Button icon="check" size="lg" disabled={pool.length > 0} onClick={() => setChecked(true)}>{t('k.check')}</Button>
      <Button variant="secondary" icon="refresh" onClick={reset}>{t('k.again')}</Button>
      {checked && <b class={clsx('k-pz-score', okN === cards.length && 'is-ok')}>{okN === cards.length ? t('k.perfect') : t('k.score', { ok: okN, n: cards.length })}</b>}
    </div>
    {drag?.active && <div class="k-pc k-pc--drag" style={{ left: drag.x - 160 + 'px', top: drag.y - 50 + 'px' }}><Media ill={drag.c.ill} tone="archival" ratio="1/1" shape="circle" alt="" /><span><b>?</b>{drag.c.title}</span></div>}
  </div>);
}
