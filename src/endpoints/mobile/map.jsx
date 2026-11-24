// Nawigacja: mapa terenu FPŻ / miasta, wyszukiwarka i filtry, karta miejsca, ulubione, indywidualne ścieżki zwiedzania.
import { useEffect, useState } from 'preact/hooks';
import { useClient, useEnv } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDistance, distanceM } from '../../kernel/util.js';
import { Button, Card, CardBody, Checkbox, Chips, Empty, Field, Icon, IconButton, Input, Media, Modal, Notice, SearchInput, Select, Switch, Tabs, Tag } from '../../ui/components.jsx';
import { SitePlan, CityMap } from '../../ui/maps.jsx';
import { useApp, KIND_GROUP } from './ctx.js';
import { Screen, SectionHead, PoiRow } from './ui.jsx';
import { EventSheet } from './home.jsx';

strings({
  'm.map.fpz': ['Teren FPŻ', 'FPŻ site'], 'm.map.city': ['Miasto', 'City'], 'm.map.3d': ['3D', '3D'], 'm.map.plan': ['Plan', 'Plan'], 'm.map.search': ['Szukaj miejsca', 'Search places'],
  'm.map.f.attr': ['Atrakcje', 'Attractions'], 'm.map.f.serv': ['Usługi', 'Services'], 'm.map.f.visit': ['Zwiedzanie', 'Sightseeing'], 'm.map.f.acc': ['Dostępne', 'Accessible'],
  'm.map.places': ['Miejsca', 'Places'], 'm.map.favs': ['Ulubione', 'Favourites'], 'm.map.routes': ['Moje ścieżki', 'My routes'], 'm.map.favEmpty': ['Dodaj miejsca do ulubionych sercem na karcie miejsca.', 'Add places to favourites with the heart on a place card.'],
  'm.map.routesEmpty': ['Nie masz jeszcze własnych ścieżek.', 'You have no routes yet.'], 'm.map.newRoute': ['Utwórz moją ścieżkę', 'Create my route'], 'm.map.preview': ['Podgląd trasy: {name}', 'Route preview: {name}'], 'm.map.hidePreview': ['Ukryj trasę', 'Hide route'],
  'm.map.stops': ['{n} punktów', '{n} stops'], 'm.map.show': ['Pokaż', 'Show'], 'm.map.edit': ['Edytuj', 'Edit'], 'm.map.del': ['Usuń', 'Delete'], 'm.map.deleted': ['Usunięto ścieżkę', 'Route deleted'],
  'm.poi.fav': ['Dodaj do ulubionych', 'Add to favourites'], 'm.poi.unfav': ['Usuń z ulubionych', 'Remove from favourites'], 'm.poi.favAdded': ['Dodano do ulubionych', 'Added to favourites'], 'm.poi.favRemoved': ['Usunięto z ulubionych', 'Removed from favourites'],
  'm.poi.toRoute': ['Dodaj do ścieżki', 'Add to route'], 'm.poi.distance': ['Odległość', 'Distance'], 'm.poi.access': ['Dostępność', 'Accessibility'], 'm.poi.entries': ['Treści o tym miejscu', 'Content about this place'],
  'm.poi.events': ['Wydarzenia w tym miejscu', 'Events here'], 'm.poi.listen': ['Słuchaj audioprzewodnika', 'Play audio guide'], 'm.poi.newRoute': ['Nowa ścieżka', 'New route'], 'm.poi.added': ['Dodano do ścieżki „{name}”', 'Added to “{name}”'],
  'm.poi.protection': ['Ochrona', 'Protection'], 'm.poi.chooseRoute': ['Wybierz ścieżkę', 'Choose a route'],
  'm.rb.title': ['Moja ścieżka', 'My route'], 'm.rb.lead': ['Powiedz, ile masz czasu i co Cię interesuje – zaproponujemy kolejność punktów. Potem możesz ją dowolnie zmienić.', 'Tell us how much time you have and what interests you – we will suggest the stops. You can change them afterwards.'],
  'm.rb.time': ['Czas zwiedzania', 'Time available'], 'm.rb.interests': ['Zainteresowania', 'Interests'], 'm.rb.accessible': ['Tylko miejsca dostępne dla osób z niepełnosprawnościami', 'Accessible places only'], 'm.rb.scope': ['Obszar', 'Area'],
  'm.rb.suggest': ['Zaproponuj ścieżkę', 'Suggest a route'], 'm.rb.name': ['Nazwa ścieżki', 'Route name'], 'm.rb.save': ['Zapisz ścieżkę', 'Save route'], 'm.rb.saved': ['Zapisano ścieżkę', 'Route saved'], 'm.rb.add': ['Dodaj punkt', 'Add a stop'],
  'm.rb.up': ['W górę', 'Move up'], 'm.rb.down': ['W dół', 'Move down'], 'm.rb.remove': ['Usuń punkt', 'Remove stop'], 'm.rb.summary': ['ok. {min} min · {dist}', 'approx. {min} min · {dist}'], 'm.rb.empty': ['Brak punktów – dodaj je z listy poniżej albo z mapy.', 'No stops – add some below or from the map.'],
  'm.rb.restart': ['Zacznij od nowa', 'Start again'], 'm.rb.defaultName': ['Moja ścieżka', 'My route'], 'm.rb.choose': ['— wybierz miejsce —', '— choose a place —'],
  'm.int.history': ['Historia', 'History'], 'm.int.industry': ['Przemysł', 'Industry'], 'm.int.nature': ['Przyroda', 'Nature'], 'm.int.culture': ['Kultura i scena', 'Culture & stage'], 'm.int.food': ['Gastronomia', 'Food'],
});

