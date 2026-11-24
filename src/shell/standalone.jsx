// Końcówki samodzielne: każda część systemu pod własnym adresem, bez powłoki symulatora
// (/app, /www, /kiosk/TZ.T1.3, /lcd/LCD-01, /bileter, /cms, /ekspozycja) – tak działają na docelowych urządzeniach.
import { useEffect, useState } from 'preact/hooks';
import './standalone.css';
import MobileApp from '../endpoints/mobile/index.jsx';
import WebApp from '../endpoints/web/index.jsx';
import KioskEndpoint from '../endpoints/kiosk/index.jsx';
import SignageEndpoint from '../endpoints/signage/index.jsx';
import ValidatorApp from '../endpoints/validator/index.jsx';
import CmsApp from '../endpoints/cms/index.jsx';
import MgmtApp from '../endpoints/mgmt/index.jsx';
import { makeApi } from '../kernel/api.js';
import { NetNotice } from './net.jsx';
import { initNative } from './native.js';

const START = typeof __START__ !== 'undefined' ? __START__ : '';
const SERVED = typeof __API_BASE__ !== 'undefined' && __API_BASE__ !== null;
/** Lista adresów końcówek (dla powłoki i dokumentacji). */
export const ROUTES = [
  { path: 'app', id: 'mobile', title: 'Aplikacja mobilna', hint: 'telefon – także jako aplikacja APK lub „Dodaj do ekranu głównego”' },
  { path: 'www', id: 'web', title: 'Strona WWW z rezerwacjami', hint: 'komputer, tablet, telefon' },
  { path: 'kiosk/TZ.T1.1', id: 'kiosk', title: 'Kiosk TZ.T1.1', hint: 'ekran pionowy 1080×1920; także TZ.T1.2 … TZ.T1.5' },
  { path: 'kiosk/TZ.T1.5', id: 'kiosk', title: 'Kiosk TZ.T1.5 „Dźwięki miasta”', hint: 'spacja = słuchawka, strzałki = ścieżka' },
  { path: 'lcd/LCD-01', id: 'signage', title: 'Ekran LCD-01', hint: 'ekran poziomy 1920×1080; także LCD-02, PRJ-01' },
  { path: 'bileter', id: 'validator', title: 'Stanowisko bileterskie', hint: 'telefon lub tablet biletera' },
  { path: 'cms', id: 'cms', title: 'Panel CMS', hint: 'redakcja treści, oferta, gra, moderacja' },
  { path: 'ekspozycja', id: 'mgmt', title: 'Zarządzanie ekspozycją', hint: 'urządzenia, harmonogramy, awarie' },
];
/** Adres końcówki: na serwerze własna ścieżka, w wersji jednoplikowej parametr ?end=. */
export const routeHref = (p) => (SERVED && typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? `${location.origin}/${p}` : `?end=${encodeURIComponent(p)}`);

export function parseRoute() {
  let p = START;
  try { if (!p) p = new URLSearchParams(location.search).get('end') || ''; if (!p && SERVED && /^https?:$/.test(location.protocol)) p = location.pathname; } catch { /* brak adresu */ }
  const seg = String(p || '').replace(/^\/+|\/+$/g, '').split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  switch (seg[0]) {
    case 'app': return { id: 'mobile' };
    case 'q': return { id: 'mobile', code: seg[1] || '' };
    case 'www': return { id: 'web' };
    case 'kiosk': return { id: 'kiosk', device: seg[1] || 'TZ.T1.1' };
    case 'lcd': return { id: 'signage', device: seg[1] || 'LCD-01' };
    case 'bileter': return { id: 'validator' };
    case 'cms': return { id: 'cms' };
    case 'ekspozycja': return { id: 'mgmt' };
    default: return null;
  }
}
const TITLES = { mobile: 'FPŻ – aplikacja', web: 'Fabryka Pełna Życia', kiosk: 'FPŻ – kiosk', signage: 'FPŻ – ekran', validator: 'FPŻ – bileter', cms: 'FPŻ – CMS', mgmt: 'FPŻ – ekspozycja' };
const vpOf = (w) => (w >= 1080 ? 'desktop' : w >= 700 ? 'tablet' : 'phone');

export function Standalone({ route }) {
  const [vp, setVp] = useState(() => vpOf(window.innerWidth));
  useEffect(() => { const f = () => setVp(vpOf(window.innerWidth)); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  useEffect(() => { document.title = TITLES[route.id] + (route.device ? ' ' + route.device : '') + ' (wersja testowa)'; document.documentElement.classList.add('sa-html'); }, []);
  // aplikacja Android: systemowy przycisk „wstecz” cofa ekran aplikacji, a na ekranie głównym minimalizuje ją
  useEffect(() => { if (route.id === 'mobile') initNative({ onBack: () => !!window.__fpzMobile?.back?.() }); }, []);
  // adres /q/KOD (np. z wydrukowanego kodu QR): kod trafia „przed kamerę” aplikacji – skaner od razu go rozpozna
  useEffect(() => { if (route.code) makeApi('mobile').env.set({ qrInView: route.code }); }, []);
  const { id } = route;
  return (<div class={`sa-root sa-${id}`}>
    {id === 'mobile' && <div class="sa-phone"><MobileApp standalone /></div>}
    {id === 'web' && <div class="sa-fill"><WebApp viewport={vp} standalone /></div>}
    {id === 'kiosk' && <KioskEndpoint standalone={route.device} />}
    {id === 'signage' && <SignageEndpoint standalone={route.device} />}
    {id === 'validator' && <div class="sa-fill"><ValidatorApp standalone /></div>}
    {id === 'cms' && <div class="sa-fill"><CmsApp standalone /></div>}
    {id === 'mgmt' && <div class="sa-fill"><MgmtApp standalone /></div>}
    <NetNotice quiet={id === 'kiosk' || id === 'signage'} />
  </div>);
}
