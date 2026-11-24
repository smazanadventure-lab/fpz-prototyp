// Pulpit: jeden przycisk uruchomienia/wyłączenia, mapa stref, zegar z symulacją pory dnia.
import { useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { ago } from '../../kernel/util.js';
import { Icon, Button, Modal, Tag, Notice, Empty } from '../../ui/components.jsx';
import { useX, POWER, KINDS, SCHED_KINDS, PowerBadge, Head, Panel, toMin, fromMin, inWindow, targetsLabel, devName } from './common.jsx';

const ORDER = ['network', 'server', 'light', 'audio', 'projector', 'lcd', 'kiosk'];

export function Dashboard() {
  return (<div class="x-dash">
    <Head title="Pulpit sterowni" sub="Stan całej ekspozycji, jeden przycisk uruchomienia oraz zegar systemu" icon="grid" />
    <div class="x-dash__top">
      <PowerHero />
      <ClockPanel />
    </div>
    <ZoneMap />
    <div class="x-grid2">
      <OpenIncidents />
      <CurrentSchedules />
    </div>
    <Notice tone="ok" icon="database">Odporność na nieprawidłowe wyłączenie: stan sterowania (zasilanie, tryby, playlisty, harmonogramy) jest zapisywany na bieżąco i po ponownym uruchomieniu serwera przywracany do ustawień aktualnych. W prototypie – pamięć przeglądarki (odśwież stronę, aby sprawdzić).</Notice>
  </div>);
}

function PowerHero() {
  const { api, toast } = useClient(); const { can } = useX(); const s = getState();
  const ctrl = s.devices.filter((d) => d.schedule !== 'always');
  const running = ctrl.some((d) => d.power === 'on');
  const manual = s.devices.filter((d) => d.schedule === 'manual').length;
  const av = sel.availability();
  const [ask, setAsk] = useState(null); const [seq, setSeq] = useState(null);
  const run = (mode) => {
    setAsk(null);
    const order = s.devices.slice().sort((a, b) => (ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)) * (mode === 'on' ? 1 : -1));
    const list = order.map((d) => ({ id: d.id, name: d.name, kind: d.kind, skip: d.schedule === 'always' ? 'praca ciągła' : d.power === 'fault' ? 'awaria' : d.power === 'service' ? 'serwis' : null }));
    const r = api.devices.powerAll(mode);
    if (!r.ok) { toast(r.message.pl, 'error'); return; }
    setSeq({ mode, list, step: 0, count: r.count });
  };
  useEffect(() => {
    if (!seq || seq.step > seq.list.length) return;
    const t = setTimeout(() => setSeq((q) => q && { ...q, step: q.step + 1 }), 160);
    return () => clearTimeout(t);
  }, [seq]);
  const done = seq && seq.step > seq.list.length;
  return (<section class={`x-hero${running ? ' is-on' : ''}`}>
    <div class="x-hero__state">
      <span class="x-hero__lbl">Ekspozycja</span>
      <b class="x-hero__val" data-testid="x-expo-state">{running ? 'Uruchomiona' : 'Wyłączona'}</b>
      <span class="x-hero__sub">{av.on} z {av.total} urządzeń działa{av.fault ? ` · ${av.fault} w awarii` : ''}{av.service ? ` · ${av.service} w serwisie` : ''}</span>
    </div>
    <button type="button" class={`x-bigpower${running ? ' is-on' : ''}`} disabled={!can('devices')} onClick={() => setAsk(running ? 'off' : 'on')} data-testid="x-powerall">
      <span class="x-bigpower__ring"><Icon name="power" size={44} stroke={2.4} /></span>
      <span class="x-bigpower__txt">{running ? 'Wyłącz ekspozycję' : 'Uruchom ekspozycję'}</span>
      <small>wszystkie urządzenia, treści i oświetlenie</small>
    </button>
    {manual > 0 && <div class="x-hero__manual"><Icon name="hand" size={15} /><span>Sterowanie ręczne: {manual} urządz. nie podlega harmonogramom.</span>
      <Button size="sm" variant="secondary" icon="refresh" disabled={!can('devices')} onClick={() => { api.devices.setAuto('all'); toast('Przywrócono sterowanie harmonogramem'); }} data-testid="x-auto-all">Przywróć harmonogram</Button></div>}
    <Modal open={!!ask} onClose={() => setAsk(null)} title={ask === 'on' ? 'Uruchomić całą ekspozycję?' : 'Wyłączyć całą ekspozycję?'} size="sm"
      footer={<><Button variant="secondary" onClick={() => setAsk(null)}>Anuluj</Button><Button variant={ask === 'off' ? 'danger' : 'primary'} icon="power" onClick={() => run(ask)} data-testid="x-confirm">{ask === 'on' ? 'Uruchom' : 'Wyłącz'}</Button></>}>
      <p>{ask === 'on' ? 'Urządzenia zostaną uruchomione sekwencyjnie: sieć i serwer → oświetlenie → nagłośnienie → projekcja → ekrany → kioski.' : 'Urządzenia zostaną wyłączone w odwrotnej kolejności. Serwer i sieć pracują w trybie ciągłym.'}</p>
      <Notice tone="warn">Stanowiska w serwisie lub w awarii zostaną pominięte. Sterowanie przejdzie w tryb ręczny do czasu przywrócenia harmonogramu.</Notice>
    </Modal>
    <Modal open={!!seq} onClose={done ? () => setSeq(null) : undefined} title={seq ? (seq.mode === 'on' ? 'Uruchamianie ekspozycji' : 'Wyłączanie ekspozycji') : ''} size="md"
      footer={done && <Button onClick={() => setSeq(null)} data-testid="x-seq-close">Gotowe</Button>}>
      {seq && <>
        <div class="x-seq__bar"><i style={{ width: `${Math.min(100, (seq.step / seq.list.length) * 100)}%` }} /></div>
        <ol class="x-seq">{seq.list.map((d, i) => { const st = d.skip ? 'skip' : i < seq.step ? 'done' : i === seq.step ? 'run' : 'wait'; return (
          <li key={d.id} class={`x-seq__it is-${st}`}><Icon name={KINDS[d.kind]?.icon || 'monitor'} size={16} /><span>{d.name}</span>
            <em>{st === 'skip' ? `pominięto (${d.skip})` : st === 'done' ? (seq.mode === 'on' ? 'uruchomiono' : 'wyłączono') : st === 'run' ? '…' : 'oczekuje'}</em>
            {st === 'done' && <Icon name="check" size={16} />}</li>); })}</ol>
        {done && <Notice tone="ok">{seq.mode === 'on' ? 'Uruchomiono' : 'Wyłączono'} {seq.count} urządzeń.</Notice>}
      </>}
    </Modal>
  </section>);
}

