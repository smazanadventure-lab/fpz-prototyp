// Wydarzenia i bilety (osadzony system rezerwacji), transmisje, informacje, wyniki wyszukiwania, 404.
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import ReservationApp from '../reservation/index.jsx';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { fmtDay, fmtTime, matches } from '../../kernel/util.js';
import { Icon, Button, Card, CardBody, Tag, Media, Chips, Tabs, Empty, Notice, SearchInput, LiveCaptions, PjmCall, Rich, Select } from '../../ui/components.jsx';
import { VideoSim } from '../../ui/media.jsx';
import { useNav, enc, isOffline } from './nav.js';
import { PageHead, Section, EventCard, VenueCard } from './bits.jsx';
import { VideoLibrary } from './history.jsx';
import { searchAll, SEARCH_GROUPS } from './layout.jsx';

/* ── wydarzenia i bilety ── */
const VIEWS = { event: 'event', venue: 'venue', cart: 'cart', account: 'account', tickets: 'tickets', venues: 'venues', events: 'events' };
export function EventsPage({ r }) {
  const { t } = useClient(); const { go, path } = useNav();
  const view = VIEWS[r.a] || 'home';
  return (<div class="w-events">
    <div class="w-wrap w-events__head">
      <h1 tabIndex={-1}>{t('w.nav.events')}</h1>
      <p class="w-small">{t('w.ev.lead')}</p>
    </div>
    {isOffline() && <div class="w-wrap"><Notice tone="warn" icon="wifiOff">{t('w.off.res')}</Notice></div>}
    <div class="w-wrap w-resbox">
      <ReservationApp key={path} channel="web" initial={{ view, id: r.b || undefined }} nav={{ showOnMap: (poiId) => go(`mapa/miejsce/${enc(poiId)}`) }} />
    </div>
  </div>);
}

/* ── transmisje ── */
export function LivePage() {
  const s = useStore(); const { t, L, lang } = useClient(); const { go } = useNav(); const live = s.live;
  const upcoming = sel.events().filter((e) => e.live).slice(0, 4);
  const liveVid = s.videos.find((v) => v.kind === 'live');
  return (<>
    <PageHead icon="tv" title={t('w.nav.live')} lead={t('w.live.lead')} crumbs={[{ label: t('w.nav.live') }]} />
    <Section id="w-live" title={live.onAir ? L(live.title) : t('w.live.none')} kicker={live.onAir ? <Tag tone="live">{t('c.live')}</Tag> : t('w.live.studio')}>
      {live.onAir ? (isOffline() ? <Notice tone="warn" icon="wifiOff">{t('w.off.video')}</Notice> : <div class="w-live">
        <div class="w-live__player"><VideoSim live autoplay video={{ ...(liveVid || {}), title: live.title, ill: liveVid?.ill || 'studio', captions: [] }} showCaptions={false} />
          <p class="w-small"><Icon name="people" size={14} /> {t('w.live.viewers', { n: live.viewers || 0 })}</p></div>
        <div class="w-live__cc"><h3 class="w-h4"><Icon name="captions" size={18} /> {t('w.live.cc')}</h3><LiveCaptions lines={6} idleText={t('w.live.ccWait')} /><p class="w-small">{t('w.live.ccNote')}</p></div>
      </div>) : (<div class="w-split">
        <Empty icon="tv" title={t('w.live.none')} text={t('w.live.noneT')} />
        <div><h3 class="w-h4">{t('w.live.next')}</h3>{upcoming.length ? <ul class="w-stack">{upcoming.map((e) => <li key={e.id}><EventCard ev={e} compact /></li>)}</ul> : <p class="w-small">{t('c.empty')}</p>}</div>
      </div>)}
    </Section>
    <VideoLibrary kinds={['studio', 'archive']} title={t('w.live.lib')} />
  </>);
}

