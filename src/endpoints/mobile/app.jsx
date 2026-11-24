// Szkielet aplikacji: fazy startu, nawigacja (zakładka + stos ekranów), dolna nawigacja, szuflada, nakładki globalne.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useClient, useEnv } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel, makeApi } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx } from '../../kernel/util.js';
import { speak, stopSpeaking, estimateSeconds } from '../../ui/speech.js';
import { Icon } from '../../ui/components.jsx';
import GameSection from '../game/index.jsx';
import ReservationApp from '../reservation/index.jsx';
import { AppCtx, TABS, useApp } from './ctx.js';
import { Screen } from './ui.jsx';
import { Splash, LangPick, Tutorial } from './onboarding.jsx';
import { Drawer } from './drawer.jsx';
import { HomeScreen } from './home.jsx';
import { CatalogRoot, CategoryScreen, EntryScreen, GalleryScreen, VideosScreen, VideoScreen, LiveScreen, AboutSiteScreen } from './content.jsx';
import { ScanScreen, MemoriesScreen } from './scan.jsx';
import { MapScreen, PoiSheet, RouteBuilder } from './map.jsx';
import { SettingsScreen, A11yScreen, CouponsScreen, QuizzesScreen, QuizScreen, NotificationsScreen, SearchScreen, SocialScreen, InfoScreen, AboutScreen } from './more.jsx';
import { AudioScreen, MiniPlayer } from './audio.jsx';
import { Banners } from './banners.jsx';
import { TestModeSheet, useDeviceEnv } from './testmode.jsx';
import { decodeImageData } from './camera.jsx';

strings({
  'm.tab.home': ['Główna', 'Home'], 'm.tab.history': ['Historia', 'History'], 'm.tab.community': ['Społeczność', 'Community'], 'm.tab.map': ['Nawigacja', 'Navigation'], 'm.tab.game': ['Gra terenowa', 'Field game'],
  'm.nav.main': ['Nawigacja główna', 'Main navigation'], 'm.res.title': ['Bilety i rezerwacje', 'Tickets & bookings'],
  'm.res.offline': ['System rezerwacji wymaga połączenia z internetem. Kupione bilety są dostępne offline.', 'Booking needs an internet connection. Tickets you have bought are available offline.'],
  'm.res.myTickets': ['Pokaż moje bilety', 'Show my tickets'],
});

const ROOT = { home: 'home', history: 'historyRoot', community: 'communityRoot', map: 'mapRoot', game: 'gameRoot' };
let seq = 1;

function GameScreen() {
  const app = useApp();
  return <div class="m-screen-in"><div class="m-embed m-embed--game"><GameSection nav={app.gameNav} /></div></div>;
}
function ReservationScreen({ initial }) {
  const { t } = useClient(); const { env } = useEnv(); const app = useApp(); const [view, setView] = useState(initial || { view: 'home' });
  const blocked = env.network === 'offline' && view.view !== 'tickets';
  return (<Screen title={t('m.res.title')} crumbs={[t('m.tab.home'), t('m.res.title')]} embed hideTitle>
    {blocked ? <div class="m-needsnet"><Icon name="wifiOff" size={34} /><p>{t('m.res.offline')}</p><button type="button" class="fpz-btn fpz-btn--primary" onClick={() => setView({ view: 'tickets' })}><Icon name="ticket" size={18} />{t('m.res.myTickets')}</button></div>
      : <ReservationApp key={JSON.stringify(view)} channel="mobile" initial={view} nav={{ showOnMap: app.showOnMap }} />}
  </Screen>);
}

const SCREENS = {
  home: HomeScreen, historyRoot: (p) => <CatalogRoot section="history" {...p} />, communityRoot: (p) => <CatalogRoot section="community" {...p} />, mapRoot: MapScreen, gameRoot: GameScreen,
  category: CategoryScreen, entry: EntryScreen, gallery: GalleryScreen, videos: VideosScreen, video: VideoScreen, live: LiveScreen, aboutSite: AboutSiteScreen,
  scan: ScanScreen, memories: MemoriesScreen, routeBuilder: RouteBuilder, reservation: ReservationScreen,
  settings: SettingsScreen, a11y: A11yScreen, coupons: CouponsScreen, quizzes: QuizzesScreen, quiz: QuizScreen, notifications: NotificationsScreen,
  search: SearchScreen, social: SocialScreen, info: InfoScreen, about: AboutScreen, audio: AudioScreen,
};
const DARK_TOP = [];

