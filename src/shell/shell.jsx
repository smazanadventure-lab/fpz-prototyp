// Powłoka prototypu: zakładki-końcówki, widok dzielony, ramka telefonu z symulacją otoczenia, ramka przeglądarki, dziennik API.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import './shell.css';
import { ENDPOINTS } from '../endpoints/registry.js';
import { About } from './about.jsx';
import { useEnv, useNow } from '../kernel/client.jsx';
import { useStore, resetStore, update } from '../kernel/store.js';
import { sel } from '../kernel/api.js';
import { clsx, pad2, fmtDistance } from '../kernel/util.js';
import { Icon, ScaleBox, Select, Tabs } from '../ui/components.jsx';
import { SitePlan, CityMap } from '../ui/maps.jsx';
import { LOGO } from '../ui/logo-data.js';
import { QR } from '../ui/components.jsx';
import { remoteEnabled, remoteReset } from '../kernel/remote.js';
import { NetBadge, NetNotice } from './net.jsx';
import { ROUTES, routeHref } from './standalone.jsx';

const ALL = [...ENDPOINTS, { id: 'about', title: 'O prototypie', short: 'O prototypie', icon: 'info', Component: About, frame: 'none', hint: 'Scenariusze testowe, zgodność z wymaganiami, architektura' }];
const ONLY = (typeof __ONLY__ !== 'undefined' && __ONLY__) ? __ONLY__.split(',') : null;
const firstTab = () => { try { const h = decodeURIComponent(location.hash.slice(1)); if (ALL.some((e) => e.id === h)) return h; } catch { /* nic */ } return ONLY ? (ALL.find((e) => ONLY.includes(e.id))?.id || 'mobile') : 'mobile'; };

