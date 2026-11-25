// Wspólne elementy Systemu Zarządzania Ekspozycją (prefiks x-).
import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { pad2, byId } from '../../kernel/util.js';
import { Icon } from '../../ui/components.jsx';
import { deviceLink } from '../../kernel/presence.js';

export const XCtx = createContext(null);
/** { go(section), openDevice(id), can(perm), touch, presence } */
export const useX = () => useContext(XCtx);

export const POWER = {
  on: { label: 'Działa', icon: 'circleCheck', tone: 'green' },
  off: { label: 'Wyłączone', icon: 'power', tone: 'neutral' },
  service: { label: 'Serwis', icon: 'wrench', tone: 'warn' },
  fault: { label: 'Awaria', icon: 'circleAlert', tone: 'danger' },
};
export const KINDS = {
  kiosk: { label: 'Kiosk multimedialny', short: 'Kiosk', icon: 'monitor' },
  lcd: { label: 'Ekran LCD', short: 'LCD', icon: 'tv' },
  projector: { label: 'Projekcja', short: 'Projektor', icon: 'film' },
  audio: { label: 'Nagłośnienie', short: 'Audio', icon: 'speaker' },
  light: { label: 'Oświetlenie', short: 'Światło', icon: 'bulb' },
  server: { label: 'Serwer', short: 'Serwer', icon: 'server' },
  network: { label: 'Sieć LAN', short: 'Sieć', icon: 'wifi' },
};
export const SCHED_MODE = { auto: 'Automatyczny (harmonogram)', manual: 'Ręczny', always: 'Praca ciągła 24/7' };
export const SCHED_KINDS = {
  power: { label: 'Włączanie / wyłączanie', icon: 'power' },
  night: { label: 'Tryb nocny', icon: 'moon' },
  service: { label: 'Okno serwisowe', icon: 'wrench' },
};
export const DAYS = [{ id: 1, label: 'Pn' }, { id: 2, label: 'Wt' }, { id: 3, label: 'Śr' }, { id: 4, label: 'Cz' }, { id: 5, label: 'Pt' }, { id: 6, label: 'Sb' }, { id: 0, label: 'Nd' }];
export const HEIGHTS = { standing: 'Stojący (150 cm)', child: 'Dziecko (130 cm)', wheelchair: 'Wózek (105 cm)' };
export const ITEM_TYPES = {
  events: { label: 'Wydarzenia (z systemu rezerwacji)', icon: 'calendar' },
  video: { label: 'Film', icon: 'film' },
  news: { label: 'Aktualności', icon: 'news' },
  image: { label: 'Obraz / ilustracja', icon: 'image' },
  ticker: { label: 'Pasek informacyjny', icon: 'text' },
  captions: { label: 'Napisy na żywo', icon: 'captions' },
  rss: { label: 'Kanał RSS', icon: 'rss' },
  stream: { label: 'Strumień / TV na żywo', icon: 'video' },
};
export const DISPLAY_KINDS = ['kiosk', 'lcd', 'projector'];

export const zoneName = (id) => byId(getState().zones, id)?.name || id;
export const devName = (id) => sel.device(id)?.name || id;
export const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const fromMin = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
export const inWindow = (hhmm, from, to) => (from <= to ? hhmm >= from && hhmm < to : hhmm >= from || hhmm < to);
export const targetsLabel = (targets = []) => (targets.includes('all') ? 'Cała ekspozycja' : targets.map((t) => (t.startsWith('z-') ? 'Strefa: ' + zoneName(t) : t)).join(', ') || '—');
export const fmtH = (h) => (h < 1 ? `${Math.max(0, Math.round(h * 60))} min` : `${Math.floor(h)} h ${pad2(Math.round((h % 1) * 60))} min`);
export const fmtLeft = (ms) => { const neg = ms < 0; const a = Math.abs(ms); const h = Math.floor(a / 3600e3), m = Math.floor((a % 3600e3) / 60e3), s = Math.floor((a % 60e3) / 1000); return (neg ? '−' : '') + (h ? `${h} h ${pad2(m)} min` : `${m}:${pad2(s)}`); };

