// Ekran trasy (wspólny szkielet) + części specyficzne: przyroda (katalog), przemysł (oś FABRYKA / wątki), historia (oś czasu / dzielnice), przyszłość.
import { useState } from 'preact/hooks';
import { sel } from '../../kernel/api.js';
import { clsx, fmtDistance, distanceM } from '../../kernel/util.js';
import { Icon, Button, Card, Tag, Progress, Notice, Media, Empty, Chips, Tabs, Modal, Switch } from '../../ui/components.jsx';
import { CityMap, SitePlan } from '../../ui/maps.jsx';
import { useGame, routeOpts, missionStatus, MissionRow, Section, historyDistricts } from './parts.jsx';
import { ROUTE_ICON } from './strings.js';
import { PanoramaExplorer, IdeaForm, IdeasBoard } from './future.jsx';

const MODE_ICON = { walk: 'walk', bike: 'bike', access: 'wheelchair' };

export function RouteScreen({ id, ctx }) {
  const g = useGame(); const { t, L, s, p, api, client, set, toast, easy } = g;
  const r = sel.route(id); const [sel1, setSel1] = useState(null);
  if (!r) return <div class="g-pad"><Empty icon="route" title={t('c.empty')} /></div>;
  const opts = routeOpts(r, p, client); const active = p.activeRoute?.routeId === id;
  const other = !active && p.activeRoute ? sel.route(p.activeRoute.routeId) : null;
  const ms = sel.routeMissions(id, opts); const pr = sel.routeProgress(id, opts);
  const setOpt = (patch) => {
    if (active) { const res = api.game.setRouteOptions(patch); if (!res.ok) toast(L(res.message), 'error'); }
    else set({ gameOpts: { ...(client.gameOpts || {}), [id]: { ...opts, ...patch } } });
  };
  const nextMission = () => ms.find((m) => missionStatus(m).here) || ms.find((m) => !p.done[m.id]) || ms[0];
  const start = () => {
    if (!active) { const res = api.game.startRoute(id, { mode: opts.mode, length: opts.length, variant: opts.variant }); if (!res.ok) return toast(L(res.message), 'error'); toast(t('g.route.started')); }
    const n = nextMission(); if (n) ctx.go('mission', { id: n.id });
  };
  const openM = (mid) => ctx.go('mission', { id: mid });

  const list = (arr, extra) => (arr.length ? <ul class="g-mlist">{arr.map((m) => <MissionRow key={m.id} m={m} onOpen={openM} showAccess={opts.mode === 'access'} extra={extra?.(m)} />)}</ul>
    : <Empty icon="route" title={t('g.route.noMissions')} text={t('g.route.noMissionsText')} />);

  let missionsBlock;
  if (id === 'industry') {
    const fpz = ms.filter((m) => sel.poi(m.poiId)?.scope === 'fpz'); const city = ms.filter((m) => sel.poi(m.poiId)?.scope !== 'fpz');
    missionsBlock = (<>
      <Section title={t('g.ind.axis')} icon="factory" id="g-ind-axis" class="g-axis">{!easy && <p class="g-small g-muted">{t('g.ind.axisLead')}</p>}{list(fpz)}</Section>
      <Section title={t('g.ind.threads')} icon="navigation" id="g-ind-thr" class="g-threads">{!easy && <p class="g-small g-muted">{t('g.ind.threadsLead')}</p>}{list(city, () => <Tag tone="info" icon="arrowRight">{t('g.ms.city')}</Tag>)}</Section>
    </>);
  } else if (id === 'history') missionsBlock = <HistoryPanel r={r} ms={ms} ctx={ctx} list={list} />;
  else if (id === 'future') missionsBlock = <FuturePanel ms={ms} ctx={ctx} list={list} />;
  else missionsBlock = <Section title={t('g.route.missions')} icon="target" id="g-r-ms">{list(ms)}</Section>;

  const nextR = s.gameRoutes.find((x) => x.id !== id && !sel.routeProgress(x.id).complete);

  return (<div class={clsx('g-route', `g-route--${id}`)}>
    <div class="g-hero">
      <Media ill={r.ill} src={r.src} shape="arc-br" ratio={easy ? '16/8' : '16/9'} alt="" />
      <div class="g-hero__txt">
        <span class="g-label"><Icon name={ROUTE_ICON[id]} size={14} /> {t('g.title')}</span>
        <h2 class="g-h1">{L(r.name)}</h2>
        <p class="g-lead">{L(r.tagline)}</p>
      </div>
    </div>
    <div class="g-pad g-stack">
      {!easy && <p>{L(r.description)}</p>}
      {id === 'nature' && <Notice tone="ok" icon="flag">{t('g.route.startFinish')}</Notice>}

      {(r.modes?.length > 0 || r.lengths?.length > 0 || r.variants?.length > 0) && <Section title={t('g.route.options')} icon="sliders" id="g-r-opt" class="g-opts">
        {r.modes?.length > 0 && <fieldset class="g-seg"><legend>{t('g.route.way')}</legend><div class="g-seg__opts">{r.modes.map((m) => (
          <button key={m.id} type="button" class={clsx('g-seg__opt', opts.mode === m.id && 'is-on')} aria-pressed={opts.mode === m.id} onClick={() => setOpt({ mode: m.id })}><Icon name={MODE_ICON[m.id] || 'route'} size={20} /><b>{L(m.name)}</b></button>))}</div>
          {!easy && L(r.modes.find((m) => m.id === opts.mode)?.note) && <p class="g-small g-muted">{L(r.modes.find((m) => m.id === opts.mode)?.note)}</p>}
          {opts.mode === 'access' && <Notice icon="wheelchair">{t('g.route.accessNote')}</Notice>}</fieldset>}
        {r.lengths?.length > 0 && <fieldset class="g-seg"><legend>{t('g.route.length')}</legend><div class="g-lengths">{r.lengths.map((l) => { const n = sel.routeMissions(id, { ...opts, length: l.id }).length; return (
          <button key={l.id} type="button" class={clsx('g-len', opts.length === l.id && 'is-on')} aria-pressed={opts.length === l.id} onClick={() => setOpt({ length: l.id })}>
            <b>{L(l.name)}</b><span>{l.km} km</span><span>{Math.floor(l.durationMin / 60) ? `${Math.floor(l.durationMin / 60)} h ` : ''}{l.durationMin % 60 ? `${l.durationMin % 60} min` : ''}</span><span>{t('g.route.points', { n })}</span></button>); })}</div></fieldset>}
        {r.variants?.length > 0 && <fieldset class="g-seg"><legend>{t('g.route.variant')}</legend>
          <Chips scroll options={r.variants.map((v) => ({ id: v.id, label: L(v.name) }))} value={opts.variant} onChange={(v) => setOpt({ variant: v })} />
          {!easy && L(r.variants.find((v) => v.id === opts.variant)?.description) && <p class="g-small g-muted">{L(r.variants.find((v) => v.id === opts.variant)?.description)}</p>}
          <p class="g-small g-muted">{t('g.route.variantNote')}</p></fieldset>}
      </Section>}

      {other && <Notice tone="warn">{t('g.route.activeOther', { name: L(other.name) })}</Notice>}
      <div class="g-progline"><Progress value={pr.percent} label={L(r.name)} /><span>{t('g.route.progress', { done: pr.done, total: pr.total, pts: pr.points })}</span></div>
      {!pr.complete && <Button size="lg" block icon={active ? 'arrowRight' : 'flag'} onClick={start} disabled={!ms.length}>{active ? t('g.route.continue') : t('g.route.start')}</Button>}

      {pr.complete && <Card variant="deep" class="g-finish"><div class="fpz-card__body g-stack g-stack--sm">
        <span class="g-finish__ico" aria-hidden="true"><Icon name="trophy" size={34} /></span>
        <h3 class="g-h2">{t('g.route.doneTitle')}</h3>
        <p>{t('g.route.doneText', { n: pr.done, pts: pr.points })}</p>
        {nextR ? <Button variant="mint" icon="arrowRight" onClick={() => ctx.replace('route', { id: nextR.id })}>{t('g.route.next', { name: L(nextR.name) })}</Button> : <p><b>{t('g.route.allDone')}</b></p>}
        {active && <Button variant="secondary" size="sm" onClick={() => api.game.leaveRoute()}>{t('g.route.leave')}</Button>}
      </div></Card>}

      {id === 'nature' && <Card variant="mint" onClick={() => ctx.go('catalog')} class="g-linkcard"><Icon name="tree" size={26} /><span><b>{t('g.nat.openCatalog')}</b>{!easy && <small>{t('g.nat.catalogLead')}</small>}</span><Icon name="arrowRight" size={18} /></Card>}

      {missionsBlock}

      <Section title={t('g.route.map')} icon="map" id="g-r-map"><RouteMap ms={ms} selected={sel1} onSelect={setSel1} onOpen={openM} /></Section>
      {active && !pr.complete && <Button variant="ghost" size="sm" icon="close" onClick={() => api.game.leaveRoute()}>{t('g.route.leave')}</Button>}
    </div>
  </div>);
}

