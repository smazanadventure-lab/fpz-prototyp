// Wspólne elementy Systemu Zarządzania Ekspozycją (prefiks x-).
import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { pad2, byId } from '../../kernel/util.js';
import { Icon } from '../../ui/components.jsx';

export const XCtx = createContext(null);
/** { go(section), openDevice(id), can(perm), touch } */
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
