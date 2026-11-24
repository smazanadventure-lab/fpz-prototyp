// Aplikacja dla zwiedzających (APK oraz adres /app): wyłącznie przewodnik, gra terenowa i bilety.
// Ta kompilacja nie zawiera CMS, zarządzania ekspozycją, stanowiska bileterskiego, kiosków, ekranów ani symulatora.
import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import './shell/standalone.css';
import { initStore, getState } from './kernel/store.js';
import { makeSeed } from './kernel/seed.js';
import { makeApi, sel } from './kernel/api.js';
import { startRemote, syncNow } from './kernel/remote.js';
import MobileApp from './endpoints/mobile/index.jsx';
import { NetNotice } from './shell/net.jsx';
import { initNative } from './shell/native.js';

const API = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : null;
const TARGET = typeof __TARGET__ !== 'undefined' ? __TARGET__ : 'file';

initStore(makeSeed);
if (API !== null) startRemote(API);
if (typeof window !== 'undefined') window.__fpz = { getState, makeApi, sel, syncNow }; // diagnostyka i testy automatyczne

function App() {
  useEffect(() => {
    document.documentElement.classList.add('sa-html');
    // systemowy przycisk „wstecz” (Android): cofa ekran aplikacji, a na ekranie głównym minimalizuje ją
    initNative({ onBack: () => !!window.__fpzMobile?.back?.() });
    // adres /q/KOD (np. z wydrukowanego kodu QR): kod trafia „przed kamerę” – skaner od razu go rozpozna
    try { const m = location.pathname.match(/^\/q\/([^/]+)/); const code = m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get('q'); if (code) makeApi('mobile').env.set({ qrInView: code }); } catch { /* brak kodu */ }
  }, []);
  return (<div class="sa-root sa-mobile"><div class="sa-phone"><MobileApp standalone /></div><NetNotice /></div>);
}
render(<App />, document.getElementById('app'));
if (TARGET === 'netlify' && 'serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* aplikacja działa także bez pracy offline */ }); });
