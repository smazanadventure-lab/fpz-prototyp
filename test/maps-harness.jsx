// Strona testowa map: jeden scenariusz na raz (location.hash = id scenariusza). Budowanie: node test/maps-build.mjs [--stub=content]
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { initStore, getState } from '../src/kernel/store.js';
import { makeSeed } from '../src/kernel/seed.js';
import { Client, useClient } from '../src/kernel/client.jsx';
import { Button } from '../src/ui/components.jsx';
import { SitePlan, CityMap } from '../src/ui/maps.jsx';

try { localStorage.clear(); } catch { /* nic */ }
initStore(makeSeed);
window.__log = [];
const log = (type, v) => { window.__log.push([type, v]); };

function Callout({ id }) {
  const { L } = useClient(); const p = getState().pois.find((x) => x.id === id); if (!p) return null;
  return (<div><strong style={{ fontSize: '1.15em', display: 'block', marginBottom: '.3em' }}>{L(p.name)}</strong><p style={{ margin: '0 0 .6em' }}>{L(p.short)}</p><Button size="sm" variant="secondary">Dowiedz się więcej</Button></div>);
}
function Site(props) {
  const [sel, setSel] = useState(props.sel);
  return <SitePlan {...props} selectedId={sel} onSelect={(p) => { log('select', p.id); setSel(p.id); }} callout={props.withCallout && sel ? <Callout id={sel} /> : undefined} />;
}
function City(props) {
  const [sel, setSel] = useState(props.sel);
  const [vis, setVis] = useState(props.visitedDistrictIds || []);
  return <CityMap {...props} selectedId={sel} visitedDistrictIds={vis} onSelect={(p) => { log('select', p.id); setSel(p.id); }}
    onDistrict={props.tickboxes ? (d) => { log('district', d.id); setVis((v) => (v.includes(d.id) ? v.filter((x) => x !== d.id) : [...v, d.id])); } : undefined}
    onMapClick={(ll) => log('mapclick', ll)} callout={props.withCallout && sel ? <Callout id={sel} /> : undefined} />;
}
const fpz = () => getState().pois.filter((p) => p.scope === 'fpz').map((p) => p.id);
const has = (id) => getState().pois.some((p) => p.id === id);
const pick = (...ids) => ids.filter(has);
const S = {
  'site-iso-kiosk': { w: 1000, h: 1250, base: 30, el: () => <Site view="iso" highlightId="hala-zabkowice" hereId="hala-zabkowice" sel="hala-zabkowice" withCallout controls favorites={pick('wieza-widokowa')} /> },
  'site-iso-phone-night': { w: 360, h: 600, base: 16, theme: 'night', el: () => <Site view="iso" highlightId="hala-zielona" hereId="hala-zielona" routePoiIds={pick('hala-zielona', 'fabryka-wczoraj-i-dzis', 'wieza-widokowa', 'pasaz-reden', 'hala-tworzen')} position={{ lat: 50.3281, lng: 19.1872 }} controls favorites={pick('pasaz-reden')} /> },
  'site-plan-phone': { w: 360, h: 600, base: 16, el: () => <Site view="plan" sel="hala-tworzen" withCallout highlightId="hala-zielona" favorites={pick('wieza-widokowa', 'pasaz-reden')} routePoiIds={pick('hala-zielona', 'fabryka-wczoraj-i-dzis', 'dzwieki-miasta', 'wieza-widokowa')} position={{ lat: 50.3279, lng: 19.1868 }} controls /> },
  'site-plan-filter': { w: 600, h: 480, base: 16, el: () => <Site view="plan" filter={(p) => p.kind === 'hall'} hereId="pasaz-reden" /> },
  'site-plan-panel': { w: 300, h: 220, base: 14, el: () => <Site view="plan" labels="none" position={{ lat: 50.3285, lng: 19.1874 }} /> },
  'site-iso-hc': { w: 700, h: 560, base: 16, contrast: 'high', el: () => <Site view="iso" highlightId="hala-tworzen" hereId="hala-tworzen" sel="pasaz-reden" withCallout controls /> },
  'site-iso-en': { w: 700, h: 560, base: 16, lang: 'en', el: () => <Site view="iso" highlightId="hala-zielona" hereId="hala-zielona" labels="all" /> },
  'city-phone-ticks': { w: 360, h: 600, base: 16, el: () => <City tickboxes visitedDistrictIds={['srodmiescie', 'reden', 'golonog', 'zabkowice'].slice(0, 3)} legend controls /> },
  'city-kiosk-night': { w: 1000, h: 800, base: 22, theme: 'night', el: () => <City legend controls sel={pick('pogoria-3')[0]} withCallout position={{ lat: 50.335, lng: 19.21, accuracy: 30 }} routes={[{ id: 'r1', poiIds: pick('hala-zielona', 'pogoria-1', 'pogoria-3', 'wzgorze-golonoskie', 'kosciol-golonog', 'hala-tworzen') }, { id: 'r2', color: 'var(--c-info)', poiIds: pick('huta-bankowa', 'kopalnia-paryz', 'dworzec-zabkowice', 'huta-szkla-zabkowice') }]} /> },
  'city-panel': { w: 300, h: 220, base: 14, el: () => <City showDistricts position={{ lat: 50.3285, lng: 19.1874 }} /> },
  'city-fpz': { w: 600, h: 480, base: 16, el: () => <City focus="fpz" controls sel={fpz()[0]} /> },
  'city-zoom': { w: 600, h: 480, base: 16, el: () => <City focus={{ lat: 50.33, lng: 19.205, zoom: 5 }} legend /> },
  'city-hc-ticks': { w: 600, h: 480, base: 16, contrast: 'high', el: () => <City tickboxes visitedDistrictIds={['srodmiescie', 'golonog']} legend controls /> },
  'city-filter': { w: 600, h: 480, base: 16, el: () => <City filter={(p) => p.kind === 'industry'} legend /> },
};
window.__scenarios = Object.keys(S);
function App() {
  const id = location.hash.slice(1) || 'site-iso-kiosk'; const sc = S[id]; if (!sc) return <p>Brak scenariusza {id}</p>;
  return (<div style={{ width: sc.w + 'px', height: sc.h + 'px', border: '1px solid #999' }}>
    <Client id={'test-' + id} base={sc.base} theme={sc.theme} defaults={{ contrast: sc.contrast || 'normal', lang: sc.lang || 'pl' }}>{sc.el()}</Client></div>);
}
render(<App />, document.getElementById('app'));
