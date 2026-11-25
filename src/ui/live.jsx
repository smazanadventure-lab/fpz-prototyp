// Odbiór transmisji na żywo z kamery telefonu (WebRTC, kernel/rtc.js) – wspólny dla aplikacji, strony WWW, kiosków i ekranów LCD.
// VideoSim (media.jsx) pokazuje tu prawdziwy obraz, gdy s.live.onAir && s.live.streamId; bez kamery – dotychczasowa symulacja.
// Moduł należy do strony odbiorcy (także w paczce aplikacji dla zwiedzających) – nie importuje niczego z końcówek zaplecza.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient } from '../kernel/client.jsx';
import { useStore } from '../kernel/store.js';
import { strings } from '../kernel/i18n.js';
import { clsx } from '../kernel/util.js';
import { watchLive } from '../kernel/rtc.js';
import { Icon, Logo } from './components.jsx';

strings({
  'lv.connecting': ['Łączenie z transmisją…', 'Connecting to the live stream…'],
  'lv.retry': ['Ponawiamy połączenie z transmisją…', 'Reconnecting to the live stream…'],
  'lv.full': ['Komplet odbiorców – transmisję pokazują inne ekrany', 'Viewer limit reached – the stream is shown on other screens'],
  'lv.fullHint': ['Napisy na żywo działają dalej.', 'Live captions are still available.'],
  'lv.unsupported': ['Ta przeglądarka nie odbiera obrazu z kamery – pokazano symulację', 'This browser cannot receive the camera stream – showing a simulation'],
  'lv.video': ['Transmisja na żywo: {title}', 'Live stream: {title}'],
  'lv.camera': ['Obraz z kamery na żywo', 'Live camera picture'],
});

/**
 * Odbiór transmisji: { state, stream } (stany jak w watchLive; null – brak transmisji).
 * Rezygnacja z odbioru jest opóźniona o 2,5 s: odtwarzacz zamontowany ponownie (np. kolejny obrót playlisty ekranu)
 * dołącza do tego samego połączenia strony zamiast zestawiać nowe.
 */
export function useLiveWatch(streamId) {
  const [st, setSt] = useState({ id: null, state: null, stream: null });
  useEffect(() => {
    if (!streamId) return undefined;
    let on = true; setSt({ id: streamId, state: 'connecting', stream: null });
    const w = watchLive(streamId, { onState: (state) => { if (on) setSt((x) => ({ ...x, id: streamId, state })); }, onStream: (stream) => { if (on) setSt((x) => ({ ...x, id: streamId, stream })); } });
    return () => { on = false; setTimeout(() => w.stop(), 2500); };
  }, [streamId]);
  return st.id === streamId && streamId ? st : { state: null, stream: null };
}

/**
 * Odtwarzacz transmisji z kamery (ten sam kadr i kontrolki co VideoSim, bez przewijania i zmiany prędkości).
 * props: streamId, title, chromeless (ekran LCD – bez kontrolek, bez przycisku „Włącz dźwięk”), showTitle, showCaptions (napisy na obrazie),
 *   showViewers, ratio ('16/9'; null – wypełnia rodzica), class,
 *   fallback – co pokazać w stanie 'ended' (nadawca zniknął), unsupported – przy braku WebRTC (domyślnie fallback),
 *   onState(stan), onAspect(szer, wys) – wymiary obrazu (np. telefon trzymany pionowo), muted – od początku bez dźwięku (podgląd w panelu).
 */
