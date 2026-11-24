// Komponenty multimedialne współdzielone przez aplikację mobilną, stronę WWW, kioski i ekrany LCD.
// W prototypie nie ma plików wideo/audio/3D – obraz, ruch i dźwięk są generowane w kodzie (CSS 3D, SVG, Web Audio),
// ale komponenty zachowują się jak prawdziwe odtwarzacze. Interfejs zgodny z zaślepką src/ui/stubs/media.jsx.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useClient } from '../kernel/client.jsx';
import { useStore } from '../kernel/store.js';
import { strings } from '../kernel/i18n.js';
import { clsx, clamp, fmtDuration } from '../kernel/util.js';
import { speak, stopSpeaking, estimateSeconds } from './speech.js';
import { Illustration } from './illustrations.jsx';
import { Icon } from './components.jsx';
import './media.css';

strings({
  'md.sim': ['Symulacja odtwarzania – prototyp bez pliku wideo', 'Simulated playback – prototype without a video file'],
  'md.video': ['Film: {title}', 'Video: {title}'],
  'md.play': ['Odtwórz', 'Play'], 'md.pause': ['Pauza', 'Pause'], 'md.restart': ['Od początku', 'From the start'], 'md.stop': ['Zatrzymaj', 'Stop'],
  'md.seek': ['Pozycja odtwarzania', 'Playback position'],
  'md.cc': ['Napisy', 'Captions'], 'md.ad': ['Audiodeskrypcja', 'Audio description'], 'md.pjm': ['Tłumacz PJM', 'Sign language interpreter (PJM)'],
  'md.speed': ['Prędkość odtwarzania', 'Playback speed'],
  'md.live': ['NA ŻYWO', 'LIVE'], 'md.viewers': ['{n} oglądających', '{n} watching'], 'md.offAir': ['Transmisja jeszcze się nie rozpoczęła', 'The stream has not started yet'],
  'md.waitCaps': ['Oczekiwanie na napisy na żywo…', 'Waiting for live captions…'],
  'md.duration': ['Czas trwania {d}', 'Duration {d}'], 'md.archive': ['Archiwum', 'Archive'],
  'md.ad.0': ['Kamera powoli najeżdża', 'The camera slowly moves in'], 'md.ad.1': ['Panorama w prawo', 'The camera pans right'],
  'md.ad.2': ['Ujęcie ogólne, kamera się oddala', 'Wide shot, the camera pulls back'], 'md.ad.3': ['Zbliżenie na szczegół', 'Close-up on a detail'],
  'md.ad.4': ['Panorama w lewo', 'The camera pans left'], 'md.ad.5': ['Powolny najazd od dołu', 'A slow tilt up'],
  'md.ad.archive': ['Czarno-biały materiał archiwalny{year}.', 'Black-and-white archive footage{year}.'],
  'md.ad.live': ['Obraz na żywo ze sceny.', 'Live picture from the stage.'],
  'md.guide': ['Audioprzewodnik', 'Audio guide'], 'md.transcript': ['Transkrypcja', 'Transcript'],
  'md.lector': ['Lektor (synteza mowy)', 'Narrator (speech synthesis)'], 'md.lectorSim': ['Lektor – symulacja (brak syntezy mowy w przeglądarce)', 'Narrator – simulated (no speech synthesis in this browser)'],
  'md.goSentence': ['Odtwórz od tego zdania', 'Play from this sentence'],
  'md.m3.label': ['Model 3D: {name}. Przeciągnij, aby obrócić; kółko lub dwa palce – powiększenie; strzałki i +/− z klawiatury.', '3D model: {name}. Drag to rotate; wheel or pinch to zoom; arrow keys and +/− on the keyboard.'],
  'md.m3.hint': ['Przeciągnij, aby obrócić', 'Drag to rotate'], 'md.m3.reset': ['Resetuj widok', 'Reset view'],
  'md.m3.zoomIn': ['Powiększ', 'Zoom in'], 'md.m3.zoomOut': ['Pomniejsz', 'Zoom out'],
  'md.m3.lathe': ['tokarka uniwersalna', 'general-purpose lathe'], 'md.m3.hall': ['hala z dachem szedowym', 'hall with a sawtooth roof'], 'md.m3.tower': ['wieża widokowa', 'viewing tower'],
  'md.pano.label': ['Panorama 360°. Przeciągnij lub użyj strzałek, aby się rozejrzeć. Zatrzymaj celownik na obiekcie, aby poznać szczegóły.', '360° panorama. Drag or use the arrow keys to look around. Hold the crosshair on an object to learn more.'],
  'md.pano.note': ['Panorama z drona (docelowo z wieży widokowej)', 'Drone panorama (later from the viewing tower)'],
  'md.pano.left': ['Obróć w lewo', 'Turn left'], 'md.pano.right': ['Obróć w prawo', 'Turn right'],
  'md.pano.hold': ['Przytrzymaj widok: {name}', 'Hold the view: {name}'], 'md.pano.facing': ['Kierunek: {dir} {deg}°', 'Heading: {dir} {deg}°'],
  'md.ar.searching': ['Szukam wzorca…', 'Looking for the marker…'], 'md.ar.found': ['Wzorzec rozpoznany', 'Marker recognised'],
  'md.ar.sim': ['Symulacja obrazu z kamery – prototyp', 'Simulated camera view – prototype'],
  'md.ar.today': ['Dziś', 'Today'], 'md.ar.tomorrow': ['Jutro', 'Tomorrow'], 'md.ar.mix': ['Porównanie: dziś – jutro', 'Compare: today – tomorrow'],
  'md.ar.capture': ['Zrób zdjęcie widoku AR', 'Capture the AR view'], 'md.ar.view': ['Widok kamery z rozszerzoną rzeczywistością', 'Camera view with augmented reality'],
  'md.snd.sim': ['Odtwarzanie symulowane – przeglądarka nie obsługuje Web Audio', 'Simulated playback – Web Audio is not available'],
});

/* ───────────────────────── narzędzia wspólne ───────────────────────── */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Rozmiar elementu w pikselach układu (przed transform: scale przodków) – ResizeObserver, działa także po odkryciu ukrytego elementu. */
function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const read = () => { const w = el.offsetWidth, h = el.offsetHeight; setSize((s) => (s.w === w && s.h === h ? s : { w, h })); };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect();
  }, []);
  return size;
}
/** Czy element jest widoczny w oknie (IntersectionObserver; ukryty display:none → false). */
function useInView(ref) {
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((es) => setVis(es[es.length - 1].isIntersecting)); io.observe(el); return () => io.disconnect();
  }, []);
  return vis;
}
/** Skala przodków (transform: scale) – stosunek rozmiaru na ekranie do rozmiaru w układzie. */
const scaleOf = (el) => { const r = el.getBoundingClientRect(); return el.offsetWidth ? r.width / el.offsetWidth || 1 : 1; };
const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
const asText = (v, L) => (v == null ? '' : typeof v === 'object' ? L(v) : String(v));
const sentencesOf = (text) => String(text || '').replace(/\*\*/g, '').split(/\n+|(?<=[.!?…])\s+(?=[^\s])/).map((s) => s.trim()).filter(Boolean);

/* ═════════════════════════ 1. VideoSim ═════════════════════════ */
const SCENE = 7; // s – długość „ujęcia” (zmiana ruchu kamery)
const KB = [ // ruch „Ken Burns”: [od, do] – skala i przesunięcie w %
  [[1.06, 0, 0], [1.24, -4, -3]], [[1.18, 5, 0], [1.18, -5, -1]], [[1.32, -2, -3], [1.08, 0, 1]],
  [[1.2, 3, 3], [1.42, 6, 4]], [[1.18, -5, -1], [1.18, 5, 1]], [[1.25, 0, 5], [1.12, 0, -4]],
];
const kbFrame = ([s, x, y]) => ({ transform: `translate(${x}%, ${y}%) scale(${s})` });

/** Animowana sylwetka tłumacza PJM (czysto dekoracyjna – symulacja okna tłumacza). */
function PjmFigure() {
  return (<svg class="md-pjmfig" viewBox="0 0 120 140" aria-hidden="true">
    <rect width="120" height="140" class="md-pjmfig__bg" />
    <path class="md-pjmfig__body" d="M22 140c2-30 14-44 38-46c24 2 36 16 38 46z" />
    <rect class="md-pjmfig__body" x="53" y="74" width="14" height="16" rx="5" />
    <ellipse class="md-pjmfig__skin" cx="60" cy="56" rx="17" ry="20" />
    <path class="md-pjmfig__hair" d="M43 54c-1-16 8-25 18-25s19 8 17 25c-4-9-10-12-17-12s-14 4-18 12z" />
    <g class="md-pjmfig__arm md-pjmfig__arm--l"><path d="M36 104 L28 126" class="md-pjmfig__sleeve" /><g class="md-pjmfig__fore md-pjmfig__fore--l"><path d="M28 126 L44 98" class="md-pjmfig__sleeve md-pjmfig__sleeve--thin" /><circle cx="45" cy="96" r="6.5" class="md-pjmfig__skin" /></g></g>
    <g class="md-pjmfig__arm md-pjmfig__arm--r"><path d="M84 104 L92 126" class="md-pjmfig__sleeve" /><g class="md-pjmfig__fore md-pjmfig__fore--r"><path d="M92 126 L76 94" class="md-pjmfig__sleeve md-pjmfig__sleeve--thin" /><circle cx="75" cy="92" r="6.5" class="md-pjmfig__skin" /></g></g>
  </svg>);
}

/**
 * Symulowany odtwarzacz wideo: kadr z Illustration z ruchem „Ken Burns”, oś czasu, napisy (CC), audiodeskrypcja (AD), okno tłumacza PJM, prędkość.
 * props (jak w zaślepce): video {title, description, ill, durationSec, captions:[{t,text}], kind:'archive'|'studio'|'live', year, ad?:[{t,text}]}
 *   LUB osobno title, ill, durationSec, captions; live, autoplay, showCaptions=true, onEnded() (z loop – po każdym przebiegu), compact, class
 * props dodatkowe (opcjonalne): description, kind, ad, loop, muted, chromeless (bez kontrolek – ekrany LCD),
 *   onOpen() (miniatura compact: klik otwiera pełny odtwarzacz zamiast odtwarzać w miejscu), showTitle=true,
 *   ratio='16/9', showAd=false, showPjm=false, startAt (s), onTime(t)
 */