/** Mapa trasy: miasto (CityMap z łamaną trasy) albo teren FPŻ (SitePlan). */
export function RouteMap({ ms, selected, onSelect, onOpen, initial }) {
  const { t, L, env } = useGame();
  const fpzMs = ms.filter((m) => sel.poi(m.poiId)?.scope === 'fpz');
  const [tab, setTab] = useState(initial || (fpzMs.length === ms.length && ms.length ? 'fpz' : 'city'));
  const poiIds = [...new Set(ms.map((m) => m.poiId))]; const pois = poiIds.map((x) => sel.poi(x)).filter(Boolean);
  const pick = (poi) => { const m = ms.find((x) => x.poiId === poi.id); onSelect(m?.id || null); };
  const selM = selected && ms.find((m) => m.id === selected); const selPoi = selM && sel.poi(selM.poiId);
  return (<div class="g-mapbox">
    <Tabs variant="pill" value={tab} onChange={setTab} tabs={[{ id: 'city', label: t('g.route.mapCity'), icon: 'map' }, { id: 'fpz', label: t('g.route.mapFpz'), icon: 'building' }]} />
    <div class={clsx('g-map', tab === 'fpz' && 'g-map--fpz')}>{tab === 'city'
      ? <CityMap pois={pois} showDistricts={false} routes={[{ id: 'r', color: 'var(--c-accent)', poiIds }]} selectedId={selPoi?.id} position={env.position} onSelect={pick} />
      : fpzMs.length ? <SitePlan view="plan" routePoiIds={fpzMs.map((m) => m.poiId)} selectedId={selPoi?.id} position={env.position} hereId={env.position.poiId && sel.poi(env.position.poiId)?.scope === 'fpz' ? env.position.poiId : null} filter={(p) => fpzMs.some((m) => m.poiId === p.id)} onSelect={pick} labels="selected" />
        : <Empty icon="building" text={t('g.route.noFpz')} />}</div>
    {selM && <div class="g-mapsel"><span><b>{L(selM.title)}</b><small>{L(selPoi?.name)} · {fmtDistance(sel.distanceTo(selPoi))}</small></span><Button size="sm" iconRight="arrowRight" onClick={() => onOpen(selM.id)}>{t('g.done.toMission')}</Button></div>}
  </div>);
}

