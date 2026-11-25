// Końcówka „Ekrany LCD”: odtwarzacz playlist (informator, wideo, aktualności, RSS, pasek informacyjny) i napisy na żywo.
import { useEffect, useState } from 'preact/hooks';
import './signage.css';
import { Client, useClient, useNow } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { sel, makeApi } from '../../kernel/api.js';
import { strings, tr } from '../../kernel/i18n.js';
import { clsx, fmtDate, fmtTime, pad2 } from '../../kernel/util.js';
import { Icon, Logo, ScaleBox, Tag, Media, QR, PatternBand, LiveCaptions, Tabs } from '../../ui/components.jsx';
import { VideoSim } from '../../ui/media.jsx';
import { LiveVideo, useLiveWatch } from '../../ui/live.jsx';
import { mediaItem, isMediaRef, itemVideoFile, itemIssue, codecLabel } from '../../kernel/media.js';
import { usePreload, fileState, markFailed } from './preload.js';
import { setNowPlaying } from '../../kernel/presence.js';

if (typeof window !== 'undefined') window.__fpzKiosk = Object.assign(window.__fpzKiosk || {}, { makeApi, getState });

strings({
  's.events': ['Najbliższe wydarzenia', 'Upcoming events'], 's.news': ['Aktualności', 'News'], 's.rss': ['Wiadomości', 'Headlines'],
  's.live': ['Na żywo', 'Live'], 's.captions': ['Napisy na żywo', 'Live captions'], 's.waitTitle': ['Napisy na żywo', 'Live captions'],
  's.wait': ['Napisy pojawią się tutaj po rozpoczęciu transmisji.', 'Captions will appear here when the broadcast starts.'], 's.nextLive': ['Najbliższa transmisja', 'Next broadcast'],
  's.respeak': ['Symultaniczny przekaz tekstowy (respeaking)', 'Simultaneous text transmission (respeaking)'], 's.buy': ['Bilety w aplikacji FPŻ', 'Tickets in the FPŻ app'], 's.free': ['Wstęp wolny', 'Free entry'],
  's.service': ['Przerwa serwisowa', 'Maintenance break'], 's.fault': ['Ekran chwilowo niedostępny', 'Screen temporarily unavailable'], 's.empty': ['Brak przypisanej playlisty', 'No playlist assigned'], 's.nothing': ['Playlista nie ma nic do pokazania', 'The playlist has nothing to show'],
  's.loading': ['Wczytywanie filmu…', 'Loading the film…'],
  's.camOff': ['Obraz z kamery niedostępny na tym ekranie', 'Camera picture unavailable on this screen'],
  's.rssSrc': ['Kanał RSS (symulacja)', 'RSS feed (simulated)'], 's.weather': ['Pogoda', 'Weather'], 's.wind': ['wiatr {v} km/h', 'wind {v} km/h'],
});
const DEFAULT_DUR = { captions: 15, events: 10, video: 15, news: 10, image: 8, rss: 10, clock: 8, weather: 8 };
const KIND_PL = { lcd: 'Ekran LCD', projector: 'Projektor' };
const POWER = { on: ['Włączony', 'green'], off: ['Wyłączony', 'neutral'], service: ['Serwis', 'warn'], fault: ['Awaria', 'danger'] };
const W = 1920, H = 1080;

/**
 * Plan odtwarzania wyliczany z zegara – dwa ekrany z tą samą playlistą pokazują tę samą pozycję.
 * Pomijane są pozycje, których ekran nie pokaże: film / plik usunięty (itemIssue) oraz plik, którego ten ekran nie odtwarza
 * albo nie pobrał – files(id) → stan z pamięci ekranu (preload.js: { state: 'loading'|'ready'|'error', reason }); bez files – bez tej kontroli.
 */
