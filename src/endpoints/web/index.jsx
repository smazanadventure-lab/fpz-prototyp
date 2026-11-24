// Strona WWW / PWA Fabryki Pełnej Życia – portal z rozbudowanymi treściami i systemem rezerwacji.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Client, useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import './strings.js';
import './web.css';
import { NavCtx, parsePath } from './nav.js';
import { Header, Footer, CookieBanner, PwaPrompt, OfflineBar } from './layout.jsx';
import { HomePage } from './home.jsx';
import { HistoryPage } from './history.jsx';
import { CommunityPage } from './community.jsx';
import { MapPage } from './map.jsx';
import { GamePage } from './game.jsx';
import { EventsPage, LivePage, InfoPage, SearchPage, NotFound } from './pages.jsx';

export default function WebApp({ viewport = 'desktop' }) {
  return <Client id="web" base={16} class="ep-web"><Site viewport={viewport} /></Client>;
}

function Site({ viewport }) {
  useStore();
  const { client, set, api } = useClient();
  const [path, setPath] = useState(() => client.path || '');
  const scrollRef = useRef(null); const rootRef = useRef(null); const first = useRef(true);
  const skip = useRef(false);
  const go = (p) => { p = String(p || '').replace(/^\/+/, ''); setPath(p); set({ path: p }); };
  const replace = (p) => { skip.current = true; go(p); };
  useEffect(() => { api.stats.track('session'); }, []);
  // zmiana podstrony → przewinięcie do góry i fokus na nagłówku
  useEffect(() => {
    if (first.current || skip.current) { first.current = false; skip.current = false; return; }
    const sc = scrollRef.current; if (!sc) return;
    const target = path.includes('#') ? null : sc.querySelector('h1');
    sc.scrollTop = 0;
    if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    const id = setTimeout(() => { if (sc.scrollTop < 400) sc.scrollTop = 0; }, 80); return () => clearTimeout(id);
  }, [path]);
  // wysokość okna strony (dla osadzonego systemu rezerwacji) – pomiar przez ResizeObserver
  useLayoutEffect(() => {
    const el = scrollRef.current; const root = rootRef.current; if (!el || !root) return;
    const fit = () => { root.style.setProperty('--w-vh', el.clientHeight + 'px'); const h = root.querySelector('.w-head'); if (h) root.style.setProperty('--w-headh', h.offsetHeight + 'px'); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); const h = root.querySelector('.w-head'); if (h) ro.observe(h); return () => ro.disconnect();
  }, []);
  const r = parsePath(path);
  const compact = viewport !== 'desktop';
  let page;
  switch (r.sec) {
    case '': page = <HomePage />; break;
    case 'historia': page = <HistoryPage r={r} />; break;
    case 'spolecznosc': page = <CommunityPage r={r} />; break;
    case 'wydarzenia': page = <EventsPage r={r} />; break;
    case 'mapa': page = <MapPage r={r} />; break;
    case 'gra': page = <GamePage />; break;
    case 'transmisje': page = <LivePage r={r} />; break;
    case 'informacje': page = <InfoPage r={r} />; break;
    case 'szukaj': page = <SearchPage r={r} />; break;
    default: page = <NotFound />;
  }
  return (
    <NavCtx.Provider value={{ path, r, go, replace, viewport, compact }}>
      <div class={`w-root w-vp-${viewport}`} ref={rootRef}>
        <div class="w-scroll" ref={scrollRef}>
          <Header />
          {client.offlineSim && <OfflineBar />}
          <main id="w-main" class="w-main" key={r.sec + '/' + (r.sec === 'mapa' && r.a === 'miejsce' ? '' : r.a || '')}>{page}</main>
          <Footer />
        </div>
        <CookieBanner />
        <PwaPrompt />
      </div>
    </NavCtx.Provider>
  );
}