/* ── Trasa historyczna: oś czasu + dzielnice ── */
function HistoryPanel({ ms, ctx, list }) {
  const { t, L, s, env, easy } = useGame(); const [tab, setTab] = useState('timeline');
  const eras = s.eras; const [ei, setEi] = useState(0); const era = eras[Math.min(ei, eras.length - 1)];
  const [dist, setDist] = useState(null);
  const visitedEras = sel.erasVisited(); const hd = historyDistricts(s); const visited = sel.districtsVisited();
  const filled = hd.filter((d) => visited.includes(d.id)).length; const full = hd.length > 0 && filled === hd.length;
  const histPts = sel.routeProgress('history', {}).points;
  const objects = era ? sel.entries({ eraId: era.id }) : [];
  const gone = (e) => (e.tags || []).includes('nieistniejace') || (sel.poi(e.poiId)?.tags || []).includes('nieistniejace');
  return (<Section class="g-hist" id="g-hist">
    <Tabs variant="pill" value={tab} onChange={setTab} tabs={[{ id: 'timeline', label: t('g.his.timeline'), icon: 'clock' }, { id: 'districts', label: t('g.his.districts'), icon: 'map', badge: `${filled}/${hd.length}` }]} />
    {tab === 'timeline' ? (era ? <div class="g-stack">
      <h3 class="g-h3">{t('g.his.machine')}</h3>
      <div class="g-eras" role="group" aria-label={t('g.his.timeline')}>{eras.map((e, i) => (
        <button key={e.id} type="button" class={clsx('g-era', i === ei && 'is-on', visitedEras.includes(e.id) && 'is-visited')} aria-pressed={i === ei} onClick={() => setEi(i)}>
          <i aria-hidden="true" /><b>{e.from}</b>{!easy && <small>{L(e.name)}</small>}</button>))}</div>
      <input class="g-eraslider" type="range" min="0" max={eras.length - 1} step="1" value={ei} onInput={(e) => setEi(+e.currentTarget.value)} aria-label={t('g.his.machine')} aria-valuetext={`${era.from}–${era.to} ${L(era.name)}`} />
      <p class="g-small g-muted">{t('g.his.erasVisited', { x: visitedEras.length, n: eras.length })}</p>
      <Card variant="mint" class="g-eracard"><div class="fpz-card__body g-stack g-stack--sm">
        <span class="g-label">{era.from}–{era.to}</span><h3 class="g-h2">{L(era.name)}</h3><p>{L(era.summary)}</p></div></Card>
      <h3 class="g-h3">{t('g.his.eraMissions')}</h3>
      {list(ms.filter((m) => m.eraId === era.id))}
      <h3 class="g-h3">{t('g.his.objects')}</h3>
      {objects.length ? <ul class="g-objs">{objects.slice(0, easy ? 4 : 8).map((e) => (<li key={e.id}><button type="button" class="g-obj" onClick={() => ctx.nav?.openEntry?.(e.id)}>
        <Media ill={e.media?.[0]?.ill || 'map-old'} tone="archival" shape="arc-tl" ratio="1/1" alt="" class="g-obj__img" />
        <span><b>{L(e.title)}</b>{e.year && <small>{e.year}</small>}{gone(e) && <Tag tone="warn" icon="history">{t('g.his.gone')}</Tag>}</span></button></li>))}</ul>
        : <Empty icon="history" title={t('g.his.noObjects')} />}
    </div> : <Empty icon="clock" title={t('c.empty')} />) : (<div class="g-stack">
      <div class="g-filled"><b>{t('g.his.filled', { x: filled, n: hd.length })}</b><Progress value={filled} max={hd.length || 1} label={t('g.his.districts')} /></div>
      {full && <Card variant="deep" class="g-finish"><div class="fpz-card__body g-stack g-stack--sm"><span class="g-finish__ico" aria-hidden="true"><Icon name="trophy" size={30} /></span><b>{t('g.his.full')}</b><p class="g-small">{t('g.his.fullBonus', { pts: histPts })}</p></div></Card>}
      <p class="g-small g-muted">{t('g.his.tapDistrict')}</p>
      <div class="g-map g-map--tall"><CityMap tickboxes districts={hd.length ? hd : undefined} visitedDistrictIds={visited} onDistrict={setDist} pois={ms.map((m) => sel.poi(m.poiId)).filter(Boolean)} position={env.position} onSelect={(poi) => { const d = s.districts.find((x) => x.id === poi.districtId); if (d) setDist(d); }} /></div>
      <ul class="g-dlist">{s.districts.map((d) => { const has = hd.some((x) => x.id === d.id); const v = visited.includes(d.id); return (<li key={d.id}><button type="button" class={clsx('g-dchip', v && 'is-on', !has && 'is-empty')} onClick={() => setDist(d)} aria-pressed={v}><Icon name={v ? 'circleCheck' : 'mapPin'} size={14} />{d.name}</button></li>); })}</ul>
    </div>)}
    {dist && <DistrictSheet d={dist} ms={ms} onClose={() => setDist(null)} ctx={ctx} />}
  </Section>);
}