export function VideoSim({ video, title, ill, durationSec, captions, live, autoplay, showCaptions = true, onEnded, compact, class: cls,
  description, kind, ad, loop, muted, chromeless, onOpen, showTitle = true, ratio = '16/9', showAd = false, showPjm = false, startAt = 0, onTime }) {
  const { t: tr, L } = useClient(); const s = useStore();
  const v = video || {}; const vKind = kind || v.kind; const isLive = live != null ? !!live : vKind === 'live';
  const archive = vKind === 'archive';
  const dur = Math.max(1, durationSec || v.durationSec || 60); const caps = captions || v.captions || [];
  const ttl = asText(title, L) || asText(v.title, L) || (isLive ? L(s.live.title) : '');
  const desc = asText(description, L) || asText(v.description, L);
  const [t, setT] = useState(startAt || 0); const [play, setPlay] = useState(!!autoplay);
  const [cc, setCc] = useState(showCaptions); const [adOn, setAd] = useState(showAd); const [pjm, setPjm] = useState(showPjm); const [speed, setSpeed] = useState(1);
  const kbRef = useRef(null); const anim = useRef(null); const tRef = useRef(t); tRef.current = t;
  const endRef = useRef(onEnded); endRef.current = onEnded; const timeRef = useRef(onTime); timeRef.current = onTime;
  const rootRef = useRef(null); const inView = useInView(rootRef);
  const motion = !reducedMotion();

  // Jeden zegar na odtwarzany film (250 ms) – czas liczony z Date.now(), więc odporny na opóźnienia timera.
  useEffect(() => {
    if (!play) return undefined;
    let last = Date.now();
    const i = setInterval(() => {
      const now = Date.now(); const dt = ((now - last) / 1000) * speed; last = now;
      setT((x) => {
        let n = x + dt;
        if (!isLive && n >= dur) {
          if (loop) { n %= dur; setTimeout(() => endRef.current?.(), 0); } else { setPlay(false); setTimeout(() => endRef.current?.(), 0); return dur; }
        }
        timeRef.current?.(n); return n;
      });
    }, 250);
    return () => clearInterval(i);
  }, [play, speed, dur, isLive, loop]);

  // Ruch kamery: Web Animations API (bez przerysowania ilustracji), zsynchronizowany z osią czasu.
  const scene = Math.floor(t / SCENE);
  useEffect(() => {
    const el = kbRef.current; if (!el || !el.animate) return undefined;
    if (!motion) { el.style.transform = 'scale(1.08)'; return undefined; }
    const p = KB[(scene + (vKind === 'archive' ? 2 : 0)) % KB.length];
    const a = el.animate([kbFrame(p[0]), kbFrame(p[1])], { duration: SCENE * 1000, fill: 'both', easing: 'ease-in-out' });
    a.currentTime = (tRef.current % SCENE) * 1000; a.playbackRate = speed;
    if (!play || !inView) a.pause();
    anim.current = a; return () => a.cancel();
  }, [scene, vKind]);
  useEffect(() => { const a = anim.current; if (!a) return; a.playbackRate = speed; if (play && inView) a.play(); else a.pause(); }, [play, speed, inView]);
  const seek = (x) => { const n = clamp(x, 0, dur); setT(n); const a = anim.current; if (a && Math.floor(n / SCENE) === scene) a.currentTime = (n % SCENE) * 1000; };

  const toggle = () => {
    if (compact && onOpen) { onOpen(); return; }
    if (!play && !isLive && t >= dur - 0.05) setT(0);
    setPlay(!play);
  };
  const onKey = (e) => {
    const tag = e.target.tagName; const typ = e.target.type;
    if ((e.key === ' ' || e.key === 'k') && tag !== 'BUTTON' && !(tag === 'INPUT' && typ !== 'range')) { e.preventDefault(); toggle(); }
    else if (!isLive && tag !== 'INPUT' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); seek(t + (e.key === 'ArrowRight' ? 5 : -5)); }
    else if (e.key === 'c' && tag !== 'INPUT') setCc(!cc);
  };

  // napisy
  const liveCaps = isLive ? s.live.captions.slice(-2) : [];
  let capText = null;
  if (isLive) capText = s.live.onAir ? (liveCaps.length ? liveCaps.map((c) => c.text) : null) : null;
  else { const c = [...caps].reverse().find((x) => x.t <= t); const nx = caps.find((x) => x.t > (c?.t ?? -1)); if (c && t - c.t < Math.max(6, (nx ? nx.t - c.t : 6))) capText = [L(c.text)]; }
  if (!isLive && t === 0 && !play) capText = null;
  // audiodeskrypcja – z pola ad/video.ad, inaczej generowana z tytułu i opisu
  const adLines = ad || v.ad;
  let adText = '';
  if (adLines?.length) { const c = [...adLines].reverse().find((x) => x.t <= t) || adLines[0]; adText = asText(c.text, L); }
  else {
    const facts = [ttl, ...sentencesOf(desc)].filter(Boolean);
    const lead = scene === 0 ? (archive ? tr('md.ad.archive', { year: v.year ? ` (${v.year})` : '' }) + ' ' : isLive ? tr('md.ad.live') + ' ' : '') : '';
    adText = `${lead}${tr(`md.ad.${scene % 6}`)}: ${(facts[scene % Math.max(1, facts.length)] || '').replace(/[.]$/, '')}.`;
  }
  const offAir = isLive && !s.live.onAir;
  const shown = Math.min(t, dur);
  const simNote = tr('md.sim');

  return (
    <figure ref={rootRef} class={clsx('md-video', compact && 'md-video--compact', archive && 'md-video--archive', chromeless && 'md-video--chromeless', play && inView && 'is-playing', cls)}
      onKeyDown={chromeless ? undefined : onKey} tabIndex={chromeless ? undefined : -1} title={simNote} data-muted={muted ? 'true' : undefined}>
      <div class="md-video__frame" style={{ aspectRatio: ratio }} onClick={chromeless ? undefined : toggle} role={chromeless ? 'img' : undefined} aria-label={chromeless ? tr('md.video', { title: ttl }) : undefined}>
        <div class="md-video__kb" ref={kbRef}><Illustration id={ill || v.ill || 'studio'} tone={archive ? 'archival' : 'duotone'} title={ttl} /></div>
        {archive && <div class="md-video__film" aria-hidden="true"><i class="md-video__grain" /><i class="md-video__scratch" /><i class="md-video__scratch md-video__scratch--b" /></div>}
        <div class="md-video__shade" aria-hidden="true" />
        <div class="md-video__top">
          {((isLive && !offAir) || (archive && v.year && !compact)) && <div class="md-video__live">
            {isLive && !offAir && <><span class="md-video__livebadge"><i />{tr('md.live')}</span><span class="md-video__viewers"><Icon name="eye" size={14} />{tr('md.viewers', { n: s.live.viewers || 0 })}</span></>}
            {archive && v.year && !compact ? <span class="md-video__year">{tr('md.archive')} · {v.year}</span> : null}</div>}
          {showTitle && !compact && ttl && <div class="md-video__title">{ttl}</div>}
          {!compact && adOn && !offAir && <div class="md-video__ad" aria-live="polite"><b>AD</b><span>{adText}</span></div>}
        </div>
        {offAir && <div class="md-video__offair"><Icon name="video" size={28} /><span>{tr('md.offAir')}</span></div>}
        {!chromeless && !play && !offAir && (
          <button type="button" class="md-video__big" aria-label={compact && onOpen ? tr('md.video', { title: ttl }) : `${tr('md.play')}: ${ttl}`} onClick={(e) => { e.stopPropagation(); toggle(); }}><Icon name="play" size={28} /></button>)}
        {compact && <span class="md-video__dur">{isLive ? tr('md.live') : fmtDuration(play || t ? dur - t : dur)}</span>}
        {compact && (play || t > 0) && !isLive && <span class="md-video__thinbar"><i style={{ width: `${(shown / dur) * 100}%` }} /></span>}
        <div class={clsx('md-video__caps', adOn && 'md-video__caps--high')} aria-live="polite">{cc && !offAir && (capText ? capText.map((c, i) => <span key={i}>{c}</span>) : (isLive && s.live.onAir && !compact ? <span class="md-video__capwait">{tr('md.waitCaps')}</span> : null))}</div>
        {pjm && !compact && <div class="md-video__pjm" aria-label={tr('md.pjm')} role="img"><PjmFigure /><span>PJM</span></div>}
      </div>
      {!compact && !chromeless && (
        <figcaption class="md-video__bar">
          {!isLive && <input class="md-range" type="range" min="0" max={dur} step="0.25" value={shown} style={{ '--p': `${(shown / dur) * 100}%` }} aria-label={tr('md.seek')} aria-valuetext={`${fmtDuration(shown)} / ${fmtDuration(dur)}`} onInput={(e) => seek(+e.currentTarget.value)} />}
          <div class="md-video__row">
            <button type="button" class="md-btn md-btn--main" aria-label={play ? tr('md.pause') : tr('md.play')} onClick={toggle} disabled={offAir}><Icon name={play ? 'pause' : 'play'} /></button>
            <span class="md-time">{isLive ? <span class="md-video__livetxt"><i />{tr('md.live')}</span> : <>{fmtDuration(shown)} <span>/ {fmtDuration(dur)}</span></>}</span>
            <span class="md-video__sp" />
            <button type="button" class={clsx('md-btn md-btn--txt', cc && 'is-on')} aria-pressed={cc} aria-label={tr('md.cc')} title={tr('md.cc')} onClick={() => setCc(!cc)}>CC</button>
            <button type="button" class={clsx('md-btn md-btn--txt', adOn && 'is-on')} aria-pressed={adOn} aria-label={tr('md.ad')} title={tr('md.ad')} onClick={() => setAd(!adOn)}>AD</button>
            <button type="button" class={clsx('md-btn', pjm && 'is-on')} aria-pressed={pjm} aria-label={tr('md.pjm')} title={tr('md.pjm')} onClick={() => setPjm(!pjm)}><Icon name="hand" /></button>
            {!isLive && <button type="button" class={clsx('md-btn md-btn--txt', speed !== 1 && 'is-on')} aria-label={`${tr('md.speed')}: ${speed === 1 ? '1×' : '1,5×'}`} title={tr('md.speed')} onClick={() => setSpeed(speed === 1 ? 1.5 : 1)}>{speed === 1 ? '1×' : '1,5×'}</button>}
          </div>
        </figcaption>)}
    </figure>
  );
}

/* ═════════════════════════ 2. AudioGuide ═════════════════════════ */
/**
 * Audioprzewodnik z lektorem (Web Speech API; gdy niedostępne – symulacja czasu).
 * props (jak w zaślepce): text, title, lang, compact, onState('play'|'stop'), class
 * props dodatkowe: showTranscript (domyślnie zwinięta), rate (0.8|1|1.25, domyślnie 1), autoplay
 */
