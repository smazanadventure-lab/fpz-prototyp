// Aplikacja ekranu kiosku 1080×1920 (wewnątrz <Client id="kiosk:…">): stan urządzenia, wysokość, menu, dostępność, wygaszacz, menu serwisowe.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useClient, useNow, stopSpeaking } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { KIOSKS } from '../../kernel/seed.js';
import { clsx, pad2, fmtDate } from '../../kernel/util.js';
import { Icon, IconButton, Button, PatternBand, Logo, A11yBar, HeightIcon, PjmCall, Modal, Tag } from '../../ui/components.jsx';
import { KioskCtx, TakeHomeModal } from './common.jsx';
import { Illustration } from '../../ui/illustrations.jsx';
import { cap, Home, About, NewsView, MapScreen, InfoScreen, EventView, CategoryScreen, EntryView, GalleryScreen, VideosScreen, VideoView, TimelineScreen, PuzzleScreen } from './screens.jsx';
import { SoundHome, SoundScreen, CalendarScreen } from './sound.jsx';

/** Czas bezczynności do włączenia wygaszacza (prototyp: 60 s; w testach można nadpisać window.__fpzKiosk.idleMs). */
export const IDLE_MS = 60000;
export const SCREEN_W = 1080, SCREEN_H = 1920;
/**
 * Tryby wysokości wg próbki B („Zmiana wysokości”): strefa treści ma stałą wysokość (~68% ekranu), zmienia się jej położenie.
 * zone = [góra, dół] strefy treści w px ekranu; panel = górna krawędź lewego menu/panelu i kolumny dostępności.
 */
export const HEIGHTS = {
  standing: { zone: [0, 1300], panel: 566 },   // 150 cm – 1. sylwetka
  child: { zone: [472, 1770], panel: 858 },    // 130 cm – 2. sylwetka (domyślny, jak ekran startowy próbki)
  seated: { zone: [620, 1920], panel: 1486 },  // 105 cm – 3. sylwetka
};
export const DEFAULT_HEIGHT = 'child';
const PANEL_MAX_BOTTOM = 1891; // 98,5% wysokości ekranu
const TAB_TOP = 1206, TAB_H = 96; // zakładka wysokości – zawsze w tym samym miejscu (62,8% wysokości)
const A11Y_STEP = 68, A11Y_D = 51;
const HEIGHT_ORDER = ['standing', 'child', 'seated'];
const TOUCH_THROTTLE_MS = 2000;
const idleMs = () => (typeof window !== 'undefined' && window.__fpzKiosk?.idleMs) || IDLE_MS;

const VIEWS = { home: Home, about: About, news: NewsView, map: MapScreen, info: InfoScreen, event: EventView, cat: CategoryScreen, entry: EntryView, gallery: GalleryScreen, videos: VideosScreen, video: VideoView, timeline: TimelineScreen, puzzle: PuzzleScreen, sound: SoundScreen, calendar: CalendarScreen };

