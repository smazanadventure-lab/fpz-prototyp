// Awarie i SLA: zgłoszenia P1–P4, liczniki czasu reakcji/usunięcia, dostępność, raport, kopie zapasowe.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel, SLA } from '../../kernel/api.js';
import { fmtDateTime, nowIso, uid, download, dayStr } from '../../kernel/util.js';
import { Icon, Button, Tag, Notice, Empty, Select, Field, Input, Textarea, Modal, Chips, Stat, Checkbox } from '../../ui/components.jsx';
import { useX, useTick, Head, Panel, devName, fmtLeft, fmtH, csv, KINDS, isClosed, incOrigin, ORIGIN, OriginTag } from './common.jsx';

const STATUS = { open: { label: 'Nowe', tone: 'danger' }, in_progress: { label: 'W realizacji', tone: 'warn' }, closed: { label: 'Zamknięte', tone: 'green' }, resolved: { label: 'Zamknięte automatycznie', tone: 'green' } };
/** Zgłoszenie zamknięte przez monitoring serwera po powrocie sygnału ma status 'closed' i znacznik autoClosed. */
const statusOf = (i) => (i.status === 'closed' && i.autoClosed ? STATUS.resolved : STATUS[i.status] || STATUS.open);
const sevTone = (p) => (p === 'P1' || p === 'P2' ? 'danger' : p === 'P3' ? 'warn' : 'info');

/** Dostępność w bieżącym miesiącu na podstawie czasu trwania incydentów P1/P2. */
export function monthAvailability() {
  const s = getState(); const now = Date.now(); const d = new Date(); const m0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); const period = now - m0;
  let down = 0;
  for (const i of s.incidents) { if (!['P1', 'P2'].includes(i.severity)) continue; const a = Math.max(m0, new Date(i.createdAt).getTime()); const b = Math.min(now, i.resolvedAt ? new Date(i.resolvedAt).getTime() : now); if (b > a) down += b - a; }
  const pct = period > 0 ? 100 * (1 - down / period) : 100; const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { pct, downH: down / 3600e3, allowH: days * 24 * 0.003, ok: pct >= 99.7 };
}
function rows() {
  const s = getState();
  return [['ID', 'Klasa', 'Urządzenie', 'Opis', 'Źródło', 'Status', 'Zgłoszono', 'Przyjęto', 'Zamknięto', 'Czas usunięcia [h]', 'Reakcja w terminie', 'Usunięcie w terminie', 'Notatka'],
    ...s.incidents.map((i) => { const x = sel.incidentSla(i); return [i.id, i.severity, devName(i.deviceId), i.title, ORIGIN[incOrigin(i)].label, statusOf(i).label, fmtDateTime(i.createdAt), i.reactedAt ? fmtDateTime(i.reactedAt) : '', i.resolvedAt ? fmtDateTime(i.resolvedAt) : '', x.elapsedH.toFixed(2), x.reactH ? (x.reactBreached ? 'NIE' : 'TAK') : 'n/d', x.fixBreached ? 'NIE' : 'TAK', i.note || '']; })];
}

