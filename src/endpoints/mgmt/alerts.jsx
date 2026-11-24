// Powiadomienia: reguły alertów e-mail/SMS i dziennik wysłanych wiadomości.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { fmtDateTime } from '../../kernel/util.js';
import { Icon, Button, Tag, Empty, Select, Field, Input, Modal, Switch, Chips } from '../../ui/components.jsx';
import { useX, Head, Panel } from './common.jsx';

const EVENTS = { fault: 'Awaria dowolnego stanowiska', 'fault-critical': 'Awaria krytyczna (P1/P2)', offline: 'Urządzenie offline > 5 min', service: 'Rozpoczęcie okna serwisowego', backup: 'Błąd kopii zapasowej' };
const CH = { email: { label: 'E-mail', icon: 'mail' }, sms: { label: 'SMS', icon: 'phone' }, push: { label: 'Push', icon: 'bell' } };

export function Alerts() {
  const s = getState(); const { api, toast } = useClient(); const { can } = useX(); const ok = can('incidents');
  const [edit, setEdit] = useState(null); const [f, setF] = useState('');
  const log = s.outbox.filter((o) => (f ? o.kind === f : o.kind !== 'push'));
  const save = () => {
    const r = edit; if (!r.recipient.trim()) return toast('Podaj odbiorcę', 'error');
    if (r.channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.recipient)) return toast('Niepoprawny adres e-mail', 'error');
    if (r.channel === 'sms' && !/^\+?[\d\s]{9,15}$/.test(r.recipient)) return toast('Niepoprawny numer telefonu', 'error');
    const res = api.cms.save('alertRules', { ...r, name: r.name.trim() || `${EVENTS[r.event]} → ${CH[r.channel].label}` }); if (!res.ok) return toast(res.message.pl, 'error');
    toast('Zapisano regułę'); setEdit(null);
  };
  return (<div>
    <Head title="Powiadomienia" sub="Wysyłanie powiadomień o zdarzeniach na wskazane adresy e-mail i numery SMS" icon="bell">
      <Button icon="plus" disabled={!ok} onClick={() => setEdit({ name: '', event: 'fault', channel: 'email', recipient: '', active: true })} data-testid="x-rule-new">Nowa reguła</Button>
    </Head>
    <Panel title="Reguły alertów" icon="sliders" pad={false}>
      {s.alertRules.length ? <table class="x-table"><thead><tr><th>Reguła</th><th>Zdarzenie</th><th>Kanał</th><th>Odbiorca</th><th>Aktywna</th><th /></tr></thead><tbody>
        {s.alertRules.map((r) => <tr key={r.id} data-rule={r.id}><td><b>{r.name}</b></td><td>{EVENTS[r.event] || r.event}</td><td><Tag icon={CH[r.channel]?.icon}>{CH[r.channel]?.label}</Tag></td><td><code>{r.recipient}</code></td>
          <td><Switch label={r.active ? 'tak' : 'nie'} checked={r.active} disabled={!ok} onChange={(e) => api.cms.save('alertRules', { id: r.id, active: e.currentTarget.checked })} /></td>
          <td class="x-nowrap"><button type="button" class="x-iconbtn" aria-label="Edytuj regułę" disabled={!ok} onClick={() => setEdit({ ...r })}><Icon name="edit" size={16} /></button><button type="button" class="x-iconbtn x-iconbtn--danger" aria-label="Usuń regułę" disabled={!ok} onClick={() => { api.cms.remove('alertRules', r.id); toast('Usunięto regułę'); }}><Icon name="trash" size={16} /></button></td></tr>)}
      </tbody></table> : <div class="x-pad"><Empty icon="bell" title="Brak reguł" /></div>}
    </Panel>
    <Panel title="Dziennik wysłanych powiadomień" icon="send" actions={<Chips options={[{ id: '', label: 'E-mail i SMS' }, { id: 'email', label: 'E-mail' }, { id: 'sms', label: 'SMS' }, { id: 'push', label: 'Push' }]} value={f} onChange={setF} />}>
      {log.length ? <ul class="x-outbox">{log.slice(0, 60).map((o) => <li key={o.id} data-out={o.kind}>
        <span class={`x-outbox__ic x-outbox__ic--${o.kind}`}><Icon name={CH[o.kind]?.icon || 'mail'} size={16} /></span>
        <div class="x-grow"><b>{o.subject}</b><small class="x-muted">do: {o.to || 'wszyscy'} · {CH[o.kind]?.label}</small><p>{o.body}</p></div><time>{fmtDateTime(o.at)}</time></li>)}</ul>
        : <Empty icon="mail" title="Brak wiadomości" />}
      <p class="x-muted x-small">Wersja testowa – wiadomości nie są wysyłane, trafiają wyłącznie do tego dziennika.</p>
    </Panel>
    <Modal open={!!edit} onClose={() => setEdit(null)} size="md" title={edit?.id ? 'Edycja reguły' : 'Nowa reguła alertu'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Anuluj</Button><Button icon="save" onClick={save} data-testid="x-rule-save">Zapisz</Button></>}>
      {edit && <>
        <Field label="Nazwa (opcjonalnie)"><Input value={edit.name} onInput={(e) => setEdit({ ...edit, name: e.currentTarget.value })} /></Field>
        <Field label="Zdarzenie"><Select value={edit.event} onChange={(e) => setEdit({ ...edit, event: e.currentTarget.value })} options={Object.entries(EVENTS).map(([k, v]) => ({ id: k, label: v }))} /></Field>
        <Field label="Kanał"><Select value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.currentTarget.value })} options={[{ id: 'email', label: 'E-mail' }, { id: 'sms', label: 'SMS' }]} /></Field>
        <Field label={edit.channel === 'sms' ? 'Numer telefonu' : 'Adres e-mail'}><Input value={edit.recipient} onInput={(e) => setEdit({ ...edit, recipient: e.currentTarget.value })} data-testid="x-rule-to" /></Field>
        <Switch label="Reguła aktywna" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.currentTarget.checked })} />
      </>}
    </Modal>
  </div>);
}
