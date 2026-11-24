// ZAŚLEPKA map (wersja awaryjna, prosta). Docelowa implementacja: src/ui/maps.jsx – ten sam interfejs.
import { useStore } from '../../kernel/store.js';
import { useClient } from '../../kernel/client.jsx';

/**
 * Plan terenu FPŻ.
 * props: view 'iso'|'plan'; pois (domyślnie wszystkie scope 'fpz'); selectedId; highlightId (hala kiosku); hereId (POI „Tu jesteś”);
 *        position {lat,lng} (pozycja zwiedzającego); favorites [poiId]; routePoiIds [poiId] (łamana trasy); filter(poi)→bool (przygaszenie pozostałych);
 *        onSelect(poi); labels 'all'|'selected'|'none'; class
 */
export function SitePlan({ view = 'plan', pois, selectedId, highlightId, hereId, position, favorites = [], routePoiIds = [], filter, onSelect, labels = 'all', class: cls }) {
  const s = useStore(); const { L } = useClient(); const list = (pois || s.pois.filter((p) => p.scope === 'fpz' && p.site));
  const pt = (id) => { const p = s.pois.find((x) => x.id === id); return p?.site ? `${p.site.x * 4},${p.site.y * 3}` : null; };
  return (<svg class={`fpz-siteplan ${cls || ''}`} viewBox="0 0 400 300" style={{ width: '100%', height: '100%', display: 'block', background: 'var(--c-surface-2)' }} role="img" aria-label="Plan terenu">
    {(s.sitePlan.greens || []).map((g, i) => <polygon key={i} points={g.points.map(([x, y]) => `${x * 4},${y * 3}`).join(' ')} fill="var(--c-surface-3)" />)}
    {(s.sitePlan.streets || []).map((st, i) => <polyline key={i} points={st.points.map(([x, y]) => `${x * 4},${y * 3}`).join(' ')} fill="none" stroke="var(--c-line)" stroke-width="10" stroke-linecap="round" />)}
    {routePoiIds.length > 1 && <polyline points={routePoiIds.map(pt).filter(Boolean).join(' ')} fill="none" stroke="var(--c-accent)" stroke-width="3" stroke-dasharray="6 5" />}
    {list.map((p) => { const x = p.site.x * 4, y = p.site.y * 3, b = p.building, dim = filter && !filter(p), sel = p.id === selectedId, hi = p.id === highlightId; return (
      <g key={p.id} onClick={() => onSelect?.(p)} style={{ cursor: onSelect ? 'pointer' : 'default', opacity: dim ? 0.3 : 1 }}>
        {b && b.w ? <rect x={x - b.w * 2} y={y - b.d * 1.5} width={b.w * 4} height={b.d * 3} rx="3" fill={hi ? 'var(--c-green)' : 'var(--c-surface)'} stroke={sel ? 'var(--c-accent)' : 'var(--c-line-strong)'} stroke-width={sel ? 3 : 1.2} /> : <circle cx={x} cy={y} r="7" fill={hi ? 'var(--c-green)' : 'var(--c-surface)'} stroke={sel ? 'var(--c-accent)' : 'var(--c-line-strong)'} stroke-width={sel ? 3 : 1.2} />}
        {favorites.includes(p.id) && <circle cx={x + 10} cy={y - 10} r="4" fill="#C62828" />}
        {(labels === 'all' || (labels === 'selected' && sel)) && <text x={x} y={y + (b && b.w ? 4 : 20)} text-anchor="middle" font-size="9" font-weight="700" fill="var(--c-text)">{L(p.name)}</text>}
      </g>); })}
    {hereId && pt(hereId) && <g transform={`translate(${pt(hereId).replace(',', ' ')})`}><circle r="9" fill="var(--c-accent)" /><text y="22" text-anchor="middle" font-size="9" font-weight="700" fill="var(--c-accent)">Tu jesteś</text></g>}
  </svg>);
}

