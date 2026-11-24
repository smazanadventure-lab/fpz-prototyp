// Harmonogramy: włączanie/wyłączanie o porach dnia, tryb nocny, okna serwisowe + wizualizacja doby.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { Icon, Button, Tag, Notice, Empty, Select, Field, Input, Modal, Switch } from '../../ui/components.jsx';
import { useX, SCHED_KINDS, DAYS, KINDS, Head, Panel, toMin, targetsLabel, inWindow } from './common.jsx';

const blank = () => ({ name: 'Nowy harmonogram', kind: 'power', days: [1, 2, 3, 4, 5, 6, 0], from: '08:00', to: '20:00', targets: ['all'], active: true });

function segs(from, to) { const a = toMin(from), b = toMin(to); return a <= b ? [[a, b]] : [[a, 1440], [0, b]]; }
function svcIssues(x) {
  if (x.kind !== 'service') return [];
  const out = []; const len = ((toMin(x.to) - toMin(x.from)) + 1440) % 1440 || 1440;
  if (len > 120) out.push('okno dłuższe niż 2 godziny');
  if (segs(x.from, x.to).some(([a, b]) => a < 1200 && b > 480)) out.push('okno nachodzi na godziny 8:00–20:00');
  return out;
}

export function Schedules() {
  const s = getState(); const { api, toast } = useClient(); const { can } = useX(); const ok = can('schedules');
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null);
  const now = sel.clock(); const nowM = toMin(now); const day = new Date().getDay();
  return (<div>
    <Head title="Harmonogramy" sub="Automatyczne włączanie i wyłączanie urządzeń o porach dnia, tryb nocny i zdarzenia serwisowe" icon="calendar">
      <Button icon="plus" disabled={!ok} onClick={() => setEdit(blank())} data-testid="x-sch-new">Nowy harmonogram</Button>
    </Head>
    <Panel title={`Doba – ${s.env.simTime ? 'czas symulowany' : 'teraz'} ${now}`} icon="clock" class="x-dayviz">
      <div class="x-day">
        <div class="x-day__scale" aria-hidden="true">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{h}</span>)}</div>
        {s.schedules.map((x) => { const today = (x.days || []).includes(day); const act = x.active && today && inWindow(now, x.from, x.to); return (
          <div key={x.id} class={`x-day__row${x.active ? '' : ' is-off'}`}>
            <span class="x-day__name"><Icon name={SCHED_KINDS[x.kind]?.icon} size={14} />{x.name}</span>
            <span class="x-day__track">{segs(x.from, x.to).map(([a, b], k) => <i key={k} class={`x-day__seg x-day__seg--${x.kind}${act ? ' is-now' : ''}`} style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }} title={`${x.from}–${x.to}`} />)}</span>
          </div>); })}
        <div class="x-day__now" style={{ left: `calc(var(--x-dayname) + (100% - var(--x-dayname)) * ${nowM / 1440})` }}><b>{now}</b></div>
      </div>
      <div class="x-legend"><span class="x-lg x-lg--power">włączone</span><span class="x-lg x-lg--night">tryb nocny</span><span class="x-lg x-lg--service">okno serwisowe</span></div>
    </Panel>
    {s.schedules.length ? <div class="x-schlist">{s.schedules.map((x) => { const iss = svcIssues(x); const act = x.active && (x.days || []).includes(day) && inWindow(now, x.from, x.to); return (
      <article key={x.id} class={`x-sch${x.active ? '' : ' is-off'}`} data-sch={x.id}>
        <span class={`x-sch__ic x-sch__ic--${x.kind}`}><Icon name={SCHED_KINDS[x.kind]?.icon} size={20} /></span>
        <div class="x-grow">
          <b>{x.name}</b>
          <div class="x-sch__meta"><Tag>{SCHED_KINDS[x.kind]?.label}</Tag><span><Icon name="clock" size={13} />{x.from}–{x.to}</span><span><Icon name="calendar" size={13} />{DAYS.filter((d) => (x.days || []).includes(d.id)).map((d) => d.label).join(' ') || '—'}</span><span><Icon name="layers" size={13} />{targetsLabel(x.targets)}</span></div>
          {iss.length > 0 && <small class="x-bad"><Icon name="alert" size={13} /> Niezgodne z regułą okien serwisowych: {iss.join(', ')}.</small>}
        </div>
        {act && <Tag tone="green">aktywny teraz</Tag>}
        <Switch label={x.active ? 'Aktywny' : 'Wyłączony'} checked={x.active} disabled={!ok} onChange={(e) => { api.cms.save('schedules', { id: x.id, active: e.currentTarget.checked }); toast(e.currentTarget.checked ? 'Harmonogram włączony' : 'Harmonogram wyłączony'); }} />
        <button type="button" class="x-iconbtn" aria-label="Edytuj" disabled={!ok} onClick={() => setEdit({ ...x, days: [...(x.days || [])], targets: [...x.targets] })}><Icon name="edit" size={17} /></button>
        <button type="button" class="x-iconbtn x-iconbtn--danger" aria-label="Usuń" disabled={!ok} onClick={() => setDel(x)}><Icon name="trash" size={17} /></button>
      </article>); })}</div> : <Empty icon="calendar" title="Brak harmonogramów" />}
    <Notice icon="wrench">Reguła okien serwisowych (umowa SLA): maksymalnie 2 razy w miesiącu, każde do 2 godzin, poza godzinami 8:00–20:00, z zapowiedzią przekazaną Zamawiającemu co najmniej 72 godziny wcześniej.</Notice>
    {edit && <Editor init={edit} onClose={() => setEdit(null)} />}
    <Modal open={!!del} onClose={() => setDel(null)} size="sm" title="Usunąć harmonogram?" footer={<><Button variant="secondary" onClick={() => setDel(null)}>Anuluj</Button><Button variant="danger" icon="trash" onClick={() => { api.cms.remove('schedules', del.id); setDel(null); toast('Usunięto harmonogram'); }}>Usuń</Button></>}><p>„{del?.name}”</p></Modal>
  </div>);
}

