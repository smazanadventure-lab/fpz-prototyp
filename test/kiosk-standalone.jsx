// Harness trybu samodzielnego kiosków i ekranów LCD: dist/test-standalone.html#kiosk/TZ.T1.5 | #lcd/LCD-01
import { render } from 'preact';
import { initStore } from '../src/kernel/store.js';
import { makeSeed } from '../src/kernel/seed.js';
import { startKernelTimers, makeApi } from '../src/kernel/api.js';
import { getState } from '../src/kernel/store.js';
import KioskEndpoint from '../src/endpoints/kiosk/index.jsx';
import SignageEndpoint from '../src/endpoints/signage/index.jsx';

try { localStorage.clear(); } catch { /* brak */ }
initStore(makeSeed); startKernelTimers();
window.__fpzKiosk = Object.assign(window.__fpzKiosk || {}, { makeApi, getState });
const App = () => { const [kind, id] = location.hash.slice(1).split('/'); return kind === 'lcd' ? <SignageEndpoint standalone={id} /> : <KioskEndpoint standalone={id} />; };
const root = document.getElementById('app');
const draw = () => render(<App key={location.hash} />, root);
window.addEventListener('hashchange', draw); draw();
