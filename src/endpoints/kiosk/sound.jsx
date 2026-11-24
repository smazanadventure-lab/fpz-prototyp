// Kiosk TZ.T1.5 „Hala Ząbkowice i Dźwięki miasta”: ekran główny z podziałem treści, widżety (pogoda, zegar, kalendarium), stanowisko dźwiękowe.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient, useNow } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { clsx, fmtDate, fmtTime, dayStr, pad2 } from '../../kernel/util.js';
import { Icon, IconButton, Card, Tag, Media, Logo, Empty, Button } from '../../ui/components.jsx';
import { useKiosk, ScreenHead, WEATHER_ICON } from './common.jsx';
import { EventRow, MonthCal, cap } from './screens.jsx';

export function ClockWidget({ big }) {
  const { lang, t } = useClient(); const now = useNow(1000); const s = useStore(); const sim = s.env.simTime;
  const hhmm = sim || `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return (<div class={clsx('k-w k-w--clock', big && 'is-big')} aria-label={t('k.clock')}>
    <Icon name="clock" size={24} />
    <div><b class="k-w__time">{hhmm}{!sim && <small>:{pad2(now.getSeconds())}</small>}</b>
      <span class="k-w__date">{cap(fmtDate(now.toISOString(), lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span></div>
  </div>);
}
export function WeatherWidget() {
  const { t } = useClient(); const s = useStore(); const w = s.env.weather || {}; const kind = w.kind || 'cloudy';
  return (<div class="k-w k-w--weather" aria-label={t('k.weather')}>
    <Icon name={WEATHER_ICON[kind] || 'cloud'} size={64} />
    <div><b class="k-w__temp">{w.tempC != null ? `${Math.round(w.tempC)}°C` : '—'}</b><span>{t('k.w.' + kind)}</span><span class="k-w__wind"><Icon name="wind" size={16} /> {t('k.wind', { v: w.wind ?? '—' })}</span></div>
  </div>);
}
/** „Tego dnia / w tym roku w historii” – rocznice z lat wpisów (co 5 lat), w pozostałe dni rotacja wg dnia roku. */
export function historyToday(s, L, n = 3) {
  const now = new Date(); const y = now.getFullYear();
  const items = [...s.entries.filter((e) => e.status === 'published' && e.year && (e.channels || []).includes('kiosk')).map((e) => ({ key: e.id, year: e.year, title: L(e.title), entryId: e.id, ill: (e.media || [])[0]?.ill })),
    ...s.gallery.filter((g) => g.year).map((g) => ({ key: g.id, year: g.year, title: L(g.title), ill: g.ill }))];
  const ann = items.filter((x) => (y - x.year) % 5 === 0 && y > x.year).map((x) => ({ ...x, ann: y - x.year }));
  const doy = Math.floor((now - new Date(y, 0, 0)) / 864e5);
  const rest = items.filter((x) => !ann.includes(x)).sort((a, b) => ((a.year * 31 + doy) % 97) - ((b.year * 31 + doy) % 97));
  return [...ann, ...rest].slice(0, n);
}
function HistoryList({ n = 3 }) {
  const { t, L } = useClient(); const s = useStore(); const { nav } = useKiosk(); const list = historyToday(s, L, n);
  if (!list.length) return <p class="k-card__meta">{t('k.noHistory')}</p>;
  return <ul class="k-hist">{list.map((x) => <li key={x.key}><button type="button" class="k-hist__it" onClick={() => x.entryId && nav.go('entry', { id: x.entryId })} disabled={!x.entryId}>
    <span class="k-hist__y">{x.year}</span><span><small>{x.ann ? t('k.yearsAgo', { n: x.ann }) : t('k.inYear', { y: x.year })}</small><b>{x.title}</b></span></button></li>)}</ul>;
}

export function SoundHome() {
  const { t, L, lang } = useClient(); const s = useStore(); const { nav, sound } = useKiosk();
  const today = dayStr(); const evs = sel.events().filter((e) => e.start.slice(0, 10) <= today && e.end.slice(0, 10) >= today).slice(0, 2); const upcoming = evs.length ? evs : sel.events().slice(0, 2);
  const news = sel.news().slice(0, 2); const tr = sound?.track;
  const div = [['history', 'history', 'k.div.history', () => nav.section('cat', { id: 'historia' }), 'factory-archival'], ['community', 'people', 'k.div.community', () => nav.section('cat', { id: 'spolecznosc' }), 'workers'],
    ['map', 'map', 'k.div.map', () => nav.section('map'), 'hall-exterior'], ['news', 'news', 'k.div.news', () => nav.section('info', { tab: 'news' }), 'stage']];
  return (<div class="k-page k-home">
    <header class="k-welcome"><h1>{t('k.welcomeSound')}</h1><Logo /></header>
    <div class="k-widgets"><Card class="k-card" onClick={() => nav.section('calendar')}><ClockWidget /></Card><Card class="k-card"><WeatherWidget /></Card></div>
    <Card variant="deep" class={clsx('k-card k-sndcard', sound?.offHook && 'is-live')} onClick={() => nav.section('sound')}>
      <span class="k-sndcard__ic"><Icon name="phoneCall" size={36} /></span>
      <div><Tag tone={sound?.offHook ? 'live' : 'neutral'}>{t('k.snd.title')}</Tag><h2>{sound?.offHook ? `${t('k.snd.playing')}: ${L(tr?.name)}` : t('k.snd.lift')}</h2><p>{L(tr?.desc)}</p></div>
      <Viz on={sound?.playing} small getLevels={sound?.getLevels} />
    </Card>
    <div class="k-divs">{div.map(([id, ic, key, fn, ill]) => <button key={id} type="button" class="k-div" onClick={fn}><Media ill={ill} tone="duotone" ratio="16/9" shape="arc-tr" alt="" /><span><Icon name={ic} size={24} /><b>{t(key)}</b></span></button>)}</div>
    <div class="k-cols">
      <Card class="k-card k-pad"><h2 class="k-card__title"><Icon name="calendar" size={22} /> {t('k.todayAtFpz')}</h2>
        {upcoming.length ? <ul class="k-evlist k-evlist--mini">{upcoming.map((e) => <li key={e.id}><EventRow e={e} /></li>)}</ul> : <p class="k-card__meta">{t('k.noEvents')}</p>}</Card>
      <Card class="k-card k-pad"><h2 class="k-card__title"><Icon name="history" size={22} /> {t('k.onThisDay')}</h2><HistoryList n={3} /></Card>
    </div>
    {news.length > 0 && <div class="k-newsrow">{news.map((n) => <Card key={n.id} class="k-card k-row k-row--sm" onClick={() => nav.go('news', { id: n.id })}><Media ill={n.ill} src={n.src} ratio="1/1" shape="arc-tl" alt="" /><div><p class="k-card__meta">{fmtDate(n.date, lang)}</p><h3 class="k-card__title">{L(n.title)}</h3></div></Card>)}</div>}
  </div>);
}

/** Wizualizacja dźwięku: poziomy z analizatora (getLevels, gdy dostępny) albo animacja CSS. */
export function Viz({ on, small, getLevels }) {
  const ref = useRef(null); const n = small ? 9 : 24;
  useEffect(() => {
    if (!on || !getLevels || !ref.current) return; let id = 0; const bars = ref.current.children;
    const loop = () => { const lv = getLevels(); const b = lv?.bands || []; for (let i = 0; i < bars.length; i++) { const v = b.length ? b[Math.floor((i / bars.length) * b.length)] : lv?.level || 0; bars[i].style.height = `${Math.max(8, Math.min(100, v * 110))}%`; } id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop); return () => { cancelAnimationFrame(id); for (const el of bars) el.style.height = ''; };
  }, [on, !!getLevels]);
  return <div ref={ref} class={clsx('k-viz', on && 'is-on', on && getLevels && 'is-live', small && 'is-small')} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${600 + ((i * 211) % 700)}ms` }} />)}</div>;
}

