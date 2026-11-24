// Prosty router strony: ścieżka „sekcja/a/b” w stanie lokalnym + client.path (pasek adresu powłoki).
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { getState } from '../../kernel/store.js';

export const NavCtx = createContext({ path: '', r: { sec: '' }, go: () => {}, viewport: 'desktop', compact: false });
export const useNav = () => useContext(NavCtx);

/** 'historia/wpis/abc' → { sec:'historia', a:'wpis', b:'abc', parts:[…] } */
export function parsePath(path) {
  const [p] = String(path || '').split('#'); const parts = p.split('/').filter(Boolean).map((x) => decodeURIComponent(x));
  return { sec: parts[0] || '', a: parts[1] || null, b: parts[2] || null, parts };
}
export const enc = encodeURIComponent;

/** Sekcje nawigacji głównej. */
export const SECTIONS = [
  { id: '', key: 'w.nav.home', icon: 'pin' },
  { id: 'historia', key: 'w.nav.history', icon: 'history' },
  { id: 'spolecznosc', key: 'w.nav.community', icon: 'community' },
  { id: 'wydarzenia', key: 'w.nav.events', icon: 'ticket' },
  { id: 'mapa', key: 'w.nav.map', icon: 'map' },
  { id: 'gra', key: 'w.nav.game', icon: 'game' },
  { id: 'transmisje', key: 'w.nav.live', icon: 'tv' },
  { id: 'informacje', key: 'w.nav.info', icon: 'info' },
];

/** Tryb offline (symulowany): które treści są zapisane w pamięci podręcznej PWA. */
export function offlineOk(kind, id) {
  const s = getState(); if (!s.clients.web?.offlineSim) return true;
  if (kind === 'entry') return (s.settings.offlineEntryIds || []).includes(id);
  return ['info', 'plan', 'tickets', 'home', 'game-info'].includes(kind);
}
export const isOffline = () => !!getState().clients.web?.offlineSim;