export function AudioGuide({ text, title, lang, compact, onState, class: cls, showTranscript = false, rate: rate0 = 1, autoplay }) {
  const c = useClient(); const tr = c.t; const txt = asText(text, c.L); const speakLang = lang || c.lang;
  const sents = useMemo(() => { const ss = sentencesOf(txt); return ss.length ? ss : [txt]; }, [txt]);
  const [rate, setRate] = useState(rate0);
  const durs = sents.map((x) => estimateSeconds(x, rate)); const total = durs.reduce((a, b) => a + b, 0);
  const starts = durs.reduce((a, d, i) => { a.push(i ? a[i - 1] + durs[i - 1] : 0); return a; }, []);
  const [playing, setPlaying] = useState(false); const [pos, setPos] = useState(0); const [open, setOpen] = useState(showTranscript); const [simulated, setSim] = useState(false);
  const sess = useRef(0); const clock = useRef(null); const posRef = useRef(0); posRef.current = pos; const listRef = useRef(null);
  const stateRef = useRef(onState); stateRef.current = onState;
  const idx = Math.max(0, starts.findLastIndex ? starts.findLastIndex((s0) => s0 <= pos + 0.01) : starts.filter((s0) => s0 <= pos + 0.01).length - 1);

  const halt = (reset) => {
    sess.current++; clearInterval(clock.current); clock.current = null;
    if (playing) { stopSpeaking(); stateRef.current?.('stop'); }
    setPlaying(false); if (reset) setPos(0);
  };
  const start = (fromSentence = null, r = rate) => {
    const my = ++sess.current; clearInterval(clock.current);
    const ds = sents.map((x) => estimateSeconds(x, r)); const st = ds.reduce((a, d, i) => { a.push(i ? a[i - 1] + ds[i - 1] : 0); return a; }, []); const tot = ds.reduce((a, b) => a + b, 0);
    let i0 = fromSentence;
    if (i0 == null) { const p = posRef.current >= tot - 0.05 ? 0 : posRef.current; i0 = Math.max(0, st.filter((s0) => s0 <= p + 0.01).length - 1); }
    const base = st[i0]; const rest = sents.slice(i0); const restText = rest.join(' ');
    const offs = rest.reduce((a, x, k) => { a.push(k ? a[k - 1] + rest[k - 1].length + 1 : 0); return a; }, []);
    setPos(base); setPlaying(true); stateRef.current?.('play');
    let t0 = Date.now(); let sim = false; let speechEnded = false;
    const finish = () => { if (sess.current !== my) return; sess.current++; clearInterval(clock.current); clock.current = null; setPos(tot); setPlaying(false); stateRef.current?.('stop'); };
    clock.current = setInterval(() => {
      if (sess.current !== my) return;
      const p = base + (Date.now() - t0) / 1000;
      if (sim || speechEnded) { if (p >= tot) finish(); else setPos(p); } else setPos(Math.min(p, tot - 0.3));
    }, 200);
    const res = speak(restText, {
      lang: speakLang, rate: r,
      onboundary: (ci) => { if (sess.current !== my) return; let k = 0; while (k + 1 < offs.length && offs[k + 1] <= ci) k++; const ss = st[i0 + k]; if (posRef.current < ss) { t0 = Date.now() - (ss - base) * 1000; setPos(ss); } },
      onend: (finished) => {
        if (sess.current !== my) return;
        const elapsed = (Date.now() - t0) / 1000;
        if (finished && elapsed > 0.35 * (tot - base)) finish();
        else { sim = true; setSim(true); } // synteza niedostępna / przerwana przez system – kontynuacja w trybie symulacji
      },
    });
    if (res?.simulated) { sim = true; setSim(true); }
  };
  useEffect(() => () => { if (clock.current) { clearInterval(clock.current); sess.current++; stopSpeaking(); } }, []);
  useEffect(() => { if (clock.current) halt(true); else setPos(0); }, [txt, speakLang]);
  useEffect(() => { if (autoplay) start(0); }, []);
  // przewinięcie transkrypcji do bieżącego zdania (tylko wewnątrz listy – bez przewijania strony)
  useEffect(() => { const ul = listRef.current; const li = ul?.children[idx]; if (ul && li && playing) { const top = li.offsetTop - ul.offsetTop; if (top < ul.scrollTop || top + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = Math.max(0, top - ul.clientHeight / 3); } }, [idx, open, playing]);

  const toggle = () => (playing ? halt(false) : start());
  const cycleRate = () => { const r = rate === 1 ? 1.25 : rate === 1.25 ? 0.8 : 1; const frac = total ? pos / total : 0; setRate(r); if (playing) { const ds = sents.map((x) => estimateSeconds(x, r)); const tot = ds.reduce((a, b) => a + b, 0); posRef.current = frac * tot; start(null, r); } else { const tot = sents.reduce((a, x) => a + estimateSeconds(x, r), 0); setPos(frac * tot); } };
  const seekTo = (sec) => { const i = Math.max(0, starts.filter((s0) => s0 <= sec + 0.01).length - 1); if (playing) start(i); else setPos(starts[i]); };
  const name = title || tr('md.guide'); const prog = total ? Math.min(1, pos / total) : 0;
  const rateLbl = String(rate).replace('.', c.lang === 'pl' ? ',' : '.') + '×';
  const waves = <span class="md-wave" aria-hidden="true">{[0, 1, 2, 3, 4].map((k) => <i key={k} />)}</span>;

  if (compact) {
    return (<div class={clsx('md-audio md-audio--compact', playing && 'is-playing', cls)} title={simulated ? tr('md.lectorSim') : tr('md.lector')}>
      <button type="button" class="md-btn md-btn--main" aria-label={`${playing ? tr('md.pause') : tr('md.play')}: ${name}`} onClick={toggle}><Icon name={playing ? 'pause' : 'headphones'} /></button>
      <span class="md-audio__name">{name}</span>{waves}
      <span class="md-audio__thin" role="progressbar" aria-label={name} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(prog * 100)}><i style={{ width: `${prog * 100}%` }} /></span>
      <span class="md-time">{fmtDuration(playing || pos ? total - pos : total)}</span>
    </div>);
  }
  return (<div class={clsx('md-audio', playing && 'is-playing', cls)}>
    <div class="md-audio__top">
      <button type="button" class="md-btn md-btn--main md-btn--lg" aria-label={playing ? tr('md.pause') : tr('md.play')} onClick={toggle}><Icon name={playing ? 'pause' : 'play'} /></button>
      <div class="md-audio__meta">
        <span class="md-audio__kicker"><Icon name="headphones" size={14} />{tr('md.guide')}</span>
        <b class="md-audio__title">{name}</b>
      </div>
      {waves}
    </div>
    <input class="md-range" type="range" min="0" max={total} step="0.1" value={Math.min(pos, total)} style={{ '--p': `${prog * 100}%` }} aria-label={tr('md.seek')} aria-valuetext={`${fmtDuration(pos)} / ${fmtDuration(total)}`} onChange={(e) => seekTo(+e.currentTarget.value)} />
    <div class="md-audio__row">
      <span class="md-time">{fmtDuration(Math.min(pos, total))} <span>/ {fmtDuration(total)}</span></span>
      <span class="md-video__sp" />
      <button type="button" class="md-btn" aria-label={tr('md.restart')} title={tr('md.restart')} onClick={() => (playing ? start(0) : setPos(0))}><Icon name="skipBack" /></button>
      <button type="button" class="md-btn md-btn--txt" aria-label={`${tr('md.speed')}: ${rateLbl}`} title={tr('md.speed')} onClick={cycleRate}>{rateLbl}</button>
      <button type="button" class={clsx('md-btn md-btn--wide', open && 'is-on')} aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="captions" /><span>{tr('md.transcript')}</span></button>
    </div>
    {simulated && <p class="md-note">{tr('md.lectorSim')}</p>}
    {open && <ol class="md-audio__tx" ref={listRef} aria-label={tr('md.transcript')}>
      {sents.map((x, i) => <li key={i} class={clsx(i === idx && (playing || pos > 0) && 'is-current', i < idx && 'is-past')} aria-current={i === idx && playing ? 'true' : undefined}>
        <button type="button" title={tr('md.goSentence')} onClick={() => (playing ? start(i) : setPos(starts[i]))}>{x}</button></li>)}
    </ol>}
  </div>);
}

/* ═════════════════════════ 3. Model3D ═════════════════════════ */
// Geometria: lista ścian (prostokąty/wielokąty) w przestrzeni modelu (x w prawo, y w dół, z do widza), pozycjonowanych matrix3d.
const V = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len: (a) => Math.hypot(a[0], a[1], a[2]) };
const LIGHT = (() => { const l = [-0.45, -0.8, 0.55]; const n = V.len(l); return V.mul(l, 1 / n); })();
const f4 = (x) => Math.round(x * 1000) / 1000;
function makeGeo() {
  const faces = [];
  // prostokąt A (lewy górny), B (prawy górny), D (lewy dolny); ref – punkt wewnątrz bryły (ściana zwrócona na zewnątrz)
  const quad = (A, B, D, mat, ref, extra = {}) => {
    let u = V.sub(B, A); let v = V.sub(D, A); let n = V.cross(u, v); let clip = extra.clip; let flipped = false;
    if (ref && V.dot(n, V.sub(V.add(A, V.mul(V.add(u, v), 0.5)), ref)) < 0) { const C = V.add(B, v); [A, B, D] = [B, A, C]; u = V.sub(B, A); v = V.sub(D, A); n = V.cross(u, v); flipped = true; }
    const w = V.len(u), h = V.len(v); const ln = V.len(n) || 1; const un = V.mul(u, 1 / w), vn = V.mul(v, 1 / h), nn = V.mul(n, 1 / ln);
    if (clip && flipped) clip = clip.map(([x, y]) => [100 - x, y]);
    const k = Math.round(58 + 42 * Math.max(0, V.dot(nn, LIGHT)));
    faces.push({ w: f4(w), h: f4(h), m: `matrix3d(${[...un, 0, ...vn, 0, ...nn, 0, ...A, 1].map(f4).join(',')})`, mat, k, round: extra.round, clip, two: extra.two });
  };
  const box = (c, s, mat, opt = {}) => {
    const [x0, x1] = [c[0] - s[0] / 2, c[0] + s[0] / 2]; const [y0, y1] = [c[1] - s[1] / 2, c[1] + s[1] / 2]; const [z0, z1] = [c[2] - s[2] / 2, c[2] + s[2] / 2];
    const skip = opt.skip || '';
    if (!skip.includes('f')) quad([x0, y0, z1], [x1, y0, z1], [x0, y1, z1], opt.front || mat, c);
    if (!skip.includes('k')) quad([x1, y0, z0], [x0, y0, z0], [x1, y1, z0], opt.back || opt.front || mat, c);
    if (!skip.includes('r')) quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z1], opt.side || mat, c);
    if (!skip.includes('l')) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z0], opt.side || mat, c);
    if (!skip.includes('t')) quad([x0, y0, z0], [x1, y0, z0], [x0, y0, z1], opt.top || mat, c);
    if (!skip.includes('b')) quad([x0, y1, z1], [x1, y1, z1], [x0, y1, z0], mat, c);
  };
  const AX = { x: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], y: [[0, 1, 0], [0, 0, 1], [1, 0, 0]], z: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] };
  const cyl = (c, r, len, axis, n, mat, opt = {}) => {
    const [a, e1, e2] = AX[axis]; const half = V.mul(a, len / 2);
    const P = (th) => V.add(c, V.add(V.mul(e1, r * Math.cos(th)), V.mul(e2, r * Math.sin(th))));
    for (let i = 0; i < n; i++) { const t0 = (i / n) * 2 * Math.PI, t1 = ((i + 1) / n) * 2 * Math.PI; const p0 = P(t0), p1 = P(t1); quad(V.sub(p0, half), V.sub(p1, half), V.add(p0, half), opt.side || mat, c); }
    if (opt.caps !== false) for (const sg of [-1, 1]) { const cc = V.add(c, V.mul(half, sg)); const A = V.sub(V.sub(cc, V.mul(e1, r)), V.mul(e2, r)); quad(A, V.add(A, V.mul(e1, 2 * r)), V.add(A, V.mul(e2, 2 * r)), opt.cap || mat, c, { round: true }); }
  };
  return { faces, quad, box, cyl };
}
function buildLathe() {
  const g = makeGeo(); const { box, cyl } = g;
  box([-120, 52, 0], [40, 84, 56], 'dark'); box([118, 52, 0], [40, 84, 56], 'dark');            // nogi (szafki)
  box([0, 6, 0], [310, 4, 70], 'dark', { skip: 'b' });                                              // wanna wiórowa
  box([0, -8, 0], [300, 24, 50], 'body');                                                          // łoże
  box([0, -22, -15], [300, 4, 8], 'steel'); box([0, -22, 15], [300, 4, 8], 'steel');               // prowadnice
  box([0, 8, 30], [290, 4, 4], 'steel');                                                           // śruba pociągowa
  box([-118, -56, 0], [64, 64, 60], 'body');                                                       // wrzeciennik
  box([-118, -14, 29], [56, 26, 6], 'dark');                                                       // skrzynka posuwów
  cyl([-158, -60, 0], 26, 10, 'x', 16, 'steel', { cap: 'light' });                                 // koło pasowe
  box([-158, 26, -6], [28, 34, 34], 'dark');                                                       // silnik
  box([-158, -16, -6], [8, 70, 6], 'dark');                                                        // pas
  cyl([-76, -58, 0], 26, 22, 'x', 12, 'steel', { cap: 'light' });                                 // uchwyt
  for (const [y, z] of [[-84, 0], [-45, 22], [-45, -22]]) box([-62, y + (y === -84 ? 0 : 0), z], [6, 10, 8], 'dark');  // szczęki
  cyl([-12, -58, 0], 9, 104, 'x', 8, 'work');                                                      // przedmiot obrabiany
  box([92, -46, 0], [46, 52, 46], 'body');                                                         // konik
  cyl([58, -58, 0], 7, 24, 'x', 8, 'steel');                                                       // tuleja konika
  cyl([122, -58, 0], 15, 4, 'x', 12, 'steel', { cap: 'light' });                                   // pokrętło konika
  box([12, -28, 0], [58, 10, 72], 'dark');                                                         // sanie suportu
  box([12, -38, 6], [36, 10, 52], 'body');                                                         // suport poprzeczny
  box([12, -50, 12], [18, 14, 18], 'steel');                                                       // imak nożowy
  box([12, -50, -2], [6, 5, 22], 'light');                                                         // nóż
  box([12, -6, 37], [54, 36, 6], 'body');                                                          // fartuch
  cyl([0, -6, 43], 9, 4, 'z', 10, 'steel', { cap: 'light' });                                      // pokrętło fartucha
  return { faces: g.faces, size: [340, 200, 120], center: [-10, -10, 0], hotspots: [
    { label: { pl: 'Wrzeciennik', en: 'Headstock' }, at: [-118, -92, -10] }, { label: { pl: 'Uchwyt', en: 'Chuck' }, at: [-72, -58, 30] },
    { label: { pl: 'Konik', en: 'Tailstock' }, at: [92, -74, 0] }, { label: { pl: 'Suport', en: 'Carriage' }, at: [12, -60, 14] },
    { label: { pl: 'Łoże', en: 'Bed' }, at: [60, -12, 26] }, { label: { pl: 'Koło pasowe', en: 'Pulley' }, at: [-166, -50, 0] }] };
}
function buildHall() {
  const g = makeGeo(); const { quad, box } = g;
  const W = 300, D = 180, H = 64, top = -H; const x0 = -W / 2, x1 = W / 2, z0 = -D / 2;
  box([0, -H / 2, 0], [W, H, D], 'wall', { skip: 'tb', front: 'win', back: 'win', side: 'winSide' });  // ściany z oknami
  box([0, 2, 0], [W + 40, 4, D + 40], 'ground', { skip: 'b' });                                          // plac
  const N = 5, td = D / N, th = 28;
  for (let i = 0; i < N; i++) {
    const za = z0 + i * td, zb = za + td;
    quad([x0, top - th, za], [x1, top - th, za], [x0, top, zb], 'roof', [0, top + 20, (za + zb) / 2], { two: true }); // połać skośna (opada ku +z)
    quad([x0, top - th, za], [x1, top - th, za], [x0, top, za], 'glass', [0, top, zb]);    // pionowe przeszklenie szedu (od północy, -z)
    for (const [x, rx] of [[x0, -1], [x1, 1]]) quad([x, top - th, za], [x, top - th, zb], [x, top, za], 'wall', [x - rx, top, (za + zb) / 2], { clip: [[0, 0], [0, 100], [100, 100]] });
  }
  box([0, -84, 0], [W - 4, 6, 4], 'dark', { skip: 'b' });                                                 // świetlik kalenicowy
  box([0, -34, D / 2 + 3], [56, 36, 6], 'dark');                                                          // brama
  box([-110, -30, D / 2 + 1], [24, 30, 2], 'light'); box([110, -30, D / 2 + 1], [24, 30, 2], 'light');    // tablice
  return { faces: g.faces, size: [360, 160, 240], center: [0, -40, 0], hotspots: [
    { label: { pl: 'Dach szedowy', en: 'Sawtooth roof' }, at: [-60, -96, -20] }, { label: { pl: 'Przeszklenia od północy', en: 'North-light glazing' }, at: [60, -80, -54] },
    { label: { pl: 'Brama główna', en: 'Main gate' }, at: [0, -52, 94] }] };
}
function buildTower() {
  const g = makeGeo(); const { quad, box } = g;
  const secs = [[0, 90, 60], [90, 170, 48], [170, 240, 38]]; // [od, do, szerokość]
  for (const [a, b, w] of secs) {
    const y0 = -b, y1 = -a, hw = w / 2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box([sx * hw, (y0 + y1) / 2, sz * hw], [5, b - a, 5], 'dark');       // narożniki
    const c = [0, (y0 + y1) / 2, 0];
    quad([-hw, y0, hw], [hw, y0, hw], [-hw, y1, hw], 'lattice', c, { two: true }); quad([hw, y0, -hw], [-hw, y0, -hw], [hw, y1, -hw], 'lattice', c, { two: true });
    quad([hw, y0, hw], [hw, y0, -hw], [hw, y1, hw], 'lattice', c, { two: true }); quad([-hw, y0, -hw], [-hw, y0, hw], [-hw, y1, -hw], 'lattice', c, { two: true });
    box([0, y0, 0], [w + 14, 4, w + 14], 'deck');                                                                                       // platforma
    for (const [sx, sz, ww, dd] of [[0, 1, w + 14, 2], [0, -1, w + 14, 2], [1, 0, 2, w + 14], [-1, 0, 2, w + 14]]) box([sx * (w / 2 + 7), y0 - 7, sz * (w / 2 + 7)], [ww, 12, dd], 'rail', { skip: 'tb' });
  }
  box([0, -262, 0], [44, 40, 44], 'glass', { top: 'roof' });  // taras widokowy (oszklony)
  box([0, -285, 0], [56, 6, 56], 'roof');                       // daszek
  box([0, -305, 0], [3, 36, 3], 'dark');                        // maszt
  box([0, 2, 0], [120, 4, 120], 'ground', { skip: 'b' });       // podstawa
  return { faces: g.faces, size: [160, 330, 160], center: [0, -150, 0], hotspots: [
    { label: { pl: 'Taras widokowy', en: 'Viewing terrace' }, at: [0, -290, 0] }, { label: { pl: 'Platforma pośrednia', en: 'Intermediate deck' }, at: [30, -178, 30] },
    { label: { pl: 'Konstrukcja kratowa', en: 'Lattice structure' }, at: [-30, -50, 30] }] };
}
const MODELS = { lathe: buildLathe, hall: buildHall, tower: buildTower };
const modelCache = {};
const getModel = (id) => modelCache[id] || (modelCache[id] = (MODELS[id] || MODELS.lathe)());