/**
 * Schematyczna mapa Dąbrowy Górniczej.
 * props: pois (domyślnie wszystkie); districts (domyślnie wszystkie); showDistricts; tickboxes (pola wyboru dzielnic – trasa historyczna);
 *        visitedDistrictIds [id]; routes [{id,color,poiIds}]; selectedId; position {lat,lng}; filter(poi)→bool; onSelect(poi); onDistrict(d); onMapClick({lat,lng});
 *        focus 'city'|'fpz'|{lat,lng,zoom}; class
 */
export function CityMap({ pois, districts, showDistricts = true, tickboxes, visitedDistrictIds = [], routes = [], selectedId, position, filter, onSelect, onDistrict, onMapClick, focus = 'city', class: cls }) {
  const s = useStore(); const { L } = useClient(); const list = pois || s.pois; const ds = districts || s.districts;
  const B = { w: 19.14, e: 19.49, n: 50.43, s: 50.285 }; const X = (lng) => ((lng - B.w) / (B.e - B.w)) * 600, Y = (lat) => ((B.n - lat) / (B.n - B.s)) * 380;
  const click = (e) => { if (!onMapClick) return; const r = e.currentTarget.getBoundingClientRect(); onMapClick({ lng: B.w + ((e.clientX - r.left) / r.width) * (B.e - B.w), lat: B.n - ((e.clientY - r.top) / r.height) * (B.n - B.s) }); };
  return (<svg class={`fpz-citymap ${cls || ''}`} viewBox="0 0 600 380" style={{ width: '100%', height: '100%', display: 'block', background: 'var(--c-surface-2)' }} onClick={click} role="img" aria-label="Mapa schematyczna">
    {showDistricts && ds.map((d) => { const v = visitedDistrictIds.includes(d.id); return (<g key={d.id} onClick={(e) => { if (onDistrict) { e.stopPropagation(); onDistrict(d); } }} style={{ cursor: onDistrict ? 'pointer' : 'default' }}>
      <circle cx={X(d.lng)} cy={Y(d.lat)} r="26" fill={v ? 'var(--c-green)' : 'var(--c-surface-3)'} opacity={v ? 0.75 : 0.5} />
      <text x={X(d.lng)} y={Y(d.lat) + 3} text-anchor="middle" font-size="8" font-weight="700" fill="var(--c-text-2)">{tickboxes ? (v ? '☑ ' : '☐ ') : ''}{d.name}</text></g>); })}
    {routes.map((r) => <polyline key={r.id} points={r.poiIds.map((id) => list.find((p) => p.id === id) || s.pois.find((p) => p.id === id)).filter(Boolean).map((p) => `${X(p.lng)},${Y(p.lat)}`).join(' ')} fill="none" stroke={r.color || 'var(--c-accent)'} stroke-width="2.5" stroke-dasharray="6 4" />)}
    {list.map((p) => { const dim = filter && !filter(p); return (<g key={p.id} onClick={(e) => { e.stopPropagation(); onSelect?.(p); }} style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1 }}>
      <circle cx={X(p.lng)} cy={Y(p.lat)} r={p.id === selectedId ? 7 : 4.5} fill={p.scope === 'fpz' ? 'var(--c-accent)' : 'var(--c-surface)'} stroke="var(--c-accent)" stroke-width="1.6"><title>{L(p.name)}</title></circle>
      {p.id === selectedId && <text x={X(p.lng)} y={Y(p.lat) - 10} text-anchor="middle" font-size="9" font-weight="700" fill="var(--c-text)">{L(p.name)}</text>}</g>); })}
    {position && <g transform={`translate(${X(position.lng)} ${Y(position.lat)})`}><circle r="9" fill="#1976D2" opacity=".25" /><circle r="4.5" fill="#1976D2" stroke="#fff" stroke-width="1.5" /></g>}
  </svg>);
}