/* ── telefon ── */
function StatusBar({ platform }) {
  const now = useNow(15000); const { env } = useEnv(); const s = useStore(); const light = s.clients.mobile?.statusBar === 'light';
  const net = env.network;
  return (<div class={clsx('sh-status', light && 'is-light', platform === 'android' && 'is-android')} aria-hidden="true">
    <span class="sh-status__time">{pad2(now.getHours())}:{pad2(now.getMinutes())}</span>
    <span class="sh-status__right">
      <span class="sh-status__net">{net === 'offline' ? 'brak sieci' : net === 'slow' ? 'H' : 'LTE'}</span>
      <Icon name={net === 'offline' ? 'wifiOff' : 'signal'} size={15} stroke={2.4} /><Icon name="battery" size={19} stroke={2} />
    </span></div>);
}
function EnvPanel() {
  const { env, setEnv, moveTo } = useEnv(); const s = useStore(); const [mapTab, setMapTab] = useState('fpz');
  const mob = s.clients.mobile || {}; const beacons = sel.nearbyBeacons(120); const ar = sel.arHere(); const near = sel.nearestPoi();
  const qrs = s.triggers.filter((t) => t.kind === 'qr' && t.active !== false); const myTickets = s.tickets.filter((t) => t.status === 'valid').slice(0, 6);
  const fpz = s.pois.filter((p) => p.scope === 'fpz'), city = s.pois.filter((p) => p.scope === 'city');
  return (<aside class="sh-env fpz-theme" style={{ '--fs-base': '14px' }}>
    <h2><Icon name="satellite" size={16} /> Otoczenie telefonu <small>symulacja czujników</small></h2>
    <p class="sh-env__lead">Telefon w przeglądarce nie ma GPS, Bluetooth ani kamery – tutaj ustawiasz, co „widzi” aplikacja.</p>
    <section>
      <h3><Icon name="locate" size={14} /> Pozycja zwiedzającego (GPS)</h3>
      <Select value={env.position.poiId || ''} onChange={(e) => e.currentTarget.value && moveTo(e.currentTarget.value)} aria-label="Przenieś do punktu">
        <option value="">{near ? `ok. ${fmtDistance(near.distanceM)} od: ${near.poi.name.pl}` : '—'}</option>
        <optgroup label="Teren FPŻ">{fpz.map((p) => <option key={p.id} value={p.id}>{p.name.pl}</option>)}</optgroup>
        <optgroup label="Miasto i okolice">{city.map((p) => <option key={p.id} value={p.id}>{p.name.pl}</option>)}</optgroup>
      </Select>
      <Tabs variant="pill" value={mapTab} onChange={setMapTab} tabs={[{ id: 'fpz', label: 'Teren FPŻ' }, { id: 'city', label: 'Miasto' }]} />
      <div class="sh-env__map">{mapTab === 'fpz'
        ? <SitePlan view="plan" labels="none" streetNames={false} controls selectedId={env.position.poiId} position={env.position} onSelect={(p) => moveTo(p.id)} />
        : <CityMap showDistricts controls selectedId={env.position.poiId} position={env.position} onSelect={(p) => moveTo(p.id)} onMapClick={(ll) => moveTo(ll)} />}</div>
      <small>Kliknij punkt na planie, aby „przenieść” zwiedzającego (geolokalizacja i geofencing).</small>
    </section>
    <section>
      <h3><Icon name="signal" size={14} /> Zasięg sieci</h3>
      <div class="sh-seg">{[['online', 'LTE / Wi‑Fi'], ['slow', 'Słaby (HSDPA)'], ['offline', 'Offline']].map(([id, label]) => <button key={id} type="button" class={env.network === id ? 'is-on' : ''} onClick={() => setEnv({ network: id })}>{label}</button>)}</div>
      {s.player.pending.length > 0 && <small class="sh-env__warn">Postępy gry czekające na synchronizację: {s.player.pending.length}</small>}
    </section>
    <section>
      <h3><Icon name="qr" size={14} /> Kod QR przed kamerą</h3>
      <Select value={env.qrInView || ''} onChange={(e) => setEnv({ qrInView: e.currentTarget.value || null })} aria-label="Kod QR w kadrze">
        <option value="">— brak kodu w kadrze —</option>
        <optgroup label="Kody na stanowiskach i tablicach">{qrs.map((t) => <option key={t.id} value={t.code}>{t.code} · {t.label}</option>)}</optgroup>
        {myTickets.length > 0 && <optgroup label="Bilety (kody z zamówień)">{myTickets.map((t) => <option key={t.id} value={`FPZ:T:${t.code}`}>Bilet {t.code}</option>)}</optgroup>}
      </Select>
      <small>Nowe kody wygenerowane w CMS pojawiają się na tej liście od razu.</small>
    </section>
    <section>
      <h3><Icon name="bluetooth" size={14} /> Nadajniki BLE w pobliżu</h3>
      {beacons.length ? <ul class="sh-env__list">{beacons.slice(0, 5).map((b) => <li key={b.trigger.id} class={b.inRange ? 'is-on' : ''}><span>{b.trigger.label.replace('Beacon – ', '')}</span><b>{fmtDistance(b.distanceM)}</b><i>zasięg {b.trigger.ble.rangeM} m</i></li>)}</ul> : <small>Brak nadajników w promieniu 120 m.</small>}
    </section>
    <section>
      <h3><Icon name="ar" size={14} /> Punkty AR w tym miejscu</h3>
      {ar.length ? <ul class="sh-env__list">{ar.slice(0, 4).map((t) => <li key={t.id} class="is-on"><span>{t.label}</span><i>{t.code}</i></li>)}</ul> : <small>Brak wzorców AR w zasięgu kamery.</small>}
    </section>
    <section>
      <h3><Icon name="smartphone" size={14} /> System telefonu</h3>
      <div class="sh-seg">{[['ios', 'iOS'], ['android', 'Android']].map(([id, label]) => <button key={id} type="button" class={(mob.platform || 'ios') === id ? 'is-on' : ''} onClick={() => update((st) => { if (st.clients.mobile) st.clients.mobile.platform = id; })}>{label}</button>)}</div>
    </section>
  </aside>);
}
function PhoneStage({ Component, compact }) {
  const s = useStore(); const platform = s.clients.mobile?.platform || 'ios'; const [env, setEnv] = useState(!compact);
  return (<div class={clsx('sh-phone-stage', !env && 'is-noenv')}>
    {env && <EnvPanel />}
    <div class="sh-phone-col">
      <button type="button" class="sh-linkbtn" onClick={() => setEnv(!env)}><Icon name="sliders" size={14} /> {env ? 'Ukryj panel otoczenia' : 'Pokaż panel otoczenia (GPS, sieć, QR, BLE)'}</button>
      <ScaleBox width={414} height={868} maxScale={1.15}>
        <div class={clsx('sh-phone', platform === 'android' && 'is-android')}>
          <div class="sh-phone__screen" style={{ '--safe-top': '47px', '--safe-bottom': platform === 'android' ? '26px' : '22px' }}>
            <Component platform={platform} />
            <StatusBar platform={platform} />
            <div class="sh-phone__island" aria-hidden="true" />
            <div class="sh-phone__home" aria-hidden="true" />
          </div>
        </div>
      </ScaleBox>
    </div>
  </div>);
}