/**
 * Obiekt 3D z prymitywów CSS 3D, obracany przeciąganiem (yaw + pitch), zoom kółkiem/szczypaniem/klawiszami, autoobrót do 1. interakcji.
 * props (jak w zaślepce): modelId 'lathe'|'hall'|'tower', autoRotate=true, class
 * props dodatkowe: hotspots [{label (tekst lub {pl,en}), at:[x,y,z]}] lub 'auto' (wbudowane opisy części), bare (bez tła i przycisków – do osadzenia, np. w ARView),
 *   yaw, pitch (początkowe kąty), ratio='4/3'
 */
export function Model3D({ modelId = 'lathe', autoRotate = true, class: cls, hotspots, bare, yaw: yaw0 = -32, pitch: pitch0 = -20, ratio = '4/3' }) {
  const { t: tr, L } = useClient(); const model = getModel(modelId);
  const hs = hotspots === 'auto' ? model.hotspots : Array.isArray(hotspots) ? hotspots : [];
  const stageRef = useRef(null); const objRef = useRef(null); const hsRefs = useRef([]); const size = useSize(stageRef); const inView = useInView(stageRef);
  const st = useRef({ yaw: yaw0, pitch: pitch0, zoom: 1, auto: autoRotate && !reducedMotion(), raf: 0, last: 0, tween: null, pointers: new Map(), pinch: 0 });
  const [touched, setTouched] = useState(false);
  const fit = size.w ? Math.min(size.w / Math.max(model.size[0], model.size[2]), size.h / (model.size[1] + 0.35 * Math.min(model.size[0], model.size[2]))) * 0.8 : 1;
  const persp = Math.max(400, (size.w || 400) * 2.2);
  const apply = () => {
    const s = st.current; const el = objRef.current; if (!el) return;
    const k = fit * s.zoom; const [cx, cy, cz] = model.center;
    el.style.transform = `scale3d(${k},${k},${k}) rotateX(${s.pitch}deg) rotateY(${s.yaw}deg) translate3d(${-cx}px,${-cy}px,${-cz}px)`;
    if (hs.length) {
      const ry = (s.yaw * Math.PI) / 180, rx = (s.pitch * Math.PI) / 180; const cyw = Math.cos(ry), syw = Math.sin(ry), cp = Math.cos(rx), sp = Math.sin(rx);
      hs.forEach((h, i) => {
        const node = hsRefs.current[i]; if (!node) return;
        const x = h.at[0] - cx, y = h.at[1] - cy, z = h.at[2] - cz;
        const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw; const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const f = persp / (persp - z2 * k); const X = size.w / 2 + x1 * k * f, Y = size.h / 2 + y2 * k * f;
        const nw = node.offsetWidth; const left = X + nw > size.w - 6 && X - nw > 4; node.style.transform = `translate(${X.toFixed(1)}px, ${Y.toFixed(1)}px)${left ? ' translateX(-100%)' : ''}`; node.classList.toggle('is-behind', z2 < -20); node.classList.toggle('is-left', left);
      });
    }
  };
  const applyRef = useRef(apply); applyRef.current = apply;
  const loop = (ts) => {
    const s = st.current; const dt = s.last ? Math.min(64, ts - s.last) : 16; s.last = ts;
    if (s.tween) { const p = Math.min(1, (ts - s.tween.t0) / 450); const e = 1 - (1 - p) ** 3; for (const k of ['yaw', 'pitch', 'zoom']) s[k] = s.tween.from[k] + (s.tween.to[k] - s.tween.from[k]) * e; if (p >= 1) s.tween = null; }
    else if (s.auto) s.yaw += dt * 0.018;
    applyRef.current();
    s.raf = s.tween || s.auto ? requestAnimationFrame(loop) : 0; if (!s.raf) s.last = 0;
  };
  const kick = () => { const s = st.current; if (!s.raf && inView) s.raf = requestAnimationFrame(loop); };
  useLayoutEffect(() => { apply(); }, [size.w, size.h, modelId, hs.length]);
  useEffect(() => { const s = st.current; if (inView) kick(); else if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0; } }, [inView]);
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);
  const interact = () => { const s = st.current; if (s.auto) { s.auto = false; } s.tween = null; if (!touched) setTouched(true); };
  const zoomBy = (f) => { const s = st.current; interact(); s.zoom = clamp(s.zoom * f, 0.55, 2.4); apply(); };
  // kółko myszy – nasłuch niepasywny (preventDefault), tylko nad modelem
  useEffect(() => { const el = stageRef.current; if (!el) return undefined; const w = (e) => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0015)); }; el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w); });
  const onDown = (e) => { if (e.target.closest('button')) return; const s = st.current; interact(); s.pointers.set(e.pointerId, [e.clientX, e.clientY]); s.scale = scaleOf(stageRef.current); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* nic */ } if (s.pointers.size === 2) { const [a, b] = [...s.pointers.values()]; s.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
  const onMove = (e) => {
    const s = st.current; const prev = s.pointers.get(e.pointerId); if (!prev) return;
    s.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (s.pointers.size >= 2) { const [a, b] = [...s.pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (s.pinch) s.zoom = clamp(s.zoom * (d / s.pinch), 0.55, 2.4); s.pinch = d; }
    else { const sc = s.scale || 1; s.yaw += ((e.clientX - prev[0]) / sc) * 0.5; s.pitch = clamp(s.pitch - ((e.clientY - prev[1]) / sc) * 0.4, -80, 12); }
    apply();
  };
  const onUp = (e) => { const s = st.current; s.pointers.delete(e.pointerId); if (s.pointers.size < 2) s.pinch = 0; };
  const onKey = (e) => {
    const s = st.current; const m = { ArrowLeft: ['yaw', -8], ArrowRight: ['yaw', 8], ArrowUp: ['pitch', 6], ArrowDown: ['pitch', -6] }[e.key];
    if (m) { e.preventDefault(); interact(); s[m[0]] = m[0] === 'pitch' ? clamp(s.pitch + m[1], -80, 12) : s.yaw + m[1]; apply(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.15); } else if (e.key === '-') { e.preventDefault(); zoomBy(1 / 1.15); } else if (e.key === '0' || e.key === 'Home') { e.preventDefault(); reset(); }
  };
  const reset = () => { const s = st.current; s.auto = false; s.tween = { t0: performance.now(), from: { yaw: s.yaw, pitch: s.pitch, zoom: s.zoom }, to: { yaw: s.yaw + angDiff(yaw0, s.yaw), pitch: pitch0, zoom: 1 } }; if (reducedMotion()) { s.tween.t0 = -1e9; } kick(); };
  const name = tr(`md.m3.${MODELS[modelId] ? modelId : 'lathe'}`);
  return (
    <div ref={stageRef} class={clsx('md-m3', bare && 'md-m3--bare', `md-m3--${modelId}`, cls)} style={{ aspectRatio: ratio, perspective: `${persp}px` }}
      tabIndex={0} role="group" aria-roledescription="3D" aria-label={tr('md.m3.label', { name })} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      <div class="md-m3__shadow" aria-hidden="true" />
      <div class="md-m3__obj" ref={objRef} aria-hidden="true">
        {model.faces.map((f, i) => <div key={i} class={clsx('md-m3__f', `md-m3__f--${f.mat}`, f.round && 'is-round', f.two && 'is-two')} style={{ width: `${f.w}px`, height: `${f.h}px`, transform: f.m, '--k': `${f.k}%`, clipPath: f.clip ? `polygon(${f.clip.map(([x, y]) => `${x}% ${y}%`).join(',')})` : undefined }} />)}
      </div>
      {hs.map((h, i) => <span key={i} class="md-m3__hs" ref={(n) => { hsRefs.current[i] = n; }}><i /><span>{asText(h.label, L)}</span></span>)}
      {!bare && <>
        {!touched && <span class="md-m3__hint" aria-hidden="true"><Icon name="rotate" size={16} />{tr('md.m3.hint')}</span>}
        <div class="md-m3__tools">
          <button type="button" class="md-btn md-btn--ghost" aria-label={tr('md.m3.zoomOut')} title={tr('md.m3.zoomOut')} onClick={() => zoomBy(1 / 1.2)}><Icon name="zoomOut" /></button>
          <button type="button" class="md-btn md-btn--ghost" aria-label={tr('md.m3.zoomIn')} title={tr('md.m3.zoomIn')} onClick={() => zoomBy(1.2)}><Icon name="zoomIn" /></button>
          <button type="button" class="md-btn md-btn--ghost" aria-label={tr('md.m3.reset')} title={tr('md.m3.reset')} onClick={reset}><Icon name="refresh" /></button>
        </div></>}
    </div>
  );
}

/* ═════════════════════════ 4. Panorama360 ═════════════════════════ */
const PW = 3600, PH = 500, HZ = 318; // szerokość 360° (10 j./°), wysokość, linia horyzontu
const AZX = (az) => (((az % 360) + 360) % 360) * (PW / 360);
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
/** Okresowy profil wzgórz (całkowite częstotliwości → bezszwowe zapętlenie). */
const hillPath = (base, amps, phase) => { let d = `M-30 ${PH}`; for (let x = -30; x <= PW + 30; x += 30) { let y = base; amps.forEach(([k, a], i) => { y -= a * Math.sin((k * 2 * Math.PI * x) / PW + phase + i); }); d += `L${x} ${y.toFixed(1)}`; } return d + `L${PW + 30} ${PH}z`; };
export const PANORAMA_LANDMARKS = [
  { id: 'lm-huta', name: { pl: 'Huta Katowice', en: 'Katowice Steelworks' }, az: 76, kind: 'city' },
  { id: 'lm-pogoria', name: { pl: 'Pogoria III', en: 'Pogoria III lake' }, az: 118, kind: 'city' },
  { id: 'lm-pkz', name: { pl: 'Pałac Kultury Zagłębia', en: 'Palace of Culture' }, az: 186, kind: 'city' },
  { id: 'lm-bazylika', name: { pl: 'Bazylika NMP Anielskiej', en: 'Basilica' }, az: 208, kind: 'city' },
  { id: 'lm-szyb', name: { pl: 'Szyb kopalni', en: 'Mine shaft' }, az: 252, kind: 'city' },
  { id: 'lm-manhattan', name: { pl: 'Osiedle „Manhattan”', en: '“Manhattan” estate' }, az: 160, kind: 'city' },
  { id: 'lm-gora', name: { pl: 'Góra Gołonoska', en: 'Gołonóg hill' }, az: 330, kind: 'city' },
];
function PanoramaArt({ uid }) {
  const r = rng(7); const els = [];
  // bloki miejskie (pas śródmiejski)
  for (let x = 0; x < PW;) {
    const w = 14 + r() * 34; const h = 10 + r() * 34 + (Math.sin((x / PW) * 2 * Math.PI * 3) + 1) * 8; const az = (x / PW) * 360;
    const near = (a) => Math.abs(((az - a + 540) % 360) - 180) < 12;
    const tall = near(160) ? 40 + r() * 30 : 0; const skip = near(118) || near(76);
    if (!skip) els.push(<rect key={`b${x}`} x={x.toFixed(0)} y={(HZ - h - tall).toFixed(0)} width={w.toFixed(0)} height={(h + tall + 4).toFixed(0)} class={r() > 0.5 ? 'md-pano__blk' : 'md-pano__blk2'} />);
    if (!skip && h + tall > 30) els.push(<rect key={`w${x}`} x={(x + 3).toFixed(0)} y={(HZ - h - tall + 5).toFixed(0)} width={Math.max(4, w - 6).toFixed(0)} height={(h + tall - 10).toFixed(0)} fill={`url(#${uid}-win)`} />);
    x += w + 2 + r() * 10;
  }
  const smoke = (x, y) => [0, 1, 2, 3].map((k) => <circle key={k} cx={x + k * 14} cy={y - k * 16} r={8 + k * 5} class="md-pano__smoke" />);
  const X = AZX;
  const lm = (
    <g>
      {/* Huta Katowice: hale, wielki piec, kominy */}
      <rect x={X(64)} y={HZ - 46} width="150" height="50" class="md-pano__lm" /><path d={`M${X(70)} ${HZ - 46}l20-18h60l20 18z`} class="md-pano__lm" />
      {[0, 22, 50, 74].map((dx, k) => <g key={k}><rect x={X(72) + dx} y={HZ - 150 + k * 12} width="9" height={150 - k * 12} class="md-pano__lm" /><rect x={X(72) + dx} y={HZ - 150 + k * 12} width="9" height="8" class="md-pano__band" />{k < 2 && smoke(X(72) + dx + 4, HZ - 160 + k * 12)}</g>)}
      <path d={`M${X(80)} ${HZ - 46}v-60h16v20h10v40z`} class="md-pano__lm" />
      {/* Pałac Kultury Zagłębia */}
      <path d={`M${X(181)} ${HZ}v-42h90v42z M${X(181) + 30} ${HZ - 42}v-32h30v32z M${X(181) + 38} ${HZ - 74}v-18h14v18z M${X(181) + 45} ${HZ - 92}l0-16`} class="md-pano__lm md-pano__lm--stroke" />
      {/* Bazylika – dwie neogotyckie wieże */}
      <path d={`M${X(204)} ${HZ}v-48h70v48z M${X(204) - 4} ${HZ - 48}l0-60h20v60z M${X(204) + 56} ${HZ - 48}l0-60h20v60z M${X(204) - 6} ${HZ - 108}l12-44l12 44z M${X(204) + 54} ${HZ - 108}l12-44l12 44z M${X(204) + 16} ${HZ - 48}l19-22l19 22z`} class="md-pano__lm" />
      {/* szyb kopalni (wieża wyciągowa) */}
      <g class="md-pano__lmline"><path d={`M${X(249)} ${HZ}l14-90l14 90 M${X(249) + 4} ${HZ - 30}h20 M${X(249) + 8} ${HZ - 60}h12 M${X(249) + 14} ${HZ - 90}l26 90`} /><circle cx={X(249) + 14} cy={HZ - 92} r="7" /></g>
      {/* kościół na wzgórzu */}
      <path d={`M${X(300)} ${HZ - 8}v-30h36v30z M${X(300) + 10} ${HZ - 38}v-30h14v30z M${X(300) + 8} ${HZ - 68}l9-26l9 26z`} class="md-pano__lm" />
    </g>);
  // jeziora Pogorii
  const lakes = [[100, 140, 10], [28, 42, 6], [262, 280, 5]].map(([a, b, h], k) => <path key={k} d={`M${X(a)} ${HZ + 4}C${X(a) + 40} ${HZ - 2} ${X(b) - 40} ${HZ - 2} ${X(b)} ${HZ + 4}C${X(b) - 50} ${HZ + 6 + h} ${X(a) + 50} ${HZ + 6 + h} ${X(a)} ${HZ + 4}z`} class="md-pano__water" />);
  // pierwszy plan: hale FPŻ z dachami szedowymi, zieleń
  const fpz = [[18, 66], [126, 158], [216, 246], [318, 352]].map(([a, b], k) => {
    const x0 = X(a), x1 = X(b); const y = 392 + (k % 2) * 14; let saw = `M${x0} ${PH}V${y}`; const n = Math.round((x1 - x0) / 46);
    for (let i = 0; i < n; i++) { const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n; saw += `L${xb - 8} ${y - 30}L${xb} ${y - 30}L${xb} ${y}`; void xa; }
    return (<g key={k}><path d={`${saw}V${PH}z`} class="md-pano__hall" />
      {Array.from({ length: n }, (_, i) => { const xb = x0 + ((x1 - x0) * (i + 1)) / n; return <rect key={i} x={xb - 7} y={y - 27} width="5" height="24" class="md-pano__glass" />; })}
      <rect x={x0 + 10} y={y + 22} width={x1 - x0 - 20} height="14" class="md-pano__glass" opacity=".7" /></g>);
  });
  const trees = []; const rt = rng(3); for (let i = 0; i < 70; i++) { const x = rt() * PW; const y = 440 + rt() * 50; trees.push(<circle key={i} cx={x.toFixed(0)} cy={y.toFixed(0)} r={(10 + rt() * 14).toFixed(0)} class={i % 3 ? 'md-pano__tree' : 'md-pano__tree2'} />); }
  return (<g>
    <rect x="-4" width={PW + 8} height={PH} fill={`url(#${uid}-sky)`} />
    {[[200, 80], [900, 60], [1700, 90], [2500, 70], [3200, 85]].map(([x, y], k) => <ellipse key={k} cx={x} cy={y} rx={90 + k * 10} ry="14" class="md-pano__cloud" />)}
    <path d={hillPath(HZ - 26, [[2, 10], [3, 7], [7, 4], [11, 2]], 0.4)} class="md-pano__hill1" />
    <path d={hillPath(HZ - 8, [[1, 8], [4, 6], [9, 3]], 2.1)} class="md-pano__hill2" />
    <g>{els}</g>{lm}
    <rect x="-4" y={HZ} width={PW + 8} height={PH - HZ} class="md-pano__land" />
    {lakes}
    <path d={hillPath(410, [[3, 10], [5, 6], [13, 3]], 1.2)} class="md-pano__field" />
    {fpz}{trees}
  </g>);
}
const DIRS = { pl: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] };
let panoSeq = 0;
/**
 * Panorama 360° rysowana proceduralnie (SVG), bezszwowo zapętlona; obrót przeciąganiem (z bezwładnością), strzałkami i przyciskami.
 * Zatrzymanie celownika na obiekcie przez dwellMs → onDwell(hotspot) (pierścień postępu); klik w etykietę → onSelect(hotspot).
 * props (jak w zaślepce): hotspots [{id, name:L, az:0..359, kind:'fpz'|'city'}], onDwell(h), onSelect(h), dwellMs=1500, class
 * props dodatkowe: az, onAz(az) (sterowanie z zewnątrz), landmarks=true (podpisy charakterystycznych obiektów miasta na panoramie, bez akcji),
 *   ratio='16/9', note=true (adnotacja o źródle panoramy)
 */