export function App({ platform, standalone }) {
  const { client, set, lang, L, t } = useClient(); const { env } = useEnv();
  const [phase, setPhase] = useState('splash');
  const [nav, setNav] = useState(() => ({ tab: 'home', anim: 'tab', visited: ['home'], stacks: Object.fromEntries(TABS.map((x) => [x.id, [{ name: ROOT[x.id], key: x.id, props: {} }]])) }));
  const [navHidden, setNavHidden] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [poiSheet, setPoiSheet] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [audio, setAudio] = useState({ ids: [], i: 0, playing: false, startedAt: 0, dur: 0, open: false });
  const [testMode, setTestMode] = useState(false); const gps = useDeviceEnv(standalone);
  const audioTok = useRef(0); const rootRef = useRef(null);

  useEffect(() => { const tm = setTimeout(() => setPhase(getState().clients.mobile?.onboarded ? 'main' : 'lang'), 1500); return () => clearTimeout(tm); }, []);

  // pomiar wysokości dolnej nawigacji (skala tekstu zmienia wysokość)
  useLayoutEffect(() => {
    const el = rootRef.current?.querySelector('.m-bnav'); if (!el) return;
    const ro = new ResizeObserver(() => { const h = el.getBoundingClientRect().height; if (h) rootRef.current.style.setProperty('--m-navh', h + 'px'); }); ro.observe(el); return () => ro.disconnect();
  }, [phase]);

  const top = nav.stacks[nav.tab][nav.stacks[nav.tab].length - 1];
  const dark = client.theme === 'night' || client.contrast === 'high' || (phase === 'main' && DARK_TOP.includes(top.name));
  useEffect(() => { const want = dark ? 'light' : 'dark'; if (client.statusBar !== want) set({ statusBar: want }); }, [dark, client.statusBar]);

  const go = (tab) => { setNavHidden(false); setDrawer(false); setNav((n) => (n.tab === tab ? { ...n, anim: 'pop', stacks: { ...n.stacks, [tab]: n.stacks[tab].slice(0, 1) } } : { ...n, tab, anim: 'tab', visited: n.visited.includes(tab) ? n.visited : [...n.visited, tab] })); };
  const push = (name, props = {}) => { setNavHidden(false); setDrawer(false); setNav((n) => ({ ...n, anim: 'push', stacks: { ...n.stacks, [n.tab]: [...n.stacks[n.tab], { name, props, key: `s${seq++}` }] } })); };
  const pop = () => { setNavHidden(false); setNav((n) => (n.stacks[n.tab].length > 1 ? { ...n, anim: 'pop', stacks: { ...n.stacks, [n.tab]: n.stacks[n.tab].slice(0, -1) } } : n)); };
  const toTabRoot = (tab, after) => { setNavHidden(false); setDrawer(false); setNav((n) => ({ ...n, tab, anim: 'tab', visited: n.visited.includes(tab) ? n.visited : [...n.visited, tab], stacks: { ...n.stacks, [tab]: n.stacks[tab].slice(0, 1) } })); after?.(); };

  // audioprzewodnik – kolejka wpisów
  const playAudio = (ids, i = 0) => {
    const e = sel.entry(ids[i]); if (!e?.audioGuide) return; const text = L(e.audioGuide.text); const tok = ++audioTok.current;
    stopSpeaking();
    setAudio({ ids, i, playing: true, startedAt: Date.now(), dur: estimateSeconds(text), open: true });
    speak(text, { lang, onend: (fin) => { if (tok !== audioTok.current) return; if (fin && i + 1 < ids.length && getState().clients.mobile?.audioQueue !== false) playAudio(ids, i + 1); else setAudio((a) => ({ ...a, playing: false })); } });
  };
  const audioCtl = {
    ...audio, play: playAudio,
    toggle: () => { if (audio.playing) { audioTok.current++; stopSpeaking(); setAudio((a) => ({ ...a, playing: false })); } else playAudio(audio.ids, audio.i); },
    next: () => audio.i + 1 < audio.ids.length && playAudio(audio.ids, audio.i + 1), prev: () => audio.i > 0 && playAudio(audio.ids, audio.i - 1),
    close: () => { audioTok.current++; stopSpeaking(); setAudio({ ids: [], i: 0, playing: false, startedAt: 0, dur: 0, open: false }); },
  };

  const app = {
    platform, standalone: !!standalone, gps, openTestMode: () => { setDrawer(false); setTestMode(true); }, tab: nav.tab, top, go, push, pop, navHidden, phase, mapFocus, audio: audioCtl, playAudio,
    onScroll: (dir) => setNavHidden(dir === 'down'),
    openDrawer: () => setDrawer(true), closeDrawer: () => setDrawer(false),
    openEntry: (id) => { setPoiSheet(null); push('entry', { id }); },
    openPoi: (id) => setPoiSheet(id), closePoi: () => setPoiSheet(null),
    showOnMap: (poiId) => { setPoiSheet(null); toTabRoot('map', () => setMapFocus({ poiId, n: seq++ })); },
    showRoute: (routeId) => { setPoiSheet(null); toTabRoot('map', () => setMapFocus({ routeId, n: seq++ })); },
    openScanner: (mode = 'qr') => push('scan', { mode }), openCoupons: (highlight) => push('coupons', { highlight }),
    openReservation: (initial = { view: 'home' }) => { setPoiSheet(null); push('reservation', { initial }); },
    showTutorial: () => { setDrawer(false); setPhase('tutorial'); },
  };
  app.gameNav = { openEntry: app.openEntry, openPoi: app.openPoi, showOnMap: app.showOnMap, openScanner: () => app.openScanner('qr'), openCoupons: () => app.openCoupons() };
  if (typeof window !== 'undefined') window.__fpzMobile = { push, go, pop, openPoi: app.openPoi, showOnMap: app.showOnMap, set, phase, testApi: globalThis.FPZ_APP_ONLY ? null : makeApi('cms'), decodeImageData, openTestMode: app.openTestMode,
    /** Systemowy przycisk „wstecz” (aplikacja Android): zamyka panel / cofa ekran; false = nie ma dokąd wrócić. */
    back: () => { if (testMode) { setTestMode(false); return true; } if (drawer) { setDrawer(false); return true; } if (poiSheet) { setPoiSheet(null); return true; } if (phase !== 'main') return false; if (nav.stacks[nav.tab].length > 1) { pop(); return true; } const first = Object.keys(nav.stacks)[0]; if (nav.tab !== first) { go(first); return true; } return false; } }; // wyłącznie do testów

  const finishOnboarding = () => { set({ onboarded: true }); setPhase('main'); };
  const embedTop = top.name === 'gameRoot' || top.name === 'reservation';

  return (<AppCtx.Provider value={app}>
    <div ref={rootRef} class={clsx('m-app', `m-${platform}`, standalone && 'm-standalone')} data-platform={platform}>
      {phase === 'splash' && <Splash />}
      {phase === 'lang' && <LangPick onNext={() => setPhase('tutorial')} />}
      {phase === 'tutorial' && <Tutorial onDone={finishOnboarding} />}
      {phase === 'main' && <>
        <main class="m-stage">
          {TABS.filter((x) => nav.visited.includes(x.id)).map((x) => nav.stacks[x.id].map((it, k, arr) => {
            const C = SCREENS[it.name]; const isTop = x.id === nav.tab && k === arr.length - 1;
            return <section key={it.key} class={clsx('m-screen', isTop && `m-anim-${nav.anim}`)} hidden={!isTop} aria-hidden={!isTop}>{C ? <C {...it.props} active={isTop && !poiSheet && !drawer && !testMode} /> : null}</section>;
          }))}
        </main>
        <MiniPlayer hidden={navHidden && !embedTop} />
        <Banners />
        <nav class={clsx('m-bnav', navHidden && !embedTop && 'is-hidden')} aria-label={t('m.nav.main')}>
          {TABS.map((x) => <BottomItem key={x.id} tab={x} active={nav.tab === x.id} onClick={() => go(x.id)} />)}
        </nav>
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
        {poiSheet && <PoiSheet id={poiSheet} onClose={() => setPoiSheet(null)} />}
        {testMode && <TestModeSheet gps={gps} standalone={standalone} onClose={() => setTestMode(false)} />}
      </>}
    </div>
  </AppCtx.Provider>);
}

function BottomItem({ tab, active, onClick }) {
  const { t } = useClient();
  return <button type="button" class={clsx('m-bnav__item', active && 'is-active')} aria-current={active ? 'page' : undefined} onClick={onClick}><span class="m-bnav__ico"><Icon name={tab.icon} size={22} /></span><span class="m-bnav__lbl">{t(tab.key)}</span></button>;
}