export function LiveVideo({ streamId, title, chromeless, showTitle = true, showCaptions = true, showViewers = true, ratio = '16/9', class: cls, fallback, unsupported, onState, onAspect, muted = false }) {
  const { t: tr } = useClient(); const s = useStore();
  const { state, stream } = useLiveWatch(streamId);
  const ref = useRef(null); const rootRef = useRef(null);
  const [mute, setMute] = useState(!!muted); const [blocked, setBlocked] = useState(false); const [paused, setPaused] = useState(false);
  const [cc, setCc] = useState(showCaptions); const [fs, setFs] = useState(false); const [portrait, setPortrait] = useState(false);
  const fsOk = typeof document !== 'undefined' && !!document.fullscreenEnabled && !chromeless;
  const stRef = useRef(onState); stRef.current = onState; const asRef = useRef(onAspect); asRef.current = onAspect;
  useEffect(() => { if (state) stRef.current?.(state); }, [state]);
  const alt = state === 'ended' ? fallback : state === 'unsupported' ? (unsupported !== undefined ? unsupported : fallback) : undefined;
  const showVideo = alt === undefined;

  // próba odtwarzania z dźwiękiem; przeglądarka blokuje (NotAllowedError) → bez dźwięku, a na końcówkach interaktywnych przycisk „Włącz dźwięk”
  const start = () => {
    const el = ref.current; if (!el) return; setPaused(false);
    const p = el.play();
    if (p && p.catch) p.catch((err) => { if (err?.name === 'NotAllowedError' && !el.muted) { el.muted = true; setMute(true); setBlocked(true); el.play().catch(() => {}); } });
  };
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    if (!stream) { el.srcObject = null; return undefined; }
    if (el.srcObject !== stream) { el.srcObject = stream; el.muted = mute; }
    start();
    const dims = () => { if (el.videoWidth) { setPortrait(el.videoHeight > el.videoWidth); asRef.current?.(el.videoWidth, el.videoHeight); } };
    el.addEventListener('resize', dims); el.addEventListener('loadedmetadata', dims);
    return () => { el.removeEventListener('resize', dims); el.removeEventListener('loadedmetadata', dims); };
  }, [stream, showVideo]);
  useEffect(() => () => { const el = ref.current; if (el) { try { el.pause(); el.srcObject = null; } catch { /* nic */ } } }, []);
  useEffect(() => { if (!fsOk) return undefined; const f = () => setFs(document.fullscreenElement === rootRef.current); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);

  if (!showVideo) return alt || null;
  const live = state === 'live' && !!stream;
  const ttl = title || '';
  const toggle = () => { const el = ref.current; if (!el || !live) return; if (el.paused) start(); else { el.pause(); setPaused(true); } };
  const toggleMute = (e) => { e?.stopPropagation(); const el = ref.current; if (!el) return; el.muted = !el.muted; setMute(el.muted); setBlocked(false); if (!el.muted && el.paused && live) start(); };
  const toggleFs = () => { const r = rootRef.current; if (!r) return; if (document.fullscreenElement) document.exitFullscreen?.(); else r.requestFullscreen?.().catch(() => {}); };
  const onKey = (e) => { const tag = e.target.tagName; if ((e.key === ' ' || e.key === 'k') && tag !== 'BUTTON' && tag !== 'INPUT') { e.preventDefault(); toggle(); } else if (e.key === 'c' && tag !== 'INPUT') setCc(!cc); else if (e.key === 'm' && tag !== 'INPUT') toggleMute(); };
  const caps = s.live.captions.slice(-2);
  return (
    <figure ref={rootRef} class={clsx('md-video md-video--file md-video--cam', chromeless && 'md-video--chromeless', live && !paused && 'is-playing', portrait && 'is-portrait', fs && 'is-fs', cls)}
      onKeyDown={chromeless ? undefined : onKey} tabIndex={chromeless ? undefined : -1} data-live={state || 'connecting'} data-muted={mute ? 'true' : undefined}>
      <div class="md-video__frame" style={ratio && !fs ? { aspectRatio: ratio } : undefined} onClick={chromeless ? undefined : toggle}>
        <video ref={ref} class="md-video__file" autoplay playsInline aria-label={tr('lv.video', { title: ttl || tr('lv.camera') })} />
        {!live && <div class="md-live__wait" role="status">
          {state === 'full' ? <><Icon name="people" size={34} /><b>{tr('lv.full')}</b><span>{tr('lv.fullHint')}</span></>
            : <><span class="md-live__ring" aria-hidden="true"><Logo onDark compact /></span><b>{tr(state === 'retry' ? 'lv.retry' : 'lv.connecting')}</b>{ttl && showTitle && <span>{ttl}</span>}</>}
        </div>}
        <div class="md-video__shade" aria-hidden="true" />
        <div class="md-video__top">
          {live && <div class="md-video__live"><span class="md-video__livebadge"><i />{tr('md.live')}</span>{showViewers && <span class="md-video__viewers"><Icon name="eye" size={14} />{tr('md.viewers', { n: s.live.viewers || 0 })}</span>}</div>}
          {showTitle && live && ttl && <div class="md-video__title">{ttl}</div>}
        </div>
        {!chromeless && live && paused && <button type="button" class="md-video__big" aria-label={`${tr('md.play')}: ${ttl}`} onClick={(e) => { e.stopPropagation(); toggle(); }}><Icon name="play" size={28} /></button>}
        {blocked && mute && !chromeless && live && <button type="button" class="md-video__unmute" onClick={toggleMute} data-testid="live-unmute"><Icon name="volume" size={18} />{tr('md.unmute')}</button>}
        <div class="md-video__caps" aria-live="polite">{cc && showCaptions && live && (caps.length ? caps.map((c) => <span key={c.id}>{c.text}</span>) : <span class="md-video__capwait">{tr('md.waitCaps')}</span>)}</div>
      </div>
      {!chromeless && (
        <figcaption class="md-video__bar">
          <div class="md-video__row">
            <button type="button" class="md-btn md-btn--main" aria-label={live && !paused ? tr('md.pause') : tr('md.play')} onClick={toggle} disabled={!live}><Icon name={live && !paused ? 'pause' : 'play'} /></button>
            <span class="md-time"><span class="md-video__livetxt"><i />{tr('md.live')}</span></span>
            <span class="md-video__sp" />
            <button type="button" class={clsx('md-btn', mute && 'is-on')} aria-pressed={mute} aria-label={mute ? tr('md.unmute') : tr('md.mute')} title={mute ? tr('md.unmute') : tr('md.mute')} onClick={toggleMute}><Icon name={mute ? 'mute' : 'volume'} /></button>
            {showCaptions && <button type="button" class={clsx('md-btn md-btn--txt', cc && 'is-on')} aria-pressed={cc} aria-label={tr('md.cc')} title={tr('md.cc')} onClick={() => setCc(!cc)}>CC</button>}
            {fsOk && <button type="button" class={clsx('md-btn', fs && 'is-on')} aria-label={fs ? tr('md.fsExit') : tr('md.fs')} title={fs ? tr('md.fsExit') : tr('md.fs')} onClick={toggleFs}><Icon name={fs ? 'minimize' : 'maximize'} /></button>}
          </div>
        </figcaption>)}
    </figure>
  );
}
