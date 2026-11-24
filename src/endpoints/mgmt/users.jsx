// Użytkownicy i uprawnienia: konta personelu, role, blokada, macierz uprawnień.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel, ROLES } from '../../kernel/api.js';
import { fmtDateTime } from '../../kernel/util.js';
import { Icon, Button, Tag, Notice, Select, Field, Input, Modal, Switch } from '../../ui/components.jsx';
import { Head, Panel } from './common.jsx';

const PERMS = [
  ['devices', 'Sterowanie urządzeniami'], ['playlists', 'Treści i playlisty'], ['schedules', 'Harmonogramy'], ['incidents', 'Awarie i powiadomienia'], ['stats', 'Raporty i statystyki'],
  ['tickets.validate', 'Walidacja biletów'], ['orders.refund', 'Zwroty zamówień'], ['content.edit', 'Edycja treści (CMS)'], ['content.publish', 'Publikacja treści'], ['ugc.moderate', 'Moderacja'], ['staff', 'Konta i uprawnienia'],
];

export function Users() {
  const s = getState(); const { api, toast, staff } = useClient();
  const admin = staff?.role === 'admin';
  const [edit, setEdit] = useState(null);
  const save = () => {
    const u = edit; if (!u.login.trim() || !u.name.trim()) return toast('Podaj login i imię', 'error');
    if (s.staff.some((x) => x.login === u.login.trim() && x.id !== u.id)) return toast('Login jest zajęty', 'error');
    if (!u.id && (u.password || '').length < 5) return toast('Hasło musi mieć co najmniej 5 znaków', 'error');
    const rec = { ...u, login: u.login.trim() }; if (!rec.password) delete rec.password;
    const r = api.cms.save('staff', rec); if (!r.ok) return toast(r.message.pl, 'error'); toast(r.created ? 'Utworzono konto' : 'Zapisano konto'); setEdit(null);
  };
  const lastLogin = (id) => s.audit.find((a) => a.staffId === id && a.action === 'Logowanie')?.at;
  return (<div>
    <Head title="Użytkownicy i uprawnienia" sub="Loginy, hasła i role pracowników z dostępem do systemu" icon="key">
      <Button icon="userPlus" disabled={!admin} onClick={() => setEdit({ login: '', name: '', email: '', role: 'technician', password: '', active: true })} data-testid="x-user-new">Nowe konto</Button>
    </Head>
    {!admin && <Notice tone="warn">Zarządzanie kontami jest dostępne wyłącznie dla administratora.</Notice>}
    <Panel title="Konta personelu" icon="people" pad={false}>
      <table class="x-table"><thead><tr><th>Pracownik</th><th>Login</th><th>Rola</th><th>Ostatnie logowanie</th><th>Stan</th><th /></tr></thead><tbody>
        {s.staff.map((u) => <tr key={u.id} class={u.active === false ? 'is-off' : ''}><td><b>{u.name}</b><br /><small class="x-muted">{u.email}</small></td><td><code>{u.login}</code></td><td>{ROLES[u.role]?.name || u.role}</td><td>{lastLogin(u.id) ? fmtDateTime(lastLogin(u.id)) : '—'}</td>
          <td>{u.active === false ? <Tag tone="danger" icon="lock">zablokowane</Tag> : <Tag tone="green">aktywne</Tag>}</td>
          <td class="x-nowrap"><button type="button" class="x-iconbtn" aria-label={`Edytuj ${u.login}`} disabled={!admin} onClick={() => setEdit({ ...u, password: '' })}><Icon name="edit" size={16} /></button>
            <button type="button" class="x-iconbtn" aria-label={u.active === false ? 'Odblokuj' : 'Zablokuj'} title={u.active === false ? 'Odblokuj' : 'Zablokuj'} disabled={!admin || u.id === staff?.id} onClick={() => { api.cms.save('staff', { id: u.id, active: u.active === false }); toast(u.active === false ? 'Odblokowano konto' : 'Zablokowano konto', 'info'); }}><Icon name={u.active === false ? 'key' : 'lock'} size={16} /></button></td></tr>)}
      </tbody></table>
    </Panel>
    <Panel title="Macierz uprawnień ról" icon="shield" pad={false}>
      <div class="x-matrix"><table class="x-table x-table--dense"><thead><tr><th>Uprawnienie</th>{Object.values(ROLES).map((r) => <th key={r.name}>{r.name}</th>)}</tr></thead><tbody>
        {PERMS.map(([p, l]) => <tr key={p}><td>{l}</td>{Object.keys(ROLES).map((k) => { const on = sel.can({ role: k }, p); return <td key={k} class="x-center">{on ? <span class="x-yes" aria-label="tak"><Icon name="check" size={15} /></span> : <span class="x-no" aria-label="nie">–</span>}</td>; })}</tr>)}
      </tbody></table></div>
    </Panel>
    <Modal open={!!edit} onClose={() => setEdit(null)} size="md" title={edit?.id ? 'Edycja konta' : 'Nowe konto'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Anuluj</Button><Button icon="save" onClick={save} data-testid="x-user-save">Zapisz</Button></>}>
      {edit && <>
        <Field label="Imię i nazwisko / opis"><Input value={edit.name} onInput={(e) => setEdit({ ...edit, name: e.currentTarget.value })} /></Field>
        <Field label="Login"><Input value={edit.login} onInput={(e) => setEdit({ ...edit, login: e.currentTarget.value })} /></Field>
        <Field label="E-mail"><Input type="email" value={edit.email} onInput={(e) => setEdit({ ...edit, email: e.currentTarget.value })} /></Field>
        <Field label={edit.id ? 'Nowe hasło (puste = bez zmian)' : 'Hasło'}><Input type="password" value={edit.password} onInput={(e) => setEdit({ ...edit, password: e.currentTarget.value })} autocomplete="new-password" /></Field>
        <Field label="Rola"><Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.currentTarget.value })} options={Object.entries(ROLES).map(([k, r]) => ({ id: k, label: r.name }))} /></Field>
        <Switch label="Konto aktywne" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.currentTarget.checked })} />
      </>}
    </Modal>
  </div>);
}