/** Plakietka stanu urządzenia – kolor + ikona + tekst (nie tylko kolor). */
export function PowerBadge({ power, big }) {
  const p = POWER[power] || POWER.off;
  return <span class={`x-pw x-pw--${power}${big ? ' x-pw--big' : ''}`}><Icon name={p.icon} size={big ? 18 : 13} />{p.label}</span>;
}
/** Przelicza widok co intervalMs (liczniki SLA, „ostatni kontakt”). */
export function useTick(ms = 1000) { const [, s] = useState(0); useEffect(() => { const i = setInterval(() => s((n) => n + 1), ms); return () => clearInterval(i); }, [ms]); }
/** Stała sekcji: nagłówek + opis + akcje. */
export function Head({ title, sub, icon, children }) {
  return (<header class="x-head"><div class="x-head__t">{icon && <span class="x-head__ic"><Icon name={icon} size={22} /></span>}<div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></div>{children && <div class="x-head__act">{children}</div>}</header>);
}
export function Panel({ title, icon, actions, children, class: cls, pad = true }) {
  return (<section class={`x-panel${cls ? ' ' + cls : ''}`}>{(title || actions) && <div class="x-panel__head"><h3>{icon && <Icon name={icon} size={17} />}{title}</h3>{actions && <div class="x-panel__act">{actions}</div>}</div>}<div class={pad ? 'x-panel__body' : 'x-panel__body x-panel__body--flush'}>{children}</div></section>);
}
export const csv = (rows) => '﻿' + rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\n');

/* ── Stan rzeczywisty (sygnały urządzeń z serwera) ── */
/** Urządzenia, które mają własną stronę (kiosk / ekran) i mogą się meldować same. */
export const PAGE_KINDS = { kiosk: 'kiosk', lcd: 'lcd', projector: 'lcd' };
/** Adres strony urządzenia (bez importu powłoki – uniknięcie cyklu importów). */
export function devicePageUrl(d) {
  const seg = PAGE_KINDS[d?.kind]; if (!seg) return null; const p = `${seg}/${d.id}`;
  try { if (/^https?:$/.test(location.protocol)) return `${location.origin}/${p}`; } catch { /* brak adresu */ }
  return `?end=${encodeURIComponent(p)}`;
}
/** Zgłoszenie zamknięte ('closed'; monitoring serwera dodaje znacznik autoClosed; 'resolved' – zgodność ze starszymi danymi). */
export const isClosed = (i) => i.status === 'closed' || i.status === 'resolved';
/** Pochodzenie zgłoszenia: auto – prawdziwy monitoring serwera (brak sygnału), manual – zgłoszenie ręczne, sim – symulacja awarii / dane przykładowe. */
export const incOrigin = (i) => (String(i.id || '').startsWith('inc-mon-') ? 'auto' : i.source === 'zgłoszenie ręczne' ? 'manual' : 'sim');
export const ORIGIN = {
  auto: { label: 'wykryte automatycznie (brak sygnału)', short: 'wykryte automatycznie', tone: 'info', icon: 'activity' },
  manual: { label: 'zgłoszenie ręczne', short: 'zgłoszenie ręczne', tone: 'neutral', icon: 'user' },
  sim: { label: 'symulacja (dane testowe)', short: 'symulacja', tone: 'neutral', icon: 'sparkles' },
};
export function OriginTag({ inc }) { const o = ORIGIN[incOrigin(inc)]; return <span class={`x-origin x-origin--${incOrigin(inc)}`}><Icon name={o.icon} size={12} />{o.label}</span>; }