/* ── przeglądarka ── */
const VIEWPORTS = [{ id: 'desktop', label: 'Komputer', icon: 'monitor', w: 1320 }, { id: 'tablet', label: 'Tablet', icon: 'tablet', w: 820 }, { id: 'phone', label: 'Telefon', icon: 'smartphone', w: 400 }];
function BrowserStage({ Component }) {
  const s = useStore(); const [vp, setVp] = useState('desktop'); const ref = useRef(null); const [box, setBox] = useState({ w: 1200, h: 700 });
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const fit = () => { const r = el.getBoundingClientRect(); if (r.width && r.height) setBox({ w: r.width, h: r.height }); }; fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect(); }, []);
  const w = VIEWPORTS.find((v) => v.id === vp).w; const k = Math.min(1, box.w / w); const path = s.clients.web?.path || '';
  return (<div class="sh-browser">
    <div class="sh-browser__bar">
      <span class="sh-browser__dots"><i /><i /><i /></span>
      <span class="sh-browser__url"><Icon name="lock" size={12} /> www.fpz.example{path ? '/' + path : ''}</span>
      <span class="sh-seg sh-seg--sm">{VIEWPORTS.map((v) => <button key={v.id} type="button" class={vp === v.id ? 'is-on' : ''} onClick={() => setVp(v.id)} title={`${v.label} (${v.w}px)`}><Icon name={v.icon} size={14} /> {v.label}</button>)}</span>
    </div>
    <div class="sh-browser__view" ref={ref}>
      <div class="sh-browser__page" style={{ width: w + 'px', height: box.h / k + 'px', transform: `scale(${k})`, left: Math.max(0, (box.w - w * k) / 2) + 'px' }}><Component viewport={vp} /></div>
    </div>
  </div>);
}

/* ── dziennik API ── */
const CL = { mobile: 'Aplikacja', web: 'WWW', kiosk: 'Kiosk', cms: 'CMS', mgmt: 'Ekspozycja', validator: 'Bileter', signage: 'LCD', sim: 'Symulator', shell: 'Powłoka' };
function ApiLog({ onClose }) {
  const s = useStore(); const [f, setF] = useState('');
  const rows = s.apiLog.filter((r) => !f || r.client.startsWith(f)).slice(0, 80);
  const counts = [['Wpisy', s.entries.length], ['Wyzwalacze QR/BLE/AR', s.triggers.length], ['Zamówienia', s.orders.length], ['Bilety', s.tickets.length], ['Zapytania', s.inquiries.length], ['Pomysły', s.ideas.length], ['Urządzenia', s.devices.length], ['Powiadomienia', s.outbox.length]];
  return (<div class="sh-log">
    <div class="sh-log__head">
      <b><Icon name="terminal" size={15} /> Dziennik API – komunikacja końcówek ze wspólnym backendem</b>
      <span class="sh-seg sh-seg--sm">{[['', 'Wszystkie'], ['mobile', 'Aplikacja'], ['web', 'WWW'], ['kiosk', 'Kioski'], ['cms', 'CMS'], ['mgmt', 'Ekspozycja'], ['validator', 'Bileter']].map(([id, l]) => <button key={id} type="button" class={f === id ? 'is-on' : ''} onClick={() => setF(id)}>{l}</button>)}</span>
      <span class="sh-log__counts">{counts.map(([l, n]) => <span key={l}>{l}: <b>{n}</b></span>)}</span>
      <button type="button" class="sh-iconbtn" onClick={onClose} aria-label="Zamknij dziennik"><Icon name="close" size={16} /></button>
    </div>
    <div class="sh-log__rows">{rows.length ? rows.map((r) => { const d = new Date(r.t); return (<div key={r.id} class={clsx('sh-log__row', r.status >= 400 && 'is-err')}>
      <span>{pad2(d.getHours())}:{pad2(d.getMinutes())}:{pad2(d.getSeconds())}</span><span class={`sh-cl sh-cl--${r.client.split(':')[0]}`}>{CL[r.client.split(':')[0]] || r.client}{r.client.includes(':') ? ' ' + r.client.split(':')[1] : ''}</span>
      <b>{r.method}</b><code>{r.path}</code><span class="sh-log__st">{r.status}{r.error ? ' ' + r.error : ''}</span></div>); }) : <div class="sh-log__empty">Wykonaj dowolną akcję w jednej z końcówek (np. dodaj bilet do koszyka albo zapisz wpis w CMS) – wywołania pojawią się tutaj.</div>}</div>
  </div>);
}

