// Strona testowa modułu gry: <Client id="mobile"> 390×740 + prosty panel otoczenia. window.__fpz = { makeApi, sel, getState }.
import { render } from 'preact';
import { initStore, getState, useStore, update } from '../src/kernel/store.js';
import { makeSeed } from '../src/kernel/seed.js';
import { makeApi, sel } from '../src/kernel/api.js';
import { Client, useEnv } from '../src/kernel/client.jsx';
import GameSection from '../src/endpoints/game/index.jsx';

initStore(makeSeed);
window.__fpz = { makeApi, sel, getState, update };
window.__nav = [];
const log = (k) => (...a) => { window.__nav.push([k, ...a]); console.log('nav', k, ...a); };
const nav = { openEntry: log('openEntry'), openPoi: log('openPoi'), showOnMap: log('showOnMap'), openScanner: log('openScanner'), openCoupons: log('openCoupons') };

function Env() {
  const { env, setEnv, moveTo } = useEnv(); const s = useStore();
  return (<aside style={{ width: '300px', font: '13px sans-serif', display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <b>Otoczenie telefonu (test)</b>
    <label>Pozycja <select id="env-poi" value={env.position.poiId || ''} onChange={(e) => moveTo(e.currentTarget.value)}><option value="">—</option>{s.pois.map((p) => <option key={p.id} value={p.id}>{p.name.pl}</option>)}</select></label>
    <label>Sieć <select id="env-net" value={env.network} onChange={(e) => setEnv({ network: e.currentTarget.value })}>{['online', 'slow', 'offline'].map((n) => <option key={n}>{n}</option>)}</select></label>
    <label>QR w kadrze <select id="env-qr" value={env.qrInView || ''} onChange={(e) => setEnv({ qrInView: e.currentTarget.value || null })}><option value="">—</option>{s.triggers.filter((t) => t.kind === 'qr').map((t) => <option key={t.id} value={t.code}>{t.code} {t.label}</option>)}</select></label>
    <small>pending: {s.player.pending.length}</small>
  </aside>);
}
function App() {
  return (<div style={{ display: 'flex', gap: '20px', padding: '10px', background: '#ddd', minHeight: '100vh', boxSizing: 'border-box' }}>
    <div id="phone" style={{ width: '390px', height: '740px', flex: 'none', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.2)' }}>
      <Client id="mobile" base={16}><GameSection nav={nav} /></Client>
    </div>
    <Env />
  </div>);
}
render(<App />, document.getElementById('app'));