/* ── informacje ── */
const ITABS = [['', 'w.info.visit', 'info'], ['dostepnosc', 'w.info.a11y', 'accessibility'], ['najemcy', 'w.info.tenants', 'store'], ['prywatnosc', 'w.info.privacy', 'shield'], ['faq', 'w.info.faq', 'help']];
export function InfoPage({ r }) {
  const { t } = useClient(); const { go } = useNav(); const tab = ITABS.some((x) => x[0] === r.a) ? r.a || '' : ''; const cur = ITABS.find((x) => x[0] === tab);
  return (<>
    <PageHead icon="info" title={tab ? t(cur[1]) : t('w.nav.info')} lead={t('w.info.lead')} crumbs={tab ? [{ label: t('w.nav.info'), path: 'informacje' }, { label: t(cur[1]) }] : [{ label: t('w.nav.info') }]}>
      <Tabs variant="pill" class="w-htabs" tabs={ITABS.map(([id, k, ic]) => ({ id, label: t(k), icon: ic }))} value={tab} onChange={(id) => go(id ? `informacje/${id}` : 'informacje')} />
    </PageHead>
    {tab === '' && <Visit />}{tab === 'dostepnosc' && <Access />}{tab === 'najemcy' && <Tenants />}{tab === 'prywatnosc' && <Privacy />}{tab === 'faq' && <Faq />}
  </>);
}
function Visit() {
  const s = useStore(); const { t, L } = useClient(); const { go } = useNav(); const site = s.site;
  return (<Section id="w-visit">
    <div class="w-grid w-grid--3">
      <Card variant="mint"><CardBody><h2 class="w-h4"><Icon name="clock" size={18} /> {t('w.info.hours')}</h2><p class="w-big">{L(site.hours)}</p><p class="w-small">{t('w.info.hoursNote')}</p></CardBody></Card>
      <Card><CardBody><h2 class="w-h4"><Icon name="mapPin" size={18} /> {t('w.info.address')}</h2><p class="w-big">{site.address}</p><Button size="sm" variant="secondary" icon="map" onClick={() => go('mapa')}>{t('w.nav.map')}</Button></CardBody></Card>
      <Card><CardBody><h2 class="w-h4"><Icon name="phone" size={18} /> {t('w.foot.contact')}</h2><ul class="w-contacts">
        <li><Icon name="phone" size={15} /><a href={`tel:${site.contact.phone.replace(/\s/g, '')}`}>{site.contact.phone}</a></li>
        <li><Icon name="mail" size={15} /><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></li>
        <li><Icon name="globe" size={15} />{site.contact.www}</li></ul></CardBody></Card>
    </div>
    <h2 class="w-h3 w-mt">{t('w.info.getThere')}</h2>
    <ul class="w-grid w-grid--4 w-mt">
      {[['train', 'w.info.train'], ['bus', 'w.info.bus'], ['car', 'w.info.car'], ['bike', 'w.info.bike']].map(([ic, k]) => <li key={k}><Card class="w-howto"><CardBody><Icon name={ic} size={26} /><h3 class="w-h5">{t(k)}</h3><p class="w-small">{t(k + 'T')}</p></CardBody></Card></li>)}
    </ul>
    <Notice class="w-mt">{t('w.info.sample')}</Notice>
  </Section>);
}
function Access() {
  const { t } = useClient(); const { go } = useNav(); const [pjm, setPjm] = useState(false);
  const items = [['ear', 'w.acc.loop'], ['hand', 'w.acc.pjm'], ['captions', 'w.acc.cc'], ['monitor', 'w.acc.kiosk'], ['wheelchair', 'w.acc.routes'], ['headphones', 'w.acc.audio'], ['contrast', 'w.acc.web'], ['file', 'w.acc.alt']];
  return (<Section id="w-acc">
    <div class="w-split">
      <div class="w-stack">
        <p class="w-lead">{t('w.acc.lead')}</p>
        <ul class="w-acclist">{items.map(([ic, k]) => <li key={k}><span class="w-acclist__ic"><Icon name={ic} size={22} /></span><div><h3 class="w-h5">{t(k)}</h3><p class="w-small">{t(k + 'T')}</p></div></li>)}</ul>
      </div>
      <div class="w-stack">
        <Card variant="deep" class="w-pjmcard"><CardBody><Icon name="hand" size={34} /><h2 class="w-h3">{t('c.pjm')}</h2><p>{t('w.acc.pjmT')}</p><Button variant="mint" icon="phoneCall" size="lg" onClick={() => setPjm(true)}>{t('w.acc.pjmBtn')}</Button></CardBody></Card>
        <Card><CardBody><h2 class="w-h4">{t('w.acc.decl')}</h2><p class="w-small">{t('w.acc.declT')}</p><ul class="w-glist"><li>{t('w.acc.d1')}</li><li>{t('w.acc.d2')}</li><li>{t('w.acc.d3')}</li></ul>
          <Button size="sm" variant="secondary" icon="route" onClick={() => go('mapa/zaplanuj')}>{t('w.acc.plan')}</Button></CardBody></Card>
      </div>
    </div>
    <PjmCall open={pjm} onClose={() => setPjm(false)} where="web: informacje/dostępność" />
  </Section>);
}
function Tenants() {
  const s = useStore(); const { t, L } = useClient(); const [cat, setCat] = useState('all'); const [q, setQ] = useState('');
  const cats = [...new Set(s.venues.map((v) => v.category))];
  const list = s.venues.filter((v) => v.active !== false && (cat === 'all' || v.category === cat) && matches(q, v.name.pl, v.name.en, v.description?.pl, (v.tags || []).join(' ')));
  return (<Section id="w-ten">
    <div class="w-toolbar"><SearchInput value={q} onInput={setQ} placeholder={t('w.ten.search')} /><Chips options={[{ id: 'all', label: t('c.all') }, ...cats.map((c) => ({ id: c, label: t('w.vcat.' + c) }))]} value={cat} onChange={setCat} /></div>
    <p class="w-small w-mb" aria-live="polite">{t('w.ten.count', { n: list.length })}</p>
    {list.length ? <ul class="w-grid w-grid--3">{list.map((v) => <li key={v.id}><VenueCard v={v} contacts /></li>)}</ul> : <Empty icon="store" title={t('w.f.none')} />}
  </Section>);
}
function Privacy() {
  const { t } = useClient(); const { client, set } = useClient();
  return (<Section id="w-priv"><div class="w-split">
    <div class="w-prose fpz-rich"><p class="w-lead">{t('w.pr.lead')}</p>{[1, 2, 3, 4, 5].map((i) => <Fragment key={i}><h2 class="w-h4">{t('w.pr.h' + i)}</h2><p>{t('w.pr.p' + i)}</p></Fragment>)}</div>
    <Card variant="mint"><CardBody><h2 class="w-h4"><Icon name="shield" size={18} /> {t('w.pr.yours')}</h2>
      {client.cookies ? <ul class="w-glist"><li>{t('w.ck.nec')}: ✓</li><li>{t('w.ck.an')}: {client.cookies.analytics ? '✓' : '—'}</li><li>{t('w.ck.mk')}: {client.cookies.marketing ? '✓' : '—'}</li></ul> : <p class="w-small">{t('w.pr.none')}</p>}
      <Button size="sm" variant="secondary" icon="settings" onClick={() => set({ cookies: null })}>{t('w.ck.settings')}</Button></CardBody></Card>
  </div></Section>);
}
function Faq() {
  const { t } = useClient();
  return (<Section id="w-faq"><div class="w-faq">{[1, 2, 3, 4, 5, 6, 7].map((i) => <details key={i} class="w-details w-details--faq"><summary>{t('w.faq.q' + i)}</summary><p>{t('w.faq.a' + i)}</p></details>)}</div></Section>);
}