/** Menu główne – 5 pozycji jak w próbce (+ Dźwięki i Kalendarium w T1.5). Pozostałe kategorie z CMS są kaflami w dziale „Historia”. */
function buildMenu(variant, t) {
  const cats = sel.categoryTree(); const has = (id) => cats.some((c) => c.id === id);
  const m = [{ key: 'home', v: 'home', icon: 'pin', label: t('k.nav.home') }];
  if (has('historia')) m.push({ key: 'cat:historia', v: 'cat', p: { id: 'historia' }, icon: 'history', label: t('k.nav.history') });
  if (has('spolecznosc')) m.push({ key: 'cat:spolecznosc', v: 'cat', p: { id: 'spolecznosc' }, icon: 'community', label: t('k.nav.community') });
  m.push({ key: 'map', v: 'map', icon: 'map', label: t('k.nav.map') }, { key: 'info', v: 'info', icon: 'info', label: t('k.nav.info') });
  if (variant === 'sound') m.push({ key: 'sound', v: 'sound', icon: 'headphones', label: t('k.nav.sound') }, { key: 'calendar', v: 'calendar', icon: 'calendar', label: t('k.nav.calendar') });
  return m;
}
/** Panel kontekstowy podstron (jak w próbce: wstecz, nazwa działu, linia, poddziały jako pigułki). */
function contextFor(stack, t, L) {
  const root = stack[1]; const cur = stack[stack.length - 1]; if (!root) return null;
  let r = root;
  if (r.v === 'entry') { const e = sel.entry(r.p?.id); let c = e && sel.category(e.categoryId); while (c && c.parentId) c = sel.category(c.parentId); r = { v: 'cat', p: { id: c?.id } }; }
  if (r.v === 'cat') {
    const id = r.p?.id; const cat = sel.category(id); const media = id === 'historia' || id === 'spolecznosc';
    const items = [{ id: 'cat', label: t('k.entries'), to: [] }];
    if (media) items.push({ id: 'gallery', label: t('k.gallery'), to: [{ v: 'gallery', p: { from: id } }] }, { id: 'videos', label: t('k.videos'), to: [{ v: 'videos', p: { from: id } }] });
    if (id === 'historia') items.push({ id: 'timeline', label: t('k.timeline'), to: [{ v: 'timeline' }] }, { id: 'puzzle', label: t('k.puzzle'), to: [{ v: 'puzzle' }] });
    const act = { gallery: 'gallery', videos: 'videos', video: 'videos', timeline: 'timeline', puzzle: 'puzzle' }[cur.v] || 'cat';
    return { title: id === 'historia' ? t('k.nav.history') : id === 'spolecznosc' ? t('k.nav.community') : L(cat?.name), items, active: act, base: [{ v: 'home' }, { v: 'cat', p: { id } }] };
  }
  if (['info', 'event', 'news', 'about'].includes(r.v)) {
    const tabs = [['today', t('k.today')], ['week', t('k.week')], ['cal', t('k.calendar')], ['news', t('k.news')], ['practical', t('k.practical')]];
    const act = cur.v === 'info' ? cur.p?.tab || 'today' : cur.v === 'news' ? 'news' : cur.v === 'about' ? 'practical' : null;
    return { title: t('k.nav.info'), items: tabs.map(([id, label]) => ({ id, label, root: { v: 'info', p: { tab: id } } })), active: act, base: [{ v: 'home' }] };
  }
  if (r.v === 'sound') return { title: t('k.nav.sound'), items: [], base: [{ v: 'home' }] };
  if (r.v === 'calendar') return { title: t('k.nav.calendar'), items: [], base: [{ v: 'home' }] };
  return { title: '', items: [], base: [{ v: 'home' }] };
}

