// ZAŚLEPKA komponentów multimedialnych (wersja awaryjna, uproszczona). Docelowa implementacja: src/ui/media.jsx – ten sam interfejs.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { speak, stopSpeaking, estimateSeconds } from '../speech.js';
import { fmtDuration } from '../../kernel/util.js';
import { Illustration } from '../illustrations.jsx';

const box = { position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-md)', background: '#0d1f16', color: '#fff' };
const ctl = { display: 'inline-grid', placeItems: 'center', width: '2.6em', height: '2.6em', borderRadius: '50%', background: 'var(--c-accent)', color: 'var(--c-accent-text)', fontWeight: 700 };

/**
 * Symulowany odtwarzacz wideo (brak plików filmowych w prototypie): animowana ilustracja + oś czasu + napisy.
 * props: video (obiekt z kolekcji videos: {title, ill, durationSec, captions:[{t,text:L}], kind}) LUB osobno title, ill, durationSec, captions;
 *        live (transmisja – bez osi czasu), autoplay, showCaptions (domyślnie true), onEnded(), compact, class
 */
export function VideoSim({ video, title, ill, durationSec, captions, live, autoplay, showCaptions = true, onEnded, compact, class: cls }) {
  const { L } = useClient(); const v = video || {}; const dur = durationSec || v.durationSec || 60; const caps = captions || v.captions || [];
  const [t, setT] = useState(0); const [play, setPlay] = useState(!!autoplay); const [cc, setCc] = useState(showCaptions);
  useEffect(() => { if (!play) return; const i = setInterval(() => setT((x) => { if (!live && x + 0.25 >= dur) { setPlay(false); onEnded?.(); return 0; } return x + 0.25; }), 250); return () => clearInterval(i); }, [play, dur, live]);
  const cap = [...caps].reverse().find((c) => c.t <= t);
  return (<div class={`fpz-video ${cls || ''}`} style={{ ...box, aspectRatio: '16/9' }}>
    <div style={{ position: 'absolute', inset: 0, opacity: play ? 1 : 0.7 }}><Illustration id={ill || v.ill || 'studio'} tone={v.kind === 'archive' ? 'archival' : 'duotone'} /></div>
    {cc && cap && play && <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: '18%', textAlign: 'center' }}><span style={{ background: 'rgba(0,0,0,.78)', padding: '.2em .6em', borderRadius: '.3em', fontWeight: 700 }}>{L(cap.text)}</span></div>}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: '.6em', padding: '.5em .7em', background: 'linear-gradient(transparent, rgba(0,0,0,.75))' }}>
      <button type="button" style={ctl} aria-label={play ? 'Pauza' : 'Odtwórz'} onClick={() => setPlay(!play)}>{play ? 'II' : '▶'}</button>
      {!live && <input type="range" min="0" max={dur} step="0.25" value={t} onInput={(e) => setT(+e.currentTarget.value)} style={{ flex: 1 }} aria-label="Pozycja" />}
      <span style={{ fontSize: 'var(--fs-xs)', fontVariantNumeric: 'tabular-nums' }}>{live ? 'NA ŻYWO' : `${fmtDuration(t)} / ${fmtDuration(dur)}`}</span>
      <button type="button" style={{ ...ctl, background: cc ? '#fff' : 'transparent', color: cc ? '#000' : '#fff', fontSize: '.7em' }} aria-pressed={cc} onClick={() => setCc(!cc)}>CC</button>
    </div>
    {!compact && <div style={{ position: 'absolute', left: '.8em', top: '.6em', fontWeight: 700, textShadow: '0 1px 4px #000' }}>{title || L(v.title)}</div>}
  </div>);
}

/**
 * Audioprzewodnik – lektor (synteza mowy przeglądarki; gdy niedostępna, symulacja czasu) z paskiem postępu.
 * props: text (string), title, lang (domyślnie język końcówki), compact, onState('play'|'stop'), class
 */
export function AudioGuide({ text, title, lang, compact, onState, class: cls }) {
  const c = useClient(); const [on, setOn] = useState(false); const [p, setP] = useState(0); const dur = estimateSeconds(text);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { if (!on) return; const t0 = Date.now(); const i = setInterval(() => setP(Math.min(1, (Date.now() - t0) / 1000 / dur)), 200); return () => clearInterval(i); }, [on]);
  const toggle = () => { if (on) { stopSpeaking(); setOn(false); onState?.('stop'); } else { setP(0); setOn(true); onState?.('play'); speak(text, { lang: lang || c.lang, onend: () => { setOn(false); onState?.('stop'); } }); } };
  return (<div class={`fpz-audioguide ${cls || ''}`} style={{ display: 'flex', alignItems: 'center', gap: '.8em', padding: '.7em .9em', borderRadius: 'var(--r-md)', background: 'var(--c-surface-2)' }}>
    <button type="button" style={ctl} onClick={toggle} aria-label={on ? 'Zatrzymaj' : 'Odtwórz'}>{on ? '■' : '▶'}</button>
    <div style={{ flex: 1, minWidth: 0 }}>{!compact && <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{title || 'Audioprzewodnik'}</div>}
      <div class="fpz-progress"><i style={{ width: `${p * 100}%` }} /></div></div>
    <span style={{ fontSize: 'var(--fs-xs)' }}>{fmtDuration(dur)}</span></div>);
}

