// Urządzenia: telemetria na żywo, filtr stref i rodzajów, panel pojedynczego stanowiska.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { ago, fmtDateTime } from '../../kernel/util.js';
import { Icon, Button, Modal, Tag, Notice, Empty, Chips, Select, Field, Switch, Tabs } from '../../ui/components.jsx';
import { useX, useTick, POWER, KINDS, SCHED_MODE, HEIGHTS, PowerBadge, Head, zoneName, DISPLAY_KINDS } from './common.jsx';

export function Devices() {
  const s = getState(); const { openDevice } = useX(); useTick(1000);
  const [zone, setZone] = useState(''); const [kind, setKind] = useState(''); const [st, setSt] = useState('');
  const list = s.devices.filter((d) => (!zone || d.zone === zone) && (!kind || d.kind === kind) && (!st || d.power === st));
  const pl = (id) => s.playlists.find((p) => p.id === id)?.name;
  return (<div>
    <Head title="Urządzenia" sub={`${s.devices.length} urządzeń w sieci LAN ekspozycji · telemetria odświeżana co 5 s`} icon="monitor" />
    <div class="x-filters">
      <Chips options={[{ id: '', label: 'Wszystkie strefy' }, ...s.zones.map((z) => ({ id: z.id, label: z.name }))]} value={zone} onChange={setZone} scroll />
      <div class="x-filters__row">
        <Chips options={[{ id: '', label: 'Wszystkie rodzaje' }, ...Object.entries(KINDS).map(([k, v]) => ({ id: k, label: v.short, icon: v.icon }))]} value={kind} onChange={setKind} scroll />
        <Select value={st} onChange={(e) => setSt(e.currentTarget.value)} aria-label="Stan" options={[{ id: '', label: 'Każdy stan' }, ...Object.entries(POWER).map(([k, v]) => ({ id: k, label: v.label }))]} class="x-filters__sel" />
      </div>
    </div>
    {list.length ? <div class="x-devtable" role="table" aria-label="Urządzenia">
      <div class="x-devrow x-devrow--head" role="row"><span role="columnheader">Urządzenie</span><span role="columnheader">Stan</span><span role="columnheader" class="x-c-tel">Temp. / CPU</span><span role="columnheader" class="x-c-up">Czas pracy</span><span role="columnheader" class="x-c-seen">Ostatni kontakt</span><span role="columnheader" class="x-c-net">IP / wersja</span><span role="columnheader" class="x-c-pl">Playlista</span><span role="columnheader" class="x-c-mode">Tryb</span></div>
      {list.map((d) => (<button type="button" key={d.id} class={`x-devrow x-devrow--${d.power}`} role="row" onClick={() => openDevice(d.id)} data-dev={d.id}>
        <span class="x-devrow__name" role="cell"><span class="x-devic"><Icon name={KINDS[d.kind]?.icon} size={20} /></span><span><b>{d.name}</b><small>{d.id} · {zoneName(d.zone)}</small></span></span>
        <span role="cell"><PowerBadge power={d.power} />{d.night && <span class="x-nightmark" title="Tryb nocny"><Icon name="moon" size={13} /></span>}</span>
        <span role="cell" class="x-c-tel">{d.power === 'on' ? <><span class={d.tempC > 55 ? 'x-bad' : ''}><Icon name="thermometer" size={13} />{Math.round(d.tempC)}°C</span> <span><Icon name="cpu" size={13} />{d.cpu}%</span></> : <span class="x-muted">—</span>}</span>
        <span role="cell" class="x-c-up">{d.power === 'on' ? `${Math.floor(d.uptimeH)} h ${Math.round((d.uptimeH % 1) * 60)} min` : '—'}</span>
        <span role="cell" class="x-c-seen">{ago(d.lastSeen)}</span>
        <span role="cell" class="x-c-net"><code>{d.ip}</code><small>v{d.appVersion}</small></span>
        <span role="cell" class="x-c-pl">{pl(d.playlistId) || <span class="x-muted">{d.kind === 'kiosk' ? 'aplikacja kiosku' : '—'}</span>}</span>
        <span role="cell" class="x-c-mode"><Tag tone={d.schedule === 'manual' ? 'warn' : d.schedule === 'always' ? 'info' : 'green'}>{d.schedule === 'auto' ? 'auto' : d.schedule === 'manual' ? 'ręczny' : '24/7'}</Tag></span>
      </button>))}
    </div> : <Empty icon="filter" title="Brak urządzeń dla wybranych filtrów" />}
  </div>);
}

const FAULTS = [
  { t: 'Utrata komunikacji z urządzeniem', sev: '' },
  { t: 'Brak reakcji nakładki dotykowej', sev: 'P3' },
  { t: 'Przekroczona temperatura pracy', sev: 'P4' },
  { t: 'Brak sygnału wideo', sev: 'P2' },
  { t: 'Awaria zasilania szafy rack', sev: 'P1' },
];