function DistrictSheet({ d, ms, onClose, ctx }) {
  const { t, L, ov } = useGame(); const r = sel.route('history');
  const dms = (r?.missions || []).filter((m) => m.active !== false && m.districtId === d.id);
  const ents = sel.entries({ districtId: d.id }).slice(0, 3); const v = sel.districtsVisited().includes(d.id);
  return (<Modal class={ov} open onClose={onClose} variant="sheet" title={d.name} closeLabel={t('c.close')}>
    <div class="g-stack">
      <div class="g-board"><Icon name="flag" size={22} /><span><b>{t('g.his.board', { code: d.boardCode || '—' })}</b><small>{t('g.his.boardQr')}</small></span>{v && <Tag tone="green" icon="circleCheck">{t('g.ms.done')}</Tag>}</div>
      <p>{L(d.blurb)}</p>
      {dms.length ? <ul class="g-mlist">{dms.map((m) => <MissionRow key={m.id} m={m} onOpen={(id) => { onClose(); ctx.go('mission', { id }); }} />)}</ul> : <Notice>{t('g.his.noMission')}</Notice>}
      {ents.length > 0 && <ul class="g-links">{ents.map((e) => <li key={e.id}><button type="button" class="g-link" onClick={() => ctx.nav?.openEntry?.(e.id)}><Icon name="book" size={15} /> {L(e.title)}</button></li>)}</ul>}
    </div></Modal>);
}