const INTERESTS = { history: ['history', 'historia', 'defum', 'skoda'], industry: ['industry', 'spot', 'suwnice', 'gornictwo'], nature: ['nature', 'park', 'tree', 'zielen', 'ekologia'], culture: ['culture', 'hall', 'scena', 'koncerty', 'wystawy'], food: ['service', 'gastronomia'] };
const routeStats = (ids) => { let pos = getState().env.position, d = 0; for (const id of ids) { const p = sel.poi(id); if (p) { d += distanceM(pos, p); pos = p; } } const fpz = ids.every((id) => sel.poi(id)?.scope === 'fpz'); return { dist: d, min: Math.round(d / (fpz ? 70 : 250) + ids.length * (fpz ? 7 : 15)) }; };

export function MapScreen() {
  const app = useApp(); const { t, L, api, toast } = useClient(); const { env } = useEnv(); const s = getState();
  const [scope, setScope] = useState('fpz'); const [view, setView] = useState('iso'); const [q, setQ] = useState(''); const [f, setF] = useState('all'); const [list, setList] = useState('places'); const [routeId, setRouteId] = useState(null); const [sel1, setSel1] = useState(null);
  useEffect(() => { const fc = app.mapFocus; if (!fc) return; if (fc.poiId) { const p = sel.poi(fc.poiId); if (p) { setScope(p.scope); setSel1(p.id); setQ(''); setF('all'); } } if (fc.routeId) { setRouteId(fc.routeId); setList('routes'); const r = s.player.customRoutes.find((x) => x.id === fc.routeId); const p = r && sel.poi(r.poiIds[0]); if (p) setScope(p.scope); } }, [app.mapFocus?.n]);
  const match = (p) => (f === 'all' || (f === 'acc' ? p.accessible : KIND_GROUP[p.kind] === f)) && (!q || [L(p.name), ...(p.tags || [])].join(' ').toLowerCase().includes(q.toLowerCase()));
  const pois = sel.pois({ scope }); const shown = pois.filter(match).sort((a, b) => sel.distanceTo(a) - sel.distanceTo(b));
  const route = routeId && s.player.customRoutes.find((r) => r.id === routeId); const favs = s.player.favorites.map((id) => sel.poi(id)).filter(Boolean);
  const pick = (p) => { setSel1(p.id); app.openPoi(p.id); };
  const filtered = f !== 'all' || q;
  return (<Screen root title={t('m.tab.map')} below={<div class="m-mapctl">
    <div class="m-seg" role="group"><button type="button" class={clsx(scope === 'fpz' && 'is-on')} aria-pressed={scope === 'fpz'} onClick={() => setScope('fpz')}>{t('m.map.fpz')}</button><button type="button" class={clsx(scope === 'city' && 'is-on')} aria-pressed={scope === 'city'} onClick={() => setScope('city')}>{t('m.map.city')}</button></div>
    <SearchInput value={q} onInput={setQ} placeholder={t('m.map.search')} />
  </div>}>
    <Chips scroll value={f} onChange={setF} class="m-filters m-filters--map" options={[{ id: 'all', label: t('c.all') }, { id: 'attr', label: t('m.map.f.attr'), icon: 'star' }, { id: 'serv', label: t('m.map.f.serv'), icon: 'utensils' }, { id: 'visit', label: t('m.map.f.visit'), icon: 'compass' }, { id: 'acc', label: t('m.map.f.acc'), icon: 'wheelchair' }]} />
    <div class={clsx('m-map', scope === 'fpz' && view === 'iso' && 'is-iso')}>
      {scope === 'fpz' ? <SitePlan view={view} selectedId={sel1} hereId={env.position.poiId && sel.poi(env.position.poiId)?.scope === 'fpz' ? env.position.poiId : null} position={env.position} favorites={s.player.favorites} routePoiIds={route?.poiIds || []} filter={filtered ? match : undefined} onSelect={pick} labels={view === 'iso' ? 'selected' : 'all'} />
        : <CityMap focus="city" selectedId={sel1} position={env.position} filter={filtered ? match : undefined} onSelect={pick} routes={route ? [{ id: route.id, poiIds: route.poiIds }] : []} showDistricts />}
      {scope === 'fpz' && <div class="m-map__view" role="group"><button type="button" class={clsx(view === 'iso' && 'is-on')} aria-pressed={view === 'iso'} onClick={() => setView('iso')}>{t('m.map.3d')}</button><button type="button" class={clsx(view === 'plan' && 'is-on')} aria-pressed={view === 'plan'} onClick={() => setView('plan')}>{t('m.map.plan')}</button></div>}
      <IconButton icon="locate" variant="round" size="sm" class="m-map__locate" label={t('c.youAreHere')} onClick={() => { const p = env.position.poiId && sel.poi(env.position.poiId); if (p) { setScope(p.scope); setSel1(p.id); } }} />
      {scope === 'fpz' && <small class="m-map__note">{t('c.schematicMap')}</small>}
    </div>
    {route && <Notice tone="ok" icon="route"><span class="m-flexrow">{t('m.map.preview', { name: route.name })}<button type="button" class="m-link" onClick={() => setRouteId(null)}>{t('m.map.hidePreview')}</button></span></Notice>}
    <Tabs value={list} onChange={setList} tabs={[{ id: 'places', label: t('m.map.places'), badge: shown.length }, { id: 'favs', label: t('m.map.favs'), badge: favs.length || null }, { id: 'routes', label: t('m.map.routes'), badge: s.player.customRoutes.length || null }]} />
    {list === 'places' && (shown.length ? <ul class="m-list">{shown.map((p) => <li key={p.id}><PoiRow poi={p} onClick={() => pick(p)} /></li>)}</ul> : <Empty icon="search" title={t('c.empty')} />)}
    {list === 'favs' && (favs.length ? <ul class="m-list">{favs.map((p) => <li key={p.id}><PoiRow poi={p} onClick={() => pick(p)} extra={<IconButton icon="heart" variant="mint" size="sm" label={t('m.poi.unfav')} active onClick={(e) => { e.stopPropagation(); api.visit.toggleFavorite(p.id); toast(t('m.poi.favRemoved'), 'info'); }} />} /></li>)}</ul> : <Empty icon="heart" title={t('c.empty')} text={t('m.map.favEmpty')} />)}
    {list === 'routes' && <div class="m-stack">
      <Button block icon="plus" onClick={() => app.push('routeBuilder', {})}>{t('m.map.newRoute')}</Button>
      {s.player.customRoutes.length === 0 ? <Empty icon="route" title={t('m.map.routesEmpty')} /> : s.player.customRoutes.map((r) => { const st = routeStats(r.poiIds); return (
        <Card key={r.id} variant={routeId === r.id ? 'mint' : 'outline'} class="m-routecard"><CardBody><b>{r.name}</b><small>{t('m.map.stops', { n: r.poiIds.length })} · {t('m.rb.summary', { min: st.min, dist: fmtDistance(st.dist) })}</small>
          <ol class="m-routecard__stops">{r.poiIds.map((id) => <li key={id}>{L(sel.poi(id)?.name)}</li>)}</ol>
          <div class="m-btnrow"><Button size="sm" icon="map" onClick={() => { setRouteId(r.id); const p = sel.poi(r.poiIds[0]); if (p) setScope(p.scope); }}>{t('m.map.show')}</Button><Button size="sm" variant="secondary" icon="edit" onClick={() => app.push('routeBuilder', { routeId: r.id })}>{t('m.map.edit')}</Button>
            <Button size="sm" variant="ghost" icon="trash" onClick={() => { api.visit.deleteRoute(r.id); if (routeId === r.id) setRouteId(null); toast(t('m.map.deleted'), 'info'); }}>{t('m.map.del')}</Button></div></CardBody></Card>); })}
    </div>}
  </Screen>);
}

