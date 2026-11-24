import { render } from 'preact';
import { initStore } from './kernel/store.js';
import { makeSeed } from './kernel/seed.js';
import { startKernelTimers, makeApi, sel } from './kernel/api.js';
import { getState } from './kernel/store.js';
import { startRemote, syncNow } from './kernel/remote.js';
import { Shell } from './shell/shell.jsx';
import { Standalone, parseRoute } from './shell/standalone.jsx';

// Tryb pracy ustala kompilacja (build.mjs): lokalny – dane w przeglądarce; serwerowy – wspólne dane z /api/*.
const API = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : null;
const TARGET = typeof __TARGET__ !== 'undefined' ? __TARGET__ : 'file';

initStore(makeSeed);
startKernelTimers();
if (API !== null) startRemote(API);
if (typeof window !== 'undefined') window.__fpz = { getState, makeApi, sel, syncNow }; // diagnostyka i testy automatyczne
const route = parseRoute();
render(route ? <Standalone route={route} /> : <Shell />, document.getElementById('app'));
if (TARGET === 'netlify' && 'serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* aplikacja działa także bez pracy offline */ }); });