/* ── adresy końcówek ── */
function Addresses({ onClose }) {
  const remote = remoteEnabled(); const appUrl = routeHref('app'); const abs = /^https?:/.test(appUrl);
  return (<div class="sh-confirm" role="dialog" aria-modal="true" aria-label="Adresy końcówek" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><div class="sh-confirm__box sh-addr">
    <b>Końcówki pod własnymi adresami</b>
    <p>{remote ? 'Każdą część systemu można otworzyć osobno – na telefonie, tablecie biletera, monitorze kiosku czy ekranie LCD. Wszystkie korzystają z tych samych danych na serwerze.' : 'Każdą część systemu można otworzyć w osobnej karcie na pełnym ekranie. W tej wersji (jeden plik) dane są wspólne tylko w obrębie tej przeglądarki.'}</p>
    <ul class="sh-addr__list">{ROUTES.map((r) => <li key={r.path}><a href={routeHref(r.path)} target="_blank" rel="noopener">{r.title}</a><code>{abs ? '/' + r.path : '?end=' + r.path}</code><small>{r.hint}</small></li>)}</ul>
    {abs && <div class="sh-addr__qr"><QR value={appUrl} size={132} /><span><b>Aplikacja na telefonie</b>Zeskanuj kod aparatem telefonu, aby otworzyć aplikację mobilną ({appUrl.replace(/^https?:\/\//, '')}). W przeglądarce telefonu można ją dodać do ekranu głównego; plik APK dla Androida powstaje z tego samego kodu.</span></div>}
    <div><button type="button" class="sh-toolbtn is-on" onClick={onClose}>Zamknij</button></div>
  </div></div>);
}

/* ── panele ── */
function Pane({ id, compact }) {
  const [mounted, setMounted] = useState(() => new Set([id]));
  useEffect(() => { setMounted((m) => (m.has(id) ? m : new Set([...m, id]))); }, [id]);
  return (<div class="sh-pane">{ALL.filter((e) => mounted.has(e.id) || e.id === id).map((e) => (
    <div key={e.id} class="sh-pane__ep" style={{ display: e.id === id ? 'block' : 'none' }} data-endpoint={e.id}>
      {e.frame === 'phone' ? <PhoneStage Component={e.Component} compact={compact} /> : e.frame === 'browser' ? <BrowserStage Component={e.Component} /> : <e.Component />}
    </div>))}</div>);
}

export function Shell() {
  const [tab, setTab] = useState(firstTab); const [split, setSplit] = useState(false); const [side, setSide] = useState('cms'); const [log, setLog] = useState(false); const [confirm, setConfirm] = useState(false); const [addr, setAddr] = useState(false); const [busy, setBusy] = useState(false); const remote = remoteEnabled();
  const s = useStore();
  useEffect(() => { try { history.replaceState(null, '', '#' + tab); } catch { /* nic */ } }, [tab]);
  useEffect(() => { const h = () => { let id = ''; try { id = decodeURIComponent(location.hash.slice(1)); } catch { /* nic */ } if (ALL.some((e) => e.id === id)) setTab(id); }; const c = (e) => { if (ALL.some((x) => x.id === e.detail)) setTab(e.detail); }; window.addEventListener('hashchange', h); window.addEventListener('fpz:tab', c); return () => { window.removeEventListener('hashchange', h); window.removeEventListener('fpz:tab', c); }; }, []);
  const sideId = side === tab ? ALL.find((e) => e.id !== tab).id : side;
  const liveCalls = s.apiLog.length;
  return (<div class={clsx('sh-root', remote && 'is-remote')}>
    <header class="sh-top">
      <div class="sh-brand"><span class="sh-brand__mark"><svg viewBox={LOGO.mark.box.join(' ')} role="img" aria-label="Fabryka Pełna Życia"><path d={LOGO.mark.d} fill="currentColor" /></svg></span><span><b>Fabryka Pełna Życia</b><small>prototyp systemu multimedialnego</small></span><span class="sh-badge" title="Dane przykładowe. Logowanie, płatności, kamera, Bluetooth i GPS są symulowane.">WERSJA TESTOWA</span></div>
      <nav class="sh-tabs" role="tablist" aria-label="Końcówki systemu">{ALL.map((e) => <button key={e.id} type="button" role="tab" aria-selected={tab === e.id} class={clsx('sh-tabbtn', tab === e.id && 'is-active')} onClick={() => setTab(e.id)} title={e.hint}><Icon name={e.icon} size={16} /><span>{e.short}</span></button>)}</nav>
      <div class="sh-tools">
        <NetBadge />
        <button type="button" class={clsx('sh-toolbtn', addr && 'is-on')} onClick={() => setAddr(true)} title="Otwórz końcówki pod własnymi adresami (telefon, kiosk, ekran, bileter…)"><Icon name="link" size={15} /><span>Adresy</span></button>
        <button type="button" class={clsx('sh-toolbtn', split && 'is-on')} onClick={() => setSplit(!split)} title="Pokaż dwie końcówki obok siebie, aby zobaczyć zależności na żywo"><Icon name="split" size={15} /><span>Dwa okna</span></button>
        <button type="button" class={clsx('sh-toolbtn', log && 'is-on')} onClick={() => setLog(!log)} title="Dziennik wywołań API"><Icon name="terminal" size={15} /><span>API</span>{liveCalls > 0 && <i>{liveCalls > 99 ? '99+' : liveCalls}</i>}</button>
        <button type="button" class="sh-toolbtn" onClick={() => setConfirm(true)} title="Przywróć dane początkowe"><Icon name="refresh" size={15} /><span>Reset</span></button>
      </div>
    </header>
    <main class={clsx('sh-stage', split && 'is-split')}>
      <Pane id={tab} compact={split} />
      {split && (<div class="sh-side">
        <div class="sh-side__bar"><span>Drugie okno:</span>{ALL.filter((e) => e.id !== tab).map((e) => <button key={e.id} type="button" class={clsx(sideId === e.id && 'is-on')} onClick={() => setSide(e.id)}><Icon name={e.icon} size={13} /> {e.short}</button>)}</div>
        <Pane id={sideId} compact />
      </div>)}
    </main>
    {log && <ApiLog onClose={() => setLog(false)} />}
    {confirm && (<div class="sh-confirm" role="dialog" aria-modal="true"><div class="sh-confirm__box"><b>Przywrócić dane początkowe?</b><p>Zamówienia, postępy gry, zmiany w CMS i ustawienia urządzeń wrócą do stanu wyjściowego.{remote && <> <strong>Uwaga: dane zostaną przywrócone na serwerze – dla wszystkich urządzeń i testerów.</strong></>}</p>
      <div><button type="button" class="sh-toolbtn" onClick={() => setConfirm(false)}>Anuluj</button><button type="button" class="sh-toolbtn is-on" disabled={busy} onClick={() => { if (!remote) { resetStore(); setConfirm(false); return; } setBusy(true); remoteReset().catch(() => window.alert('Nie udało się połączyć z serwerem – spróbuj ponownie.')).finally(() => { setBusy(false); setConfirm(false); }); }}>{busy ? 'Przywracanie…' : 'Przywróć'}</button></div></div></div>)}
    {addr && <Addresses onClose={() => setAddr(false)} />}
    <NetNotice />
  </div>);
}