export function playback(s, device, nowMs, files) {
  const pl = s.playlists.find((p) => p.id === device?.playlistId) || null; const items = pl?.items || [];
  const ticker = items.filter((i) => i.type === 'ticker'); const skipped = [];
  const all = items.filter((i) => i.type !== 'ticker');
  const timed = all.filter((i) => {
    const bad = itemIssue(s, i); if (bad) { skipped.push({ item: i, reason: bad }); return false; }
    const f = files && itemVideoFile(s, i); const st = f && files(f.id);
    if (st?.state === 'error') { skipped.push({ item: i, reason: st.reason, file: f, codec: st.codec || f.codec || null }); return false; }
    return true;
  }).map((i) => ({ ...i, dur: i.durationSec > 0 ? i.durationSec : DEFAULT_DUR[i.type] || 10 }));
  const caps = timed.find((i) => i.type === 'captions');
  if (!timed.length) return { pl, items, ticker, timed, skipped, item: null, idx: -1, progress: 0, nothing: all.length > 0 };
  if (caps && s.live.onAir) return { pl, items, ticker, timed, skipped, item: caps, idx: timed.indexOf(caps), progress: 1, live: true, cycle: 'live' };
  const total = timed.reduce((a, i) => a + i.dur, 0); const sec = nowMs / 1000; const t = sec % total; let acc = 0, idx = 0;
  for (; idx < timed.length; idx++) { if (t < acc + timed[idx].dur) break; acc += timed[idx].dur; }
  return { pl, items, ticker, timed, skipped, item: timed[idx], idx, progress: (t - acc) / timed[idx].dur, cycle: Math.floor(sec / total) };
}
/** Pliki wideo z biblioteki, których potrzebują playlisty podanych ekranów (do wczytania z wyprzedzeniem). */
export function playlistFiles(s, devices) {
  const out = new Map();
  for (const d of devices) for (const i of s.playlists.find((p) => p.id === d.playlistId)?.items || []) { const f = itemVideoFile(s, i); if (f) out.set(f.id, f); }
  return [...out.values()];
}
const FMT_INC = { hevc: 'HEVC/H.265', h264: 'H.264', av1: 'AV1', vp9: 'VP9' };
/** Opis pominiętej pozycji dla symulatora (techniczny, nie na sam ekran). */
const skipReason = (k) => (k.reason === 'download' ? 'nie udało się pobrać pliku' : k.reason === 'film' ? 'film usunięto z CMS' : k.reason === 'file' ? 'plik usunięto z biblioteki' : k.codec && k.codec !== 'h264' ? `ten ekran nie odtwarza formatu ${codecLabel(k.codec)}` : 'ten ekran nie odtwarza tego pliku');
export const skipText = (k) => `Pominięto: ${k.item.title || k.file?.name || 'film'} – ${skipReason(k)}`;
const cut = (x, n = 80) => { const t = String(x ?? ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
/**
 * Co ekran teraz pokazuje – krótki opis do sygnału dla panelu (presence.js → setNowPlaying).
 * state: gra playlistę / wyłączony wg harmonogramu / wyłączony w panelu / przerwa serwisowa / awaria / playlista nie ma nic do pokazania / brak playlisty.
 */
export function nowInfo(s, device, p, files) {
  const pw = device.power; const out = { kind: 'screen', playlist: p.pl ? cut(p.pl.name) : null };
  if (pw === 'off') out.state = device.schedule === 'auto' ? 'wyłączony wg harmonogramu' : 'wyłączony w panelu';
  else if (pw === 'service') out.state = 'przerwa serwisowa';
  else if (pw === 'fault') out.state = 'awaria';
  else out.state = p.item ? 'gra playlistę' : p.nothing ? 'playlista nie ma nic do pokazania' : 'brak playlisty';
  const it = pw === 'on' ? p.item : null;
  if (it) {
    out.pos = [p.idx + 1, p.timed.length]; const f = itemVideoFile(s, it); const v = !f && it.type === 'video' ? s.videos.find((x) => x.id === it.ref) : null;
    const cam = s.live.onAir && !!s.live.streamId;
    out.item = { type: it.type, title: cut(it.title || (v && v.title?.pl) || f?.name || '') };
    if (it.type === 'video') out.item.src = f ? 'plik' : v?.kind === 'live' ? (cam ? 'transmisja z kamery' : 'transmisja symulowana') : 'film symulowany';
    else if (it.type === 'captions') out.item.src = cam ? 'transmisja z kamery' : s.live.onAir ? 'transmisja symulowana' : 'oczekiwanie na transmisję';
    const st = f && files ? files(f.id) : null; if (f && files && (!st || st.state === 'loading')) out.loading = Math.round((st?.progress || 0) * 100);
    if (p.live) out.live = true;
  }
  if (p.skipped.length) out.skipped = p.skipped.slice(0, 5).map((k) => ({ title: cut(k.item.title || k.file?.name || 'pozycja'), reason: skipReason(k) }));
  return out;
}
const reported = new Set(); // urządzenie + plik – zgłoszenie raz na kartę (i nie powtarzamy, gdy otwarte zgłoszenie już jest)
/** Pliki, których ekran nie odtwarza / nie pobrał → jedno zgłoszenie usterki na urządzenie i plik w „Zarządzaniu ekspozycją”. */
function useFileIncidents(s, devices, files) {
  const todo = [];
  for (const d of devices) {
    if (d.power !== 'on') continue;
    for (const k of playback(s, d, 0, files).skipped) {
      if (!k.file || (k.reason !== 'decode' && k.reason !== 'download')) continue;
      const fmt = FMT_INC[k.codec] || null;
      const title = k.reason === 'download' ? `Ekran nie może pobrać pliku „${k.file.name}”` : `Ekran nie odtwarza pliku „${k.file.name}”${fmt && k.codec !== 'h264' ? ` (format ${fmt} nie jest obsługiwany przez przeglądarkę ekranu)` : ' (przeglądarka ekranu nie potrafi go odtworzyć)'}`;
      const key = d.id + '|' + k.file.id; if (reported.has(key)) continue;
      if ((s.incidents || []).some((x) => x.deviceId === d.id && x.status !== 'closed' && x.title === title)) { reported.add(key); continue; }
      todo.push({ key, deviceId: d.id, title });
    }
  }
  const sig = todo.map((x) => x.key).join(',');
  useEffect(() => { for (const x of todo) { if (reported.has(x.key)) continue; reported.add(x.key); makeApi('signage:' + x.deviceId).devices?.reportIncident?.({ deviceId: x.deviceId, title: x.title, severity: 'P3', auto: true }); } }, [sig]);
}

export default function SignageEndpoint({ standalone } = {}) {
  if (standalone) return <StandaloneScreen id={standalone} />;
  return <SignageScene />;
}

/** Tryb samodzielny (/lcd/<id>): sam obraz 1920×1080 na całe okno (player sieciowy przy monitorze lub projektorze). */
function StandaloneScreen({ id }) {
  const s = useStore(); const now = useNow(250);
  const list = s.devices.filter((d) => d.kind === 'lcd' || d.kind === 'projector'); const device = list.find((d) => d.id === id);
  const mine = device ? [device] : []; const files = usePreload(playlistFiles(s, mine)); useFileIncidents(s, mine, files);
  if (!device) return (
    <div class="ep-signage s-sa s-sa--err fpz-theme" data-theme="light">
      <div class="s-sa__box"><Icon name="alert" size={40} /><h1>Nieznany ekran „{String(id)}”</h1><p>Poprawne adresy ekranów:</p>
        <ul>{list.map((d) => <li key={d.id}><a href={'/lcd/' + d.id}><code>/lcd/{d.id}</code></a> – {d.name}</li>)}</ul></div>
    </div>);
  const p = playback(s, device, now.getTime(), files);
  setNowPlaying(device.id, nowInfo(s, device, p, files)); // tylko zapis w pamięci – trafi do najbliższego sygnału
  return (
    <div class="ep-signage s-sa fpz-theme" data-theme="light">
      <ScaleBox width={W} height={H} maxScale={4}>
        <div class="s-sa__panel">
          <Client id={'signage:' + device.id} base={34} class="ep-signage" theme={device.night ? 'night' : undefined}>
            <Player device={device} p={p} now={now} files={files} />
          </Client>
        </div>
      </ScaleBox>
    </div>
  );
}

function SignageScene() {
  const s = useStore(); const list = s.devices.filter((d) => d.kind === 'lcd' || d.kind === 'projector');
  const [cur, setCur] = useState(list[0]?.id); const d = sel.device(cur) || list[0];
  const now = useNow(500); const files = usePreload(playlistFiles(s, list)); useFileIncidents(s, list, files);
  return (
    <div class="ep-signage s-scene fpz-theme" data-theme="light">
      <aside class="s-list">
        <h2>Ekrany LCD i projekcje</h2>
        <p class="s-hint">Odtwarzają playlisty przypisane w „Zarządzaniu ekspozycją”. Kolejność wyliczana z zegara – ekrany z tą samą playlistą grają synchronicznie.</p>
        <ul>{list.map((x) => { const [pl, tone] = POWER[x.power] || POWER.off; const p = playback(s, x, now.getTime(), files); const skip = p.skipped.filter((k) => k.file); return (
          <li key={x.id}><button type="button" class={clsx('s-it', x.id === d?.id && 'is-active')} onClick={() => setCur(x.id)} data-screen={x.id} aria-pressed={x.id === d?.id}>
            <span class="s-it__id">{x.id} · {KIND_PL[x.kind]}</span><b>{x.name}</b>
            <span class="s-it__tags"><Tag tone={tone}>{pl}</Tag>{x.night && <Tag tone="deep" icon="moon">noc</Tag>}{p.live && <Tag tone="live">napisy</Tag>}</span>
            <small><Icon name="playlist" size={13} /> {p.pl ? p.pl.name : 'brak playlisty'}{p.item ? ` · teraz: ${p.item.title}` : ''}</small>
            {skip.map((k) => <small key={k.item.id} class="s-it__skip" data-skip={k.item.id}><Icon name="alert" size={13} /> {skipText(k)}</small>)}
          </button></li>); })}</ul>
      </aside>
      {d && <Screen key={d.id} device={d} files={files} />}
    </div>
  );
}

function Screen({ device, files }) {
  const s = useStore(); const now = useNow(250); const p = playback(s, device, now.getTime(), files);
  const proj = device.kind === 'projector';
  return (
    <section class="s-stage" aria-label={device.name}>
      <div class="s-stage__box">
        <ScaleBox width={W + 120} height={H + (proj ? 140 : 300)}>
          <div class={clsx('s-mon', proj && 's-mon--proj')}>
            {proj && <div class="s-proj"><Icon name="monitor" size={40} /> projektor laserowy</div>}
            <div class="s-mon__panel" style={{ width: W + 'px', height: H + 'px' }}>
              <Client id={'signage:' + device.id} base={34} class="ep-signage" theme={device.night ? 'night' : undefined}>
                <Player device={device} p={p} now={now} files={files} />
              </Client>
            </div>
            {!proj && <><div class="s-mon__logo">FPŻ · {device.id}</div><div class="s-mon__neck" /><div class="s-mon__foot" /></>}
          </div>
        </ScaleBox>
      </div>
      <div class="s-status" aria-live="polite">
        <span><Icon name="playlist" size={15} /> <b>{p.pl ? p.pl.name : 'Brak przypisanej playlisty'}</b></span>
        <span>Pozycja <b>{p.item ? `${p.idx + 1}/${p.timed.length}` : '–'}</b>{p.item ? ` · ${p.item.title}` : ''}{p.live ? ' · transmisja na żywo (priorytet)' : ''}</span>
        {p.item && !p.live && <span class="s-status__bar"><i style={{ width: `${Math.round(p.progress * 100)}%` }} /></span>}
        {p.skipped.map((k) => <span key={k.item.id} class="s-status__skip" data-skip={k.item.id}><Icon name="alert" size={15} /> {skipText(k)}</span>)}
        <span><Icon name="clock" size={15} /> <b>{pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}</b></span>
        <span>{POWER[device.power]?.[0]} · jasność {device.brightness}%{device.night ? ' · tryb nocny' : ''}</span>
      </div>
    </section>
  );
}

function Player({ device, p, now, files }) {
  const s = useStore(); const { t } = useClient();
  // transmisja z kamery: ekran, którego playlista ją pokazuje (napisy na żywo albo film „na żywo”), trzyma połączenie przez cały czas –
  // obraz jest od razu, gdy pozycja wraca w pętli playlisty
  const camLive = device.power === 'on' && s.live.onAir && s.live.streamId && (p.items || []).some((i) => i.type === 'captions' || (i.type === 'video' && s.videos.find((v) => v.id === i.ref)?.kind === 'live'));
  useLiveWatch(camLive ? s.live.streamId : null);
  const dim = device.brightness != null && device.brightness < 80 ? Math.min(0.75, ((80 - device.brightness) / 80) * 0.8) : 0;
  if (device.power === 'off') return <div class="s-screen s-off" />;
  if (device.power === 'service' || device.power === 'fault') return (<div class="s-screen s-plate"><PatternBand class="s-plate__band" scale={1.2} /><div class="s-plate__box"><Icon name={device.power === 'fault' ? 'alert' : 'wrench'} size={90} /><h1>{t(device.power === 'fault' ? 's.fault' : 's.service')}</h1><p lang="en">{tr('en', device.power === 'fault' ? 's.fault' : 's.service')}</p></div><div class="s-dim" style={{ opacity: dim }} /></div>);
  const it = p.item; const hasTicker = p.ticker.length > 0;
  return (
    <div class={clsx('s-screen', hasTicker && 'has-ticker', it?.type === 'captions' && 'is-captions')}>
      <div class="s-slot">
        {it ? <div class="s-slide" key={it.id + ':' + p.cycle}><Slide item={it} now={now} files={files} /></div>
          : <div class="s-slide s-empty" data-empty={p.nothing ? 'nothing' : 'none'}><Logo onDark /><p>{t(p.nothing ? 's.nothing' : 's.empty')}</p></div>}
      </div>
      {it && it.type !== 'captions' && it.type !== 'video' && <div class="s-corner"><Logo onDark compact /><b>{pad2(now.getHours())}:{pad2(now.getMinutes())}</b></div>}
      {hasTicker && <Ticker items={p.ticker} />}
      {it && !p.live && <div class="s-prog"><i style={{ width: `${p.progress * 100}%` }} /></div>}
      <div class="s-dim" style={{ opacity: dim }} />
    </div>
  );
}

const Head = ({ k, icon }) => (<header class="s-head"><Icon name={icon} size={52} /><h1>{tr('pl', k)}</h1><span lang="en">{tr('en', k)}</span></header>);

function Slide({ item, now, files }) {
  const s = useStore(); const { L } = useClient();
  switch (item.type) {
    case 'events': {
      const evs = sel.events().slice(0, 5); const [f, ...rest] = evs;
      if (!f) return <div class="s-pad"><Head k="s.events" icon="calendar" /></div>;
      return (<div class="s-pad s-events"><Head k="s.events" icon="calendar" />
        <div class="s-events__grid">
          <article class="s-feat"><Media ill={f.ill} src={f.src} ratio="5/2" shape="arc-tr" alt="" />
            <div class="s-feat__txt"><p class="s-meta">{fmtDate(f.start, 'pl', { weekday: 'long', day: 'numeric', month: 'long' })} · {fmtTime(f.start, 'pl')}</p><h2>{f.title.pl}</h2><p class="s-en" lang="en">{f.title.en}</p><p class="s-meta"><Icon name="mapPin" size={30} /> {sel.poi(f.poiId)?.name.pl}</p></div>
            <div class="s-feat__qr"><QR value={'V:' + f.id} size={170} /><span>{f.ticketed ? tr('pl', 's.buy') : tr('pl', 's.free')}</span></div></article>
          <ul class="s-evl">{rest.map((e) => { const d = new Date(e.start); return <li key={e.id}><span class="s-date"><b>{d.getDate()}</b>{fmtDate(e.start, 'pl', { month: 'short' })}</span><span><b>{e.title.pl}</b><small>{fmtTime(e.start, 'pl')} · {sel.poi(e.poiId)?.name.pl}{e.live ? ' · ' : ''}{e.live && <Tag tone="live">{tr('pl', 's.live')}</Tag>}</small></span></li>; })}</ul>
        </div></div>);
    }
    case 'video': {
      // plik wideo prosto z biblioteki mediów („media:<id>”) albo film z CMS; plik z biblioteki gra z pamięci ekranu (preload.js).
      // Prawdziwy film idzie na ekran czysty – bez plakietki z tytułem; plakietka zostaje przy symulacji i transmisji.
      const f = itemVideoFile(s, item); const st = f && files ? files(f.id) : null;
      if (f && files && (!st || st.state === 'loading')) return <LoadingSlide title={item.title || f.name} progress={st?.progress || 0} />;
      const url = st?.url;
      if (isMediaRef(item.ref)) { const m = mediaItem(item.ref); return <div class="s-video">{m ? <VideoLoop file={f} url={url} v={{ id: m.id, src: item.ref, title: { pl: item.title || m.name, en: '' }, durationSec: m.durationSec || item.durationSec || 20, kind: 'studio', captions: [] }} /> : null}{!url && <div class="s-video__t"><b>{item.title || m?.name}</b></div>}</div>; }
      const v = s.videos.find((x) => x.id === item.ref); if (!v) return null; // pozycje bez filmu pomija playback()
      const ttl = v.kind === 'live' && s.live.onAir && s.live.streamId ? s.live.title || v.title : v.title; // obraz z kamery – tytuł bieżącej transmisji
      return <div class="s-video"><VideoLoop v={v} file={f} url={url} />{!url && <div class="s-video__t"><b>{ttl.pl}</b>{ttl.en && ttl.en !== ttl.pl && <span lang="en">{ttl.en}</span>}</div>}</div>;
    }
    case 'news': {
      const ns = sel.news().slice(0, 3);
      return (<div class="s-pad"><Head k="s.news" icon="news" /><div class="s-news">{ns.map((n, i) => <article key={n.id} class="s-ncard"><Media ill={n.ill} src={n.src} ratio="16/10" shape={i === 0 ? 'arc-tl' : 'card'} alt="" /><p class="s-meta">{fmtDate(n.date, 'pl')}</p><h2>{n.title.pl}</h2><p class="s-en" lang="en">{n.title.en}</p></article>)}</div></div>);
    }
    case 'image': {
      const lib = s.media.find((m) => m.id === item.ref);
      return (<div class="s-image">{lib ? <Media src={lib.id} ratio={null} shape="plain" alt={item.title} /> : <Media ill={item.ref || 'city-panorama'} ratio={null} shape="plain" alt={item.title} />}<div class="s-image__t"><h1>{item.title}</h1>{item.text && <p>{item.text}</p>}</div></div>);
    }
    case 'captions': return <CaptionsSlide item={item} />;
    case 'rss': {
      const ns = sel.news().slice(0, 6);
      return (<div class="s-pad"><Head k="s.rss" icon="rss" /><ol class="s-rss">{ns.map((n) => <li key={n.id}><span>{fmtDate(n.date, 'pl', { day: 'numeric', month: 'short' })}</span><b>{n.title.pl}</b></li>)}</ol><p class="s-src"><Icon name="rss" size={24} /> {tr('pl', 's.rssSrc')}{item.url ? ` · ${item.url}` : ''}</p></div>);
    }
    case 'clock': return (<div class="s-clock"><b>{pad2(now.getHours())}:{pad2(now.getMinutes())}</b><span>{fmtDate(now.toISOString(), 'pl', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>);
    case 'weather': { const w = s.env.weather || {}; const ic = { sunny: 'sun', cloudy: 'cloud', partly: 'cloudSun', rain: 'cloudRain', snow: 'snow', wind: 'wind' }[w.kind] || 'cloud';
      return (<div class="s-clock"><Icon name={ic} size={200} /><b>{w.tempC != null ? Math.round(w.tempC) + '°C' : '—'}</b><span>{tr('pl', 's.weather')} · Dąbrowa Górnicza · {tr('pl', 's.wind', { v: w.wind ?? '—' })}</span></div>); }
    default: return <div class="s-pad"><h1>{item.title}</h1></div>;
  }
}

function VideoLoop({ v, file, url }) {
  const [n, setN] = useState(0);
  return <VideoSim key={n} video={v} autoplay chromeless loop muted showCaptions showTitle={false} onEnded={() => setN(n + 1)} class="s-vsim" {...(file && url ? { fileUrl: url, onFileError: () => markFailed(file.id, 'decode') } : {})} />;
}
/** Plansza „Wczytywanie filmu… 43%” – zanim film z biblioteki trafi w całości do pamięci ekranu. */
function LoadingSlide({ title, progress }) {
  const pc = Math.round(progress * 100);
  return (<div class="s-load" data-loading={pc} role="status"><Logo onDark /><p class="s-load__t">{tr('pl', 's.loading')} <b>{pc}%</b></p>
    <span class="s-load__bar"><i style={{ width: pc + '%' }} /></span><p class="s-load__n">{title}</p></div>);
}

function CaptionsSlide() {
  const s = useStore(); const L = s.live;
  if (!L.onAir) {
    const next = sel.events().find((e) => e.live);
    return (<div class="s-caps s-caps--wait"><Icon name="captions" size={120} /><h1>{tr('pl', 's.waitTitle')} <span lang="en">· {tr('en', 's.waitTitle')}</span></h1><p>{tr('pl', 's.wait')}</p><p lang="en" class="s-en">{tr('en', 's.wait')}</p>
      {next && <p class="s-caps__next"><Icon name="calendar" size={36} /><span>{tr('pl', 's.nextLive')}: <b>{next.title.pl}</b> · {fmtDate(next.start, 'pl', { weekday: 'long', day: 'numeric', month: 'long' })} {fmtTime(next.start, 'pl')}</span></p>}</div>);
  }
  if (L.streamId) return <CamCaptions key={L.streamId} live={L} />;
  return (<div class="s-caps">
    <header class="s-caps__head"><Tag tone="live">{tr('pl', 's.live')} · LIVE</Tag><h1>{L.title?.pl}</h1><span class="s-caps__note"><Icon name="captions" size={30} /> {tr('pl', 's.respeak')}</span></header>
    <LiveCaptions lines={4} class="s-caps__lines" idleText="…" />
  </div>);
}
/**
 * Napisy na żywo z obrazem z kamery telefonu. Układ zależy od proporcji obrazu (videoWidth/videoHeight) i od tego, czy są już napisy:
 *  bez napisów – obraz na środku, możliwie duży (pionowy i poziomy); napisy + obraz poziomy – obraz u góry, napisy pod nim;
 *  napisy + obraz pionowy – obraz po lewej na całą wysokość, napisy po prawej.
 *  Bez nadawcy (stan 'ended') i bez WebRTC – dotychczasowa plansza samych napisów.
 */
function CamCaptions({ live: L }) {
  const [st, setSt] = useState('connecting'); const [asp, setAsp] = useState(null); // [szer, wys] obrazu, gdy już znane
  const cam = st !== 'ended' && st !== 'unsupported'; const portrait = !!asp && asp[1] > asp[0]; const hasCaps = L.captions.length > 0;
  const layout = !cam ? null : !hasCaps ? 'nocaps' : portrait ? 'portrait' : 'landscape';
  return (<div class={clsx('s-caps', cam && 's-caps--cam', layout && 'is-' + layout)} data-cam={st} data-layout={layout || 'plain'}>
    <header class="s-caps__head"><Tag tone="live">{tr('pl', 's.live')} · LIVE</Tag><h1>{L.title?.pl}</h1><span class="s-caps__note"><Icon name="captions" size={30} /> {st === 'unsupported' ? tr('pl', 's.camOff') : tr('pl', 's.respeak')}</span></header>
    <div class="s-caps__body">
      <LiveVideo streamId={L.streamId} chromeless showTitle={false} showCaptions={false} showViewers={false} ratio={null} class="s-caps__video" fallback={null} onState={setSt} onAspect={(w, h) => setAsp((a) => (a && a[0] === w && a[1] === h ? a : [w, h]))} />
      {layout !== 'nocaps' && <LiveCaptions lines={cam ? (portrait ? 6 : 2) : 4} class="s-caps__lines" idleText="…" />}
    </div>
  </div>);
}

function Ticker({ items }) {
  const texts = items.map((i) => i.text || i.title).filter(Boolean); const news = sel.news().slice(0, 3).map((n) => n.title.pl);
  const line = [...texts, ...news].join('   •   ');
  const dur = Math.max(25, line.length * 0.22);
  return (<div class="s-ticker" role="marquee" aria-label={line}><span class="s-ticker__lbl"><Icon name="info" size={34} /> INFO</span>
    <div class="s-ticker__track"><div class="s-ticker__move" style={{ animationDuration: dur + 's' }}><span>{line}</span><span aria-hidden="true">{line}</span></div></div></div>);
}