export function Panorama360({ hotspots = [], onDwell, onSelect, dwellMs = 1500, class: cls, az: azProp, onAz, landmarks = true, ratio = '16/9', note = true }) {
  const { t: tr, L, lang } = useClient();
  const uid = useMemo(() => `mdp${++panoSeq}`, []);
  const rootRef = useRef(null); const layerRef = useRef(null); const cmpRef = useRef(null); const readRef = useRef(null); const size = useSize(rootRef); const inView = useInView(rootRef);
  const st = useRef({ az: azProp ?? 0, vel: 0, drag: null, raf: 0, last: 0, target: null, scale: 1 });
  const [center, setCenter] = useState(null); const [dwelt, setDwelt] = useState(null);
  const hsRef = useRef(hotspots); hsRef.current = hotspots; const cbs = useRef({}); cbs.current = { onDwell, onAz, onSelect };
  const spanPx = size.h ? size.h * 1.26 * (PW / PH) : 1; // 360° w pikselach
  const fov = size.w && size.h ? (size.w / spanPx) * 360 : 90;
  const apply = () => {
    const s = st.current; const el = layerRef.current; if (!el) return;
    const left = (((s.az - fov / 2) % 360) + 360) % 360; // azymut lewej krawędzi
    el.style.transform = `translate3d(${(-(left + 360) / 1080) * 100}%,0,0)`; if (cmpRef.current) cmpRef.current.style.transform = el.style.transform;
    const a = Math.round((((s.az % 360) + 360) % 360)) % 360;
    if (readRef.current) readRef.current.textContent = `${DIRS[lang === 'pl' ? 'pl' : 'en'][Math.round(a / 45) % 8]} ${a}°`;
    const tol = Math.max(4, fov * 0.06);
    let best = null; for (const h of hsRef.current) { const d = Math.abs(angDiff(h.az, s.az)); if (d < tol && (!best || d < best.d)) best = { h, d }; }
    setCenter((c) => ((c?.id ?? null) === (best?.h.id ?? null) ? c : best?.h || null));
    cbs.current.onAz?.(((s.az % 360) + 360) % 360);
  };
  const applyRef = useRef(apply); applyRef.current = apply;
  const loop = (ts) => {
    const s = st.current; const dt = s.last ? Math.min(64, ts - s.last) : 16; s.last = ts; let go = false;
    if (s.target != null) { const d = angDiff(s.target, s.az); if (Math.abs(d) < 0.2) { s.az = s.target; s.target = null; } else { s.az += d * Math.min(1, dt / 90); go = true; } }
    else if (!s.drag && Math.abs(s.vel) > 0.002) { s.az += s.vel * dt; s.vel *= Math.pow(0.93, dt / 16); go = true; }
    applyRef.current(); s.raf = go ? requestAnimationFrame(loop) : 0; if (!go) s.last = 0;
  };
  const kick = () => { const s = st.current; if (!s.raf) s.raf = requestAnimationFrame(loop); };
  const turnTo = (az) => { const s = st.current; s.vel = 0; s.target = az; if (reducedMotion() || !inView) { s.az = az; s.target = null; apply(); } else kick(); };
  useLayoutEffect(() => { apply(); }, [size.w, size.h, hotspots.length, lang]);
  useEffect(() => { if (azProp == null) return; const s = st.current; if (Math.abs(angDiff(azProp, s.az)) > 0.5) turnTo(azProp); }, [azProp]);
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);
  // zatrzymanie widoku na obiekcie
  useEffect(() => {
    if (!center || !inView) return undefined;
    const id = setTimeout(() => { setDwelt(center.id); cbs.current.onDwell?.(center); }, dwellMs);
    return () => clearTimeout(id);
  }, [center?.id, inView, dwellMs]);
  useEffect(() => { if (!center) setDwelt(null); }, [center?.id]);
  const onDown = (e) => { if (e.target.closest('button')) return; const s = st.current; s.target = null; s.vel = 0; s.scale = scaleOf(rootRef.current); s.drag = { x: e.clientX, t: performance.now(), id: e.pointerId }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* nic */ } };
  const onMove = (e) => {
    const s = st.current; if (!s.drag || s.drag.id !== e.pointerId) return;
    const now = performance.now(); const dx = (e.clientX - s.drag.x) / s.scale; const dDeg = -(dx / spanPx) * 360;
    s.az += dDeg; const dt = Math.max(1, now - s.drag.t); s.vel = s.vel * 0.6 + (dDeg / dt) * 0.4; s.drag.x = e.clientX; s.drag.t = now; apply();
  };
  const onUp = () => { const s = st.current; if (!s.drag) return; if (performance.now() - s.drag.t > 80) s.vel = 0; s.drag = null; if (reducedMotion()) s.vel = 0; kick(); };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const s = st.current; turnTo((s.target ?? s.az) + (e.key === 'ArrowRight' ? 10 : -10)); }
    else if (e.key === 'Home') { e.preventDefault(); turnTo(0); }
  };
  const lmList = landmarks ? PANORAMA_LANDMARKS.filter((l) => !hotspots.some((h) => Math.abs(angDiff(h.az, l.az)) < 6)).map((l) => ({ ...l, text: L(l.name) })) : [];
  const art = useMemo(() => [0, 1, 2].map((c) => <g key={c} transform={`translate(${c * PW} 0)`}><PanoramaArt uid={uid} /></g>), [uid]);
  const compass = useMemo(() => { const out = []; for (let c = 0; c < 3; c++) for (let a = 0; a < 360; a += 15) { const n = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[a]; out.push(<span key={`${c}-${a}`} class={clsx('md-pano__cmp', n && 'is-dir', n?.length === 1 && 'is-main')} style={{ left: `${((a + c * 360) / 1080) * 100}%` }}>{n || a}</span>); } return out; }, []);
  const lmEls = []; for (let c = 0; c < 3; c++) for (const l of lmList) lmEls.push(<span key={`${c}-${l.id}`} class="md-pano__lmtxt" style={{ left: `${((l.az + c * 360) / 1080) * 100}%` }} aria-hidden="true">{l.text}</span>);
  // etykiety bliskich obiektów miejskich – naprzemiennie na dwóch wysokościach
  const level = {}; { let prev = null; let lv = 0; [...hotspots].filter((h) => h.kind !== 'fpz').sort((a, b) => a.az - b.az).forEach((h) => { lv = prev != null && Math.abs(angDiff(h.az, prev)) < Math.max(8, fov * 0.22) ? 1 - lv : 0; level[h.id] = lv; prev = h.az; }); }
  const hsEls = []; for (const copy of [0, 1, 2]) for (const h of hotspots) {
    const leftPct = (((((h.az % 360) + 360) % 360) + copy * 360) / 1080) * 100;
    hsEls.push(<button key={`${copy}-${h.id}`} type="button" tabIndex={copy === 1 ? 0 : -1} aria-hidden={copy === 1 ? undefined : 'true'}
      class={clsx('md-pano__hs', `md-pano__hs--${h.kind === 'fpz' ? 'fpz' : 'city'}`, center?.id === h.id && 'is-center', dwelt === h.id && 'is-dwelt', level[h.id] && 'is-low')} style={{ left: `${leftPct}%` }}
      onFocus={() => turnTo(h.az)} onClick={() => { turnTo(h.az); cbs.current.onSelect?.(h); }}>
      <span class="md-pano__hslabel">{asText(h.name, L)}</span><i class="md-pano__stem" /><i class="md-pano__dot" /></button>);
  }
  return (
    <div ref={rootRef} class={clsx('md-pano', cls)} style={{ aspectRatio: ratio }} tabIndex={0} role="application" aria-label={tr('md.pano.label')}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      <div class="md-pano__layer" ref={layerRef}>
        <svg class="md-pano__svg" viewBox={`0 0 ${PW * 3} ${PH}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="md-pano__sky0" /><stop offset=".62" class="md-pano__sky1" /></linearGradient>
            <pattern id={`${uid}-win`} width="7" height="8" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="3" height="3" class="md-pano__winp" /></pattern>
          </defs>
          {art}
        </svg>
        <div class="md-pano__hss">{lmEls}{hsEls}</div>
      </div>
      <div class="md-pano__compass" aria-hidden="true"><div class="md-pano__cmpstrip" ref={cmpRef} style={{ width: `${spanPx * 3}px` }}>{compass}</div><i class="md-pano__cmpmark" /></div>
      <div class="md-pano__cross" aria-hidden="true">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="md-pano__ring" />
          {center && dwelt !== center.id && <circle key={center.id} cx="32" cy="32" r="26" class="md-pano__prog" style={{ animationDuration: `${dwellMs}ms` }} transform="rotate(-90 32 32)" />}
          <path d="M32 4v14M32 46v14M4 32h14M46 32h14" class="md-pano__crossline" /><circle cx="32" cy="32" r="2.5" class="md-pano__crossdot" /></svg>
      </div>
      <div class="md-pano__read"><Icon name="compass" size={14} /><span ref={readRef}>N 0°</span></div>
      <div class="md-pano__status" aria-live="polite">{center ? tr('md.pano.hold', { name: asText(center.name, L) }) : ''}</div>
      <button type="button" class="md-btn md-btn--ghost md-pano__nav md-pano__nav--l" aria-label={tr('md.pano.left')} onClick={() => { const s = st.current; turnTo((s.target ?? s.az) - 30); }}><Icon name="back" /></button>
      <button type="button" class="md-btn md-btn--ghost md-pano__nav md-pano__nav--r" aria-label={tr('md.pano.right')} onClick={() => { const s = st.current; turnTo((s.target ?? s.az) + 30); }}><Icon name="arrowRight" /></button>
      {note && <span class="md-note md-pano__note"><Icon name="panorama" size={12} />{tr('md.pano.note')}</span>}
    </div>
  );
}

/* ═════════════════════════ 5. ARView ═════════════════════════ */
const AR_FUTURE = [
  { x: 22, y: 46, label: { pl: 'Zielony dach z ogrodem', en: 'Green roof garden' } },
  { x: 52, y: 64, label: { pl: 'Pasaż handlowy', en: 'Shopping arcade' } },
  { x: 80, y: 38, label: { pl: 'Taras widokowy', en: 'Viewing terrace' } },
];
const AR_INFO = { hall: [{ x: 32, y: 34, label: { pl: 'Dach szedowy, lata 50.', en: 'Sawtooth roof, 1950s' } }, { x: 68, y: 62, label: { pl: 'Dawna hala montażu', en: 'Former assembly hall' } }],
  plaza: [{ x: 40, y: 40, label: { pl: 'Plac Fabryki', en: 'Factory Square' } }] };
/**
 * Widok rozszerzonej rzeczywistości (symulacja obrazu z kamery).
 * props (jak w zaślepce): scene 'hall'|'plaza'; overlay 'future'|'info'|'model'; modelId; label; onCapture(); children; class
 * props dodatkowe: ill (własne tło), futureIll='future-city', points [{x,y (w %), label}] (punkty wizji przyszłości / etykiety info),
 *   mix=50 (położenie suwaka dziś↔jutro), onMix(v), ratio='3/4', trackMs=1200
 */
export function ARView({ scene = 'hall', overlay = 'info', modelId = 'lathe', label, onCapture, children, class: cls, ill, futureIll = 'future-city', points, mix: mix0 = 50, onMix, ratio = '3/4', trackMs = 1200 }) {
  const { t: tr, L } = useClient();
  const [mix, setMix] = useState(mix0); const [found, setFound] = useState(false); const [flash, setFlash] = useState(0);
  useEffect(() => { setFound(false); const id = setTimeout(() => setFound(true), trackMs); return () => clearTimeout(id); }, [scene, overlay, modelId, trackMs]);
  const pts = points || (overlay === 'future' ? AR_FUTURE : overlay === 'info' ? (AR_INFO[scene] || AR_INFO.hall) : []);
  const capture = () => { setFlash((n) => n + 1); onCapture?.(); };
  const bg = ill || (scene === 'plaza' ? 'hall-exterior' : 'hall-interior');
  return (
    <div class={clsx('md-ar', found && 'is-found', `md-ar--${overlay}`, cls)} style={{ aspectRatio: ratio }} role="group" aria-label={tr('md.ar.view')}>
      <div class="md-ar__cam">
        <div class="md-ar__bg"><Illustration id={bg} tone="color" title={tr('md.ar.view')} /></div>
        {overlay === 'future' && found && <div class="md-ar__future" style={{ clipPath: `inset(0 0 0 ${100 - mix}%)` }}>
          <Illustration id={futureIll} tone="duotone" />
          {pts.map((p, i) => <span key={i} class={clsx('md-ar__pt', p.x >= 100 - mix && 'is-on', p.x > 66 && 'is-left')} style={{ left: `${p.x}%`, top: `${p.y}%` }}><i /><b>{asText(p.label, L)}</b></span>)}
        </div>}
        {overlay === 'info' && found && pts.map((p, i) => <span key={i} class={clsx('md-ar__tag', p.x > 66 && 'is-left')} style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${i * 120}ms` }}><i /><b>{asText(p.label, L)}</b></span>)}
        {overlay === 'model' && found && <div class="md-ar__model"><Model3D modelId={modelId} bare ratio="1/1" pitch={-24} /></div>}
      </div>
      {overlay === 'future' && found && <div class="md-ar__split" style={{ left: `${100 - mix}%` }} aria-hidden="true"><span>{tr('md.ar.today')}</span><span>{tr('md.ar.tomorrow')}</span></div>}
      <span class="md-ar__corner md-ar__corner--tl" /><span class="md-ar__corner md-ar__corner--tr" /><span class="md-ar__corner md-ar__corner--bl" /><span class="md-ar__corner md-ar__corner--br" />
      {!found && <div class="md-ar__scan" aria-hidden="true"><i /></div>}
      <div class="md-ar__top">
        <span class="md-ar__badge"><Icon name="ar" size={16} />AR</span>
        <span class={clsx('md-ar__track', found && 'is-found')} role="status" aria-live="polite"><i />{found ? tr('md.ar.found') : tr('md.ar.searching')}</span>
      </div>
      {label && found && <div class="md-ar__label">{asText(label, L)}</div>}
      {children && <div class="md-ar__custom">{children}</div>}
      {flash > 0 && <i key={flash} class="md-ar__flash" aria-hidden="true" />}
      <div class="md-ar__bottom">
        {overlay === 'future' && <label class="md-ar__slider"><span>{tr('md.ar.today')}</span>
          <input class="md-range" type="range" min="0" max="100" value={mix} style={{ '--p': `${mix}%` }} aria-label={tr('md.ar.mix')} disabled={!found} onInput={(e) => { const x = +e.currentTarget.value; setMix(x); onMix?.(x); }} />
          <span>{tr('md.ar.tomorrow')}</span></label>}
        {onCapture && <button type="button" class="md-ar__shutter" aria-label={tr('md.ar.capture')} onClick={capture}><i /></button>}
      </div>
      <span class="md-note md-ar__note">{tr('md.ar.sim')}</span>
    </div>
  );
}

