// Kontekst aplikacji mobilnej: nawigacja (zakładka + stos ekranów), szuflada, odtwarzacz audioprzewodnika.
import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { getState } from '../../kernel/store.js';

export const AppCtx = createContext(null);
/** { platform, tab, go(tab), push(name, props), pop(), openEntry, openPoi, showOnMap, openScanner, openCoupons, openReservation, openDrawer, onScroll, audio, playAudio, … } */
export const useApp = () => useContext(AppCtx);

export const APP_VERSION = '0.9.3-test';
export const TABS = [
  { id: 'home', icon: 'pin', key: 'm.tab.home' },
  { id: 'history', icon: 'history', key: 'm.tab.history' },
  { id: 'community', icon: 'community', key: 'm.tab.community' },
  { id: 'map', icon: 'map', key: 'm.tab.map' },
  { id: 'game', icon: 'game', key: 'm.tab.game' },
];

/** Czy wpis jest dostępny przy obecnym stanie sieci (offline → tylko pakiet pobrany w ustawieniach). */
export function entryAvailable(entryId, client) {
  const s = getState();
  if (s.env.network !== 'offline') return true;
  return !!client.offlinePack && (s.settings.offlineEntryIds || []).includes(entryId);
}

/** Symulacja słabego łącza: przy wejściu w treść pokazuje szkielet przez 500–900 ms. */
export function useSlowLoad(dep) {
  const slow = getState().env.network === 'slow';
  const [loading, setLoading] = useState(slow);
  useEffect(() => {
    if (getState().env.network !== 'slow') { setLoading(false); return; }
    setLoading(true); const t = setTimeout(() => setLoading(false), 500 + Math.random() * 400); return () => clearTimeout(t);
  }, [dep]);
  return loading;
}

/** Ikona i etykieta grupy dla rodzaju miejsca. */
export const KIND_GROUP = { hall: 'attr', spot: 'attr', culture: 'attr', service: 'serv', history: 'visit', industry: 'visit', nature: 'visit', park: 'visit', tree: 'visit' };
export const KIND_ICON = { hall: 'building', spot: 'star', culture: 'music', service: 'utensils', history: 'book', industry: 'factory', nature: 'leaf', park: 'tree', tree: 'tree' };