function Editor({ init, onClose }) {
  const s = getState(); const { api, toast } = useClient();
  const [f, setF] = useState(init); const up = (p) => setF({ ...f, ...p });
  const mode = f.targets.includes('all') ? 'all' : f.targets.some((t) => t.startsWith('z-')) ? 'zone' : 'devices';
  const iss = svcIssues(f);
  const save = () => {
    if (!f.name.trim()) return toast('Podaj nazwę', 'error'); if (!f.days.length) return toast('Wybierz dni tygodnia', 'error'); if (!f.targets.length) return toast('Wybierz cele harmonogramu', 'error');
    const r = api.cms.save('schedules', f); if (!r.ok) return toast(r.message.pl, 'error');
    toast(r.created ? 'Dodano harmonogram – urządzenia przeliczone' : 'Zapisano harmonogram'); onClose();
  };
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (<Modal open onClose={onClose} size="lg" title={init.id ? 'Edycja harmonogramu' : 'Nowy harmonogram'} footer={<><Button variant="secondary" onClick={onClose}>Anuluj</Button><Button icon="save" onClick={save} data-testid="x-sch-save">Zapisz</Button></>}>
    <Field label="Nazwa"><Input value={f.name} onInput={(e) => up({ name: e.currentTarget.value })} data-testid="x-sch-name" /></Field>
    <div class="x-fieldset"><span class="x-lbl">Rodzaj</span><div class="x-seg x-seg--wide">{Object.entries(SCHED_KINDS).map(([k, v]) => <button key={k} type="button" class={f.kind === k ? 'is-on' : ''} aria-pressed={f.kind === k} onClick={() => up({ kind: k })} data-kind={k}><Icon name={v.icon} size={15} />{v.label}</button>)}</div></div>
    <div class="x-fieldset"><span class="x-lbl">Dni tygodnia</span><div class="x-days">{DAYS.map((d) => <button key={d.id} type="button" class={`x-pill${f.days.includes(d.id) ? ' is-on' : ''}`} aria-pressed={f.days.includes(d.id)} onClick={() => up({ days: toggle(f.days, d.id) })}>{d.label}</button>)}</div></div>
    <div class="x-row2">
      <Field label={f.kind === 'power' ? 'Włączenie o' : 'Od'}><Input type="time" value={f.from} onInput={(e) => up({ from: e.currentTarget.value })} data-testid="x-sch-from" /></Field>
      <Field label={f.kind === 'power' ? 'Wyłączenie o' : 'Do'}><Input type="time" value={f.to} onInput={(e) => up({ to: e.currentTarget.value })} data-testid="x-sch-to" /></Field>
    </div>
    <div class="x-fieldset"><span class="x-lbl">Cele</span>
      <div class="x-seg x-seg--wide">{[['all', 'Cała ekspozycja'], ['zone', 'Strefy'], ['devices', 'Wybrane urządzenia']].map(([k, l]) => <button key={k} type="button" class={mode === k ? 'is-on' : ''} aria-pressed={mode === k} onClick={() => up({ targets: k === 'all' ? ['all'] : k === 'zone' ? [s.zones[0].id] : [] })} data-mode={k}>{l}</button>)}</div>
      {mode === 'zone' && <div class="x-days">{s.zones.map((z) => <button key={z.id} type="button" class={`x-pill${f.targets.includes(z.id) ? ' is-on' : ''}`} aria-pressed={f.targets.includes(z.id)} onClick={() => up({ targets: toggle(f.targets, z.id) })}>{z.name}</button>)}</div>}
      {mode === 'devices' && <ul class="x-assign x-assign--cols">{s.devices.map((d) => <li key={d.id}><label class="x-check"><input type="checkbox" checked={f.targets.includes(d.id)} onChange={() => up({ targets: toggle(f.targets, d.id) })} data-target={d.id} /><Icon name={KINDS[d.kind]?.icon} size={15} /><span>{d.name}</span></label></li>)}</ul>}
    </div>
    <Switch label="Harmonogram aktywny" checked={f.active} onChange={(e) => up({ active: e.currentTarget.checked })} />
    {f.kind === 'power' && <Notice>Urządzenia w trybie automatycznym są włączone w podanym przedziale i wyłączone poza nim. Serwer i sieć pracują w trybie ciągłym.</Notice>}
    {f.kind === 'service' && (iss.length ? <Notice tone="warn">Okno niezgodne z umową SLA: {iss.join(', ')}. Dopuszczalne: maks. 2× w miesiącu, do 2 h, poza 8:00–20:00, zapowiedź 72 h wcześniej.</Notice> : <Notice tone="ok">Okno zgodne z regułą SLA. Pamiętaj o zapowiedzi co najmniej 72 h wcześniej (maks. 2× w miesiącu).</Notice>)}
  </Modal>);
}