/** Karta miejsca (arkusz od dołu). */
export function PoiSheet({ id, onClose }) {
  const app = useApp(); const { t, L, api, toast, lang } = useClient(); useEnv(); const s = getState(); const p = sel.poi(id); const [pickRoute, setPickRoute] = useState(false); const [ev, setEv] = useState(null);
  if (!p) return null;
  const fav = s.player.favorites.includes(p.id); const entries = sel.entries({ poiId: p.id, channel: 'mobile' }); const audio = entries.filter((e) => e.audioGuide); const events = sel.events({ poiId: p.id }).slice(0, 3);
  const toggle = () => { const r = api.visit.toggleFavorite(p.id); toast(t(r.favorite ? 'm.poi.favAdded' : 'm.poi.favRemoved'), 'ok'); };
  const addTo = (r) => { if (r) { if (!r.poiIds.includes(p.id)) api.visit.saveRoute({ id: r.id, name: r.name, poiIds: [...r.poiIds, p.id] }); toast(t('m.poi.added', { name: r.name }), 'ok'); setPickRoute(false); } else { setPickRoute(false); onClose(); app.push('routeBuilder', { add: p.id }); } };
  return (<Modal open variant="sheet" onClose={onClose} title={L(p.name)} closeLabel={t('c.close')} class="m-poisheet">
    <Media ill={p.ill} src={p.src} ratio={s.env.network === 'slow' ? '3/1' : '16/9'} shape="arc-tr" alt={L(p.name)} />
    <div class="m-tagrow"><Tag icon="navigation">{fmtDistance(sel.distanceTo(p))}</Tag>{p.accessible ? <Tag tone="green" icon="wheelchair">{t('c.accessible')}</Tag> : <Tag tone="warn" icon="wheelchair">{t('c.notAccessible')}</Tag>}{p.protection && <Tag tone="info" icon="leaf">{L(p.protection)}</Tag>}</div>
    <div class="m-btnrow">
      <Button variant={fav ? 'mint' : 'secondary'} icon="heart" size="sm" aria-pressed={fav} onClick={toggle}>{t(fav ? 'm.poi.unfav' : 'm.poi.fav')}</Button>
      <Button variant="secondary" icon="route" size="sm" onClick={() => setPickRoute(true)}>{t('m.poi.toRoute')}</Button>
      {app.tab !== 'map' && <Button variant="secondary" icon="map" size="sm" onClick={() => app.showOnMap(p.id)}>{t('m.showOnMap')}</Button>}
    </div>
    <p class="m-poisheet__short">{L(p.short)}</p><p>{L(p.description)}</p>
    {p.accessNote && <div class="m-access"><Icon name="accessibility" size={18} /><span><b>{t('m.poi.access')}</b> {L(p.accessNote)}</span></div>}
    {audio.length > 0 && <Button block icon="headphones" onClick={() => { app.playAudio(audio.map((e) => e.id)); }}>{t('m.poi.listen')}</Button>}
    {entries.length > 0 && <><SectionHead title={t('m.poi.entries')} /><ul class="m-list">{entries.map((e) => <li key={e.id}><button type="button" class="m-linkrow" onClick={() => app.openEntry(e.id)}><Icon name={e.audioGuide ? 'headphones' : 'book'} size={16} /><span>{L(e.title)}</span><Icon name="arrowRight" size={16} /></button></li>)}</ul></>}
    {events.length > 0 && <><SectionHead title={t('m.poi.events')} /><ul class="m-list">{events.map((e) => <li key={e.id}><button type="button" class="m-linkrow" onClick={() => setEv(e.id)}><Icon name="calendar" size={16} /><span>{L(e.title)}</span><Icon name="arrowRight" size={16} /></button></li>)}</ul></>}
    {pickRoute && <Modal open size="sm" onClose={() => setPickRoute(false)} title={t('m.poi.chooseRoute')} closeLabel={t('c.close')}>
      <div class="m-stack">{s.player.customRoutes.map((r) => <Button key={r.id} variant="secondary" block icon="route" onClick={() => addTo(r)}>{r.name}</Button>)}<Button block icon="plus" onClick={() => addTo(null)}>{t('m.poi.newRoute')}</Button></div></Modal>}
    {ev && <EventSheet id={ev} onClose={() => setEv(null)} />}
  </Modal>);
}