/** Obiekt 3D obracany przeciąganiem. props: modelId 'lathe'|'hall'|'tower', autoRotate, class */
export function Model3D({ modelId = 'lathe', autoRotate = true, class: cls }) {
  const [a, setA] = useState(30); const drag = useRef(null);
  useEffect(() => { if (!autoRotate) return; const i = setInterval(() => { if (!drag.current) setA((x) => x + 1.2); }, 50); return () => clearInterval(i); }, [autoRotate]);
  const face = (tr, bg) => <div style={{ position: 'absolute', inset: 0, background: bg, border: '2px solid #125930', transform: tr }} />;
  return (<div class={`fpz-model3d ${cls || ''}`} style={{ ...box, background: 'var(--c-surface-2)', aspectRatio: '4/3', display: 'grid', placeItems: 'center', perspective: '700px', touchAction: 'none', cursor: 'grab' }}
    onPointerDown={(e) => { drag.current = e.clientX; }} onPointerMove={(e) => { if (drag.current != null) { setA((x) => x + (e.clientX - drag.current) * 0.6); drag.current = e.clientX; } }} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
    <div style={{ width: '110px', height: '110px', position: 'relative', transformStyle: 'preserve-3d', transform: `rotateX(-22deg) rotateY(${a}deg)` }}>
      {face('translateZ(55px)', '#CCE5D8')}{face('rotateY(180deg) translateZ(55px)', '#CCE5D8')}{face('rotateY(90deg) translateZ(55px)', '#5FB287')}{face('rotateY(-90deg) translateZ(55px)', '#5FB287')}{face('rotateX(90deg) translateZ(55px)', '#EEF6F2')}{face('rotateX(-90deg) translateZ(55px)', '#45574D')}
    </div><span style={{ position: 'absolute', left: '.8em', bottom: '.6em', fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)', fontWeight: 700 }}>Model 3D: {modelId} · przeciągnij, aby obrócić</span></div>);
}

/**
 * Panorama 360° (przeciąganie w poziomie, zapętlona). Zatrzymanie widoku na obiekcie przez dwellMs wywołuje onDwell(hotspot).
 * props: hotspots [{id, name:L, az:0..359, kind}], onDwell(h), onSelect(h), dwellMs=1500, class
 */
export function Panorama360({ hotspots = [], onDwell, onSelect, dwellMs = 1500, class: cls }) {
  const { L } = useClient(); const [az, setAz] = useState(0); const drag = useRef(null); const timer = useRef(null);
  const center = hotspots.find((h) => Math.abs(((h.az - az + 540) % 360) - 180) < 9);
  useEffect(() => { clearTimeout(timer.current); if (center && onDwell) timer.current = setTimeout(() => onDwell(center), dwellMs); return () => clearTimeout(timer.current); }, [center?.id]);
  return (<div class={`fpz-panorama ${cls || ''}`} style={{ ...box, aspectRatio: '16/9', touchAction: 'none', cursor: 'grab' }}
    onPointerDown={(e) => { drag.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); }} onPointerMove={(e) => { if (drag.current != null) { setAz((x) => (x - (e.clientX - drag.current) * 0.25 + 360) % 360); drag.current = e.clientX; } }} onPointerUp={() => { drag.current = null; }}>
    <div style={{ position: 'absolute', inset: 0, width: '300%', left: `${-(az / 360) * 200}%` }}><Illustration id="city-panorama" /></div>
    {hotspots.map((h) => { const d = ((h.az - az + 540) % 360) - 180; if (Math.abs(d) > 55) return null; return <button key={h.id} type="button" onClick={() => onSelect?.(h)} style={{ position: 'absolute', left: `${50 + d * 0.9}%`, top: h.kind === 'fpz' ? '58%' : '34%', transform: 'translateX(-50%)', background: center?.id === h.id ? '#FFE600' : 'rgba(255,255,255,.92)', color: '#000', padding: '.25em .7em', borderRadius: '999px', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{L(h.name)}</button>; })}
    <div style={{ position: 'absolute', left: '50%', top: '10%', bottom: '10%', width: '2px', background: 'rgba(255,255,255,.6)' }} />
    <span style={{ position: 'absolute', right: '.8em', top: '.6em', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{Math.round(az)}°</span></div>);
}

/**
 * Widok rozszerzonej rzeczywistości (symulacja obrazu z kamery).
 * props: scene 'hall'|'plaza'; overlay 'future' (suwak dziś → jutro) | 'info' (etykieta) | 'model' (obiekt 3D); modelId; label; onCapture(); children (własna nakładka); class
 */
export function ARView({ scene = 'hall', overlay = 'info', modelId, label, onCapture, children, class: cls }) {
  const [mix, setMix] = useState(50);
  return (<div class={`fpz-arview ${cls || ''}`} style={{ ...box, aspectRatio: '3/4' }}>
    <div style={{ position: 'absolute', inset: 0 }}><Illustration id={scene === 'hall' ? 'hall-interior' : 'hall-exterior'} tone="color" /></div>
    {overlay === 'future' && <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${100 - mix}%)` }}><Illustration id="future-city" /></div>}
    {overlay === 'model' && <div style={{ position: 'absolute', left: '15%', right: '15%', top: '22%' }}><Model3D modelId={modelId} /></div>}
    {label && <div style={{ position: 'absolute', left: '8%', top: '8%', background: 'rgba(255,255,255,.94)', color: '#000', padding: '.35em .8em', borderRadius: '.6em', fontWeight: 700 }}>{label}</div>}
    {children}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '.8em', display: 'flex', gap: '.8em', alignItems: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,.7))' }}>
      {overlay === 'future' && <input type="range" min="0" max="100" value={mix} onInput={(e) => setMix(+e.currentTarget.value)} style={{ flex: 1 }} aria-label="Dziś – jutro" />}
      {onCapture && <button type="button" style={{ ...ctl, marginLeft: 'auto' }} onClick={onCapture} aria-label="Zapisz widok">◉</button>}
    </div></div>);
}

const TRACKS = [
  { id: 'hala', name: { pl: 'Hala maszyn', en: 'Machine hall' }, desc: { pl: 'Rytm obrabiarek i suwnic.', en: 'The rhythm of machine tools and cranes.' }, f: 70 },
  { id: 'kuznia', name: { pl: 'Kuźnia', en: 'Forge' }, desc: { pl: 'Młoty i gorący metal.', en: 'Hammers and hot metal.' }, f: 110 },
  { id: 'kolej', name: { pl: 'Kolej', en: 'Railway' }, desc: { pl: 'Parowóz na bocznicy.', en: 'A steam engine on the siding.' }, f: 55 },
  { id: 'symfonia', name: { pl: 'Symfonia industrialna', en: 'Industrial symphony' }, desc: { pl: 'Dźwięki maszyn jako podkład linii muzycznej.', en: 'Machine sounds under a musical line.' }, f: 220 },
];
/** Odtwarzacz „Dźwięków miasta” (Web Audio, dźwięki syntetyczne). → { tracks, current, playing, play(id?), stop(), next(), prev(), volume, setVolume(v 0..1) } */
export function useSoundscape() {
  const ctxRef = useRef(null); const nodes = useRef([]); const [current, setCurrent] = useState(TRACKS[0].id); const [playing, setPlaying] = useState(false); const [volume, setVol] = useState(0.6); const gain = useRef(null);
  const stop = () => { nodes.current.forEach((n) => { try { n.stop(); } catch { /* nic */ } }); nodes.current = []; setPlaying(false); };
  const play = (id = current) => { stop(); try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { setCurrent(id); setPlaying(true); return; } const ac = ctxRef.current || (ctxRef.current = new AC()); ac.resume?.(); const g = (gain.current = ac.createGain()); g.gain.value = volume * 0.25; g.connect(ac.destination); const tr = TRACKS.find((t) => t.id === id) || TRACKS[0];
    [1, 1.5, 2.01].forEach((m, i) => { const o = ac.createOscillator(); o.type = i ? 'triangle' : 'sawtooth'; o.frequency.value = tr.f * m; const lg = ac.createGain(); lg.gain.value = 0.35; const lfo = ac.createOscillator(); lfo.frequency.value = 1.5 + i; const lfg = ac.createGain(); lfg.gain.value = 0.3; lfo.connect(lfg); lfg.connect(lg.gain); o.connect(lg); lg.connect(g); o.start(); lfo.start(); nodes.current.push(o, lfo); }); } catch { /* brak audio */ } setCurrent(id); setPlaying(true); };
  const step = (d) => { const i = TRACKS.findIndex((t) => t.id === current); play(TRACKS[(i + d + TRACKS.length) % TRACKS.length].id); };
  useEffect(() => () => stop(), []);
  return { tracks: TRACKS, current, playing, play, stop, next: () => step(1), prev: () => step(-1), volume, setVolume: (v) => { setVol(v); if (gain.current) gain.current.gain.value = v * 0.25; } };
}
