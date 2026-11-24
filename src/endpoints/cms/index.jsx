// Panel CMS – jedno miejsce zarządzania treścią aplikacji mobilnej, strony WWW, kiosków, gry terenowej i systemu rezerwacji.
import { useState, useEffect, useRef } from 'preact/hooks';
import { Client, useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { sel, ROLES } from '../../kernel/api.js';
import { clsx, matches } from '../../kernel/util.js';
import { Icon, Button, IconButton, Modal, Input, Logo, Notice, Tag, Field } from '../../ui/components.jsx';
import { CmsCtx, SubNav, Denied, roleName, denyText } from './kit.jsx';
import Dashboard from './dashboard.jsx';
import { Entries, Categories, NewsCrud, GalleryCrud, VideosCrud, MediaLibrary } from './content.jsx';
import Places from './places.jsx';
import Triggers from './triggers.jsx';
import { GameRoutes, Quizzes, Rewards, Coupons, Hotspots, GameStats } from './game.jsx';
import { Venues, Events, Products, Orders, Inquiries, Customers } from './offer.jsx';
import Community from './community.jsx';
import Translations from './translations.jsx';
import Notifications from './notify.jsx';
import { Identity, SiteData, Payments, Offline, StaffRoles, AuditLog, Backup } from './settings.jsx';
import './cms.css';

const anyOf = (can, p) => [].concat(p || []).length === 0 || [].concat(p).some(can);
/** Mapa panelu: sekcje → podsekcje (z wymaganym uprawnieniem). */
export const SECTIONS = [
  { id: 'dash', label: 'Pulpit', icon: 'chart', C: Dashboard },
  { id: 'content', label: 'Treści', icon: 'file', perm: 'content.view', subs: [
    { id: 'entries', label: 'Wpisy', icon: 'file', C: Entries, perm: 'content.view' }, { id: 'categories', label: 'Kategorie', icon: 'folder', C: Categories, perm: 'content.view' },
    { id: 'news', label: 'Aktualności', icon: 'news', C: NewsCrud, perm: 'content.view' }, { id: 'gallery', label: 'Galeria', icon: 'image', C: GalleryCrud, perm: 'content.view' },
    { id: 'videos', label: 'Filmy', icon: 'film', C: VideosCrud, perm: 'content.view' }, { id: 'media', label: 'Biblioteka mediów', icon: 'upload', C: MediaLibrary, perm: 'media' }] },
  { id: 'places', label: 'Miejsca i mapa', icon: 'mapPin', perm: 'content.view', C: Places },
  { id: 'triggers', label: 'Wyzwalacze QR · BLE · AR', short: 'Wyzwalacze', icon: 'qr', perm: 'triggers', C: Triggers },
  { id: 'game', label: 'Gra terenowa', icon: 'game', perm: 'game.edit', subs: [
    { id: 'routes', label: 'Trasy i misje', icon: 'route', C: GameRoutes }, { id: 'quizzes', label: 'Quizy', icon: 'quiz', C: Quizzes }, { id: 'rewards', label: 'Nagrody', icon: 'gift', C: Rewards },
    { id: 'coupons', label: 'Kupony', icon: 'coupon', C: Coupons }, { id: 'panorama', label: 'Panorama 360°', icon: 'panorama', C: Hotspots }, { id: 'gstats', label: 'Statystyki gry', icon: 'trophy', C: GameStats }] },
  { id: 'offer', label: 'Oferta i rezerwacje', short: 'Oferta', icon: 'ticket', perm: ['offer.edit', 'orders.view', 'inquiries'], subs: [
    { id: 'venues', label: 'Obiekty', icon: 'store', C: Venues, perm: 'offer.edit' }, { id: 'events', label: 'Wydarzenia', icon: 'calendar', C: Events, perm: 'offer.edit' },
    { id: 'products', label: 'Bilety, strefy, pakiety', icon: 'ticket', C: Products, perm: 'offer.edit' }, { id: 'orders', label: 'Zamówienia', icon: 'receipt', C: Orders, perm: 'orders.view' },
    { id: 'inquiries', label: 'Zapytania o termin', icon: 'message', C: Inquiries, perm: 'inquiries' }, { id: 'customers', label: 'Klienci', icon: 'people', C: Customers, perm: 'users' }] },
  { id: 'community', label: 'Społeczność i moderacja', short: 'Społeczność', icon: 'community', perm: 'ugc.moderate', C: Community },
  { id: 'i18n', label: 'Tłumaczenia', icon: 'languages', perm: 'translations', C: Translations },
  { id: 'push', label: 'Powiadomienia', icon: 'bell', perm: 'push', C: Notifications },
  { id: 'settings', label: 'Ustawienia', icon: 'settings', perm: 'settings', subs: [
    { id: 'identity', label: 'Identyfikacja', icon: 'image', C: Identity }, { id: 'site', label: 'Dane obiektu', icon: 'building', C: SiteData }, { id: 'payments', label: 'Płatności', icon: 'card', C: Payments },
    { id: 'offline', label: 'Pakiet offline', icon: 'wifiOff', C: Offline }, { id: 'staff', label: 'Użytkownicy i role', icon: 'shield', C: StaffRoles }, { id: 'audit', label: 'Dziennik zdarzeń', icon: 'activity', C: AuditLog },
    { id: 'backup', label: 'Kopia danych', icon: 'database', C: Backup }] },
];

export default function CmsApp() {
  return <Client id="cms" base={14} class="ep-cms"><App /></Client>;
}

function App() {
  const { staff, api } = useClient();
  useEffect(() => { if (typeof window !== 'undefined') window.__fpzCms = { getState, sel, api }; }, []);
  return staff ? <Shell /> : <Login />;
}

/* ── logowanie ── */
const DEMO = [['admin', 'Administrator', 'pełny dostęp, publikacja, ustawienia, użytkownicy'], ['redaktor', 'Redaktor', 'treści, media, tłumaczenia, gra, oferta, wyzwalacze – bez publikacji'], ['moderator', 'Moderator', 'moderacja pomysłów (UGC), zapytania o termin, podgląd treści']];
function Login() {
  const { api } = useClient(); const [login, setLogin] = useState('admin'); const [pw, setPw] = useState('admin'); const [err, setErr] = useState('');
  const go = (l, p) => { const r = api.staff.login(l, p); if (!r.ok) setErr(r.message.pl); };
  const pick = (l) => { setLogin(l); setPw(l); setErr(''); };
  return (<div class="c-login">
    <div class="c-login__card">
      <div class="c-login__brand"><Logo /><span>Panel CMS</span></div>
      <h1>Logowanie do panelu</h1>
      <form class="c-login__form" onSubmit={(e) => { e.preventDefault(); go(login, pw); }}>
        <Field label="Login"><Input value={login} autocomplete="username" name="c-login" onInput={(e) => setLogin(e.currentTarget.value)} /></Field>
        <Field label="Hasło"><Input type="password" value={pw} autocomplete="current-password" name="c-pass" onInput={(e) => setPw(e.currentTarget.value)} /></Field>
        {err && <Notice tone="danger">{err}</Notice>}
        <Button type="submit" icon="key" size="lg" block data-testid="c-login-submit">Zaloguj</Button>
        <p class="c-login__note"><Icon name="info" size={14} />Makieta logowania – dane konta testowego są wypełnione.</p>
      </form>
      <div class="c-login__demo">
        <b>Konta testowe – wybierz, aby wpisać dane</b>
        {DEMO.map(([l, n, d]) => { const on = login === l && pw === l; return <button key={l} type="button" class={`c-login__acc${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => pick(l)} data-testid={`c-login-acc-${l}`}><Icon name="user" size={18} /><span><b>{n}</b><small>{l} / {l} · {d}</small></span>{on && <Icon name="check" size={16} />}</button>; })}
      </div>
      <p class="c-muted c-small">Wersja testowa – konta demonstracyjne (login = hasło). W wersji docelowej logowanie z polityką haseł i rejestrem dostępu.</p>
    </div>
  </div>);
}

/* ── układ panelu ── */
function Shell() {
  const s = useStore(); const { client, set, staff, api } = useClient();
  const can = (p) => sel.can(staff, p);
  const [openId, setOpenId] = useState(null); const [confirm, setConfirm] = useState(null);
  const secId = client.sec || 'dash'; const sec = SECTIONS.find((x) => x.id === secId) || SECTIONS[0];
  const subs = sec.subs || null; const subId = subs ? (subs.find((x) => x.id === client.sub) ? client.sub : (subs.find((x) => !x.perm || can(x.perm)) || subs[0]).id) : null; const sub = subs?.find((x) => x.id === subId);
  const go = (section, subsection, id) => { set({ sec: section, sub: subsection || null }); setOpenId(id || null); mainRef.current?.scrollTo?.(0, 0); };
  const ctx = { can, staff, go, openId, clearOpen: () => setOpenId(null), ask: setConfirm };
  const mainRef = useRef(null);
  const badges = { content: s.entries.filter((e) => e.status === 'review').length, community: s.ideas.filter((i) => i.status === 'pending').length, offer: s.inquiries.filter((i) => i.status === 'new').length };
  const subBadges = { entries: badges.content, inquiries: badges.offer };
  const allowed = anyOf(can, sec.perm) && (!sub?.perm || can(sub.perm));
  const Body = (sub || sec).C;
  const needPerm = !anyOf(can, sec.perm) ? [].concat(sec.perm)[0] : sub?.perm;
  return (<CmsCtx.Provider value={ctx}>
    <div class={clsx('c-app', client.collapsed && 'is-collapsed')}>
      <aside class="c-side" aria-label="Sekcje panelu">
        <div class="c-side__brand"><Logo onDark compact /><span class="c-side__bt"><b>Panel CMS</b><small>Fabryka Pełna Życia</small></span></div>
        <nav class="c-side__nav">{SECTIONS.map((x) => { const ok = anyOf(can, x.perm); return (
          <button key={x.id} type="button" class={clsx('c-side__it', x.id === sec.id && 'is-on', !ok && 'is-locked')} aria-current={x.id === sec.id ? 'page' : undefined} title={ok ? x.label : denyText([].concat(x.perm)[0], staff)} onClick={() => go(x.id)}>
            <Icon name={x.icon} size={19} /><span class="c-side__lbl">{x.short || x.label}</span>{!ok ? <Icon name="lock" size={13} class="c-side__lock" /> : badges[x.id] ? <span class="c-badge">{badges[x.id]}</span> : null}</button>); })}</nav>
        <div class="c-side__foot"><Tag tone="deep">Wersja testowa</Tag><button type="button" class="c-side__collapse" onClick={() => set({ collapsed: !client.collapsed })} aria-label={client.collapsed ? 'Rozwiń menu' : 'Zwiń menu'}><Icon name={client.collapsed ? 'arrowRight' : 'back'} size={16} /></button></div>
      </aside>
      <div class="c-main">
        <header class="c-top">
          <nav class="c-crumbs" aria-label="Okruszki"><button type="button" onClick={() => go('dash')}><Icon name="home" size={15} /><span class="c-sr">Pulpit</span></button>
            <span>/</span><button type="button" onClick={() => go(sec.id)}>{sec.label}</button>{sub && <><span>/</span><b>{sub.label}</b></>}</nav>
          <GlobalSearch go={go} />
          <div class="c-theme"><IconButton icon={client.theme === 'night' ? 'sun' : 'moon'} variant="plain" size="sm" label={client.theme === 'night' ? 'Tryb dzienny' : 'Tryb nocny'} onClick={() => set({ theme: client.theme === 'night' ? 'light' : 'night' })} />
            <IconButton icon="contrast" variant="plain" size="sm" label="Wysoki kontrast" active={client.contrast === 'high'} onClick={() => set({ contrast: client.contrast === 'high' ? 'normal' : 'high' })} /></div>
          <div class="c-user"><span class="c-user__av" aria-hidden="true">{(staff.name || staff.login)[0]}</span><span class="c-user__txt"><b>{staff.name}</b><small>{roleName(staff)}</small></span>
            <Button variant="secondary" size="sm" icon="power" onClick={() => api.staff.logout()}>Wyloguj</Button></div>
        </header>
        <main class="c-content" ref={mainRef}>
          {subs && <SubNav items={subs.map((x) => ({ ...x, badge: subBadges[x.id] }))} value={subId} onChange={(id) => go(sec.id, id)} />}
          {allowed ? <Body key={sec.id + subId} openId={openId} /> : <Denied perm={needPerm} />}
        </main>
      </div>
    </div>
    <Modal open={!!confirm} onClose={() => setConfirm(null)} size="sm" title={confirm?.title}
      footer={<><Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>Anuluj</Button><Button variant={confirm?.tone || 'danger'} size="sm" icon={confirm?.icon || 'trash'} onClick={() => { const c = confirm; setConfirm(null); c.onOk(); }}>{confirm?.ok || 'Potwierdź'}</Button></>}>
      <div class="c-confirm">{confirm?.text}</div>
    </Modal>
  </CmsCtx.Provider>);
}

/* ── wyszukiwarka globalna (wpisy, miejsca, wydarzenia, obiekty, wyzwalacze) ── */
function GlobalSearch({ go }) {
  const s = useStore(); const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const res = q.trim().length < 2 ? [] : [
    ...s.entries.filter((e) => matches(q, e.title.pl, e.title.en, (e.tags || []).join(' '))).slice(0, 5).map((e) => ({ k: 'e' + e.id, icon: 'file', label: e.title.pl, kind: 'Wpis', to: ['content', 'entries', e.id] })),
    ...s.pois.filter((p) => matches(q, p.name.pl, p.name.en)).slice(0, 4).map((p) => ({ k: 'p' + p.id, icon: 'mapPin', label: p.name.pl, kind: 'Miejsce', to: ['places', null, p.id] })),
    ...s.events.filter((e) => matches(q, e.title.pl)).slice(0, 3).map((e) => ({ k: 'v' + e.id, icon: 'calendar', label: e.title.pl, kind: 'Wydarzenie', to: ['offer', 'events', e.id] })),
    ...s.venues.filter((v) => matches(q, v.name.pl)).slice(0, 3).map((v) => ({ k: 'o' + v.id, icon: 'store', label: v.name.pl, kind: 'Obiekt', to: ['offer', 'venues', v.id] })),
    ...s.triggers.filter((t) => matches(q, t.code, t.label)).slice(0, 4).map((t) => ({ k: 't' + t.id, icon: { qr: 'qr', ble: 'bluetooth', ar: 'ar' }[t.kind], label: `${t.code} · ${t.label}`, kind: 'Wyzwalacz', to: ['triggers', null, t.id] })),
  ];
  return (<div class="c-gsearch" onFocusIn={() => setOpen(true)} onFocusOut={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <Icon name="search" size={16} />
    <input type="search" value={q} placeholder="Szukaj w CMS (wpisy, miejsca, wydarzenia, kody)…" aria-label="Szukaj w CMS" onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && res[0]) { go(...res[0].to); setOpen(false); } }} />
    {open && q.trim().length >= 2 && <div class="c-gsearch__res" role="listbox">{res.length ? res.map((r) => <button key={r.k} type="button" role="option" onClick={() => { go(...r.to); setOpen(false); setQ(''); }}><Icon name={r.icon} size={15} /><span>{r.label}</span><small>{r.kind}</small></button>) : <div class="c-muted c-pad">Brak wyników.</div>}</div>}
  </div>);
}