/* ── wyniki wyszukiwania ── */
export function SearchPage({ r }) {
  const { t, L, lang } = useClient(); const { go } = useNav(); useStore(); const [q, setQ] = useState(r.a || ''); const res = searchAll(q);
  return (<>
    <PageHead icon="search" title={t('w.search.title')} crumbs={[{ label: t('w.search.title') }]}>
      <form class="w-srch-form" onSubmit={(e) => { e.preventDefault(); }} role="search"><SearchInput value={q} onInput={setQ} placeholder={t('w.search.ph')} /></form>
    </PageHead>
    <Section id="w-sr">
      {!res ? <p class="w-small">{t('w.search.short')}</p> : res.total === 0 ? <Empty icon="search" title={t('w.search.none', { q })} /> : <>
        <p class="w-small w-mb" aria-live="polite">{t('w.search.count', { n: res.total })}</p>
        <div class="w-srgroups">{SEARCH_GROUPS.filter((g) => res[g.id].length).map((g) => <section key={g.id} class="w-srgroup" aria-labelledby={`w-sg-${g.id}`}>
          <h2 id={`w-sg-${g.id}`} class="w-h4"><Icon name={g.icon} size={18} /> {t(g.key)} <span class="w-count">{res[g.id].length}</span></h2>
          <ul>{res[g.id].map((x) => <li key={x.id}><a href="#" onClick={(e) => { e.preventDefault(); go(g.path(x)); }}><b>{L(g.title(x))}</b><span class="w-small">{g.id === 'events' ? `${fmtDay(x.start, lang)}, ${fmtTime(x.start, lang)}` : L(g.sub?.(x) || '')}</span></a></li>)}</ul>
        </section>)}</div>
      </>}
    </Section>
  </>);
}

export function NotFound() {
  const { t } = useClient(); const { go } = useNav();
  return (<><PageHead title={t('w.404')} crumbs={[{ label: '404' }]} /><Section><Empty icon="compass" title={t('w.404')} text={t('w.404T')}><Button onClick={() => go('')}>{t('w.nav.home')}</Button></Empty></Section></>);
}
