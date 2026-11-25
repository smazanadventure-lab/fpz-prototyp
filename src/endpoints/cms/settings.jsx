// CMS – ustawienia: identyfikacja (logotyp), dane obiektu, płatności, pakiet offline, personel i role, dziennik zdarzeń, kopia danych.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { sel, ROLES } from '../../kernel/api.js';
import { deepClone, matches, download, dayStr, fmtDateTime, clsx } from '../../kernel/util.js';
import { Icon, Button, IconButton, Input, Select, Checkbox, SearchInput, Tag, Notice, Logo, Field } from '../../ui/components.jsx';
import { useCms, useRun, useDraft, DataTable, Crud, Form, FieldBox, Head, When, PERM_LABEL, roleName } from './kit.jsx';
import { readFile, fmtSize, imgLimit, isRemote } from './content.jsx';

export function Identity() {
  const s = useStore(); const { api, toast } = useClient(); const run = useRun();
  const up = async (e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (!f) return; if (!/^image\//.test(f.type)) return toast('Wybierz plik graficzny (SVG, PNG, JPG, WebP).', 'error'); const lim = imgLimit(getState(), 600 * 1024); if (f.size > lim) return toast(`Plik ma ${fmtSize(f.size)} – maksymalnie ${fmtSize(lim)}${isRemote(getState()) ? ' (pilotaż serwerowy)' : ''}.`, 'error');
    const dataUrl = await readFile(f); run(api.cms.setSetting({ logo: dataUrl }), `Wgrano własny plik logo „${f.name}” – zastępuje wbudowane logo we wszystkich końcówkach`); };
  return (<div class="c-page"><Head title="Identyfikacja wizualna" sub="Logo Fabryki Pełnej Życia – wyświetlane w aplikacji, na stronie WWW, w kioskach, na ekranach LCD i w panelach" />
    <div class="c-grid2">
      <section class="c-panel"><h3>Logo</h3>
        <div class="c-logopv"><div class="c-logopv__light"><Logo /></div><div class="c-logopv__dark"><Logo onDark /></div></div>
        <p class="c-small c-muted">{s.settings.logo ? 'Wyświetlany jest własny plik wgrany w panelu – zastępuje wbudowane logo; na ciemnych tłach jest automatycznie odwracany na biały.' : 'Domyślnie wyświetlane jest wbudowane logo Fabryki Pełnej Życia – w wersji ciemnej na jasnym tle i białej na ciemnym (kolor dobierany automatycznie). Można je zastąpić własnym plikiem.'}</p>
        <div class="c-row">
          <label class="fpz-btn fpz-btn--primary fpz-btn--sm c-filebtn"><Icon name="upload" size={15} />Wgraj własny plik<input type="file" accept="image/*" class="c-sr" data-testid="logo-upload" onChange={up} /></label>
          <Button size="sm" variant="secondary" icon="undo" disabled={!s.settings.logo} onClick={() => run(api.cms.setSetting({ logo: null }), 'Przywrócono wbudowane logo Fabryki Pełnej Życia')}>Przywróć wbudowane logo</Button>
        </div>
        <Notice tone="info">Własny plik: jednobarwny SVG lub PNG z przezroczystym tłem, w wersji poziomej – na ciemnych tłach (i w motywie nocnym oraz wysokiego kontrastu) jest automatycznie odwracany na biały; do {isRemote(s) ? '300 kB – w pilotażu plik trafia do wspólnego stanu na serwerze' : '600 kB'}.</Notice>
      </section>
      <section class="c-panel"><h3>Zastosowanie</h3><ul class="c-links"><li><Icon name="phone" size={14} /> aplikacja mobilna – nagłówek i ekran startowy</li><li><Icon name="globe" size={14} /> strona WWW / PWA – nagłówek i stopka</li><li><Icon name="monitor" size={14} /> kioski 55″ – nagłówek z pasem identyfikacji</li><li><Icon name="tv" size={14} /> ekrany LCD – plansze informacyjne</li><li><Icon name="ticket" size={14} /> e-maile z biletami (wersja docelowa)</li></ul></section>
    </div>
  </div>);
}

export function SiteData() {
  const s = useStore(); const { api } = useClient(); const run = useRun();
  const [d, setD, set] = useDraft(deepClone(s.site));
  const dirty = JSON.stringify(d) !== JSON.stringify(s.site);
  return (<div class="c-page"><Head title="Dane obiektu" sub="Nazwa, godziny otwarcia, kontakt i media społecznościowe – w stopce WWW, w aplikacji i na kioskach">
    <Button variant="secondary" size="sm" disabled={!dirty} onClick={() => setD(deepClone(s.site))}>Odrzuć zmiany</Button><Button size="sm" icon="save" disabled={!dirty} onClick={() => run(api.cms.setSite(d), 'Zapisano dane obiektu')}>Zapisz</Button></Head>
    <section class="c-panel"><Form draft={d} set={set} fields={[{ k: 'name', label: 'Nazwa', type: 'L' }, { k: 'tagline', label: 'Hasło', type: 'L' }, { k: 'hours', label: 'Godziny otwarcia', type: 'L' }, { k: 'address', label: 'Adres' },
      { k: 'contact.phone', label: 'Telefon' }, { k: 'contact.email', label: 'E-mail' }, { k: 'contact.www', label: 'Strona WWW' }, { k: 'about', label: 'O miejscu', type: 'Ltext', rows: 4 }]} />
      <h4 class="c-form__sec">Media społecznościowe</h4>
      {(d.social || []).map((x, i) => <div class="c-row c-row--end" key={i}><FieldBox label="Serwis"><Select value={x.kind} onChange={(e) => set(`social.${i}.kind`, e.currentTarget.value)}>{['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin'].map((k) => <option key={k} value={k}>{k}</option>)}</Select></FieldBox>
        <FieldBox label="Etykieta"><Input value={x.label} onInput={(e) => set(`social.${i}.label`, e.currentTarget.value)} /></FieldBox><FieldBox label="Adres URL" class="c-grow"><Input value={x.url} onInput={(e) => set(`social.${i}.url`, e.currentTarget.value)} /></FieldBox>
        <IconButton icon="trash" variant="plain" size="sm" label="Usuń" onClick={() => set('social', d.social.filter((_, j) => j !== i))} /></div>)}
      <Button size="sm" variant="secondary" icon="plus" onClick={() => set('social', [...(d.social || []), { kind: 'facebook', label: 'Facebook', url: 'https://' }])}>Dodaj profil</Button>
    </section></div>);
}

const METHODS = [['blik', 'BLIK'], ['card', 'Karta płatnicza'], ['transfer', 'Szybki przelew (pay-by-link)'], ['applepay', 'Apple Pay'], ['googlepay', 'Google Pay']];
export function Payments() {
  const s = useStore(); const { api } = useClient(); const run = useRun(); const [d, setD] = useState(deepClone(s.settings.payments));
  return (<div class="c-page"><Head title="Płatności" sub="Integracja z zewnętrznym operatorem płatności (wybór Zamawiającego) – PSD2/SCA" />
    <section class="c-panel">
      <Field label="Nazwa operatora (wyświetlana klientom)"><Input value={d.operator} onInput={(e) => setD({ ...d, operator: e.currentTarget.value })} /></Field>
      <FieldBox label="Włączone metody płatności"><div class="c-checks">{METHODS.map(([id, l]) => <Checkbox key={id} label={l} checked={d.methods.includes(id)} onChange={(e) => setD({ ...d, methods: e.currentTarget.checked ? [...d.methods, id] : d.methods.filter((x) => x !== id) })} />)}</div></FieldBox>
      <div class="c-row"><Button size="sm" icon="save" disabled={!d.methods.length} onClick={() => run(api.cms.setSetting({ payments: d }), 'Zapisano ustawienia płatności')}>Zapisz</Button>{!d.methods.length && <span class="c-danger c-small">Wybierz co najmniej jedną metodę.</span>}</div>
      <Notice tone="warn">Środowisko testowe (sandbox) – płatności są symulowane, z krokiem silnego uwierzytelnienia (SCA). Klucze API operatora konfiguruje się w wersji docelowej po stronie serwera, nie w przeglądarce.</Notice>
    </section></div>);
}

export function Offline() {
  const s = useStore(); const { api } = useClient(); const run = useRun();
  const [ids, setIds] = useState([...s.settings.offlineEntryIds]); const [q, setQ] = useState('');
  const pub = s.entries.filter((e) => e.status === 'published'); const list = pub.filter((e) => matches(q, e.title.pl));
  const size = JSON.stringify(s.entries.filter((e) => ids.includes(e.id))).length;
  const fpz = pub.filter((e) => sel.poi(e.poiId)?.scope === 'fpz').map((e) => e.id);
  return (<div class="c-page"><Head title="Pakiet offline aplikacji" sub="Treści pobierane do telefonu, dostępne bez połączenia (np. na terenie z ograniczonym zasięgiem)">
    <Button size="sm" icon="save" onClick={() => run(api.cms.setSetting({ offlineEntryIds: ids }), `Zapisano pakiet offline: ${ids.length} wpisów`)}>Zapisz pakiet</Button></Head>
    <section class="c-panel">
      <div class="c-toolbar"><SearchInput value={q} onInput={setQ} placeholder="Szukaj wpisów" /><Button size="sm" variant="ghost" onClick={() => setIds(pub.map((e) => e.id))}>Wszystkie</Button><Button size="sm" variant="ghost" onClick={() => setIds(fpz)}>Tylko teren FPŻ</Button><Button size="sm" variant="ghost" onClick={() => setIds([])}>Żadne</Button>
        <span class="c-grow" /><Tag tone="info" icon="package">{ids.length} wpisów · ok. {fmtSize(size)} tekstu + ilustracje</Tag></div>
      <div class="c-checks c-checks--cols">{list.map((e) => <Checkbox key={e.id} label={e.title.pl} checked={ids.includes(e.id)} onChange={(ev) => setIds(ev.currentTarget.checked ? [...ids, e.id] : ids.filter((x) => x !== e.id))} />)}</div>
      <p class="c-small c-muted">Do pakietu można dodać tylko wpisy opublikowane. Mapa terenu i plan FPŻ są zawsze w pakiecie.</p>
    </section></div>);
}

export function StaffRoles() {
  const s = useStore(); const { staff } = useClient();
  const perms = [...new Set(Object.values(ROLES).flatMap((r) => r.perms).filter((p) => p !== '*')), 'content.publish', 'users', 'push', 'settings', 'staff'];
  return (<div class="c-page"><Head title="Użytkownicy i role" sub="Konta personelu (CMS, zarządzanie ekspozycją, stanowisko bileterskie) i zakres uprawnień ról" />
    <Crud col="staff" title="Personel" noun="konto" perm="settings" search={(x) => [x.login, x.name, x.email]} blank={() => ({ login: '', name: '', role: 'editor', email: '', password: '', active: true })}
      beforeSave={(d) => { if (!d.login?.trim() || !d.name?.trim()) { return null; } if (d.id === staff.id && d.active === false) return null; return d; }}
      deleteWarn={(x) => (x.id === staff.id ? 'To Twoje konto – po usunięciu zostaniesz wylogowany przy następnym logowaniu.' : null)}
      cols={[{ k: 'login', label: 'Login', render: (x) => <b>{x.login}</b> }, { k: 'name', label: 'Imię i nazwisko / funkcja' }, { k: 'role', label: 'Rola', sort: (x) => roleName(x), render: (x) => <Tag tone={x.role === 'admin' ? 'deep' : 'neutral'}>{roleName(x)}</Tag> }, { k: 'email', label: 'E-mail' },
        { k: 'active', label: 'Stan', render: (x) => (x.active === false ? <Tag tone="danger" icon="lock">zablokowane</Tag> : <Tag tone="green">aktywne</Tag>) }]}
      fields={[{ k: 'login', label: 'Login' }, { k: 'name', label: 'Imię i nazwisko / funkcja' }, { k: 'role', label: 'Rola', type: 'select', empty: false, opts: Object.entries(ROLES).map(([id, r]) => ({ id, label: r.name })) }, { k: 'email', label: 'E-mail' },
        { k: 'password', label: 'Hasło (prototyp – jawne)', hint: 'W wersji docelowej: zaproszenie e-mail, hasło ustawia użytkownik, 2FA dla administratorów.' }, { k: 'active', label: 'Konto aktywne (odznacz, aby zablokować)', type: 'switch' }]} modalSize="md" />
    <section class="c-panel"><h3>Macierz uprawnień</h3>
      <div class="c-tablewrap"><table class="c-table c-table--mini c-matrix"><thead><tr><th>Uprawnienie</th>{Object.entries(ROLES).map(([id, r]) => <th key={id} class="c-al-center">{r.name}</th>)}</tr></thead>
        <tbody>{perms.map((p) => <tr key={p}><td>{PERM_LABEL[p] || p} <code class="c-small c-muted">{p}</code></td>{Object.entries(ROLES).map(([id, r]) => { const on = r.perms.includes('*') || r.perms.includes(p); return <td key={id} class="c-al-center">{on ? <Icon name="check" size={16} class="c-ok" title="tak" /> : <span class="c-muted" aria-label="nie">–</span>}</td>; })}</tr>)}</tbody></table></div>
      <p class="c-small c-muted">Uprawnienia ról są sprawdzane przez serwer (np. publikacja wpisu bez „publikacja treści” kończy się odmową FORBIDDEN). Zakres ról ustalany z Zamawiającym.</p>
    </section></div>);
}

export function AuditLog() {
  const s = useStore(); const [who, setWho] = useState(''); const [q, setQ] = useState('');
  const rows = s.audit.map((a, i) => ({ ...a, id: `a${i}` })).filter((a) => (!who || a.staffId === who) && matches(q, a.action, a.target));
  return (<div class="c-page"><Head title="Dziennik zdarzeń" sub="Rejestr operacji personelu (logowania, publikacje, zmiany ustawień, zwroty, usunięcia danych)">
    <Button size="sm" variant="secondary" icon="download" onClick={() => download(`fpz-dziennik-${dayStr()}.csv`, 'czas;osoba;końcówka;akcja;obiekt\n' + rows.map((a) => [a.at, sel.staff(a.staffId)?.login || '', a.client, a.action, a.target].map((x) => `"${String(x || '').replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv')}>Eksport CSV</Button></Head>
    <div class="c-toolbar"><SearchInput value={q} onInput={setQ} placeholder="Szukaj akcji lub obiektu" /><Select value={who} onChange={(e) => setWho(e.currentTarget.value)} aria-label="Osoba"><option value="">Wszystkie osoby</option>{s.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select><span class="c-grow" /><span class="c-count">{rows.length} zdarzeń</span></div>
    <DataTable rows={rows} initial={{ k: 'at', dir: -1 }} empty="Brak zdarzeń" cols={[{ k: 'at', label: 'Czas', render: (a) => <When iso={a.at} /> }, { k: 'staffId', label: 'Osoba', sort: (a) => sel.staff(a.staffId)?.name, render: (a) => sel.staff(a.staffId)?.name || <span class="c-muted">{a.staffId || '—'}</span> }, { k: 'client', label: 'Końcówka' }, { k: 'action', label: 'Akcja', render: (a) => <b>{a.action}</b> }, { k: 'target', label: 'Obiekt' }]} />
  </div>);
}

export function Backup() {
  const s = useStore(); const run = useRun(); const { toast } = useClient(); const [last, setLast] = useState(null);
  const data = () => { const { apiLog, clients, ...rest } = getState(); return { exportedAt: new Date().toISOString(), system: 'FPŻ – prototyp systemu multimedialnego', version: 1, state: rest }; };
  const size = JSON.stringify(data()).length;
  const exp = () => { const name = `fpz-kopia-${dayStr()}.json`; download(name, JSON.stringify(data(), null, 1), 'application/json'); setLast({ name, at: new Date().toISOString() }); toast(`Wyeksportowano kopię danych (${name})`, 'ok'); };
  const cnt = [['Wpisy', s.entries.length], ['Miejsca', s.pois.length], ['Wydarzenia', s.events.length], ['Zamówienia', s.orders.length], ['Bilety', s.tickets.length], ['Wyzwalacze', s.triggers.length], ['Pliki mediów', s.media.length], ['Konta klientów', s.users.length]];
  return (<div class="c-page"><Head title="Kopia danych" sub="Demonstracja polityki kopii zapasowych – eksport pełnego stanu systemu do pliku JSON" />
    <div class="c-grid2">
      <section class="c-panel"><h3>Eksport</h3><dl class="c-dl c-dl--row">{cnt.map(([l, n]) => [<dt key={l + 't'}>{l}</dt>, <dd key={l}>{n}</dd>])}<dt>Rozmiar</dt><dd>{fmtSize(size)}</dd></dl>
        <Button icon="download" onClick={exp}>Eksportuj kopię (JSON)</Button>{last && <p class="c-small c-ok">Ostatni eksport: {last.name} · {fmtDateTime(last.at, 'pl')}</p>}</section>
      <section class="c-panel"><h3>Polityka kopii (wersja docelowa)</h3><ul class="c-links c-small"><li>kopia przyrostowa bazy co 1 h, pełna co dobę (retencja 30 dni)</li><li>kopia plików mediów co dobę, replikacja do drugiej lokalizacji</li><li>szyfrowanie kopii (AES-256), test odtworzenia raz w miesiącu</li><li>dane osobowe w kopiach podlegają tym samym zasadom RODO (umowa powierzenia)</li></ul>
        <Notice tone="info">Plik eksportu zawiera dane osobowe klientów (testowe) – przechowuj go zgodnie z polityką bezpieczeństwa.</Notice></section>
    </div></div>);
}
