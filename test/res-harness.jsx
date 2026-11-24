// Strona testowa systemu rezerwacji: ten sam moduł w dwóch kanałach (telefon 390×760 i WWW 1200×800) na wspólnym stanie.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { initStore, getState, update } from '../src/kernel/store.js';
import { makeSeed } from '../src/kernel/seed.js';
import { makeApi, sel } from '../src/kernel/api.js';
import { Client } from '../src/kernel/client.jsx';
import ReservationApp from '../src/endpoints/reservation/index.jsx';

try { localStorage.removeItem('fpz-prototyp-v1'); } catch { /* nic */ }
initStore(makeSeed);
window.__fpz = { makeApi, sel, getState, mapCalls: [], setClient: (id, patch) => update((s) => { Object.assign(s.clients[id], patch); }) };
const q = new URLSearchParams(location.search);

function Host({ id, w, h, channel }) {
  const [initial, setInitial] = useState({ view: q.get('view') || 'home', id: q.get('id') || null }); const [k, setK] = useState(0);
  window.__fpz['open_' + id] = (view, eid) => { setInitial({ view, id: eid || null }); setK((x) => x + 1); };
  return (
    <div style={{ width: w + 'px', height: h + 'px', flex: 'none', border: '1px solid #9aa', borderRadius: channel === 'mobile' ? '28px' : '8px', overflow: 'hidden', background: '#fff' }} id={'host-' + id}>
      <Client id={id} base={16}>
        <ReservationApp key={k} channel={channel} initial={initial} nav={{ showOnMap: (poiId) => window.__fpz.mapCalls.push({ id, poiId }) }} />
      </Client>
    </div>
  );
}
render(<div style={{ display: 'flex', gap: '24px', padding: '16px', alignItems: 'flex-start', background: '#dfe4e1', minHeight: '100vh', boxSizing: 'border-box' }}>
  <Host id="mobile" w={390} h={760} channel="mobile" />
  <Host id="web" w={1200} h={800} channel="web" />
</div>, document.getElementById('app'));
