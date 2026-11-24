// Mapa i zwiedzanie: plan terenu / mapa miasta, wyszukiwarka miejsc, szczegóły, kreator indywidualnej ścieżki, trasy tematyczne.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { distanceM, fmtDistance, fmtDay, fmtTime, clsx } from '../../kernel/util.js';
import { Icon, Button, Card, CardBody, Tag, Media, Chips, Tabs, Empty, Notice, Modal, QR, SearchInput, Switch, Input, IconButton, Select } from '../../ui/components.jsx';
import { SitePlan, CityMap } from '../../ui/maps.jsx';
import { useNav, enc } from './nav.js';
import { PageHead, Section, EntryCard } from './bits.jsx';

const KINDS = [
  { id: 'all', key: 'c.all', kinds: null },
  { id: 'halls', key: 'w.k.halls', kinds: ['hall', 'spot'] },
  { id: 'history', key: 'w.k.history', kinds: ['history', 'industry'] },
  { id: 'culture', key: 'w.k.culture', kinds: ['culture'] },
  { id: 'nature', key: 'w.k.nature', kinds: ['nature', 'park', 'tree'] },
  { id: 'service', key: 'w.k.service', kinds: ['service'] },
];
const TABS = [['', 'w.m.explore', 'map'], ['zaplanuj', 'w.plan.title', 'route'], ['trasy', 'w.m.routes', 'walk']];

export function MapPage({ r }) {
  const { t } = useClient(); const { go } = useNav();
  const tab = r.a === 'miejsce' ? '' : TABS.some((x) => x[0] === r.a) ? r.a || '' : '';
  const cur = TABS.find((x) => x[0] === tab);
  return (<>
    <PageHead icon="map" title={tab ? t(cur[1]) : t('w.nav.map')} lead={tab === 'zaplanuj' ? t('w.plan.lead') : t('w.m.lead')} crumbs={tab ? [{ label: t('w.nav.map'), path: 'mapa' }, { label: t(cur[1]) }] : [{ label: t('w.nav.map') }]}>
      <Tabs variant="pill" class="w-htabs" tabs={TABS.map(([id, k, ic]) => ({ id, label: t(k), icon: ic }))} value={tab} onChange={(id) => go(id ? `mapa/${id}` : 'mapa')} />
    </PageHead>
    {tab === '' && <Explore selId={r.a === 'miejsce' ? r.b : null} />}
    {tab === 'zaplanuj' && <Planner />}
    {tab === 'trasy' && <ThemeRoutes />}
  </>);
}

function MapBox({ view, setView, pois, selectedId, onSelect, routePoiIds = [], filter, height }) {
  const { t } = useClient(); const s = useStore();
  return (<div class="w-mapbox">
    <div class="w-mapbox__bar">
      <div class="fpz-chips" role="group" aria-label={t('w.m.view')}>
        {[['iso', 'w.m.iso', 'layers'], ['plan', 'w.m.plan', 'grid'], ['city', 'w.m.city', 'map']].map(([id, k, ic]) => <button key={id} type="button" class={clsx('fpz-chip', view === id && 'is-active')} aria-pressed={view === id} onClick={() => setView(id)}><Icon name={ic} size={14} />{t(k)}</button>)}
      </div>
    </div>
    <div class="w-mapbox__map" style={height ? { height } : null}>
      {view === 'city'
        ? <CityMap pois={pois} selectedId={selectedId} onSelect={onSelect} filter={filter} routes={routePoiIds.length > 1 ? [{ id: 'r', poiIds: routePoiIds }] : []} focus={pois?.every((p) => p.scope === 'fpz') ? 'fpz' : 'city'} />
        : <SitePlan view={view} pois={pois?.filter((p) => p.scope === 'fpz' && p.site)} selectedId={selectedId} onSelect={onSelect} filter={filter} routePoiIds={routePoiIds} favorites={s.player.favorites} />}
    </div>
    <p class="w-mapnote"><Icon name="info" size={13} /> {t('c.schematicMap')}</p>
  </div>);
}