export function Incidents() {
  const s = getState(); const { api, toast, client, set, staff } = useClient(); const { can, openDevice } = useX(); useTick(1000);
  const ok = can('incidents');
  const [f, setF] = useState('open'); const [close, setClose] = useState(null); const [note, setNote] = useState(''); const [rep, setRep] = useState(null); const [print, setPrint] = useState(false); const [bk, setBk] = useState(false);
  const list = s.incidents.filter((i) => f === 'all' || (f === 'open' ? !isClosed(i) : isClosed(i)));
  const av = monthAvailability();
  const open = s.incidents.filter((i) => !isClosed(i));
  const breached = s.incidents.filter((i) => { const x = sel.incidentSla(i); return x.fixBreached || x.reactBreached; }).length;
  const closed = s.incidents.filter((i) => i.resolvedAt); const mttr = closed.length ? closed.reduce((a, i) => a + sel.incidentSla(i).elapsedH, 0) / closed.length : 0;
  const report = () => { download(`raport-usterek-${dayStr()}.csv`, csv(rows()), 'text/csv;charset=utf-8'); toast('Pobrano raport CSV'); };
  const manual = () => {
    const { deviceId, title, severity, stop } = rep; if (!title.trim()) return toast('Opisz usterkę', 'error');
    const r = api.devices.reportIncident({ deviceId, title: title.trim(), severity, stopDevice: !!stop }); if (!r.ok) return toast(r.message.pl, 'error');
    setRep(null); toast('Zarejestrowano zgłoszenie', 'warn');
  };
  const backupTest = () => {
    setBk(true);
    setTimeout(() => { const at = nowIso(); const min = 38 + Math.round(Math.random() * 30); api.sys.audit('Test odtworzeniowy kopii zapasowej', `odtworzono kopię z ${dayStr()} 02:00 w ${min} min (RTO ≤ 8 h)`); set({ xBackupTest: { at, min } }); setBk(false); toast('Test odtworzeniowy zakończony powodzeniem'); }, 1600);
  };
  const lastBk = client.xBackupTest;
  return (<div>
    <Head title="Awarie i SLA" sub="Zgłoszenia wykryte automatycznie (brak sygnału z urządzenia), ręczne i symulowane; czasy reakcji i usunięcia wg umowy utrzymaniowej" icon="alert">
      <Button variant="secondary" icon="download" onClick={report} data-testid="x-inc-csv">Raport CSV</Button>
      <Button variant="secondary" icon="printer" onClick={() => setPrint(true)}>Widok do druku</Button>
      <Button icon="plus" disabled={!ok} onClick={() => setRep({ deviceId: s.devices[0].id, title: '', severity: 'P3', stop: false })} data-testid="x-inc-new">Zgłoś usterkę</Button>
    </Head>
    <div class="x-stats">
      <Stat icon="alert" label="Otwarte zgłoszenia" value={open.length} sub={`${open.filter((i) => ['P1', 'P2'].includes(i.severity)).length} krytyczne/wysokie`} />
      <Stat icon="timer" label="Przekroczenia SLA" value={breached} sub="reakcja lub usunięcie" />
      <Stat icon="activity" label="Śr. czas usunięcia" value={fmtH(mttr)} sub={`${closed.length} zamkniętych`} />
      <div class={`x-avail${av.ok ? '' : ' is-bad'}`}><span class="fpz-stat__label"><Icon name="shield" size={14} />Dostępność w miesiącu</span><b data-testid="x-avail">{av.pct.toFixed(3).replace('.', ',')}%</b>
        <div class="x-avail__bar"><i style={{ width: `${Math.max(0, Math.min(100, (av.pct - 99) / 1 * 100))}%` }} /><em style={{ left: '70%' }} title="Próg 99,7%" /></div>
        <small>próg 99,7% · przestój P1/P2: {fmtH(av.downH)} z dopuszczalnych {fmtH(av.allowH)}</small></div>
    </div>
    <Panel title="Zgłoszenia" icon="list" actions={<Chips options={[{ id: 'open', label: `Otwarte (${open.length})` }, { id: 'closed', label: 'Zamknięte' }, { id: 'all', label: 'Wszystkie' }]} value={f} onChange={setF} />}>
      <p class="x-originlegend"><span>Źródło zgłoszenia:</span><OriginTag inc={{ id: 'inc-mon-' }} /><span>serwer sam zakłada (brak sygnału &gt; 5 min) i zamyka po powrocie połączenia</span><OriginTag inc={{ source: 'zgłoszenie ręczne' }} /><OriginTag inc={{}} /><span>„Symuluj awarię” i dane przykładowe</span></p>
      {list.length ? <div class="x-incs">{list.map((i) => { const x = sel.incidentSla(i); const reactLeft = x.reactDue ? x.reactDue - Date.now() : null; const fixLeft = x.fixDue - Date.now(); return (
        <article key={i.id} class={`x-inc x-inc--${isClosed(i) ? 'closed' : i.status} x-inc--o-${incOrigin(i)}`} data-inc={i.id} data-origin={incOrigin(i)}>
          <div class="x-inc__sev"><Tag tone={sevTone(i.severity)}>{i.severity}</Tag><small>{SLA[i.severity]?.label}</small></div>
          <div class="x-inc__main">
            <b>{i.title}</b>
            <div class="x-inc__meta"><button type="button" class="x-link" onClick={() => openDevice(i.deviceId)}><Icon name={KINDS[s.devices.find((d) => d.id === i.deviceId)?.kind]?.icon || 'monitor'} size={13} />{devName(i.deviceId)}</button><span>{fmtDateTime(i.createdAt)}</span><OriginTag inc={i} />{i.assignee && <span>przyjął: {i.assignee}</span>}</div>
            {i.note && isClosed(i) && <small class="x-muted">Notatka: {i.note}</small>}
          </div>
          <div class="x-inc__sla">
            <div class={`x-sla${x.reactBreached ? ' is-bad' : i.reactedAt ? ' is-ok' : ''}`}><span>Reakcja{x.reactH ? ` (${x.reactH} h)` : ''}</span><b>{!x.reactH ? 'w cyklu wdrożeniowym' : i.reactedAt ? (x.reactBreached ? 'po terminie' : 'w terminie') : reactLeft >= 0 ? fmtLeft(reactLeft) : 'przekroczono ' + fmtLeft(-reactLeft)}</b></div>
            <div class={`x-sla${x.fixBreached ? ' is-bad' : i.resolvedAt ? ' is-ok' : ''}`}><span>Usunięcie ({x.fixH} h)</span><b>{i.resolvedAt ? (x.fixBreached ? 'po terminie' : `w ${fmtH(x.elapsedH)}`) : fixLeft >= 0 ? fmtLeft(fixLeft) : 'przekroczono ' + fmtLeft(-fixLeft)}</b></div>
          </div>
          <div class="x-inc__act">
            <Tag tone={statusOf(i).tone}>{statusOf(i).label}</Tag>
            {i.status === 'open' && <Button size="sm" variant="secondary" icon="check" disabled={!ok} onClick={() => { api.devices.ackIncident(i.id); toast('Przyjęto zgłoszenie'); }} data-testid="x-inc-ack">Przyjmij</Button>}
            {!isClosed(i) && <Button size="sm" icon="circleCheck" disabled={!ok} onClick={() => { setClose(i); setNote(''); }} data-testid="x-inc-close">Zamknij</Button>}
          </div>
        </article>); })}</div> : <Empty icon="circleCheck" title={f === 'open' ? 'Brak otwartych zgłoszeń' : 'Brak zgłoszeń'} />}
    </Panel>
    <div class="x-grid2">
      <Panel title="Klasy zgłoszeń i czasy (umowa SLA)" icon="timer" pad={false}>
        <table class="x-table"><thead><tr><th>Klasa</th><th>Reakcja</th><th>Usunięcie</th><th>Przykład</th></tr></thead><tbody>
          <tr><td><Tag tone="danger">P1</Tag> krytyczny</td><td>1 h</td><td>12 h (obejście 4 h)</td><td>niedostępność serwera, sieci, walidacji biletów</td></tr>
          <tr><td><Tag tone="danger">P2</Tag> wysoki</td><td>4 h</td><td>24 h</td><td>ograniczenie funkcji ≥10% użytkowników</td></tr>
          <tr><td><Tag tone="warn">P3</Tag> średni</td><td>1 dzień rob.</td><td>5 dni rob.</td><td>usterka stanowiska, nakładka dotykowa</td></tr>
          <tr><td><Tag tone="info">P4</Tag> niski</td><td>—</td><td>do 20 dni rob.</td><td>drobne usterki UI i treści</td></tr>
        </tbody></table>
        <p class="x-muted x-small x-pad">Zgłoszenia 24/7; obsługa w dni robocze 8:00–20:00, dyżur on-call 24/7 dla P1. W prototypie terminy liczone są w godzinach zegarowych.</p>
      </Panel>
      <Panel title="Kopie zapasowe" icon="database">
        <ul class="x-kvlist"><li><span>Częstotliwość</span><b>pełna kopia codziennie, 02:00</b></li><li><span>Retencja</span><b>30 dni</b></li><li><span>RPO</span><b>≤ 24 h</b></li><li><span>RTO</span><b>≤ 8 h</b></li><li><span>Ostatnia kopia</span><b>{dayStr()} 02:00 – poprawna</b></li>
          <li><span>Ostatni test odtworzeniowy</span><b data-testid="x-bk-last">{lastBk ? `${fmtDateTime(lastBk.at)} – OK (${lastBk.min} min)` : 'brak w tej sesji (wymagany co 6 mies.)'}</b></li></ul>
        <Button variant="secondary" icon={bk ? 'hourglass' : 'rotate'} disabled={bk || !ok} onClick={backupTest} data-testid="x-bk-test">{bk ? 'Odtwarzanie kopii…' : 'Wykonaj test odtworzeniowy'}</Button>
        <p class="x-muted x-small">Symulacja – wynik testu trafia do dziennika zdarzeń systemu.</p>
      </Panel>
    </div>
    <Modal open={!!close} onClose={() => setClose(null)} size="sm" title="Zamknięcie zgłoszenia" footer={<><Button variant="secondary" onClick={() => setClose(null)}>Anuluj</Button><Button icon="circleCheck" onClick={() => { api.devices.resolveIncident(close.id, note.trim()); toast('Zgłoszenie zamknięte – urządzenie wraca do pracy'); setClose(null); }} data-testid="x-inc-resolve">Zamknij zgłoszenie</Button></>}>
      <p><b>{close?.title}</b><br /><span class="x-muted">{close && devName(close.deviceId)}</span></p>
      <Field label="Notatka serwisowa"><Textarea rows={3} value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder="Co zostało zrobione?" data-testid="x-inc-note" /></Field>
    </Modal>
    <Modal open={!!rep} onClose={() => setRep(null)} size="md" title="Ręczne zgłoszenie usterki" footer={<><Button variant="secondary" onClick={() => setRep(null)}>Anuluj</Button><Button icon="send" onClick={manual} data-testid="x-rep-save">Zgłoś</Button></>}>
      {rep && <>
        <Field label="Urządzenie"><Select value={rep.deviceId} onChange={(e) => setRep({ ...rep, deviceId: e.currentTarget.value })} options={s.devices.map((d) => ({ id: d.id, label: `${d.id} – ${d.name}` }))} /></Field>
        <Field label="Opis usterki"><Input value={rep.title} onInput={(e) => setRep({ ...rep, title: e.currentTarget.value })} data-testid="x-rep-title" /></Field>
        <Field label="Klasa"><Select value={rep.severity} onChange={(e) => setRep({ ...rep, severity: e.currentTarget.value })} options={Object.entries(SLA).map(([k, v]) => ({ id: k, label: `${k} – ${v.label}` }))} /></Field>
        <Checkbox label="Urządzenie niesprawne – wyłącz je z pracy (stan „awaria”)" checked={rep.stop} onChange={(e) => setRep({ ...rep, stop: e.currentTarget.checked })} />
      </>}
    </Modal>
    {print && <PrintView onClose={() => setPrint(false)} av={av} />}
  </div>);
}

