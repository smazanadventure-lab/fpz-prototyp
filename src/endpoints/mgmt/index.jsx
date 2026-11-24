// System Zarządzania Ekspozycją i Infrastrukturą IT (końcówka „mgmt”).
import { useState } from 'preact/hooks';
import { Client, useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel, makeApi, ROLES } from '../../kernel/api.js';
import { Icon, Button, Logo, ScaleBox, Field, Input, Notice, Tag } from '../../ui/components.jsx';
import { XCtx, useTick } from './common.jsx';
import { Dashboard } from './dashboard.jsx';
import { Devices, DeviceModal } from './devices.jsx';
import { Playlists } from './playlists.jsx';
import { Schedules } from './schedules.jsx';
import { Live } from './live.jsx';
import { Incidents } from './incidents.jsx';
import { Alerts } from './alerts.jsx';
import { Reports } from './reports.jsx';
import { Users } from './users.jsx';
import './mgmt.css';

if (typeof window !== 'undefined') window.__fpzMgmt = { getState, makeApi };

const SECTIONS = [
  { id: 'dash', label: 'Pulpit', icon: 'grid', C: Dashboard },
  { id: 'devices', label: 'Urządzenia', icon: 'monitor', C: Devices },
  { id: 'content', label: 'Treści i playlisty', icon: 'playlist', C: Playlists },
  { id: 'schedules', label: 'Harmonogramy', icon: 'calendar', C: Schedules },
  { id: 'live', label: 'Transmisje i napisy', icon: 'captions', C: Live },
  { id: 'incidents', label: 'Awarie i SLA', icon: 'alert', C: Incidents },
  { id: 'alerts', label: 'Powiadomienia', icon: 'bell', C: Alerts },
  { id: 'reports', label: 'Raporty', icon: 'chart', C: Reports },
  { id: 'users', label: 'Użytkownicy', icon: 'key', C: Users },
];

export default function MgmtApp() {
  return <Client id="mgmt" base={14} class="ep-mgmt"><Root /></Client>;
}

function Root() {
  const { staff, client } = useClient();
  if (!staff) return <Login />;
  if (client.xView === 'tablet') {
    return (<div class="x-stage">
      <div class="x-stage__note"><Icon name="tablet" size={15} />Podgląd: tablet bezprzewodowy 1180 × 820 – interfejs dotykowy z większymi celami</div>
      <ScaleBox width={1228} height={868}><div class="x-tablet"><div class="x-tablet__cam" aria-hidden="true" /><div class="x-tablet__screen"><App touch /></div></div></ScaleBox>
    </div>);
  }
  return <App />;
}