function Explore({ selId }) {
  const s = useStore(); const { t, L, client, set, api, lang } = useClient(); const { replace, go } = useNav();
  const mf = client.mf || {}; const setMf = (p) => set({ mf: { ...mf, ...p } });
  const sp = selId && sel.poi(selId);
  const view = mf.view || 'iso'; const effView = sp && sp.scope === 'city' && view !== 'city' ? 'city' : view;
  const kind = KINDS.find((k) => k.id === (mf.kind || 'all'));
  const scope = effView === 'city' ? null : 'fpz';
  const list = sel.pois({ scope: scope || undefined, kind: kind.kinds || undefined, accessible: mf.acc || undefined, q: mf.q || undefined });
  const pick = (p) => replace(`mapa/miejsce/${enc(p.id)}`);
  const filter = (p) => list.includes(p);
  return (<Section id="w-explore">
    <div class="w-explore">
      <div class="w-explore__side">
        <SearchInput value={mf.q || ''} onInput={(q) => setMf({ q })} placeholder={t('w.m.search')} />
        <Chips options={KINDS.map((k) => ({ id: k.id, label: t(k.key) }))} value={kind.id} onChange={(id) => setMf({ kind: id })} />
        <Switch label={<span><Icon name="wheelchair" size={16} /> {t('w.m.acc')}</span>} checked={!!mf.acc} onChange={(e) => setMf({ acc: e.currentTarget.checked })} />
        <p class="w-small" aria-live="polite">{t('w.m.count', { n: list.length })}</p>
        <ul class="w-poilist">{list.map((p) => <li key={p.id}><button type="button" class={clsx('w-poi', p.id === selId && 'is-active')} aria-current={p.id === selId ? 'true' : undefined} onClick={() => pick(p)}>
          <Media ill={p.ill} src={p.src} ratio="1/1" shape="circle" alt="" />
          <span><b>{L(p.name)}</b><span class="w-small">{t('w.pk.' + p.kind)}{p.scope === 'city' ? ` · ${t('w.m.inCity')}` : ''}</span></span>
          {p.accessible && <Icon name="wheelchair" size={16} title={t('c.accessible')} />}
        </button></li>)}</ul>
        {!list.length && <Empty icon="search" title={t('w.f.none')} />}
      </div>
      <div class="w-explore__main">
        <MapBox view={effView} setView={(v) => setMf({ view: v })} pois={effView === 'city' ? s.pois.filter((p) => p.active !== false) : undefined} selectedId={selId} onSelect={pick} filter={filter} />
        {sp ? <PoiDetail p={sp} /> : <Notice>{t('w.m.pickHint')}</Notice>}
      </div>
    </div>
  </Section>);
}

function PoiDetail({ p }) {
  const s = useStore(); const { t, L, api, lang, client, set, toast } = useClient(); const { go } = useNav();
  const entries = sel.entries({ channel: 'web', poiId: p.id }); const events = sel.events({ poiId: p.id }).slice(0, 3); const district = s.districts.find((d) => d.id === p.districtId);
  const venue = s.venues.find((v) => v.poiId === p.id); const fav = s.player.favorites.includes(p.id);
  const plan = client.plan || {}; const inPlan = (plan.stops || []).includes(p.id);
  const addToPlan = () => { set({ plan: { ...plan, stops: [...(plan.stops || []), p.id] } }); toast(t('w.plan.added'), 'ok'); };
  return (<Card class="w-poidet" as="article" aria-labelledby="w-poidet-h">
    <div class="w-poidet__grid">
      <Media ill={p.ill} src={p.src} ratio="4/3" shape="arc-tr" alt={L(p.name)} />
      <CardBody>
        <span class="w-kicker">{t('w.pk.' + p.kind)}{district ? ` · ${district.name}` : ''}</span>
        <h2 id="w-poidet-h" class="w-h3">{L(p.name)}</h2>
        <p class="w-small">{L(p.short)}</p>
        <div class="w-row">{p.accessible ? <Tag tone="green" icon="wheelchair">{t('c.accessible')}</Tag> : <Tag tone="warn">{t('c.notAccessible')}</Tag>}{p.protection && <Tag tone="info" icon="leaf">{L(p.protection)}</Tag>}</div>
      </CardBody>
    </div>
    <CardBody>
      <div class="fpz-rich">{L(p.description).split(/\n\s*\n/).map((x, i) => <p key={i}>{x}</p>)}</div>
      {p.accessNote && L(p.accessNote) && <Notice icon="wheelchair">{L(p.accessNote)}</Notice>}
      <div class="w-row">
        <Button size="sm" icon={inPlan ? 'check' : 'plus'} disabled={inPlan} onClick={addToPlan}>{inPlan ? t('w.plan.inPlan') : t('w.plan.add')}</Button>
        <Button size="sm" variant="secondary" icon="heart" aria-pressed={fav} onClick={() => api.visit.toggleFavorite(p.id)}>{fav ? t('w.m.unfav') : t('w.m.fav')}</Button>
        {venue && <Button size="sm" variant="secondary" icon="store" onClick={() => go(`wydarzenia/venue/${enc(venue.id)}`)}>{t('w.m.venue')}</Button>}
      </div>
      {entries.length > 0 && <><h3 class="w-h4">{t('w.m.stories')}</h3><ul class="w-linklist">{entries.map((e) => <li key={e.id}><a href="#" onClick={(ev) => { ev.preventDefault(); go(`historia/wpis/${enc(e.id)}`); }}>{L(e.title)}</a></li>)}</ul></>}
      {events.length > 0 && <><h3 class="w-h4">{t('w.m.events')}</h3><ul class="w-linklist">{events.map((e) => <li key={e.id}><a href="#" onClick={(ev) => { ev.preventDefault(); go(`wydarzenia/event/${enc(e.id)}`); }}>{fmtDay(e.start, lang)} {fmtTime(e.start, lang)} – {L(e.title)}</a></li>)}</ul></>}
      <div class="w-qrrow"><QR value={'P:' + p.id} size={84} /><p class="w-small">{t('w.m.qr')}</p></div>
    </CardBody>
  </Card>);
}