/* ── Trasa przyszłości: misje AR, panorama 360°, pomysły ── */
function FuturePanel({ ms, ctx, list }) {
  const { t } = useGame(); const [tab, setTab] = useState('missions');
  return (<Section class="g-fut" id="g-fut">
    <Tabs variant="pill" value={tab} onChange={setTab} tabs={[{ id: 'missions', label: t('g.fut.missions'), icon: 'target' }, { id: 'panorama', label: t('g.fut.panorama'), icon: 'panorama' }, { id: 'ideas', label: t('g.fut.ideas'), icon: 'message' }]} />
    {tab === 'missions' && list(ms)}
    {tab === 'panorama' && <PanoramaExplorer ctx={ctx} />}
    {tab === 'ideas' && <div class="g-stack"><IdeaForm /><IdeasBoard /></div>}
  </Section>);
}

/* ── Katalog terenów i miejsc przyrodniczych ── */
const NAT_FILTERS = {
  all: () => true,
  protected: (p) => p.kind === 'nature' && !!p.protection,
  attractive: (p) => p.kind === 'nature' && !p.protection,
  trees: (p) => p.kind === 'tree',
  parks: (p) => p.kind === 'park',
};
export function NatureCatalog({ ctx }) {
  const { t, L, env, easy } = useGame(); const [f, setF] = useState('all'); const [acc, setAcc] = useState(false); const [selId, setSelId] = useState(null);
  const all = sel.pois({ kind: ['nature', 'park', 'tree'] });
  const list = all.filter(NAT_FILTERS[f]).filter((p) => !acc || p.accessible).map((p) => ({ p, d: distanceM(env.position, p) })).sort((a, b) => a.d - b.d);
  const kindLabel = (p) => (p.kind === 'tree' ? t('g.nat.f.trees') : p.kind === 'park' ? t('g.nat.f.parks') : p.protection ? t('g.nat.f.protected') : t('g.nat.f.attractive'));
  return (<div class="g-pad g-stack">
    <h2 class="g-h1">{t('g.nat.catalog')}</h2>
    {!easy && <p class="g-lead">{t('g.nat.catalogLead')}</p>}
    <Chips scroll value={f} onChange={setF} options={['all', 'protected', 'attractive', 'trees', 'parks'].map((id) => ({ id, label: t('g.nat.f.' + id) }))} />
    <Switch label={t('g.nat.onlyAcc')} checked={acc} onChange={(e) => setAcc(e.currentTarget.checked)} />
    <div class="g-map"><CityMap pois={list.map((x) => x.p)} showDistricts={false} selectedId={selId} position={env.position} onSelect={(p) => setSelId(p.id)} /></div>
    <p class="g-small g-muted">{t('g.nat.count', { n: list.length })}</p>
    {list.length ? <ul class="g-places">{list.map(({ p, d }) => (<li key={p.id} class={clsx(selId === p.id && 'is-sel')}>
      <button type="button" class="g-place" onClick={() => ctx.nav?.openPoi?.(p.id)}>
        <Media ill={p.ill || 'forest'} shape="arc-tl" ratio="1/1" alt="" class="g-place__img" />
        <span class="g-place__txt"><b>{L(p.name)}</b>
          {!easy && <small>{L(p.short)}</small>}
          <span class="g-place__tags"><Tag tone="green" icon={p.kind === 'tree' ? 'tree' : 'leaf'}>{kindLabel(p)}</Tag>
            {p.protection && <Tag tone="deep" icon="shield">{L(p.protection)}</Tag>}
            <Tag tone={p.accessible ? 'info' : 'neutral'} icon="wheelchair">{p.accessible ? t('g.ms.accessible') : t('g.ms.notAccessible')}</Tag>
            <Tag icon="navigation">{fmtDistance(d)}</Tag></span></span></button>
      <button type="button" class="g-place__map" aria-label={`${t('g.m.showMap')}: ${L(p.name)}`} onClick={() => ctx.nav?.showOnMap?.(p.id)}><Icon name="map" size={18} /></button>
    </li>))}</ul> : <Empty icon="leaf" title={t('c.empty')} />}
  </div>);
}