export function SoundScreen() {
  const { t, L } = useClient(); const { sound, device } = useKiosk();
  if (!sound) return <div class="k-page"><ScreenHead title={t('k.snd.title')} /><Empty /></div>;
  const { tracks, current, track, offHook, playing } = sound; const maxV = device.volume ?? 100;
  return (<div class="k-page k-sound">
    <ScreenHead title={t('k.snd.title')} />
    <div class={clsx('k-now', offHook && 'is-live')}>
      <div class="k-now__state"><Icon name={offHook ? 'phoneCall' : 'phone'} size={30} /><b>{offHook ? t('k.snd.offHook') : t('k.snd.onHook')}</b><span>{offHook ? t('k.snd.hangup') : t('k.snd.lift')}</span></div>
      <Viz on={playing} getLevels={sound.getLevels} />
      <p class="k-card__meta">{offHook ? t('k.snd.playing') : t('k.snd.tracks')}</p>
      <h2 class="k-now__title">{L(track?.name)}</h2>
      <p class="k-lead">{L(track?.desc)}</p>
      <div class="k-now__ctl">
        <IconButton icon="skipBack" size="lg" label={t('k.snd.prev')} onClick={sound.prev} />
        <span class="k-now__n">{tracks.findIndex((x) => x.id === current) + 1} / {tracks.length}</span>
        <IconButton icon="skipForward" size="lg" label={t('k.snd.next')} onClick={sound.next} />
      </div>
      {offHook ? <Button variant="secondary" icon="phoneOff" onClick={() => sound.setOffHook(false)}>{t('k.snd.hangupBtn')}</Button> : <Button variant="mint" icon="phoneCall" onClick={() => sound.setOffHook(true)}>{t('k.snd.lift')}</Button>}
      <label class="k-vol"><Icon name="volume" size={22} /><span>{t('k.snd.volume')}</span>
        <input type="range" min="0" max="100" step="5" value={Math.round(sound.userVol * 100)} onInput={(e) => sound.setUserVol(+e.currentTarget.value / 100)} aria-label={t('k.snd.volume')} />
        <small>{t('k.snd.volLimit', { v: maxV })}</small></label>
    </div>
    <h2 class="k-sub">{t('k.snd.tracks')}</h2>
    <ol class="k-tracks">{tracks.map((x, i) => <li key={x.id}><button type="button" class={clsx('k-track', x.id === current && 'is-active')} onClick={() => sound.select(x.id)} aria-current={x.id === current}>
      <span class="k-track__n">{i + 1}</span><span><b>{L(x.name)}</b><small>{L(x.desc)}</small></span>{x.id === current && playing && <Icon name="volume" size={20} />}</button></li>)}</ol>
    <div class="k-cols">
      <Card variant="mint" class="k-card k-pad"><h3 class="k-card__title"><Icon name="ear" size={22} /> {t('k.snd.loop')}</h3><p class="k-card__text">{t('k.snd.loopText')}</p></Card>
      <Card class="k-card k-pad"><h3 class="k-card__title"><Icon name="music" size={22} /> {t('k.snd.compTitle')}</h3><p class="k-card__text">{t('k.snd.comp')}</p></Card>
    </div>
    <p class="k-card__meta k-note">{t('k.snd.sim')}</p>
  </div>);
}

export function CalendarScreen() {
  const { t, L, lang } = useClient(); const s = useStore(); const evs = sel.events(); const [day, setDay] = useState(() => (evs.find((e) => e.start.slice(0, 10) >= dayStr()) || {}).start?.slice(0, 10) || dayStr());
 const list = evs.filter((e) => e.start.slice(0, 10) <= day && e.end.slice(0, 10) >= day);
  return (<div class="k-page">
    <ScreenHead title={t('k.nav.calendar')} />
    <div class="k-widgets"><Card class="k-card"><ClockWidget big /></Card><Card class="k-card"><WeatherWidget /></Card></div>
    <MonthCal value={day} onChange={setDay} marks={evs.map((e) => e.start.slice(0, 10))} />
    <h2 class="k-sub">{cap(fmtDate(day + 'T12:00', lang, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
    {list.length ? <ul class="k-evlist">{list.map((e) => <li key={e.id}><EventRow e={e} /></li>)}</ul> : <Empty icon="calendar" title={t('k.noEvents')} />}
    <h2 class="k-sub">{t('k.calHistory')}</h2>
    <HistoryList n={5} />
  </div>);
}