/** „12 s temu”, „6 min temu”, „2 h 5 min temu”. */
export const agoTxt = (sec) => (sec == null ? '—' : sec < 60 ? `${Math.max(0, Math.round(sec))} s` : sec < 3600 ? `${Math.floor(sec / 60)} min` : sec < 86400 ? `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min` : `${Math.floor(sec / 86400)} d`);
export const clockTxt = (ms) => (ms ? new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

/**
 * Stan połączenia jednego urządzenia liczony na bieżąco (czas „ostatniego sygnału” płynie między odczytami z serwera).
 * presence pochodzi z kontekstu (useX().presence) – zob. index.jsx.
 */
export function linkOf(presence, id) {
  if (!presence || presence.mode !== 'remote') return { state: 'local', lastAt: null, agoSec: null, page: null, agent: null };
  if (!presence.beats) return { state: 'loading', lastAt: null, agoSec: null, page: null, agent: null };
  const now = Date.now() + (presence.skew || 0); return deviceLink({ ...presence, now }, id);
}
/** Znacznik połączenia (stan RZECZYWISTY). */
export function LinkBadge({ link, compact }) {
  if (!link || link.state === 'local') return <span class="x-link-b x-link-b--local" title="Wersja bez serwera – stan symulowany"><Icon name="sparkles" size={12} />symulacja</span>;
  if (link.state === 'loading') return <span class="x-link-b x-link-b--never"><Icon name="refresh" size={13} />sprawdzanie…</span>;
  if (link.state === 'online') return <span class="x-link-b x-link-b--online" data-link="online"><Icon name="wifi" size={13} />Podłączone<small>{agoTxt(link.agoSec)} temu</small></span>;
  if (link.state === 'offline') return <span class={`x-link-b x-link-b--offline${link.agoSec >= 300 ? ' is-long' : ''}`} data-link="offline"><Icon name="wifiOff" size={13} />{compact ? 'Brak sygnału' : `Brak sygnału od ${agoTxt(link.agoSec)}`}{compact && <small>od {agoTxt(link.agoSec)}</small>}</span>;
  return <span class="x-link-b x-link-b--never" data-link="never"><Icon name="circleX" size={13} />Nigdy niepodłączone</span>;
}
/** Etykieta pochodzenia wartości: „symulowane” albo „z urządzenia”. */
export const SimMark = () => <span class="x-src x-src--sim" title="Wartość symulowana w prototypie – nie pochodzi z urządzenia">symulowane</span>;
export const RealMark = () => <span class="x-src x-src--real" title="Wartość zgłoszona przez urządzenie">z urządzenia</span>;

/** Krótka pomoc: skąd biorą się dane rzeczywiste, co jest symulowane. */
export function PresenceHelp({ mode }) {
  return (<details class="x-help">
    <summary><Icon name="help" size={15} />Skąd pochodzi stan rzeczywisty, a co jest symulowane?</summary>
    <ul>
      <li><b>Zadane</b> (włączone / wyłączone / serwis, tryb nocny, playlista, głośność) – to polecenia z tego panelu i harmonogramów zapisane na serwerze.</li>
      <li><b>Rzeczywiste</b> – strona kiosku lub ekranu (adres <code>/kiosk/ID</code>, <code>/lcd/ID</code>) co ok. 30 s wysyła serwerowi sygnał: przeglądarkę, rozdzielczość, pełny ekran, wersję aplikacji, ostatnią interakcję. Panel odczytuje sygnały co 10 s. Brak sygnału przez ponad 5 min przy stanie „włączone” tworzy zgłoszenie P2, które zamyka się samo po powrocie połączenia.</li>
      <li><b>Program sterujący</b> na komputerze kiosku (opcjonalny, Windows – docs/KIOSK-WINDOWS.md) dodaje dane systemu: obciążenie procesora, pamięć, dysk, głośność, stan monitora – oznaczone „z urządzenia”.</li>
      <li><b>Symulowane</b>: temperatura, obciążenie i czas pracy z danych przykładowych (o ile urządzenie ich nie przysyła), urządzenia bez własnej strony (nagłośnienie, oświetlenie, serwer, sieć) oraz „Symuluj awarię”.</li>
      {mode === 'local' && <li><b>Ta wersja działa bez serwera</b> – sygnałów nie ma, cały stan urządzeń jest symulowany.</li>}
    </ul>
  </details>);
}