export function KioskScreen({ deviceId, sound, activityRef, standalone }) {
  const s = useStore(); const { client, set, t, L, api, toast } = useClient();
  const device = sel.device(deviceId) || {}; const kiosk = KIOSKS.find((k) => k.id === deviceId) || KIOSKS[0];
  const mode = HEIGHT_ORDER.includes(device.heightMode) ? device.heightMode : DEFAULT_HEIGHT;
  const stack = client.kNav?.length ? client.kNav : [{ v: 'home' }];
  const [th, setTh] = useState(null); const [pjm, setPjm] = useState(false); const [attract, setAttract] = useState(false); const [boot, setBoot] = useState(false); const [svc, setSvc] = useState(null);
  const lastTouch = useRef(0); const local = useRef(Date.now()); const act = activityRef || local;
  const panelRef = useRef(null); const [panelH, setPanelH] = useState(360);
  useLayoutEffect(() => { const el = panelRef.current; if (!el) return; const ro = new ResizeObserver(() => setPanelH(el.offsetHeight || 360)); ro.observe(el); setPanelH(el.offsetHeight || 360); return () => ro.disconnect(); });

  const nav = {
    stack,
    go: (v, p = {}) => set({ kNav: [...stack, { v, p }].slice(-12) }),
    replace: (v, p = {}) => set({ kNav: [...stack.slice(0, -1), { v, p }] }),
    back: () => set({ kNav: stack.length > 1 ? stack.slice(0, -1) : [{ v: 'home' }] }),
    section: (v, p = {}) => set({ kNav: v === 'home' ? [{ v: 'home' }] : [{ v: 'home' }, { v, p }] }),
    to: (arr) => set({ kNav: arr }),
  };
  const takeHome = (code, title, opts = {}) => setTh({ code, title, ...opts });
  const resetUser = () => {
    stopSpeaking(); setTh(null); setPjm(false); setSvc(null);
    set({ kNav: [{ v: 'home' }], lang: s.settings.defaultLang || 'pl', contrast: 'normal', fs: 1, lector: false });
    if (device.heightMode !== DEFAULT_HEIGHT) api.devices.set(deviceId, { heightMode: DEFAULT_HEIGHT });
  };

  // wygaszacz po bezczynności
  useEffect(() => {
    const i = setInterval(() => { if (!attract && device.power === 'on' && !pjm && !sound?.offHook && Date.now() - act.current > idleMs()) { resetUser(); setAttract(true); } }, 1000);
    return () => clearInterval(i);
  });
  useEffect(() => { act.current = Date.now(); if (sound?.offHook) setAttract(false); }, [sound?.offHook]);
  // restart zdalny (system zarządzania) → ekran startowy
  const prevRestart = useRef(device.restartedAt);
  useEffect(() => {
    if (device.restartedAt && device.restartedAt !== prevRestart.current) { prevRestart.current = device.restartedAt; resetUser(); setAttract(false); setBoot(true); const tm = setTimeout(() => setBoot(false), 1800); return () => clearTimeout(tm); }
  }, [device.restartedAt]);
  useEffect(() => { if (device.power !== 'on') { setPjm(false); setTh(null); } }, [device.power]);

  const onDown = () => {
    act.current = Date.now();
    if (Date.now() - lastTouch.current > TOUCH_THROTTLE_MS) { lastTouch.current = Date.now(); api.stats.track('touch', deviceId); }
  };
  const cycleHeight = () => { const n = HEIGHT_ORDER[(HEIGHT_ORDER.indexOf(mode) + 1) % 3]; api.devices.set(deviceId, { heightMode: n }); toast(t('k.heightSet', { mode: t('k.h.' + n) }), 'info', 1800); };

  // długie przytrzymanie lewego górnego rogu → PIN → menu serwisowe
  const lp = useRef(null);
  const corner = { onPointerDown: () => { lp.current = setTimeout(() => setSvc('pin'), 1500); }, onPointerUp: () => clearTimeout(lp.current), onPointerLeave: () => clearTimeout(lp.current) };

  const H = HEIGHTS[mode]; const [z0, z1] = H.zone;
  const cur = stack[stack.length - 1]; const View = VIEWS[cur.v] || Home; const V = kiosk.variant === 'sound' && cur.v === 'home' ? SoundHome : View;
  const isMap = cur.v === 'map'; const isHome = cur.v === 'home';
  const menu = buildMenu(kiosk.variant, t);
  const cx = isHome || isMap ? null : contextFor(stack, t, L);
  // wspólna górna krawędź lewego panelu i kolumny dostępności (w trybie „wózek” panel nie może wyjść poza 98,5% ekranu)
  const leftH = isMap ? 430 : panelH; const a11yH = 5 * A11Y_STEP;
  const panelTop = mode === 'seated' ? Math.min(H.panel, PANEL_MAX_BOTTOM - Math.max(leftH, a11yH)) : H.panel;
  // szósty przycisk (PJM): bezpośrednio pod kolumną, chyba że wypadłby na zakładce wysokości – wtedy pod nią
  let pjmTop = panelTop + 5 * A11Y_STEP; if (pjmTop + A11Y_D > TAB_TOP - 8 && pjmTop < TAB_TOP + TAB_H + 8) pjmTop = TAB_TOP + TAB_H + 17;
  const photoBand = { gallery: ['hall-interior', 'quarry'], videos: ['map-old', 'map-old'], video: ['map-old', 'map-old'] }[cur.v];
  const band = (where, style) => photoBand
    ? <div class={`k-band k-band--${where} k-band--photo`} style={style} aria-hidden="true"><Illustration id={photoBand[where === 'top' ? 0 : 1]} tone="duotone" /></div>
    : <PatternBand class={`k-band k-band--${where}`} scale={1.6} style={style} />;
  const ctx = { device, kiosk, nav, takeHome, sound, zoneTop: z0, panelTop, mode };
  const dim = device.brightness != null && device.brightness < 80 ? Math.min(0.75, ((80 - device.brightness) / 80) * 0.8) : 0; // 80% = jasność nominalna

  if (device.power === 'off') return <div class="k-screen k-off" aria-label="Ekran wyłączony" />;
  if (device.power === 'service' || device.power === 'fault') {
    const f = device.power === 'fault';
    return (<div class={clsx('k-screen k-plate', f && 'k-plate--fault')}>
      <PatternBand class="k-plate__band" scale={1.6} />
      <div class="k-plate__box"><Icon name={f ? 'alert' : 'wrench'} size={96} /><h1>{t(f ? 'k.fault' : 'k.service')}</h1><p>{t(f ? 'k.faultText' : 'k.serviceText')}</p>
        <p class="k-plate__en" lang="en">{f ? 'Station temporarily unavailable' : 'Maintenance break'}</p><Logo /></div>
      <div class="k-dim" style={{ opacity: dim }} />
    </div>);
  }
  return (
    <KioskCtx.Provider value={ctx}>
      <div class={clsx('k-screen', `k-h-${mode}`, isMap && 'is-map')} onPointerDownCapture={onDown} onKeyDownCapture={() => { act.current = Date.now(); }}>
        {band('top', { height: z0 + 'px' })}
        {band('bottom', { top: z1 + 'px', height: SCREEN_H - z1 + 'px' })}
        <div class="k-zone" style={{ top: z0 + 'px', height: z1 - z0 + 'px' }}>
          <main class="k-main" id={`k-main-${deviceId}`}>
            <div class={clsx('k-view', isMap && 'k-view--full')} key={stack.length + ':' + cur.v + ':' + JSON.stringify(cur.p || {})}>
              <V {...(cur.p || {})} />
            </div>
          </main>
        </div>
        {isHome && <nav class="k-menu" ref={panelRef} style={{ top: panelTop + 'px' }} aria-label={t('k.menu')}>
          <ul>{menu.map((m) => <li key={m.key}><button type="button" class={clsx('k-menu__it', m.key === 'home' && 'is-active')} aria-current={m.key === 'home' ? 'page' : undefined} onClick={() => nav.section(m.v, m.p)}>
            <Icon name={m.icon} size={28} /><span>{m.label}</span></button></li>)}</ul>
        </nav>}
        {cx && <nav class="k-ctx" ref={panelRef} style={{ top: panelTop + 'px' }} aria-label={cx.title}>
          <IconButton icon="back" label={t('k.back')} class="k-ctx__back" onClick={nav.back} />
          <b class="k-ctx__title">{cx.title}</b>
          {cx.items.length > 0 && <ul>{cx.items.map((it) => <li key={it.id}><button type="button" class={clsx('k-pill', cx.active === it.id && 'is-active')} aria-current={cx.active === it.id ? 'page' : undefined}
            onClick={() => nav.to(it.root ? [{ v: 'home' }, it.root] : [...cx.base, ...it.to])}>{it.label}</button></li>)}</ul>}
        </nav>}
        <div class="k-side" style={{ top: panelTop + 'px' }}>
          <A11yBar show={['lang', 'contrast', 'bigger', 'smaller', 'lector']} />
        </div>
        <div class="k-side k-side--pjm" style={{ top: pjmTop + 'px' }}><div class="fpz-a11y"><IconButton icon="hand" label={t('c.pjm')} onClick={() => setPjm(true)} /></div></div>
        <button type="button" class="k-hbtn" style={{ top: TAB_TOP + 'px' }} onClick={cycleHeight} aria-label={`${t('k.height')}: ${t('k.h.' + mode)}`} title={t('k.height')}><HeightIcon active={mode} size={48} /></button>
        <button type="button" class="k-corner" aria-hidden="true" tabIndex={-1} {...corner} />
        {attract && <Attract onStart={() => { act.current = Date.now(); setAttract(false); }} kiosk={kiosk} />}
        {boot && <div class="k-boot"><Logo onDark /><div class="fpz-spinner" /><p>{t('k.booting')}</p></div>}
        <TakeHomeModal data={th} onClose={() => setTh(null)} />
        <PjmCall open={pjm} onClose={() => setPjm(false)} where={`Kiosk ${deviceId} – ${kiosk.name}`} />
        {svc && <Service step={svc} setStep={setSvc} device={device} toast={toast} api={api} standalone={standalone} />}
        <div class="k-dim" style={{ opacity: dim }} />
      </div>
    </KioskCtx.Provider>
  );
}