function ClockPanel() {
  const { api } = useClient(); const s = getState(); const { can } = useX();
  const sim = s.env.simTime; const cur = toMin(sel.clock());
  const [drag, setDrag] = useState(null);
  const val = drag ?? cur;
  const setT = (hhmm) => api.env.set({ simTime: hhmm });
  const night = s.devices.filter((d) => d.night).length;
  return (<Panel title="Zegar systemu i symulacja pory dnia" icon="clock" class="x-clock">
    <div class="x-clock__row">
      <div class={`x-clock__face${sim ? ' is-sim' : ''}`}><Icon name={val >= 360 && val < 1080 ? 'sun' : 'moon'} size={26} /><b data-testid="x-clock">{fromMin(val)}</b><span>{sim ? 'czas symulowany' : 'czas rzeczywisty'}</span></div>
      <div class="x-clock__ctl">
        <label class="x-range"><span class="fpz-sr">Godzina symulowana</span>
          <input type="range" min="0" max="1425" step="15" value={val} disabled={!can('schedules') && !can('devices')} onInput={(e) => setDrag(+e.currentTarget.value)} onChange={(e) => { setDrag(null); setT(fromMin(+e.currentTarget.value)); }} aria-label="Godzina symulowana" />
          <span class="x-range__ticks" aria-hidden="true"><i>0</i><i>6</i><i>12</i><i>18</i><i>24</i></span></label>
        <div class="x-clock__btns">
          {['06:30', '12:00', '18:30', '23:30'].map((h) => <button key={h} type="button" class={`x-pill${sim === h ? ' is-on' : ''}`} onClick={() => setT(h)} data-testid={`x-sim-${h}`}>{h}</button>)}
          <input class="x-time" type="time" value={fromMin(val)} aria-label="Ustaw godzinę" onChange={(e) => e.currentTarget.value && setT(e.currentTarget.value)} />
          <Button size="sm" variant={sim ? 'primary' : 'secondary'} icon="refresh" disabled={!sim} onClick={() => api.env.set({ simTime: null })} data-testid="x-realtime">Czas rzeczywisty</Button>
        </div>
      </div>
    </div>
    <p class="x-muted x-small">Zmiana godziny od razu przelicza harmonogramy: wyłączenie nocne, tryb nocny kiosków ({night} urządz. w trybie nocnym), okna serwisowe. Dotyczy urządzeń w trybie automatycznym.</p>
  </Panel>);
}