/* ═════════════════════════ 6. useSoundscape – „Dźwięki miasta” (Web Audio, w pełni syntetyczne) ═════════════════════════ */
export const SOUND_TRACKS = [
  { id: 'hala', name: { pl: 'Hala maszyn', en: 'Machine hall' }, desc: { pl: 'Szum silników, rytmiczne stuki obrabiarek i przejazd suwnicy z sygnałem ostrzegawczym.', en: 'Motor hum, the rhythmic knocking of machine tools and an overhead crane passing with its warning bell.' } },
  { id: 'kuznia', name: { pl: 'Kuźnia', en: 'Forge' }, desc: { pl: 'Ciężkie uderzenia młota o kowadło, huk paleniska i syk hartowanej stali.', en: 'Heavy hammer blows on the anvil, the roar of the hearth and the hiss of quenched steel.' } },
  { id: 'kolej', name: { pl: 'Kolej', en: 'Railway' }, desc: { pl: 'Parowóz na bocznicy w Ząbkowicach: sapanie, stukot kół i gwizd.', en: 'A steam engine on the Ząbkowice siding: chuffing, clattering wheels and a whistle.' } },
  { id: 'huta', name: { pl: 'Huta', en: 'Steelworks' }, desc: { pl: 'Niski pomruk wielkiego pieca, syk spustu surówki i daleka syrena zmiany.', en: 'The low rumble of the blast furnace, the hiss of tapping and a distant shift siren.' } },
  { id: 'szklo', name: { pl: 'Huta szkła', en: 'Glassworks' }, desc: { pl: 'Dzwoniące, szkliste tony stygnącego szkła nad szumem pieca.', en: 'Ringing, glassy tones of cooling glass above the furnace murmur.' } },
  { id: 'kopalnia', name: { pl: 'Kopalnia', en: 'Coal mine' }, desc: { pl: 'Koło wyciągowe szybu, sygnały dzwonka sygnałowego i kapanie wody w chodniku.', en: 'The shaft winding wheel, signal bells and water dripping in the gallery.' } },
  { id: 'symfonia', name: { pl: 'Symfonia industrialna', en: 'Industrial symphony' }, desc: { pl: 'Kompozycja: rytm maszyn jako podkład linii melodycznej (w duchu „Symfonii industrialnej” Filharmonii Śląskiej).', en: 'A composition: machine rhythms as the backing for a melodic line (inspired by the Silesian Philharmonic’s “Industrial Symphony”).' } },
];
const noiseCache = new WeakMap();
const noiseBuf = (ctx) => { let b = noiseCache.get(ctx); if (!b) { const n = ctx.sampleRate * 2; b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseCache.set(ctx, b); } return b; };
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
/** Zestaw generatorów dźwięku działających na kontekście ctx i wyjściu out (każdy obiekt sam się zwalnia po wybrzmieniu). */
function synth(ctx, out, keep) {
  const env = (g, t, a, peak, d, sus = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + d); };
  const fx = { out };
  /** szum filtrowany: {f, q, type, gain, a, d, f2 (przemiatanie), dest} */
  fx.noise = (t, o) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx); src.loop = true; const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f, t); f.Q.value = o.q ?? 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.a || 0.01) + o.d);
    const g = ctx.createGain(); env(g, t, o.a || 0.005, o.gain, o.d); src.connect(f).connect(g).connect(o.dest || out);
    src.start(t, Math.random() * 1.5); src.stop(t + (o.a || 0.005) + o.d + 0.05);
  };
  /** ton: {f, type, gain, a, d, f2, detune, dest} */
  fx.tone = (t, o) => {
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t); if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.d)); if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain(); env(g, t, o.a || 0.005, o.gain, o.d, o.sus); let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g).connect(o.dest || out); osc.start(t); osc.stop(t + (o.a || 0.005) + o.d + 0.1);
  };
  /** uderzenie (spadek wysokości jak w bębnie): {f, f2, d, gain} */
  fx.thump = (t, o) => fx.tone(t, { f: o.f, f2: o.f2 || o.f * 0.5, glide: o.d * 0.6, d: o.d, gain: o.gain, a: 0.003, dest: o.dest });
  /** metaliczny dźwięk o nieharmonicznych składowych: {f, ratios, d, gain} */
  fx.metal = (t, o) => (o.ratios || [1, 2.76, 5.4, 8.93]).forEach((r, i) => fx.tone(t, { f: o.f * r, d: o.d / (1 + i * 0.6), gain: o.gain / (1 + i * 0.9), a: 0.002, type: 'sine', dest: o.dest }));
  /** warstwa ciągła: oscylator/szum z modulacją amplitudy (zatrzymywana przez stop całej ścieżki) */
  fx.drone = (o) => {
    const g = ctx.createGain(); g.gain.value = o.gain; let src;
    if (o.noise) { src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx); src.loop = true; } else { src = ctx.createOscillator(); src.type = o.type || 'sine'; src.frequency.value = o.f; }
    let node = src; if (o.filter) { const f = ctx.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.ff; f.Q.value = o.q ?? 0.7; node.connect(f); node = f; }
    node.connect(g).connect(o.dest || out); src.start();
    if (o.lfo) { const l = ctx.createOscillator(); l.frequency.value = o.lfo; const lg = ctx.createGain(); lg.gain.value = o.gain * (o.depth ?? 0.5); l.connect(lg).connect(g.gain); l.start(); keep.push(l); }
    keep.push(src); return src;
  };
  return fx;
}
/** Definicje ścieżek: setup() tworzy warstwy ciągłe, tick(t, n) planuje zdarzenia kroku n (siatka step sekund). */
const TRACK_DEF = {
  hala: { step: 60 / 104 / 2, setup(fx) {
    fx.drone({ type: 'sawtooth', f: 50, filter: 'lowpass', ff: 220, gain: 0.05, lfo: 0.3, depth: 0.3 });
    fx.drone({ type: 'triangle', f: 100.5, gain: 0.025 });
    fx.drone({ noise: true, filter: 'lowpass', ff: 500, gain: 0.07, lfo: 0.13, depth: 0.4 });
  }, tick(fx, t, n) {
    const b = n % 16;
    if (b % 4 === 0) fx.thump(t, { f: 120, f2: 55, d: 0.22, gain: 0.32 });                                   // prasa
    if (b % 4 === 2) fx.noise(t, { f: 2600, q: 2, gain: 0.13, d: 0.07 });                                     // stuk
    if (b % 2 === 1) fx.metal(t, { f: 610, d: 0.18, gain: 0.05 });                                            // obrabiarka
    if (b === 6 || b === 14) fx.noise(t, { f: 900, q: 1.2, gain: 0.08, a: 0.03, d: 0.25, f2: 300 });       // syk pneumatyki
    const bar = Math.floor(n / 16) % 8;
    if (bar === 3 && b === 0) { fx.noise(t, { type: 'bandpass', f: 180, f2: 700, q: 0.8, gain: 0.12, a: 2, d: 3.5 }); fx.tone(t, { f: 90, f2: 140, glide: 4, type: 'sawtooth', lp: 400, gain: 0.035, a: 1.5, d: 4 }); } // suwnica
    if (bar === 3 && (b === 2 || b === 6 || b === 10)) { fx.metal(t, { f: 1318, ratios: [1, 2.4], d: 0.9, gain: 0.07 }); fx.metal(t + 0.18, { f: 1046, ratios: [1, 2.4], d: 0.9, gain: 0.06 }); } // dzwonek suwnicy
  } },
  kuznia: { step: 60 / 52, setup(fx) {
    fx.drone({ noise: true, filter: 'lowpass', ff: 260, gain: 0.12, lfo: 0.4, depth: 0.5 });                // palenisko
    fx.drone({ noise: true, filter: 'bandpass', ff: 1400, q: 0.6, gain: 0.015, lfo: 2.3, depth: 0.8 });     // trzask żaru
  }, tick(fx, t, n) {
    const b = n % 8;
    if (b !== 7) {
      const acc = b % 2 === 0; fx.thump(t, { f: 95, f2: 38, d: 0.35, gain: acc ? 0.42 : 0.3 });
      fx.metal(t, { f: acc ? 330 : 392, d: 1.6, gain: acc ? 0.11 : 0.075 }); fx.noise(t, { f: 3800, q: 0.8, gain: 0.1, d: 0.05 });
      if (b % 2 === 1) fx.metal(t + 0.29, { f: 440, d: 0.6, gain: 0.04 });                                     // odbicie młotka
    } else fx.noise(t + 0.2, { type: 'highpass', f: 2500, q: 0.5, gain: 0.11, a: 0.08, d: 2.2, f2: 5500 });    // syk hartowania
  } },
  kolej: { step: 60 / 150 / 2, setup(fx) { fx.drone({ type: 'sine', f: 46, gain: 0.04, lfo: 0.2 }); }, tick(fx, t, n) {
    const b = n % 4; fx.noise(t, { f: b === 0 ? 700 : 950, q: 0.9, gain: b === 0 ? 0.2 : 0.12, a: 0.01, d: 0.16, f2: 300 }); // sapanie
    const bar = n % 24; if (bar === 4 || bar === 5 || bar === 16 || bar === 17) fx.metal(t, { f: 180, ratios: [1, 3.2, 6.1], d: 0.12, gain: 0.12 }); // stukot kół
    if (n % 96 === 40) { [523.25, 659.25, 783.99].forEach((f) => fx.tone(t, { f, type: 'triangle', a: 0.12, d: 1.6, sus: 0.03, gain: 0.05, lp: 2200 })); fx.noise(t, { f: 1800, q: 2, gain: 0.05, a: 0.1, d: 1.5 }); } // gwizd
    if (n % 96 === 46) [587.33, 739.99].forEach((f) => fx.tone(t, { f, type: 'triangle', a: 0.08, d: 0.6, gain: 0.04, lp: 2200 }));
  } },
  huta: { step: 0.5, setup(fx) {
    fx.drone({ noise: true, filter: 'lowpass', ff: 140, gain: 0.17, lfo: 0.07, depth: 0.4 });               // piec
    fx.drone({ type: 'sine', f: 41, gain: 0.07, lfo: 0.11, depth: 0.5 }); fx.drone({ type: 'triangle', f: 61.7, gain: 0.03 });
  }, tick(fx, t, n) {
    if (n % 14 === 3) fx.noise(t, { type: 'highpass', f: 1800, q: 0.4, gain: 0.08, a: 0.6, d: 3, f2: 3500 }); // syk spustu
    if (n % 6 === 0) fx.thump(t, { f: 70, f2: 40, d: 0.5, gain: 0.12 });
    if (n % 7 === 2) fx.noise(t, { f: 420, q: 3, gain: 0.04, a: 0.4, d: 1.4 });
    if (n % 40 === 20) fx.tone(t, { f: 330, f2: 660, glide: 1.6, type: 'triangle', a: 1.2, d: 4.5, sus: 0.002, gain: 0.07, lp: 1800 }); // syrena
  } },
  szklo: { step: 0.3, setup(fx) { fx.drone({ noise: true, filter: 'lowpass', ff: 300, gain: 0.05, lfo: 0.09 }); fx.drone({ type: 'sine', f: 110, gain: 0.02, lfo: 0.05 }); }, tick(fx, t, n) {
    const scale = [84, 86, 88, 91, 93, 96, 98, 100]; // pentatonika (C6…)
    if (Math.random() < 0.38) { const m = scale[Math.floor(Math.random() * scale.length)]; fx.metal(t, { f: mtof(m), ratios: [1, 2.01, 3.98, 5.43], d: 2.6, gain: 0.05 + Math.random() * 0.04 }); }
    if (n % 22 === 0) for (let k = 0; k < 5; k++) fx.metal(t + k * 0.06, { f: mtof(96 + k * 2), ratios: [1, 2.32], d: 1.2, gain: 0.025 }); // brzęk
  } },
  kopalnia: { step: 0.5, setup(fx) { fx.drone({ noise: true, filter: 'lowpass', ff: 200, gain: 0.11, lfo: 0.05 }); fx.drone({ type: 'sawtooth', f: 55, filter: 'lowpass', ff: 160, gain: 0.03, lfo: 0.6, depth: 0.7 }); }, tick(fx, t, n) {
    if (Math.random() < 0.3) fx.tone(t + Math.random() * 0.4, { f: 1400 + Math.random() * 900, f2: 700, glide: 0.06, d: 0.18, gain: 0.08 }); // kapanie
    if (n % 2 === 0) fx.noise(t, { f: 320, q: 4, gain: 0.05, d: 0.3 });                                                                         // koło wyciągowe
    const c = n % 32; if (c === 8 || c === 9 || c === 10) fx.metal(t, { f: 880, ratios: [1, 2.76, 5.4], d: 1.1, gain: 0.08 });                // sygnał 3×
    if (c === 24) fx.tone(t, { f: 70, f2: 90, glide: 3, type: 'sawtooth', lp: 300, a: 1, d: 3, gain: 0.04 });                                  // ruch klatki
  } },
  symfonia: { step: 60 / 96 / 2, setup(fx) {
    fx.drone({ noise: true, filter: 'lowpass', ff: 400, gain: 0.03 });
  }, tick(fx, t, n) {
    const b = n % 16; const bar = Math.floor(n / 16) % 8;
    if (b % 4 === 0) fx.thump(t, { f: 110, f2: 46, d: 0.28, gain: 0.34 });                       // „prasa” = stopa
    if (b % 4 === 2) fx.noise(t, { f: 2200, q: 1.5, gain: 0.1, d: 0.09 });                       // stuk = werbel
    if (b % 2 === 1) fx.noise(t, { type: 'highpass', f: 7000, q: 0.7, gain: 0.04, d: 0.04 });   // syk = hi-hat
    if (b === 7 || b === 15) fx.metal(t, { f: 523.25, d: 0.25, gain: 0.03 });
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60], [52, 55, 59], [52, 56, 59]][bar]; // Am F C G Am F Em E
    if (b === 0) { prog.forEach((m) => fx.tone(t, { f: mtof(m), type: 'sawtooth', lp: 900, a: 0.4, d: 2.4, sus: 0.002, gain: 0.018, dest: fx.verb })); fx.tone(t, { f: mtof(prog[0] - 24), type: 'triangle', a: 0.01, d: 0.9, gain: 0.16 }); }
    if (b === 8) fx.tone(t, { f: mtof(prog[0] - 24), type: 'triangle', a: 0.01, d: 0.6, gain: 0.13 });
    if (b === 10 || b === 14) fx.tone(t, { f: mtof(prog[0] - 12), type: 'triangle', a: 0.01, d: 0.25, gain: 0.08 });
    const mel = [[76, 0, 74, 0, 72, 0, 71, 72, 0, 0, 69, 0, 0, 0, 0, 0], [72, 0, 0, 74, 72, 0, 69, 0, 65, 0, 0, 0, 0, 0, 0, 0], [67, 0, 72, 0, 76, 0, 0, 74, 72, 0, 0, 0, 67, 0, 0, 0], [71, 0, 0, 72, 74, 0, 79, 0, 74, 0, 0, 0, 0, 0, 0, 0],
      [76, 0, 74, 0, 72, 0, 71, 72, 0, 0, 76, 0, 77, 0, 0, 0], [77, 0, 0, 76, 74, 0, 72, 0, 69, 0, 0, 0, 0, 0, 0, 0], [71, 0, 72, 0, 74, 0, 72, 0, 71, 0, 0, 0, 0, 0, 0, 0], [68, 0, 71, 0, 76, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]][bar][b];
    if (mel) { fx.tone(t, { f: mtof(mel), type: 'triangle', a: 0.02, d: 0.7, sus: 0.002, gain: 0.08, dest: fx.verb }); fx.tone(t, { f: mtof(mel + 12), type: 'sine', a: 0.02, d: 0.45, gain: 0.02, dest: fx.verb }); }
  } },
};
/** Ścieżka na kontekście: zwraca {bus, schedule(until), stop(t)}. Wspólne dla odtwarzania na żywo i renderowania offline (testy). */
function createTrack(ctx, id, dest) {
  const def = TRACK_DEF[id] || TRACK_DEF.hala; const keep = [];
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(dest);
  // pogłos: dwie linie opóźniające ze sprzężeniem zwrotnym i filtrem
  const verbIn = ctx.createGain(); const wet = ctx.createGain(); wet.gain.value = 0.3; wet.connect(bus);
  for (const [dt, fb] of [[0.113, 0.42], [0.171, 0.38]]) { const d = ctx.createDelay(1); d.delayTime.value = dt; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; const g = ctx.createGain(); g.gain.value = fb; verbIn.connect(d); d.connect(f).connect(g).connect(d); f.connect(wet); }
  const dry = ctx.createGain(); dry.connect(bus); const send = ctx.createGain(); send.gain.value = 0.35; dry.connect(send).connect(verbIn);
  const lead = ctx.createGain(); lead.connect(dry); const leadSend = ctx.createGain(); leadSend.gain.value = 0.8; lead.connect(leadSend).connect(verbIn);
  const fx = synth(ctx, dry, keep); fx.verb = lead;
  def.setup(fx, keep, ctx);
  let n = 0; let next = ctx.currentTime + 0.08;
  return {
    bus, step: def.step,
    schedule(until) { while (next < until) { def.tick(fx, next, n); n++; next += def.step; } },
    fadeIn(t, s = 0.9) { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(0.0001, t); bus.gain.exponentialRampToValueAtTime(1, t + s); },
    stop(t, s = 0.6) { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t); bus.gain.exponentialRampToValueAtTime(0.0001, t + s); keep.forEach((k) => { try { k.stop(t + s + 0.05); } catch { /* nic */ } }); setTimeout(() => { try { bus.disconnect(); } catch { /* nic */ } }, (s + 0.3) * 1000); },
  };
}
/** Tor wyjściowy: kompresor/limiter + miękkie obcięcie (bez przesterów) + analizator. */
function createMaster(ctx, vol) {
  const gain = ctx.createGain(); gain.gain.value = vol;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.25;
  const shaper = ctx.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(1.2 * x) / Math.tanh(1.2) * 0.95; } shaper.curve = curve;
  const an = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.7;
  gain.connect(comp).connect(shaper).connect(an).connect(ctx.destination);
  return { input: gain, gain, analyser: an };
}
/** Renderowanie ścieżki offline (testy / podgląd): → Promise<{rms, peak, buffer}>. */
export async function renderTrackOffline(id, seconds = 6, sampleRate = 22050) {
  const OAC = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext); if (!OAC) return null;
  const ctx = new OAC(1, Math.round(seconds * sampleRate), sampleRate); const m = createMaster(ctx, 0.8); const tr = createTrack(ctx, id, m.input);
  tr.fadeIn(0, 0.3); tr.schedule(seconds);
  const buf = await ctx.startRendering(); const d = buf.getChannelData(0); let s = 0, p = 0; for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; p = Math.max(p, Math.abs(d[i])); }
  return { rms: Math.sqrt(s / d.length), peak: p, buffer: buf };
}
/**
 * Odtwarzacz „Dźwięków miasta”. Start wyłącznie z gestu użytkownika (play()).
 * → { tracks, current, playing, play(id?), stop(), next(), prev(), volume, setVolume(v 0..1), getLevels() → {level 0..1, bands:number[16]}, analyser, supported }
 */
