// Wielojęzyczność: słownik tekstów interfejsu (edytowalny w CMS bez prac programistycznych) + treści {pl,en,…}.
import { getState } from './store.js';

const dict = {}; // klucz → { pl, en }

/** Rejestracja tekstów interfejsu modułu: strings({ 'm.home.title': ['Witaj', 'Welcome'] }) */
export function strings(obj) {
  for (const [k, v] of Object.entries(obj)) dict[k] = Array.isArray(v) ? { pl: v[0], en: v[1] ?? v[0] } : v;
}
export const stringKeys = () => Object.keys(dict).sort();
export const stringDefault = (key, lang) => dict[key]?.[lang] ?? null;

/** Tekst interfejsu w języku lang. Kolejność: nadpisanie z CMS → domyślny → angielski → polski → klucz. */
export function tr(lang, key, vars) {
  const ov = getState()?.i18n?.overrides || {};
  let s = ov[lang]?.[key] ?? dict[key]?.[lang];
  if (s == null && lang !== 'pl') s = ov.en?.[key] ?? dict[key]?.en;
  if (s == null) s = ov.pl?.[key] ?? dict[key]?.pl ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, n) => (vars[n] ?? ''));
  return s;
}
/** Treść zlokalizowana: loc('en', {pl:'…', en:'…'}) – z zapasowym przejściem en → pl. */
export function loc(lang, obj) {
  if (obj == null) return '';
  if (typeof obj !== 'object') return String(obj);
  return obj[lang] || obj.en || obj.pl || '';
}
export const languages = () => (getState()?.settings?.languages || []).filter((l) => l.enabled);

// Teksty wspólne dla wszystkich końcówek
strings({
  'c.back': ['Wstecz', 'Back'], 'c.close': ['Zamknij', 'Close'], 'c.more': ['Dowiedz się więcej', 'Find out more'], 'c.readMore': ['Czytaj dalej', 'Read more'],
  'c.buyTicket': ['Kup bilet', 'Buy ticket'], 'c.search': ['Szukaj', 'Search'], 'c.all': ['Wszystko', 'All'], 'c.save': ['Zapisz', 'Save'], 'c.cancel': ['Anuluj', 'Cancel'],
  'c.yes': ['Tak', 'Yes'], 'c.no': ['Nie', 'No'], 'c.ok': ['OK', 'OK'], 'c.next': ['Dalej', 'Next'], 'c.prev': ['Wstecz', 'Previous'], 'c.loading': ['Wczytywanie…', 'Loading…'],
  'c.language': ['Język', 'Language'], 'c.contrast': ['Wysoki kontrast', 'High contrast'], 'c.textBigger': ['Powiększ tekst', 'Larger text'], 'c.textSmaller': ['Pomniejsz tekst', 'Smaller text'],
  'c.lector': ['Asysta lektora', 'Read aloud'], 'c.night': ['Tryb nocny', 'Night mode'], 'c.pjm': ['Tłumacz języka migowego', 'Sign language interpreter'],
  'c.captions': ['Napisy', 'Captions'], 'c.audioDesc': ['Audiodeskrypcja', 'Audio description'], 'c.transcript': ['Transkrypcja', 'Transcript'],
  'c.play': ['Odtwórz', 'Play'], 'c.pause': ['Pauza', 'Pause'], 'c.stop': ['Zatrzymaj', 'Stop'], 'c.share': ['Udostępnij', 'Share'], 'c.favorite': ['Ulubione', 'Favourite'],
  'c.accessible': ['Dostępne dla osób z niepełnosprawnościami', 'Accessible'], 'c.notAccessible': ['Ograniczona dostępność', 'Limited accessibility'],
  'c.today': ['Dziś', 'Today'], 'c.free': ['Wstęp wolny', 'Free entry'], 'c.soldOut': ['Wyprzedane', 'Sold out'], 'c.offline': ['Tryb offline', 'Offline mode'],
  'c.sample': ['Dane przykładowe', 'Sample data'], 'c.schematicMap': ['Mapa schematyczna – w wersji docelowej podkład mapowy zgodny z licencją', 'Schematic map – the final version uses a licensed base map'],
  'c.live': ['Na żywo', 'Live'], 'c.points': ['pkt', 'pts'], 'c.min': ['min', 'min'], 'c.youAreHere': ['Tu jesteś', 'You are here'],
  'c.empty': ['Brak pozycji do wyświetlenia', 'Nothing to show'], 'c.test': ['Wersja testowa', 'Test version'],
});