/* ── kreator indywidualnej ścieżki ── */
const INTERESTS = [['hall', 'w.k.halls'], ['history', 'w.k.history'], ['industry', 'w.k.industry'], ['culture', 'w.k.culture'], ['nature', 'w.k.nature'], ['park', 'w.k.parks'], ['service', 'w.k.service']];
export function legs(ids) {
  const s = getState(); const ps = ids.map((id) => sel.poi(id)).filter(Boolean); let total = 0, dist = 0;
  const rows = ps.map((p, i) => { const prev = i ? ps[i - 1] : s.env.position; const d = distanceM(prev, p); const city = p.scope === 'city'; const walk = d / (city ? 250 : 70); const stay = city ? 15 : 7; total += walk + stay; dist += d; return { p, d, walk: Math.round(walk), stay, city }; });
  return { rows, minutes: Math.round(total), distanceM: Math.round(dist) };
}
function Planner() {
  const s = useStore(); const { t, L, api, client, set, toast, lang } = useClient(); const { go } = useNav();
  const plan = client.plan || {}; const opts = { minutes: 90, interests: [], accessibleOnly: false, scope: 'fpz', ...(plan.opts || {}) };
  const stops = plan.stops || []; const setPlan = (p) => set({ plan: { ...plan, ...p } }); const setOpts = (p) => setPlan({ opts: { ...opts, ...p } });
  const [name, setName] = useState(''); const [send, setSend] = useState(false); const [view, setView] = useState(null); const [add, setAdd] = useState('');
  const suggest = () => { const r = api.visit.suggest(opts); if (!r.ok) return toast(L(r.message), 'error'); setPlan({ stops: r.poiIds }); toast(t('w.plan.ready', { n: r.poiIds.length }), 'ok'); };
  const move = (i, d) => { const a = [...stops]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setPlan({ stops: a }); };
  const L2 = legs(stops); const anyCity = L2.rows.some((x) => x.city); const v = view || (anyCity ? 'city' : 'iso');
  const save = () => { const r = api.visit.saveRoute({ name: name.trim() || t('w.plan.myRoute'), poiIds: stops }); if (r.ok) { toast(t('w.plan.saved'), 'ok'); setName(''); } else toast(L(r.message), 'error'); };
  const avail = s.pois.filter((p) => p.active !== false && !stops.includes(p.id) && (opts.scope === 'city' || p.scope === 'fpz'));
  const code = 'R-' + stops.map((id) => id.slice(0, 3)).join('').toUpperCase().slice(0, 8) + stops.length;
  return (<Section id="w-plan">
    <div class="w-planner">
      <Card variant="mint" class="w-planner__form" as="form" onSubmit={(e) => { e.preventDefault(); suggest(); }}>
        <CardBody>
          <h2 class="w-h3">{t('w.plan.step1')}</h2>
          <fieldset class="w-fs"><legend>{t('w.plan.time')}</legend>
            <Chips options={[30, 60, 90, 120, 180, 240].map((m) => ({ id: m, label: m < 60 ? `${m} min` : `${m / 60} h` }))} value={opts.minutes} onChange={(m) => setOpts({ minutes: m })} /></fieldset>
          <fieldset class="w-fs"><legend>{t('w.plan.where')}</legend>
            <Chips options={[{ id: 'fpz', label: t('w.plan.fpz') }, { id: 'city', label: t('w.plan.city') }]} value={opts.scope} onChange={(sc) => setOpts({ scope: sc })} /></fieldset>
          <fieldset class="w-fs"><legend>{t('w.plan.interests')}</legend>
            <div class="fpz-chips">{INTERESTS.map(([id, k]) => { const on = opts.interests.includes(id); return <button key={id} type="button" class={clsx('fpz-chip', on && 'is-active')} aria-pressed={on} onClick={() => setOpts({ interests: on ? opts.interests.filter((x) => x !== id) : [...opts.interests, id] })}>{on && <Icon name="check" size={13} />}{t(k)}</button>; })}</div></fieldset>
          <Switch label={<span><Icon name="wheelchair" size={16} /> {t('w.plan.accOnly')}</span>} checked={opts.accessibleOnly} onChange={(e) => setOpts({ accessibleOnly: e.currentTarget.checked })} />
          <Button type="submit" icon="sparkles" size="lg">{t('w.plan.suggest')}</Button>
        </CardBody>
      </Card>
      <div class="w-planner__res">
        <div class="w-row w-row--between"><h2 class="w-h3">{t('w.plan.step2')}</h2>{stops.length > 0 && <div class="w-planner__sum" aria-live="polite"><Tag tone="deep" icon="clock">{L2.minutes} min</Tag><Tag tone="green" icon="walk">{fmtDistance(L2.distanceM)}</Tag><Tag>{t('w.plan.stops', { n: stops.length })}</Tag></div>}</div>
        {stops.length === 0 ? <Empty icon="route" title={t('w.plan.empty')} text={t('w.plan.emptyT')} /> : <>
          <MapBox view={v} setView={setView} pois={v === 'city' ? s.pois.filter((p) => p.active !== false) : undefined} selectedId={null} routePoiIds={stops} filter={(p) => stops.includes(p.id)} onSelect={(p) => go(`mapa/miejsce/${enc(p.id)}`)} height="calc(var(--u) * 300)" />
          <ol class="w-stops">{L2.rows.map((x, i) => <li key={x.p.id} class="w-stop">
            <span class="w-stop__n" aria-hidden="true">{i + 1}</span>
            <div class="w-stop__body"><b>{L(x.p.name)}</b><span class="w-small">{i === 0 ? t('w.plan.fromStart') : ''}{fmtDistance(x.d)} · {t('w.plan.walk', { n: x.walk })} · {t('w.plan.stay', { n: x.stay })}{x.p.accessible ? '' : ` · ${t('c.notAccessible')}`}</span></div>
            <div class="w-stop__act">
              <IconButton icon="up" variant="plain" size="sm" label={`${t('w.plan.up')}: ${L(x.p.name)}`} disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon="down" variant="plain" size="sm" label={`${t('w.plan.down')}: ${L(x.p.name)}`} disabled={i === stops.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon="trash" variant="plain" size="sm" label={`${t('w.plan.remove')}: ${L(x.p.name)}`} onClick={() => setPlan({ stops: stops.filter((id) => id !== x.p.id) })} />
            </div></li>)}</ol>
          <form class="w-row w-addstop" onSubmit={(e) => { e.preventDefault(); if (add) { setPlan({ stops: [...stops, add] }); setAdd(''); } }}>
            <label class="w-fsel w-grow"><span>{t('w.plan.addStop')}</span><Select value={add} onChange={(e) => setAdd(e.currentTarget.value)} options={[{ id: '', label: '—' }, ...avail.map((p) => ({ id: p.id, label: L(p.name) }))]} /></label>
            <Button type="submit" variant="secondary" icon="plus" disabled={!add}>{t('w.plan.addBtn')}</Button>
          </form>
          <div class="w-planner__save">
            <label class="w-fsel w-grow"><span>{t('w.plan.name')}</span><Input value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder={t('w.plan.myRoute')} /></label>
            <Button icon="save" onClick={save}>{t('w.plan.save')}</Button>
            <Button variant="secondary" icon="smartphone" onClick={() => setSend(true)}>{t('w.plan.send')}</Button>
            <Button variant="secondary" icon="printer" onClick={() => { try { window.print(); } catch { /* brak drukarki */ } }}>{t('w.plan.print')}</Button>
            <Button variant="ghost" icon="trash" onClick={() => setPlan({ stops: [] })}>{t('w.plan.clear')}</Button>
          </div>
        </>}
        {s.player.customRoutes.length > 0 && <div class="w-saved"><h3 class="w-h4">{t('w.plan.savedList')}</h3>
          <ul>{s.player.customRoutes.map((cr) => <li key={cr.id}><span><b>{cr.name}</b> <span class="w-small">· {t('w.plan.stops', { n: cr.poiIds.length })}</span></span>
            <span class="w-row"><Button size="sm" variant="secondary" onClick={() => setPlan({ stops: [...cr.poiIds] })}>{t('w.plan.load')}</Button><IconButton icon="trash" variant="plain" size="sm" label={`${t('w.plan.remove')}: ${cr.name}`} onClick={() => api.visit.deleteRoute(cr.id)} /></span></li>)}</ul>
          <p class="w-small">{t('w.plan.savedNote')}</p></div>}
      </div>
    </div>
    <Modal open={send} onClose={() => setSend(false)} size="sm" title={t('w.plan.send')} closeLabel={t('c.close')}>
      <div class="w-stack w-center">
        <QR value={`https://app.fpz.example/r/${stops.join(',')}`} size={200} label={code} />
        <p class="w-small">{t('w.plan.sendT')}</p>
        <Notice>{t('w.plan.sendSim')}</Notice>
      </div>
    </Modal>
  </Section>);
}

/* ── gotowe trasy tematyczne (trasy gry jako propozycje spacerów) ── */
function ThemeRoutes() {
  const s = useStore(); const { t, L, client, set } = useClient(); const { go } = useNav(); const [cur, setCur] = useState(s.gameRoutes[0]?.id);
  const r = s.gameRoutes.find((x) => x.id === cur);
  const ids = r ? [...new Set(r.missions.filter((m) => m.active !== false).map((m) => m.poiId))].filter((id) => sel.poi(id)) : [];
  const L2 = legs(ids);
  return (<Section id="w-routes">
    <div class="w-routes">
      <ul class="w-routes__list" role="list">{s.gameRoutes.map((x) => <li key={x.id}><button type="button" class={clsx('w-rbtn', x.id === cur && 'is-active')} aria-pressed={x.id === cur} onClick={() => setCur(x.id)}>
        <Media ill={x.ill} src={x.src} ratio="1/1" shape="circle" alt="" /><span><b>{L(x.name)}</b><span class="w-small">{L(x.tagline)}</span></span></button></li>)}</ul>
      {r && <Card class="w-routes__det" as="article"><CardBody>
        <h2 class="w-h3">{L(r.name)}</h2><p class="w-small">{L(r.description)}</p>
        <div class="w-row"><Tag tone="deep" icon="mapPin">{t('w.plan.stops', { n: ids.length })}</Tag><Tag tone="green" icon="walk">{fmtDistance(L2.distanceM)}</Tag><Tag icon="clock">~{L2.minutes} min</Tag>
          {(r.lengths || []).map((l) => <Tag key={l.id}>{L(l.name)}: {l.km} km</Tag>)}</div>
        <div class="w-mapbox__map w-routes__map"><CityMap pois={s.pois.filter((p) => ids.includes(p.id))} routes={[{ id: r.id, poiIds: ids }]} onSelect={(p) => go(`mapa/miejsce/${enc(p.id)}`)} /></div>
        <ol class="w-stops w-stops--plain">{L2.rows.map((x, i) => <li key={x.p.id} class="w-stop"><span class="w-stop__n" aria-hidden="true">{i + 1}</span><div class="w-stop__body"><a href="#" onClick={(e) => { e.preventDefault(); go(`mapa/miejsce/${enc(x.p.id)}`); }}><b>{L(x.p.name)}</b></a><span class="w-small">{L(x.p.short)}</span></div></li>)}</ol>
        <div class="w-row"><Button icon="route" onClick={() => { set({ plan: { ...(client.plan || {}), stops: ids, opts: { ...((client.plan || {}).opts || {}), scope: 'city' } } }); go('mapa/zaplanuj'); }}>{t('w.m.toPlanner')}</Button>
          <Button variant="secondary" icon="game" onClick={() => go('gra')}>{t('w.m.asGame')}</Button></div>
      </CardBody></Card>}
    </div>
  </Section>);
}