export function useSoundscape() {
  const [current, setCurrent] = useState(SOUND_TRACKS[0].id); const [playing, setPlaying] = useState(false); const [volume, setVol] = useState(0.7);
  const r = useRef({ ctx: null, master: null, track: null, timer: 0, vol: 0.7, simT0: 0, bins: null });
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  const halt = (hard) => {
    const s = r.current; clearInterval(s.timer); s.timer = 0;
    if (s.track && s.ctx) { try { s.track.stop(s.ctx.currentTime, hard ? 0.05 : 0.6); } catch { /* nic */ } } s.track = null;
  };
  const play = (id = current) => {
    const s = r.current; const tid = TRACK_DEF[id] ? id : SOUND_TRACKS[0].id;
    halt(false); setCurrent(tid); setPlaying(true); s.simT0 = performance.now();
    if (!AC) return;
    try {
      if (!s.ctx) { s.ctx = new AC({ latencyHint: 'playback' }); s.master = createMaster(s.ctx, s.vol); }
      const ctx = s.ctx; if (ctx.state === 'suspended') ctx.resume?.();
      const tr = createTrack(ctx, tid, s.master.input); tr.fadeIn(ctx.currentTime + 0.05, 0.9); s.track = tr;
      const pump = () => { if (s.track === tr) tr.schedule(ctx.currentTime + 0.25); }; pump(); s.timer = setInterval(pump, 60);
    } catch { /* brak audio – stan odtwarzania symulowany */ }
  };
  const stop = () => { halt(false); setPlaying(false); };
  const step = (d) => { const i = SOUND_TRACKS.findIndex((x) => x.id === current); const nid = SOUND_TRACKS[(i + d + SOUND_TRACKS.length) % SOUND_TRACKS.length].id; if (playing) play(nid); else setCurrent(nid); };
  const setVolume = (v) => { const x = clamp(+v || 0, 0, 1); setVol(x); const s = r.current; s.vol = x; if (s.master && s.ctx) s.master.gain.gain.setTargetAtTime(x, s.ctx.currentTime, 0.05); };
  const getLevels = () => {
    const s = r.current; const bands = new Array(16).fill(0);
    if (!playing) return { level: 0, bands };
    if (s.master && s.track) {
      const an = s.master.analyser; const bins = s.bins || (s.bins = new Uint8Array(an.frequencyBinCount)); an.getByteFrequencyData(bins);
      let tot = 0; for (let b = 0; b < 16; b++) { const a = Math.floor((b / 16) ** 1.6 * bins.length), e = Math.max(a + 1, Math.floor(((b + 1) / 16) ** 1.6 * bins.length)); let m = 0; for (let i = a; i < e; i++) m = Math.max(m, bins[i]); bands[b] = m / 255; tot += bands[b]; }
      return { level: tot / 16, bands };
    }
    const tt = (performance.now() - s.simT0) / 1000; let tot = 0; for (let b = 0; b < 16; b++) { bands[b] = 0.25 + 0.35 * Math.abs(Math.sin(tt * (2 + b * 0.37) + b)) * (1 - b / 24); tot += bands[b]; } // symulacja
    return { level: tot / 16, bands };
  };
  useEffect(() => () => { const s = r.current; halt(true); if (s.ctx) { const c = s.ctx; s.ctx = null; setTimeout(() => { try { c.close(); } catch { /* nic */ } }, 120); } }, []);
  return { tracks: SOUND_TRACKS, current, playing, play, stop, next: () => step(1), prev: () => step(-1), volume, setVolume, getLevels, analyser: r.current.master?.analyser || null, supported: !!AC };
}

/** Wizualizacja poziomów (słupki) dla useSoundscape – jedna pętla rAF tylko podczas odtwarzania. props: sound (wynik useSoundscape), bars=16, class */
export function SoundBars({ sound, bars = 16, class: cls }) {
  const ref = useRef(null); const get = useRef(sound.getLevels); get.current = sound.getLevels;
  useEffect(() => {
    const el = ref.current; if (!el) return undefined; const kids = [...el.children];
    if (!sound.playing || reducedMotion()) { kids.forEach((k) => { k.style.transform = `scaleY(${sound.playing ? 0.5 : 0.06})`; }); return undefined; }
    let raf = 0; const f = () => { const { bands } = get.current(); kids.forEach((k, i) => { k.style.transform = `scaleY(${Math.max(0.06, bands[Math.floor((i / bars) * 16)] || 0).toFixed(3)})`; }); raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [sound.playing, bars]);
  return <div ref={ref} class={clsx('md-bars', cls)} aria-hidden="true">{Array.from({ length: bars }, (_, i) => <i key={i} />)}</div>;
}