function PrintView({ onClose, av }) {
  const r = rows(); const d = new Date(); const title = `Raport usterek i awarii – ${d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`;
  const html = () => `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>${title}</title><style>body{font:12px/1.4 Helvetica,Arial,sans-serif;color:#101411;margin:24px}h1{font-size:18px;color:#125930}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9aa;padding:4px 6px;text-align:left;vertical-align:top}th{background:#EEF6F2}</style></head><body><h1>${title}</h1><p>Fabryka Pełnej Życia – System Zarządzania Ekspozycją. Dostępność w miesiącu: ${av.pct.toFixed(3)}% (próg 99,7%). Wygenerowano: ${d.toLocaleString('pl-PL')}.</p><table>${r.map((row, i) => `<tr>${row.map((c) => (i ? `<td>${String(c).replace(/</g, '&lt;')}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</table></body></html>`;
  const printIt = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(html()); w.document.close(); w.focus(); w.print(); };
  return (<Modal open onClose={onClose} size="xl" title="Widok do druku – raport usterek i awarii" footer={<><Button variant="secondary" onClick={onClose}>Zamknij</Button><Button icon="printer" onClick={printIt}>Drukuj / zapisz PDF</Button></>}>
    <div class="x-print">
      <h3>{title}</h3>
      <p class="x-small">Dostępność w miesiącu: <b>{av.pct.toFixed(3).replace('.', ',')}%</b> (próg 99,7%) · zgłoszeń: {r.length - 1}</p>
      <div class="x-print__scroll"><table class="x-table x-table--dense"><thead><tr>{r[0].slice(0, 12).map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{r.slice(1).map((row, i) => <tr key={i}>{row.slice(0, 12).map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody></table></div>
    </div>
  </Modal>);
}