function Login() {
  const { api, toast } = useClient();
  const [login, setLogin] = useState('technik'); const [pass, setPass] = useState('technik'); const [err, setErr] = useState('');
  const go = (l, p) => { const r = api.staff.login(l, p); if (!r.ok) { setErr(r.message.pl); return; } toast(`Zalogowano: ${r.staff.name}`); };
  const pick = (l) => { setLogin(l); setPass(l); setErr(''); };
  const q = (l, icon, name) => { const on = login === l && pass === l; return <button type="button" class={`x-quick${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => pick(l)} data-testid={`x-login-acc-${l}`}><Icon name={icon} size={16} />{l}<small>{name}</small></button>; };
  return (<div class="x-login">
    <form class="x-login__card" onSubmit={(e) => { e.preventDefault(); go(login, pass); }}>
      <div class="x-login__brand"><Logo /><span>System Zarządzania Ekspozycją<br />i Infrastrukturą IT</span></div>
      <h1>Logowanie służb technicznych</h1>
      <p class="x-muted">Dostęp wyłącznie dla pracowników z autoryzowanym kontem. Działa w przeglądarce komputera i na tablecie.</p>
      <Field label="Login"><Input value={login} onInput={(e) => setLogin(e.currentTarget.value)} autocomplete="username" name="x-login" /></Field>
      <Field label="Hasło" error={err}><Input type="password" value={pass} onInput={(e) => setPass(e.currentTarget.value)} autocomplete="current-password" name="x-pass" /></Field>
      <Button type="submit" size="lg" icon="login" block data-testid="x-login-submit">Zaloguj</Button>
      <p class="x-login__note"><Icon name="info" size={14} />Makieta logowania – dane konta testowego są wypełnione.</p>
      <div class="x-login__quick"><span>Konta testowe (wpisz dane):</span>
        {q('technik', 'wrench', 'Służby techniczne')}
        {q('admin', 'shield', 'Administrator')}
      </div>
      <Notice>Wersja testowa – logowanie symulowane (login = hasło).</Notice>
    </form>
  </div>);
}

function App({ touch }) {
  const { client, set, staff, api, toast } = useClient(); useTick(15000);
  const s = getState();
  const [dev, setDev] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const section = SECTIONS.find((x) => x.id === client.xSection) || SECTIONS[0];
  const can = (p) => sel.can(staff, p);
  const go = (id) => { set({ xSection: id }); setNavOpen(false); };
  const ctx = { go, openDevice: setDev, can, touch };
  const openInc = s.incidents.filter((i) => i.status !== 'closed').length;
  const av = sel.availability();
  const C = section.C;
  return (<XCtx.Provider value={ctx}>
    <div class={`x-app${touch ? ' x-app--touch' : ''}`}>
      <header class="x-top">
        <button type="button" class="x-top__menu" aria-label="Menu sekcji" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}><Icon name="menu" size={20} /></button>
        <div class="x-top__brand"><Logo compact /><div><b>Zarządzanie ekspozycją</b><span>System Zarządzania Ekspozycją i Infrastrukturą IT</span></div></div>
        <div class="x-top__status" aria-live="polite">
          <span class="x-chipstat x-chipstat--on" title="Działa"><Icon name="circleCheck" size={14} />{av.on}</span>
          {av.fault > 0 && <span class="x-chipstat x-chipstat--fault" title="Awaria"><Icon name="circleAlert" size={14} />{av.fault}</span>}
          {av.service > 0 && <span class="x-chipstat x-chipstat--service" title="Serwis"><Icon name="wrench" size={14} />{av.service}</span>}
          <span class="x-top__clock" title={s.env.simTime ? 'Czas symulowany' : 'Czas rzeczywisty'}><Icon name="clock" size={14} />{sel.clock()}{s.env.simTime && <Tag tone="warn">symulacja</Tag>}</span>
        </div>
        <div class="x-seg" role="group" aria-label="Widok">
          <button type="button" class={!touch ? 'is-on' : ''} aria-pressed={!touch} onClick={() => set({ xView: 'desktop' })}><Icon name="monitor" size={15} /><span>Komputer</span></button>
          <button type="button" class={touch ? 'is-on' : ''} aria-pressed={!!touch} onClick={() => set({ xView: 'tablet' })}><Icon name="tablet" size={15} /><span>Tablet</span></button>
        </div>
        <div class="x-top__user"><span class="x-avatar" aria-hidden="true">{staff.name[0]}</span><div><b>{staff.name}</b><span>{ROLES[staff.role]?.name}</span></div>
          <button type="button" class="x-iconbtn" aria-label="Wyloguj" title="Wyloguj" onClick={() => { api.staff.logout(); toast('Wylogowano', 'info'); }}><Icon name="logout" size={18} /></button></div>
      </header>
      <div class="x-body">
        <nav class={`x-nav${navOpen ? ' is-open' : ''}`} aria-label="Sekcje systemu">
          {SECTIONS.map((x) => (<button key={x.id} type="button" class={`x-nav__it${x.id === section.id ? ' is-active' : ''}`} aria-current={x.id === section.id ? 'page' : undefined} onClick={() => go(x.id)}>
            <Icon name={x.icon} size={19} /><span>{x.label}</span>{x.id === 'incidents' && openInc > 0 && <i class="x-nav__badge">{openInc}</i>}</button>))}
          <div class="x-nav__foot"><Icon name="shield" size={14} />Stan sterowania utrwalany – po awarii zasilania serwera system wraca do bieżących ustawień.</div>
        </nav>
        <main class="x-main" key={section.id}>
          {!can('devices') && section.id !== 'users' && section.id !== 'reports' && <Notice tone="warn">Twoja rola ({ROLES[staff.role]?.name}) ma dostęp tylko do podglądu tej sekcji.</Notice>}
          <C />
        </main>
      </div>
    </div>
    {dev && <DeviceModal id={dev} onClose={() => setDev(null)} />}
  </XCtx.Provider>);
}
