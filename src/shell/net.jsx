// Stan połączenia z serwerem (tryb serwerowy): plakietka w powłoce i komunikaty w końcówkach samodzielnych.
import { useEffect } from 'preact/hooks';
import { useStore } from '../kernel/store.js';
import { dismissConflict, syncNow } from '../kernel/remote.js';
import { Icon } from '../ui/components.jsx';

const LABEL = { online: 'połączono', offline: 'brak połączenia', connecting: 'łączenie…' };
/** Plakietka dla paska powłoki. */
export function NetBadge() {
  const net = useStore((s) => s.net);
  if (!net || net.mode !== 'remote') return <span class="sh-net is-local" title="Wersja jednoplikowa: dane są zapisywane tylko w tej przeglądarce."><Icon name="database" size={13} /> <span>dane lokalne</span></span>;
  return (<button type="button" class={`sh-net is-${net.status}`} onClick={() => syncNow()} title={`Wspólne dane na serwerze – ${LABEL[net.status] || net.status}. Wersja danych: ${net.version || '—'}. Kliknij, aby zsynchronizować teraz.`}>
    <i aria-hidden="true" /><span>serwer: {LABEL[net.status] || net.status}</span>{net.pending > 0 && <b>{net.pending}</b>}</button>);
}
/** Komunikaty nakładane na końcówkę: brak połączenia / oczekujące zmiany / wynik odrzucony przez serwer. */
export function NetNotice({ quiet }) {
  const net = useStore((s) => s.net); const c = net?.conflict;
  useEffect(() => { if (!c) return undefined; const t = setTimeout(dismissConflict, 9000); return () => clearTimeout(t); }, [c?.at]);
  if (!net || net.mode !== 'remote') return null;
  const off = net.status === 'offline';
  return (<div class="sa-net" aria-live="polite">
    {off && !quiet && <div class="sa-net__pill is-off"><Icon name="wifiOff" size={14} /> Brak połączenia z serwerem{net.pending > 0 ? ` – zmiany (${net.pending}) zostaną wysłane po jego odzyskaniu` : ''}</div>}
    {off && quiet && <div class="sa-net__dot" title="Brak połączenia z serwerem" />}
    {c && <div class="sa-net__pill is-warn" role="alert"><Icon name="alert" size={14} /> <span>{c.serverOk ? 'Serwer wykonał operację, która lokalnie się nie powiodła – dane zostały odświeżone.' : `Serwer nie przyjął operacji${c.message?.pl ? ': ' + c.message.pl : c.error ? ' (' + c.error + ')' : ''} – dane zostały odświeżone.`}</span><button type="button" onClick={dismissConflict} aria-label="Zamknij komunikat">×</button></div>}
  </div>);
}