function ZoneMap() {
  const s = getState(); const { openDevice } = useX();
  return (<Panel title="Mapa stref" icon="map" actions={<div class="x-legend">{Object.entries(POWER).map(([k, p]) => <span key={k} class={`x-pw x-pw--${k}`}><Icon name={p.icon} size={12} />{p.label}</span>)}</div>}>
    <div class="x-zones">{s.zones.map((z) => { const ds = s.devices.filter((d) => d.zone === z.id); const worst = ['fault', 'service', 'off', 'on'].find((p) => ds.some((d) => d.power === p)) || 'off'; return (
      <div key={z.id} class={`x-zone x-zone--${worst}`}>
        <div class="x-zone__head"><b>{z.name}</b><span>{ds.filter((d) => d.power === 'on').length}/{ds.length}</span></div>
        {(worst === 'fault' || worst === 'service') && <div><PowerBadge power={worst} /></div>}
        <div class="x-zone__devs">{ds.map((d) => (<button key={d.id} type="button" class={`x-zdev x-zdev--${d.power}`} onClick={() => openDevice(d.id)} title={`${d.name} – ${POWER[d.power]?.label}`} data-dev={d.id}>
          <Icon name={KINDS[d.kind]?.icon} size={18} /><span class="x-zdev__name">{d.id}</span><span class="x-zdev__st"><Icon name={POWER[d.power]?.icon} size={12} />{POWER[d.power]?.label}{d.night && d.power === 'on' ? ' · noc' : ''}</span></button>))}</div>
      </div>); })}</div>
  </Panel>);
}

function OpenIncidents() {
  const s = getState(); const { go, openDevice } = useX();
  const open = s.incidents.filter((i) => i.status !== 'closed');
  return (<Panel title="Otwarte awarie" icon="alert" actions={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go('incidents')}>Awarie i SLA</Button>}>
    {open.length ? <ul class="x-list">{open.map((i) => { const sla = sel.incidentSla(i); return (
      <li key={i.id}><Tag tone={['P1', 'P2'].includes(i.severity) ? 'danger' : 'warn'}>{i.severity}</Tag><button type="button" class="x-link" onClick={() => openDevice(i.deviceId)}>{devName(i.deviceId)}</button><span class="x-grow">{i.title}</span><span class={sla.fixBreached ? 'x-bad' : 'x-muted'}>{ago(i.createdAt)}</span></li>); })}</ul>
      : <Empty icon="circleCheck" title="Brak otwartych zgłoszeń" text="Wszystkie stanowiska pracują bez zgłoszonych usterek." />}
  </Panel>);
}

function CurrentSchedules() {
  const s = getState(); const { go } = useX(); const now = sel.clock(); const day = new Date().getDay();
  const list = s.schedules.filter((x) => x.active);
  return (<Panel title="Bieżące harmonogramy" icon="calendar" actions={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go('schedules')}>Harmonogramy</Button>}>
    {list.length ? <ul class="x-list">{list.map((x) => { const act = (x.days || []).includes(day) && inWindow(now, x.from, x.to); return (
      <li key={x.id}><Icon name={SCHED_KINDS[x.kind]?.icon} size={16} /><span class="x-grow"><b>{x.name}</b><br /><small class="x-muted">{x.from}–{x.to} · {targetsLabel(x.targets)}</small></span>{act ? <Tag tone="green">teraz aktywny</Tag> : <Tag>poza oknem</Tag>}</li>); })}</ul>
      : <Empty icon="calendar" title="Brak aktywnych harmonogramów" />}
  </Panel>);
}