function Attract({ onStart, kiosk }) {
  const { t, L, lang } = useClient(); const now = useNow(1000); const s = useStore(); const ev = sel.events()[0];
  return (<div class="k-attract" role="button" tabIndex={0} aria-label={t('k.touchStart')} onClick={onStart} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStart(); }}>
    <PatternBand class="k-attract__band" scale={1.6} />
    <div class="k-attract__box">
      <Logo onDark />
      <b class="k-attract__clock">{s.env.simTime || `${pad2(now.getHours())}:${pad2(now.getMinutes())}`}</b>
      <span class="k-attract__date">{cap(fmtDate(now.toISOString(), lang, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
      <h1>{kiosk.variant === 'sound' ? t('k.welcomeSound') : kiosk.name}</h1>
      <p>{t('k.attractSub')}</p>
      {ev && <p class="k-attract__ev"><Icon name="calendar" size={30} /> {L(ev.title)}</p>}
      <span class="k-attract__cta"><Icon name="hand" size={44} /> {t('k.touchStart')}</span>
      <span class="k-attract__en" lang="en">Touch to start · Dotknij, aby rozpocząć</span>
    </div>
  </div>);
}

function Service({ step, setStep, device, api, toast, standalone }) {
  const { t } = useClient(); const s = useStore(); const [pin, setPin] = useState('');
  const close = () => setStep(null);
  if (step === 'pin') {
    const press = (d) => { const n = (pin + d).slice(0, 4); setPin(n); if (n.length === 4) { if (n === '1234') { setStep('menu'); } else { toast(t('k.svc.bad'), 'error'); setPin(''); } } };
    return (<Modal open onClose={close} title={t('k.svc.pin')} size="sm" closeLabel={t('c.close')}>
      <div class="k-pin"><div class="k-pin__dots" aria-live="polite">{[0, 1, 2, 3].map((i) => <i key={i} class={i < pin.length ? 'is-on' : ''} />)}</div>
        <div class="k-pin__pad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'].map((d) => <button key={d} type="button" onClick={() => (d === 'C' ? setPin('') : d === '←' ? setPin(pin.slice(0, -1)) : press(d))}>{d}</button>)}</div></div>
    </Modal>);
  }
  const pls = s.playlists.filter((p) => p.id === device.playlistId);
  const rows = [['Urządzenie', `${device.id} – ${device.name}`], ['Model', device.model], ['Adres IP / MAC', `${device.ip} / ${device.mac}`], ['Wersja aplikacji', device.appVersion], ['Czas pracy', `${(device.uptimeH || 0).toFixed(1)} h`], ['Temperatura / CPU', `${Math.round(device.tempC)}°C / ${device.cpu}%`],
    ['Harmonogram', device.schedule], ['Playlisty', pls.length ? pls.map((p) => p.name).join(', ') : 'treści z CMS (kanał „kiosk”), brak playlisty LCD'], ['Dotknięcia dziś', device.touchesToday], ['Wyposażenie', (device.accessories || []).join(', ')], ['Tryb', (standalone ? 'aplikacja samodzielna' : 'symulator') + ' · pełny ekran · autostart · blokada wyjścia do systemu'],
    ...(device.variant === 'sound' ? [['Przyciski fizyczne', 'Słuchawka i przyciski ścieżek są podłączone przez kontroler HID jako klawiatura: spacja = podniesienie/odłożenie słuchawki, strzałki ← / → = poprzednia/następna ścieżka (zamiennie przyciski ekranowe w dziale „Dźwięki”).']] : [])];
  return (<Modal open onClose={close} title={t('k.svc.title')} size="lg" closeLabel={t('c.close')}
    footer={<><Button variant="secondary" icon="activity" onClick={() => toast('Test dotyku: OK (10/10 punktów)', 'ok')}>{t('k.svc.calib')}</Button><Button variant="danger" icon="refresh" onClick={() => { api.devices.restart(device.id); close(); }}>{t('k.svc.restart')}</Button><Button onClick={close}>{t('k.svc.exit')}</Button></>}>
    <table class="k-svc"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
    <p class="k-card__meta"><Tag tone="warn">{t('c.test')}</Tag> Zamknięcie aplikacji wymaga uprawnień serwisowych; restart jest odnotowywany w dzienniku systemu zarządzania.</p>
  </Modal>);
}
