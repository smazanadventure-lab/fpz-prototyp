// Urządzenia: telemetria na żywo, filtr stref i rodzajów, panel pojedynczego stanowiska.
import { useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { ago, fmtDateTime } from '../../kernel/util.js';
import { Icon, Button, Modal, Tag, Notice, Empty, Chips, Select, Field, Switch, Tabs } from '../../ui/components.jsx';
import { describeUa } from '../../kernel/presence.js';
import { useX, useTick, POWER, KINDS, SCHED_MODE, HEIGHTS, PowerBadge, Head, zoneName, DISPLAY_KINDS, linkOf, LinkBadge, SimMark, RealMark, PresenceHelp, devicePageUrl, agoTxt, clockTxt, incOrigin, ORIGIN, PAGE_KINDS } from './common.jsx';

/** Wersja aplikacji: identyfikator kompilacji (znacznik czasu) → czytelna data. */
export const fmtVer = (v) => (/^\d{12,14}$/.test(String(v || '')) ? `kompilacja ${new Date(+v).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : String(v || '—'));
const fmtUp = (h) => `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`;
const Dot = () => <i class="x-realdot" title="z urządzenia" aria-label="z urządzenia" />;

export function Devices() {
  const s = getState(); const { openDevice, presence } = useX(); useTick(1000);
  const remote = presence?.mode === 'remote';
  const [zone, setZone] = useState(''); const [kind, setKind] = useState(''); const [st, setSt] = useState(''); const [onlyOn, setOnlyOn] = useState(false);
  const links = Object.fromEntries(s.devices.map((d) => [d.id, linkOf(presence, d.id)]));
  const list = s.devices.filter((d) => (!zone || d.zone === zone) && (!kind || d.kind === kind) && (!st || d.power === st) && (!onlyOn || links[d.id].state === 'online'));
  const nOn = s.devices.filter((d) => links[d.id].state === 'online').length;
  const pl = (id) => s.playlists.find((p) => p.id === id)?.name;
  return (<div>
    <Head title="Urządzenia" sub={remote ? `${s.devices.length} urządzeń · zadane = polecenia panelu i harmonogramów, rzeczywiste = sygnały wysyłane przez urządzenia (odczyt co 10 s)` : `${s.devices.length} urządzeń w sieci LAN ekspozycji · wersja bez serwera – stan symulowany`} icon="monitor" />
    {!remote && <Notice tone="info" icon="sparkles">Wersja bez serwera – urządzenia nie mogą się meldować, cały stan (połączenie, temperatura, obciążenie, czas pracy) jest symulowany.</Notice>}
    {remote && presence.error && <Notice tone="warn">Nie udało się odczytać sygnałów urządzeń z serwera ({presence.error}). Ponowna próba za chwilę.</Notice>}
    <div class="x-filters">
      <Chips options={[{ id: '', label: 'Wszystkie strefy' }, ...s.zones.map((z) => ({ id: z.id, label: z.name }))]} value={zone} onChange={setZone} scroll />
      <div class="x-filters__row">
        <Chips options={[{ id: '', label: 'Wszystkie rodzaje' }, ...Object.entries(KINDS).map(([k, v]) => ({ id: k, label: v.short, icon: v.icon }))]} value={kind} onChange={setKind} scroll />
        {remote && <button type="button" class={`x-pill x-onlyon${onlyOn ? ' is-on' : ''}`} aria-pressed={onlyOn} onClick={() => setOnlyOn(!onlyOn)} data-testid="x-only-online"><Icon name="wifi" size={14} />Tylko podłączone ({nOn})</button>}
        <Select value={st} onChange={(e) => setSt(e.currentTarget.value)} aria-label="Stan zadany" options={[{ id: '', label: 'Każdy stan zadany' }, ...Object.entries(POWER).map(([k, v]) => ({ id: k, label: v.label }))]} class="x-filters__sel" />
      </div>
    </div>
    <p class="x-legendline x-muted x-small"><Icon name="info" size={13} /><span>Temperatura, CPU i czas pracy są <b>symulowane</b>; wartości z kropką <Dot /> zgłasza urządzenie (program sterujący na komputerze kiosku).</span></p>
    {list.length ? <div class="x-devtable" role="table" aria-label="Urządzenia">
      <div class="x-devrow x-devrow--head" role="row"><span role="columnheader">Urządzenie</span><span role="columnheader">Zadane</span><span role="columnheader" class="x-c-seen">Rzeczywiste</span><span role="columnheader" class="x-c-tel">Temp. / CPU</span><span role="columnheader" class="x-c-up">Czas pracy</span><span role="columnheader" class="x-c-net">IP / wersja</span><span role="columnheader" class="x-c-pl">Playlista</span><span role="columnheader" class="x-c-mode">Tryb</span></div>
      {list.map((d) => { const k = links[d.id]; const ag = k.agent; const pg = k.page; const cpu = ag?.cpu ?? null; const temp = ag?.tempC ?? null; const up = ag?.uptimeH ?? null; return (<button type="button" key={d.id} class={`x-devrow x-devrow--${d.power} x-devrow--link-${k.state}`} role="row" onClick={() => openDevice(d.id)} data-dev={d.id}>
        <span class="x-devrow__name" role="cell"><span class="x-devic"><Icon name={KINDS[d.kind]?.icon} size={20} /></span><span><b>{d.name}</b><small>{d.id} · {zoneName(d.zone)}</small></span></span>
        <span role="cell"><PowerBadge power={d.power} />{d.night && <span class="x-nightmark" title="Tryb nocny"><Icon name="moon" size={13} /></span>}</span>
        <span role="cell" class="x-c-seen">{remote ? <LinkBadge link={k} /> : <><LinkBadge link={k} /><small>kontakt {ago(d.lastSeen)}</small></>}</span>
        <span role="cell" class="x-c-tel">{d.power === 'on' || cpu != null ? <><span class={(temp ?? d.tempC) > 55 ? 'x-bad' : ''}><Icon name="thermometer" size={13} />{Math.round(temp ?? d.tempC)}°C{temp != null && <Dot />}</span> <span><Icon name="cpu" size={13} />{cpu ?? d.cpu}%{cpu != null && <Dot />}</span></> : <span class="x-muted">—</span>}</span>
        <span role="cell" class="x-c-up">{up != null ? <>{fmtUp(up)}<Dot /></> : d.power === 'on' ? fmtUp(d.uptimeH) : '—'}</span>
        <span role="cell" class="x-c-net">{pg ? <><code>{pg.ip || ag?.ip || 'IP nieznany'}</code><small>{pg.ver === s.build ? 'wersja aktualna' : <span class="x-bad">wersja nieaktualna</span>}</small></> : <><code>{d.ip}</code><small>v{d.appVersion}</small></>}</span>
        <span role="cell" class="x-c-pl">{pl(d.playlistId) || <span class="x-muted">{d.kind === 'kiosk' ? 'aplikacja kiosku' : '—'}</span>}</span>
        <span role="cell" class="x-c-mode"><Tag tone={d.schedule === 'manual' ? 'warn' : d.schedule === 'always' ? 'info' : 'green'}>{d.schedule === 'auto' ? 'auto' : d.schedule === 'manual' ? 'ręczny' : '24/7'}</Tag></span>
        {remote && (PAGE_KINDS[d.kind] || pg) && <span role="cell" class="x-devrow__now"><NowLine link={k} presence={presence} compact /></span>}
      </button>); })}
    </div> : <Empty icon="filter" title={onlyOn ? 'Żadne urządzenie nie jest teraz podłączone' : 'Brak urządzeń dla wybranych filtrów'} text={onlyOn ? 'Otwórz na urządzeniu jego adres (szczegóły urządzenia → „Stan rzeczywisty”).' : undefined} />}
  </div>);
}

const mmss = (x) => (Number.isFinite(x) ? `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}` : '—');
const TYPE_PL = { video: 'Film', captions: 'Napisy na żywo', image: 'Obraz', news: 'Aktualności', events: 'Wydarzenia', rss: 'Wiadomości RSS', clock: 'Zegar', weather: 'Pogoda' };
const STATE_PL = { 'wyłączony wg harmonogramu': 'Wyłączony według harmonogramu', 'wyłączony w panelu': 'Wyłączony w panelu', 'przerwa serwisowa': 'Przerwa serwisowa – plansza serwisowa', awaria: 'Awaria – plansza „chwilowo niedostępny”', 'brak playlisty': 'Brak przypisanej playlisty' };
const q = (t) => `„${t}”`;
/**
 * „Teraz na ekranie” z raportu strony urządzenia (sygnał page.now) → { tone, main, extra[] } po polsku.
 * tone: ok | info | warn | bad | muted. Raport bez treści (stara wersja strony) / brak sygnału → null.
 */
export function nowSummary(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // raport pochodzi z urządzenia – tylko teksty i liczby w oczekiwanych polach, reszta pomijana
  const txt = (x) => (typeof x === 'string' ? x : typeof x === 'number' && Number.isFinite(x) ? String(x) : '');
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
  const it0 = obj(raw.item) || {}; const m0 = obj(raw.media);
  const n = { kind: txt(raw.kind), state: txt(raw.state), playlist: txt(raw.playlist), view: txt(raw.view), overlay: txt(raw.overlay), sound: txt(raw.sound), idle: raw.idle === true,
    loading: num(raw.loading), pos: Array.isArray(raw.pos) && num(raw.pos[0]) != null && num(raw.pos[1]) != null ? raw.pos : null,
    skipped: Array.isArray(raw.skipped) ? raw.skipped.map(obj).filter(Boolean).map((k) => ({ title: txt(k.title), reason: txt(k.reason) })) : [],
    item: { type: txt(it0.type), title: txt(it0.title), src: txt(it0.src) } };
  const m = m0 && { advancing: m0.advancing === true ? true : m0.advancing === false ? false : null, gone: m0.gone === true, pos: num(m0.pos), dur: num(m0.dur), w: num(m0.w), h: num(m0.h), muted: m0.muted === true, paused: m0.paused === true, ready: num(m0.ready) ?? 4, error: txt(m0.error) || (m0.error ? 'nieznany' : ''), src: txt(m0.src) };
  const extra = [];
  const mediaTxt = () => {
    if (!m) return null;
    if (m.error) return { tone: 'bad', txt: `Błąd odtwarzania: ${m.error}` };
    if (m.advancing === null) return { tone: 'info', txt: 'obraz właśnie się zmienia' };
    if (m.advancing) return { tone: 'ok', txt: m.src === 'kamera – transmisja' ? 'obraz płynie' : m.dur ? `odtwarza się, ${mmss(m.pos)} z ${mmss(m.dur)}` : 'obraz płynie' };
    return { tone: 'warn', txt: `stoi w miejscu – obraz się nie przesuwa${m.paused ? ' (wstrzymany)' : m.ready < 3 ? ' (brak danych do odtworzenia)' : ''}` };
  };
  const tech = () => { if (m && m.src) extra.push(`źródło obrazu: ${m.src}${m.w && m.h ? ` · ${m.w}×${m.h}` : ''}${m.muted ? ' · bez dźwięku' : ''}`); };
  if (n.kind === 'kiosk') {
    if (n.state && n.state !== 'działa') return { tone: n.state === 'awaria' ? 'bad' : 'muted', main: STATE_PL[n.state] || n.state, extra };
    let main = `${n.view || 'widok nieznany'}${n.idle ? ' · bezczynny (wygaszacz)' : ''}`; let tone = n.idle ? 'muted' : 'ok';
    if (n.overlay) main += ` · ${n.overlay}`; if (n.sound) main += ` · słuchawka podniesiona: ${q(n.sound)}`;
    const mt = mediaTxt(); if (mt) { main += ` · film ${mt.txt}`; if (mt.tone !== 'ok') tone = mt.tone; tech(); }
    return { tone, main, extra };
  }
  const pl = n.playlist ? ` playlisty ${q(n.playlist)}` : '';
  if (n.skipped.length) extra.push('Pominięte: ' + n.skipped.map((k) => `${q(k.title || 'pozycja')} (${k.reason || 'powód nieznany'})`).join(', '));
  if (n.state !== 'gra playlistę') {
    if (n.state === 'playlista nie ma nic do pokazania') return { tone: 'warn', main: `Playlista${n.playlist ? ' ' + q(n.playlist) : ''} nie ma nic do pokazania`, extra };
    return { tone: n.state === 'awaria' ? 'bad' : n.state === 'brak playlisty' ? 'warn' : 'muted', main: STATE_PL[n.state] || String(n.state || 'stan nieznany'), extra };
  }
  const it = n.item; const pos = n.pos ? ` · pozycja ${n.pos[0]} z ${n.pos[1]}${pl}` : '';
  if (n.loading != null) return { tone: 'info', main: `Wczytuje film ${q(it.title || '…')} – ${n.loading}%${pos}`, extra };
  const srcTxt = it.src ? ` (${it.src})` : ''; const label = TYPE_PL[it.type] || 'Pozycja';
  if (it.src === 'transmisja z kamery') { const mt = mediaTxt(); if (mt) tech(); return { tone: mt ? mt.tone : 'warn', main: mt?.tone === 'bad' ? mt.txt : `Transmisja z kamery – ${mt ? mt.txt : 'brak obrazu na stronie'}${pos}`, extra }; }
  const head = `${label}${it.title && it.type !== 'clock' && it.type !== 'weather' ? ' ' + q(it.title) : ''}${srcTxt}`;
  const mt = mediaTxt();
  if (mt) { tech(); if (mt.tone === 'bad') return { tone: 'bad', main: mt.txt, extra: [`${head}${pos}`, ...extra] }; return { tone: mt.tone, main: `${head} – ${mt.txt}${pos}`, extra }; }
  if (it.type === 'video' && it.src === 'plik') return { tone: 'warn', main: `${head} – na stronie nie ma odtwarzacza wideo${pos}`, extra };
  return { tone: it.type === 'video' && it.src !== 'plik' ? 'info' : 'ok', main: `${head}${it.src === 'film symulowany' || it.src === 'transmisja symulowana' ? ' – symulacja, bez prawdziwego pliku' : ''}${pos}`, extra };
}
const NOW_IC = { ok: 'play', info: 'info', warn: 'alert', bad: 'circleAlert', muted: 'moon' };
/** Blok „Teraz na ekranie” (lista i szczegóły urządzenia) – tylko w wersji serwerowej. */
export function NowLine({ link, presence, compact }) {
  if (!presence || presence.mode !== 'remote' || link.state === 'loading' || link.state === 'local') return null;
  const pg = link.page; const n = pg?.now; const sum = n ? nowSummary(n) : null;
  if (!sum) return <div class="x-now x-now--none" data-testid="x-now" data-now="none"><Icon name="monitor" size={14} /><span><b class="x-now__lbl">Teraz na ekranie:</b> brak danych o treści (urządzenie nie zgłosiło)</span></div>;
  const ageSec = Math.max(0, (Date.now() + (presence.skew || 0) - (pg.at || 0)) / 1000); const stale = ageSec * 1000 > (presence.staleMs || 100000);
  const tone = stale ? 'stale' : sum.tone;
  const age = <small class="x-now__age">{stale ? `stan sprzed ${agoTxt(ageSec)} – brak sygnału, raport nieaktualny` : `stan sprzed ${agoTxt(ageSec)}`}{!stale && pg.visible === false ? <b class="x-now__bg"> · karta w tle – przeglądarka mogła wstrzymać obraz</b> : ''}</small>;
  return (<div class={`x-now x-now--${tone}${compact ? ' x-now--compact' : ''}`} data-testid="x-now" data-now={tone} data-media={n.media && typeof n.media === 'object' ? (n.media.advancing === true ? 'advancing' : 'still') : 'none'}>
    <Icon name={stale ? 'clock' : NOW_IC[sum.tone] || 'monitor'} size={14} />
    <span class="x-now__txt"><b class="x-now__lbl">{stale ? 'Ostatnio:' : 'Teraz na ekranie:'}</b> <span class="x-now__main">{sum.main}</span>
      {compact && age}{sum.extra.map((x, i) => <small key={i} class="x-now__extra">{x}</small>)}{!compact && age}</span>
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
  const { api, toast } = useClient(); const { can, go, presence } = useX(); useTick(1000);
  const s = getState(); const d = sel.device(id);
  const [tab, setTab] = useState('ctl'); const [fault, setFault] = useState(null);
  const remote = presence?.mode === 'remote'; const link = linkOf(presence, id);
  const rs = remote && d ? restartState(d, link) : null;
  // czekając na potwierdzenie restartu odczytujemy sygnały częściej niż co 10 s
  useEffect(() => { if (rs?.st !== 'wait') return undefined; const t = setInterval(() => presence.refresh(), 3000); return () => clearInterval(t); }, [rs?.st]);
  if (!d) return null;
  const ok = can('devices');
  const res = (r, msg) => { if (r && r.ok === false) toast(r.message.pl, 'error'); else if (msg) toast(msg); };
  const power = (p) => res(api.devices.power(d.id, p), { on: 'Włączono', off: 'Wyłączono', service: 'Przełączono w tryb serwisowy' }[p] + `: ${d.name}`);
  const setp = (patch) => res(api.devices.set(d.id, patch));
  const history = [
    ...s.audit.filter((a) => a.target === d.name || a.target === d.id).map((a) => ({ at: a.at, icon: 'activity', text: a.action, who: sel.staff(a.staffId)?.name })),
    ...s.incidents.filter((i) => i.deviceId === d.id).flatMap((i) => [{ at: i.createdAt, icon: 'circleAlert', text: `[${i.severity}] ${i.title}`, who: ORIGIN[incOrigin(i)].short }, ...(i.resolvedAt ? [{ at: i.resolvedAt, icon: 'circleCheck', text: `Zamknięto: ${i.note}`, who: i.assignee }] : [])]),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  const displays = DISPLAY_KINDS.includes(d.kind);
  return (<Modal open onClose={onClose} size="lg" class="x-devmodal" title={<span class="x-devmodal__t"><Icon name={KINDS[d.kind]?.icon} size={22} />{d.name}<PowerBadge power={d.power} /></span>}>
    <div class="x-devmeta"><span><Icon name="mapPin" size={14} />{zoneName(d.zone)}</span><span><Icon name="tag" size={14} />{d.id}</span><span><Icon name="cpu" size={14} />{d.model}</span>{remote ? <LinkBadge link={link} /> : <span><Icon name="clock" size={14} />kontakt {ago(d.lastSeen)} <SimMark /></span>}</div>
    {remote && (PAGE_KINDS[d.kind] || link.page) && <NowLine link={link} presence={presence} />}
    {d.kind === 'kiosk' && !remote && <Notice icon="eye">Podgląd ekranu tego kiosku: zakładka „Kioski” w powłoce prototypu – zmiany wprowadzone tutaj widać tam od razu.</Notice>}
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'ctl', label: 'Sterowanie', icon: 'sliders' }, { id: 'real', label: 'Stan rzeczywisty', icon: 'activity' }, { id: 'info', label: 'Wyposażenie i sieć', icon: 'server' }, { id: 'hist', label: 'Historia zdarzeń', icon: 'history' }]} />
    {tab === 'ctl' && <div class="x-devctl">
      <div class="x-powerseg" role="group" aria-label="Zasilanie stanowiska">
        {[['on', 'Włącz', 'power'], ['off', 'Wyłącz', 'power'], ['service', 'Tryb serwisowy', 'wrench']].map(([p, l, ic]) => (
          <button key={p} type="button" class={`x-powerseg__b x-powerseg__b--${p}${d.power === p ? ' is-on' : ''}`} aria-pressed={d.power === p} disabled={!ok} onClick={() => power(p)} data-testid={`x-dev-${p}`}><Icon name={ic} size={22} />{l}</button>))}
      </div>
      {remote && <PowerFeedback d={d} link={link} />}
      {d.power === 'fault' && <Notice tone="danger">Urządzenie zgłasza awarię. Zamknij zgłoszenie w sekcji „Awarie i SLA”, aby przywrócić pracę. <button type="button" class="x-link" onClick={() => { onClose(); go('incidents'); }}>Przejdź do zgłoszeń</button></Notice>}
      {d.power === 'service' && <Notice tone="warn">Stanowisko wyłączone do konserwacji – pozostałe urządzenia pracują bez zmian.</Notice>}
      <div class="x-devctl__row">
        <div><span class="x-lbl">Tryb sterowania</span><b>{SCHED_MODE[d.schedule]}</b></div>
        <Button variant="secondary" size="sm" icon="calendar" disabled={!ok || d.schedule !== 'manual'} onClick={() => { api.devices.setAuto(d.id); toast('Przywrócono harmonogram'); }} data-testid="x-dev-auto">Przywróć harmonogram</Button>
        <Button variant="secondary" size="sm" icon="refresh" disabled={!ok || d.power !== 'on'} onClick={() => res(api.devices.restart(d.id), 'Zrestartowano aplikację')} data-testid="x-dev-restart">Restart aplikacji</Button>
      </div>
      {rs && <RestartStatus rs={rs} />}
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
        <dt>Rodzaj</dt><dd>{KINDS[d.kind]?.label}</dd><dt>Model</dt><dd>{d.model}</dd><dt>Adres IP (sieć LAN, plan)</dt><dd><code>{d.ip}</code></dd><dt>MAC</dt><dd><code>{d.mac}</code></dd>
        <dt>Wersja aplikacji</dt><dd>{link.page ? <>{fmtVer(link.page.ver)} <RealMark /></> : <>{d.appVersion} <SimMark /></>}</dd>
        <dt>Temperatura</dt><dd>{link.agent?.tempC != null ? <>{Math.round(link.agent.tempC)}°C <RealMark /></> : <>{Math.round(d.tempC)}°C <SimMark /></>}</dd>
        <dt>Obciążenie CPU</dt><dd>{link.agent?.cpu != null ? <>{link.agent.cpu}% <RealMark /></> : <>{d.cpu}% <SimMark /></>}</dd>
        <dt>Czas pracy</dt><dd>{link.agent?.uptimeH != null ? <>{link.agent.uptimeH.toFixed(1)} h <RealMark /></> : <>{d.uptimeH.toFixed(1)} h <SimMark /></>}</dd>
        {d.restartedAt && <><dt>Ostatni restart</dt><dd>{fmtDateTime(d.restartedAt)}</dd></>}
        {d.kind === 'kiosk' && <><dt>Dotknięcia dziś</dt><dd>{d.touchesToday} <SimMark /></dd></>}
      </dl>
      <h4>Wyposażenie</h4>
      {(d.accessories || []).length ? <ul class="x-tags">{d.accessories.map((a) => <li key={a}><Tag tone="info" icon="check">{a}</Tag></li>)}</ul> : <p class="x-muted">Brak dodatkowego wyposażenia.</p>}
    </div>}
    {tab === 'real' && <RealState d={d} link={link} remote={remote} />}
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

/** Stan polecenia „restart”: wait – wysłano, czekam; done – strona uruchomiona ponownie; none – brak potwierdzenia po 60 s. */
function restartState(d, link) {
  if (!d.restartedAt) return null; const at = Date.parse(d.restartedAt); if (!at) return null;
  const pg = link.page; if (pg?.boot && pg.boot > at) return { st: 'done', at, boot: pg.boot };
  const age = Date.now() - at; if (age > 15 * 60e3) return null; // dawne polecenie bez potwierdzenia – nie zaśmiecamy widoku
  return { st: age < 60e3 ? 'wait' : 'none', at };
}
function RestartStatus({ rs }) {
  if (rs.st === 'done') return <div class="x-cmd x-cmd--ok" role="status" data-testid="x-restart-state" data-st="done"><Icon name="circleCheck" size={16} /><span>Restart wykonany {clockTxt(rs.boot)} – aplikacja na urządzeniu uruchomiła się ponownie <small>(polecenie {clockTxt(rs.at)})</small></span></div>;
  if (rs.st === 'wait') return <div class="x-cmd x-cmd--wait" role="status" data-testid="x-restart-state" data-st="wait"><Icon name="hourglass" size={16} /><span>Wysłano polecenie restartu ({clockTxt(rs.at)}) – czekam na potwierdzenie z urządzenia…</span></div>;
  return <div class="x-cmd x-cmd--bad" role="status" data-testid="x-restart-state" data-st="none"><Icon name="circleAlert" size={16} /><span>Urządzenie nie potwierdziło restartu (polecenie {clockTxt(rs.at)}) – brak połączenia?</span></div>;
}

/** Czy urządzenie faktycznie jest w zadanym stanie (na tyle, na ile wiemy z sygnałów). */
function PowerFeedback({ d, link }) {
  if (!PAGE_KINDS[d.kind] && !link.agent) return null;
  if (link.state === 'loading') return null;
  if (link.state !== 'online') return <div class="x-cmd x-cmd--bad" data-testid="x-power-real"><Icon name="wifiOff" size={16} /><span>{link.state === 'never' ? 'Urządzenie nigdy się nie połączyło' : `Brak sygnału od ${agoTxt(link.agoSec)}`} – nie wiadomo, czy wykonało polecenie. Zastosuje stan zadany po połączeniu.</span></div>;
  const ag = link.agent;
  if (ag?.monitor) {
    const want = d.power === 'on' ? 'on' : d.power === 'off' ? 'off' : null; const okm = !want || ag.monitor === want;
    return <div class={`x-cmd ${okm ? 'x-cmd--ok' : 'x-cmd--wait'}`} data-testid="x-power-real"><Icon name={ag.monitor === 'on' ? 'monitor' : 'moon'} size={16} /><span>Monitor: <b>{ag.monitor === 'on' ? 'włączony' : 'uśpiony'}</b> (zgłasza program sterujący{ag.host ? ` ${ag.host}` : ''}) – {okm ? 'zgodnie z zadanym stanem' : 'jeszcze niezgodny z zadanym stanem, czekam na wykonanie'}.</span></div>;
  }
  if (d.power === 'off' || d.power === 'service') return <div class="x-cmd x-cmd--info" data-testid="x-power-real"><Icon name="info" size={16} /><span>Strona urządzenia jest podłączona i pokazuje czarną planszę. Fizyczne wyłączenie monitora wymaga programu sterującego (docs/KIOSK-WINDOWS.md).</span></div>;
  return <div class="x-cmd x-cmd--ok" data-testid="x-power-real"><Icon name="circleCheck" size={16} /><span>Strona urządzenia działa i melduje się (ostatni sygnał {agoTxt(link.agoSec)} temu). Stan fizyczny monitora nieznany – brak programu sterującego (docs/KIOSK-WINDOWS.md).</span></div>;
}

function CopyUrl({ url }) {
  const { toast } = useClient();
  const copy = () => { const ok = () => toast('Skopiowano adres'); try { navigator.clipboard.writeText(url).then(ok, () => fallback()); } catch { fallback(); } function fallback() { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch { toast('Nie udało się skopiować – zaznacz adres ręcznie', 'warn'); } t.remove(); } };
  return (<div class="x-url"><code data-testid="x-dev-url">{url}</code><Button size="sm" variant="secondary" icon="copy" onClick={copy} data-testid="x-dev-copy">Kopiuj adres</Button><a class="fpz-btn fpz-btn--ghost fpz-btn--sm x-url__open" href={url} target="_blank" rel="noopener"><Icon name="external" size={16} />Otwórz</a></div>);
}

/** Zakładka „Stan rzeczywisty” – wszystko, co urządzenie samo zgłosiło serwerowi. */
function RealState({ d, link, remote }) {
  const s = getState(); const url = devicePageUrl(d); const pg = link.page; const ag = link.agent; const now = Date.now();
  if (!remote) return (<div class="x-real"><Notice tone="info" icon="sparkles">Wersja bez serwera – urządzenia nie wysyłają sygnałów, a cały stan jest symulowany. Stan rzeczywisty jest dostępny w wersji serwerowej (panel pod adresem /ekspozycja).</Notice><PresenceHelp mode="local" /></div>);
  const howTo = url && (<div class="x-howto"><b><Icon name="monitor" size={16} />Jak podłączyć to urządzenie</b>
    <p>Otwórz na urządzeniu adres poniżej w przeglądarce (Edge / Chrome) w trybie pełnoekranowym (F11 albo tryb kiosku przeglądarki). Strona sama zacznie wysyłać sygnały – po ok. 10 s urządzenie pojawi się tu jako „Podłączone”.</p>
    <CopyUrl url={url} /></div>);
  return (<div class="x-real" data-testid="x-real">
    <div class="x-real__head"><LinkBadge link={link} />{link.lastAt && <span class="x-muted x-small">ostatni sygnał {clockTxt(link.lastAt)}</span>}</div>
    {link.state === 'never' && (url ? howTo : <Notice tone="info">To urządzenie nie ma własnej strony – jego stan może zgłaszać wyłącznie program sterujący (docs/KIOSK-WINDOWS.md). Do tego czasu stan jest symulowany.</Notice>)}
    {link.state === 'offline' && <Notice tone="warn">Brak sygnału od {agoTxt(link.agoSec)}. Poniżej ostatnie znane dane. Po 5 min bez sygnału przy stanie „włączone” serwer zakłada zgłoszenie awarii (P2) i zamyka je sam po powrocie połączenia.</Notice>}
    {pg && <section class="x-real__sec"><h4><Icon name="globe" size={16} />Strona urządzenia <RealMark /></h4>
      <dl class="x-real__dl">
        <dt>Przeglądarka i system</dt><dd data-testid="x-real-ua">{describeUa(pg.ua)}</dd>
        <dt>Rozdzielczość ekranu</dt><dd data-testid="x-real-screen">{pg.screen ? `${pg.screen[0]} × ${pg.screen[1]}${pg.screen[2] && pg.screen[2] !== 1 ? ` (skala ${pg.screen[2]})` : ''}` : '—'}</dd>
        <dt>Okno przeglądarki</dt><dd data-testid="x-real-viewport">{pg.viewport ? `${pg.viewport[0]} × ${pg.viewport[1]}` : '—'}</dd>
        <dt>Pełny ekran</dt><dd>{pg.fullscreen ? <Tag tone="green" icon="check">tak</Tag> : <><Tag tone="warn" icon="alert">nie</Tag> <small class="x-muted">{d.kind === 'kiosk' ? 'kiosk powinien działać w trybie pełnoekranowym (F11 / tryb kiosku przeglądarki)' : 'ekran powinien działać w trybie pełnoekranowym'}</small></>}</dd>
        <dt>Karta przeglądarki</dt><dd>{pg.visible === false ? <><Tag tone="warn">ukryta</Tag> <small class="x-muted">strona jest w tle – zwiedzający jej nie widzą</small></> : <Tag tone="green">widoczna</Tag>}</dd>
        <dt>Uruchomiona od</dt><dd>{pg.boot ? <>{fmtDateTime(new Date(pg.boot).toISOString())} <small class="x-muted">({agoTxt((now - pg.boot) / 1000)})</small></> : '—'}</dd>
        <dt>Ostatnia interakcja</dt><dd data-testid="x-real-input">{pg.lastInput && pg.boot && pg.lastInput - pg.boot > 1000 ? <>{clockTxt(pg.lastInput)} <small class="x-muted">({agoTxt((now - pg.lastInput) / 1000)} temu{d.kind === 'kiosk' ? ' – dotknięcie ekranu przez zwiedzającego' : ''})</small></> : <span class="x-muted">brak od uruchomienia strony</span>}</dd>
        <dt>Wersja aplikacji</dt><dd data-testid="x-real-ver">{fmtVer(pg.ver)} {pg.ver === s.build ? <Tag tone="green" icon="check">aktualna</Tag> : <><Tag tone="danger" icon="alert">nieaktualna</Tag> <small class="x-muted">panel: {fmtVer(s.build)} – odśwież stronę na urządzeniu (Restart aplikacji)</small></>}</dd>
        <dt>Adres IP</dt><dd><code>{pg.ip || 'nieznany'}</code></dd>
        <dt>Język / sieć</dt><dd>{pg.lang || '—'} · {pg.online === false ? 'przeglądarka zgłasza brak sieci' : 'sieć dostępna'}</dd>
      </dl>
      {d.restartedAt && <p class="x-muted x-small x-real__note">Ostatnie polecenie restartu: {fmtDateTime(d.restartedAt)} · {pg.boot > Date.parse(d.restartedAt) ? 'wykonane' : 'jeszcze niewykonane'}</p>}
    </section>}
    {ag ? <section class="x-real__sec"><h4><Icon name="cpu" size={16} />Program sterujący na komputerze <RealMark /></h4>
      <dl class="x-real__dl">
        <dt>Komputer</dt><dd data-testid="x-real-host">{ag.host || '—'}</dd>
        <dt>System</dt><dd>{ag.os || '—'}</dd>
        <dt>Obciążenie procesora</dt><dd data-testid="x-real-cpu">{ag.cpu != null ? `${ag.cpu}%` : '—'}</dd>
        <dt>Pamięć</dt><dd>{ag.memPct != null ? `${ag.memPct}% zajęte` : '—'}</dd>
        <dt>Wolne miejsce</dt><dd>{ag.diskFreeGb != null ? `${ag.diskFreeGb} GB` : '—'}</dd>
        <dt>Czas pracy komputera</dt><dd>{ag.uptimeH != null ? fmtUp(ag.uptimeH) : '—'}</dd>
        {ag.tempC != null && <><dt>Temperatura</dt><dd>{Math.round(ag.tempC)}°C</dd></>}
        <dt>Głośność</dt><dd data-testid="x-real-vol">{ag.volume != null ? <>{ag.volume}% {d.volume !== ag.volume && <small class="x-muted">(zadana {d.volume}%)</small>}</> : '—'}</dd>
        {ag.brightness != null && <><dt>Jasność</dt><dd>{ag.brightness}%</dd></>}
        <dt>Monitor</dt><dd data-testid="x-real-monitor">{ag.monitor === 'on' ? <Tag tone="green" icon="monitor">włączony</Tag> : ag.monitor === 'off' ? <Tag icon="moon">uśpiony</Tag> : '—'}</dd>
        {ag.ver && <><dt>Wersja programu</dt><dd>{ag.ver}</dd></>}
        {ag.note && <><dt>Uwagi</dt><dd>{ag.note}</dd></>}
        <dt>Ostatni sygnał programu</dt><dd>{clockTxt(ag.at)}</dd>
      </dl>
    </section> : (link.state !== 'never' && PAGE_KINDS[d.kind] && <p class="x-muted x-small"><Icon name="info" size={13} /> Brak programu sterującego na komputerze – obciążenie, pamięć, głośność systemowa i stan monitora są nieznane (instalacja: docs/KIOSK-WINDOWS.md).</p>)}
    {link.state !== 'never' && url && <details class="x-help"><summary><Icon name="external" size={15} />Adres strony tego urządzenia</summary><CopyUrl url={url} /></details>}
    <PresenceHelp mode="remote" />
  </div>);
}