export function DeviceModal({ id, onClose }) {
  const { api, toast } = useClient(); const { can, go } = useX(); useTick(1000);
  const s = getState(); const d = sel.device(id);
  const [tab, setTab] = useState('ctl'); const [fault, setFault] = useState(null);
  if (!d) return null;
  const ok = can('devices');
  const res = (r, msg) => { if (r && r.ok === false) toast(r.message.pl, 'error'); else if (msg) toast(msg); };
  const power = (p) => res(api.devices.power(d.id, p), { on: 'Włączono', off: 'Wyłączono', service: 'Przełączono w tryb serwisowy' }[p] + `: ${d.name}`);
  const setp = (patch) => res(api.devices.set(d.id, patch));
  const history = [
    ...s.audit.filter((a) => a.target === d.name || a.target === d.id).map((a) => ({ at: a.at, icon: 'activity', text: a.action, who: sel.staff(a.staffId)?.name })),
    ...s.incidents.filter((i) => i.deviceId === d.id).flatMap((i) => [{ at: i.createdAt, icon: 'circleAlert', text: `[${i.severity}] ${i.title}`, who: i.source === 'monitoring' ? 'monitoring' : 'zgłoszenie ręczne' }, ...(i.resolvedAt ? [{ at: i.resolvedAt, icon: 'circleCheck', text: `Zamknięto: ${i.note}`, who: i.assignee }] : [])]),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  const displays = DISPLAY_KINDS.includes(d.kind);
  return (<Modal open onClose={onClose} size="lg" class="x-devmodal" title={<span class="x-devmodal__t"><Icon name={KINDS[d.kind]?.icon} size={22} />{d.name}<PowerBadge power={d.power} /></span>}>
    <div class="x-devmeta"><span><Icon name="mapPin" size={14} />{zoneName(d.zone)}</span><span><Icon name="tag" size={14} />{d.id}</span><span><Icon name="cpu" size={14} />{d.model}</span><span><Icon name="clock" size={14} />kontakt {ago(d.lastSeen)}</span></div>
    {d.kind === 'kiosk' && <Notice icon="eye">Podgląd ekranu tego kiosku: zakładka „Kioski” w powłoce prototypu – zmiany wprowadzone tutaj widać tam od razu.</Notice>}
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'ctl', label: 'Sterowanie', icon: 'sliders' }, { id: 'info', label: 'Wyposażenie i sieć', icon: 'server' }, { id: 'hist', label: 'Historia zdarzeń', icon: 'history' }]} />
    {tab === 'ctl' && <div class="x-devctl">
      <div class="x-powerseg" role="group" aria-label="Zasilanie stanowiska">
        {[['on', 'Włącz', 'power'], ['off', 'Wyłącz', 'power'], ['service', 'Tryb serwisowy', 'wrench']].map(([p, l, ic]) => (
          <button key={p} type="button" class={`x-powerseg__b x-powerseg__b--${p}${d.power === p ? ' is-on' : ''}`} aria-pressed={d.power === p} disabled={!ok} onClick={() => power(p)} data-testid={`x-dev-${p}`}><Icon name={ic} size={22} />{l}</button>))}
      </div>
      {d.power === 'fault' && <Notice tone="danger">Urządzenie zgłasza awarię. Zamknij zgłoszenie w sekcji „Awarie i SLA”, aby przywrócić pracę. <button type="button" class="x-link" onClick={() => { onClose(); go('incidents'); }}>Przejdź do zgłoszeń</button></Notice>}
      {d.power === 'service' && <Notice tone="warn">Stanowisko wyłączone do konserwacji – pozostałe urządzenia pracują bez zmian.</Notice>}
      <div class="x-devctl__row">
        <div><span class="x-lbl">Tryb sterowania</span><b>{SCHED_MODE[d.schedule]}</b></div>
        <Button variant="secondary" size="sm" icon="calendar" disabled={!ok || d.schedule !== 'manual'} onClick={() => { api.devices.setAuto(d.id); toast('Przywrócono harmonogram'); }} data-testid="x-dev-auto">Przywróć harmonogram</Button>
        <Button variant="secondary" size="sm" icon="refresh" disabled={!ok || d.power !== 'on'} onClick={() => res(api.devices.restart(d.id), 'Zrestartowano aplikację')} data-testid="x-dev-restart">Restart aplikacji</Button>
      </div>
      {!['server', 'network'].includes(d.kind) && <div class="x-sliders">
        {['kiosk', 'lcd', 'projector', 'audio'].includes(d.kind) && <label class="x-slider"><span><Icon name="volume" size={16} />Głośność <b>{d.volume}%</b></span><input type="range" min="0" max="100" value={d.volume} disabled={!ok} onInput={(e) => setp({ volume: +e.currentTarget.value })} aria-label="Głośność" /></label>}
        {d.kind !== 'audio' && <label class="x-slider"><span><Icon name="sun" size={16} />Jasność <b>{d.brightness}%</b></span><input type="range" min="10" max="100" value={d.brightness} disabled={!ok} onInput={(e) => setp({ brightness: +e.currentTarget.value })} aria-label="Jasność" /></label>}
      </div>}
      <div class="x-devctl__grid">
        {displays && <Switch label="Tryb nocny (ciemny motyw, przygaszenie)" checked={!!d.night} disabled={!ok} onChange={(e) => setp({ night: e.currentTarget.checked })} />}
        {d.kind === 'kiosk' && <Field label="Wysokość interfejsu kiosku"><Select value={d.heightMode || 'standing'} disabled={!ok} onChange={(e) => setp({ heightMode: e.currentTarget.value })} options={Object.entries(HEIGHTS).map(([k, v]) => ({ id: k, label: v }))} /></Field>}
        {displays && d.kind !== 'kiosk' && <Field label="Playlista"><Select value={d.playlistId || ''} disabled={!can('playlists')} onChange={(e) => { setp({ playlistId: e.currentTarget.value || null }); toast('Przypisano playlistę'); }} options={[{ id: '', label: '— brak —' }, ...s.playlists.map((p) => ({ id: p.id, label: p.name }))]} /></Field>}
        {d.kind === 'kiosk' && <Field label="Treść" hint="Kiosk uruchamia aplikację interaktywną (mapa, informator)."><Select value={d.playlistId || ''} disabled={!can('playlists')} onChange={(e) => setp({ playlistId: e.currentTarget.value || null })} options={[{ id: '', label: 'Aplikacja kiosku' }, ...s.playlists.map((p) => ({ id: p.id, label: 'Wygaszacz: ' + p.name }))]} /></Field>}
      </div>
      {displays && <p class="x-muted x-small">Tryb nocny ustawiany ręcznie obowiązuje do najbliższego przeliczenia harmonogramu „Tryb nocny”.</p>}
      <div class="x-faultbox">
        <div><b><Icon name="zap" size={16} /> Test monitoringu</b><p class="x-muted x-small">Symulacja awarii tworzy zgłoszenie z klasą SLA i wysyła powiadomienia wg reguł alertów.</p></div>
        <Button variant="danger" size="sm" icon="alert" disabled={!can('incidents') || d.power === 'fault'} onClick={() => setFault({ t: FAULTS[0].t, sev: '' })} data-testid="x-dev-fault">Symuluj awarię</Button>
      </div>
    </div>}
    {tab === 'info' && <div class="x-kv">
      <dl>
        <dt>Rodzaj</dt><dd>{KINDS[d.kind]?.label}</dd><dt>Model</dt><dd>{d.model}</dd><dt>Adres IP</dt><dd><code>{d.ip}</code></dd><dt>MAC</dt><dd><code>{d.mac}</code></dd>
        <dt>Wersja aplikacji</dt><dd>{d.appVersion}</dd><dt>Temperatura</dt><dd>{Math.round(d.tempC)}°C</dd><dt>Obciążenie CPU</dt><dd>{d.cpu}%</dd><dt>Czas pracy</dt><dd>{d.uptimeH.toFixed(1)} h</dd>
        {d.restartedAt && <><dt>Ostatni restart</dt><dd>{fmtDateTime(d.restartedAt)}</dd></>}
        {d.kind === 'kiosk' && <><dt>Dotknięcia dziś</dt><dd>{d.touchesToday}</dd></>}
      </dl>
      <h4>Wyposażenie</h4>
      {(d.accessories || []).length ? <ul class="x-tags">{d.accessories.map((a) => <li key={a}><Tag tone="info" icon="check">{a}</Tag></li>)}</ul> : <p class="x-muted">Brak dodatkowego wyposażenia.</p>}
    </div>}
    {tab === 'hist' && (history.length ? <ul class="x-timeline">{history.map((h, i) => <li key={i}><Icon name={h.icon} size={15} /><span class="x-grow">{h.text}{h.who && <small class="x-muted"> · {h.who}</small>}</span><time>{fmtDateTime(h.at)}</time></li>)}</ul> : <Empty icon="history" title="Brak zdarzeń" />)}
    <Modal open={!!fault} onClose={() => setFault(null)} title="Symulacja awarii" size="sm"
      footer={<><Button variant="secondary" onClick={() => setFault(null)}>Anuluj</Button><Button variant="danger" icon="zap" data-testid="x-fault-go" onClick={() => { const r = api.devices.simulateFault(d.id, { title: fault.t, severity: fault.sev || undefined }); setFault(null); if (r.ok) toast(`Zgłoszenie ${r.incident.severity} utworzone, powiadomienia wysłane`, 'warn'); else toast(r.message.pl, 'error'); }}>Zgłoś awarię</Button></>}>
      {fault && <>
        <Field label="Opis usterki"><Select value={fault.t} onChange={(e) => { const f = FAULTS.find((x) => x.t === e.currentTarget.value); setFault({ t: f.t, sev: f.sev || fault.sev }); }} options={FAULTS.map((f) => ({ id: f.t, label: f.t }))} /></Field>
        <Field label="Klasa zgłoszenia" hint="Automatycznie: serwer/sieć – P1, kiosk – P3, pozostałe – P4."><Select value={fault.sev} onChange={(e) => setFault({ ...fault, sev: e.currentTarget.value })} options={[{ id: '', label: 'Automatycznie' }, ...['P1', 'P2', 'P3', 'P4'].map((p) => ({ id: p, label: p }))]} /></Field>
      </>}
    </Modal>
  </Modal>);
}