/** Kreator indywidualnej ścieżki zwiedzania: propozycja (api.visit.suggest) → edycja kolejności → zapis. */
export function RouteBuilder({ routeId, add }) {
  const app = useApp(); const { t, L, api, toast } = useClient(); useEnv(); const s = getState(); const existing = routeId && s.player.customRoutes.find((r) => r.id === routeId);
  const [step, setStep] = useState(existing || add ? 'edit' : 'form');
  const [minutes, setMinutes] = useState('60'); const [ints, setInts] = useState(['history']); const [acc, setAcc] = useState(false); const [scope, setScope] = useState('fpz');
  const [ids, setIds] = useState(existing ? [...existing.poiIds] : add ? [add] : []); const [name, setName] = useState(existing ? existing.name : t('m.rb.defaultName')); const [addSel, setAddSel] = useState('');
  const suggest = () => { const r = api.visit.suggest({ minutes: +minutes, interests: ints.flatMap((i) => INTERESTS[i]), accessibleOnly: acc, scope }); if (!r.ok) { toast(L(r.message), 'error'); return; } setIds(r.poiIds); setStep('edit'); };
  const move = (k, d) => setIds((a) => { const b = [...a]; const j = k + d; if (j < 0 || j >= b.length) return a; [b[k], b[j]] = [b[j], b[k]]; return b; });
  const save = () => { const r = api.visit.saveRoute({ id: existing?.id, name: name.trim() || t('m.rb.defaultName'), poiIds: ids }); if (!r.ok) { toast(L(r.message), 'error'); return; } toast(t('m.rb.saved'), 'ok'); const saved = existing || r.routes[r.routes.length - 1]; app.pop(); setTimeout(() => app.showRoute(saved.id), 0); };
  const st = routeStats(ids); const firstScope = ids.length ? sel.poi(ids[0])?.scope || scope : scope;
  const avail = sel.pois({ scope: firstScope }).filter((p) => !ids.includes(p.id) && (!acc || p.accessible));
  return (<Screen title={t('m.rb.title')} crumbs={[t('m.tab.map'), t('m.rb.title')]}>
    {step === 'form' ? <form class="m-stack m-form" onSubmit={(e) => { e.preventDefault(); suggest(); }}>
      <p>{t('m.rb.lead')}</p>
      <Field label={t('m.rb.scope')}><div class="m-seg" role="group"><button type="button" class={clsx(scope === 'fpz' && 'is-on')} aria-pressed={scope === 'fpz'} onClick={() => setScope('fpz')}>{t('m.map.fpz')}</button><button type="button" class={clsx(scope === 'city' && 'is-on')} aria-pressed={scope === 'city'} onClick={() => setScope('city')}>{t('m.map.city')}</button></div></Field>
      <div class="fpz-field"><span class="fpz-field__label">{t('m.rb.time')}</span><Chips value={minutes} onChange={setMinutes} options={['30', '60', '90', '120', '180'].map((m) => ({ id: m, label: `${m} min` }))} /></div>
      <div class="fpz-field"><span class="fpz-field__label">{t('m.rb.interests')}</span><div class="fpz-chips">{Object.keys(INTERESTS).map((k) => <button key={k} type="button" class={clsx('fpz-chip', ints.includes(k) && 'is-active')} aria-pressed={ints.includes(k)} onClick={() => setInts((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}>{t('m.int.' + k)}</button>)}</div></div>
      <Switch label={t('m.rb.accessible')} checked={acc} onChange={(e) => setAcc(e.currentTarget.checked)} />
      <Button type="submit" block size="lg" icon="sparkles">{t('m.rb.suggest')}</Button>
    </form> : <div class="m-stack">
      <Field label={t('m.rb.name')}><Input value={name} onInput={(e) => setName(e.currentTarget.value)} /></Field>
      <div class="m-map m-map--small">{firstScope === 'fpz' ? <SitePlan view="plan" routePoiIds={ids} position={getState().env.position} labels="none" pois={undefined} /> : <CityMap routes={[{ id: 'r', poiIds: ids }]} position={getState().env.position} showDistricts={false} />}</div>
      <small class="m-muted">{t('m.map.stops', { n: ids.length })} · {t('m.rb.summary', { min: st.min, dist: fmtDistance(st.dist) })}</small>
      {ids.length === 0 ? <p class="m-muted">{t('m.rb.empty')}</p> : <ol class="m-stops">{ids.map((id, k) => { const p = sel.poi(id); return (<li key={id}><span class="m-stops__n">{k + 1}</span><span class="m-stops__name">{L(p?.name)}{p?.accessible && <Icon name="wheelchair" size={13} />}</span>
        <IconButton icon="up" variant="plain" size="sm" label={t('m.rb.up')} disabled={k === 0} onClick={() => move(k, -1)} /><IconButton icon="down" variant="plain" size="sm" label={t('m.rb.down')} disabled={k === ids.length - 1} onClick={() => move(k, 1)} /><IconButton icon="trash" variant="plain" size="sm" label={t('m.rb.remove')} onClick={() => setIds((a) => a.filter((x) => x !== id))} /></li>); })}</ol>}
      <div class="m-manual__row"><Select value={addSel} onChange={(e) => setAddSel(e.currentTarget.value)} aria-label={t('m.rb.add')}><option value="">{t('m.rb.choose')}</option>{avail.map((p) => <option key={p.id} value={p.id}>{L(p.name)}</option>)}</Select><Button variant="mint" icon="plus" disabled={!addSel} onClick={() => { setIds((a) => [...a, addSel]); setAddSel(''); }}>{t('m.rb.add')}</Button></div>
      <Button block size="lg" icon="save" disabled={!ids.length} onClick={save}>{t('m.rb.save')}</Button>
      {!existing && <Button block variant="ghost" icon="refresh" onClick={() => setStep('form')}>{t('m.rb.restart')}</Button>}
    </div>}
  </Screen>);
}
