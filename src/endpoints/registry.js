// Rejestr końcówek prototypu (kolejność = kolejność zakładek).
import MobileApp from './mobile/index.jsx';
import WebApp from './web/index.jsx';
import KioskEndpoint from './kiosk/index.jsx';
import SignageEndpoint from './signage/index.jsx';
import ValidatorApp from './validator/index.jsx';
import CmsApp from './cms/index.jsx';
import MgmtApp from './mgmt/index.jsx';

export const ENDPOINTS = [
  { id: 'mobile', title: 'Aplikacja mobilna', short: 'Aplikacja', icon: 'smartphone', Component: MobileApp, frame: 'phone', hint: 'Wirtualny przewodnik + gra terenowa (iOS / Android)' },
  { id: 'web', title: 'Strona WWW / PWA', short: 'Strona WWW', icon: 'globe', Component: WebApp, frame: 'browser', hint: 'Portal z rozbudowanymi treściami i systemem rezerwacji' },
  { id: 'kiosk', title: 'Kioski multimedialne', short: 'Kioski', icon: 'monitor', Component: KioskEndpoint, frame: 'none', hint: 'TZ.T1.1–T1.5: mapa, informator, historia, Dźwięki miasta' },
  { id: 'signage', title: 'Ekrany LCD', short: 'Ekrany LCD', icon: 'tv', Component: SignageEndpoint, frame: 'none', hint: 'Informator i napisy na żywo (symultaniczny przekaz tekstowy)' },
  { id: 'validator', title: 'Stanowisko bileterskie', short: 'Bileter', icon: 'scan', Component: ValidatorApp, frame: 'none', hint: 'Walidacja biletów, kuponów i nagród' },
  { id: 'cms', title: 'Panel CMS', short: 'CMS', icon: 'database', Component: CmsApp, frame: 'none', hint: 'Treści, tłumaczenia, QR/BLE/AR, gra, oferta, moderacja' },
  { id: 'mgmt', title: 'Zarządzanie ekspozycją', short: 'Ekspozycja', icon: 'sliders', Component: MgmtApp, frame: 'none', hint: 'Urządzenia, harmonogramy, playlisty, awarie i alerty' },
];
