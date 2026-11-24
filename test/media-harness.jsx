// Strona testowa komponentów multimedialnych (src/ui/media.jsx). Parametry w #hash: sec, w, base, theme, contrast, lang
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { initStore, getState } from '../src/kernel/store.js';
import { makeSeed } from '../src/kernel/seed.js';
import { makeApi } from '../src/kernel/api.js';
import { Client, useClient } from '../src/kernel/client.jsx';
import { VideoSim, AudioGuide, Model3D, Panorama360, ARView, useSoundscape, SoundBars, renderTrackOffline } from '../src/ui/media.jsx';

initStore(makeSeed);
const q = Object.fromEntries(location.hash.slice(1).split('&').filter(Boolean).map((p) => p.split('=')));
const sec = q.sec || 'video'; const w = +(q.w || 360); const base = +(q.base || 16);
window.__log = []; window.renderTrackOffline = renderTrackOffline;
const log = (x) => { window.__log.push(x); };
const api = makeApi('test');
if (sec === 'video') { api.live.start(); api.live.caption('Dobry wieczór, witamy na koncercie!'); api.live.caption('Za chwilę zagra orkiestra młodzieżowa.'); }

function Sound() {
  const snd = useSoundscape(); const { L } = useClient(); window.__snd = snd;
  return (<div class="hx-card">
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{snd.tracks.map((t) => <button key={t.id} type="button" class="hx-b" data-track={t.id} aria-pressed={snd.current === t.id} onClick={() => snd.play(t.id)}>{L(t.name)}</button>)}</div>
    <p style={{ margin: '8px 0' }}><b>{L(snd.tracks.find((t) => t.id === snd.current).name)}</b> – {L(snd.tracks.find((t) => t.id === snd.current).desc)} {snd.playing ? '▶' : '■'} supported={String(snd.supported)}</p>
    <SoundBars sound={snd} />
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}><button type="button" class="hx-b" id="snd-prev" onClick={snd.prev}>prev</button><button type="button" class="hx-b" id="snd-stop" onClick={snd.stop}>stop</button><button type="button" class="hx-b" id="snd-next" onClick={snd.next}>next</button>
      <input type="range" min="0" max="1" step="0.05" value={snd.volume} onInput={(e) => snd.setVolume(+e.currentTarget.value)} aria-label="vol" /></div>
  </div>);
}
const text = 'Hala Ząbkowice powstała w latach pięćdziesiątych. Jej dach szedowy wpuszcza do wnętrza równe, północne światło. Pracowały tu tokarki i frezarki produkowane dla całego kraju. Dziś hala czeka na nowe życie jako miejsce spotkań, koncertów i warsztatów.';
function Body() {
  const s = getState(); const [dw, setDw] = useState(null); const [cap, setCap] = useState(0); const [az, setAz] = useState(0);
  const hs = [...s.futureHotspots, { id: 'hx-baz', name: { pl: 'Bazylika', en: 'Basilica' }, az: 208, kind: 'city' }, { id: 'hx-pkz', name: { pl: 'Pałac Kultury Zagłębia', en: 'Palace of Culture' }, az: 186, kind: 'city' }, { id: 'hx-hz', name: { pl: 'Hala Ząbkowice', en: 'Ząbkowice Hall' }, az: 140, kind: 'fpz' }];
  if (sec === 'video') return (<>
    <VideoSim video={s.videos.find((v) => v.id === 'video-arch-obrabiarki')} showAd showPjm startAt={8} class="hx-v1" />
    <VideoSim video={s.videos.find((v) => v.id === 'video-live-scena')} live autoplay class="hx-live" />
    <div class="hx-grid">{s.videos.slice(2, 4).map((v) => <VideoSim key={v.id} video={v} compact />)}</div>
    <div style={{ width: '50%' }}><VideoSim video={s.videos[4]} chromeless autoplay loop muted /></div>
  </>);
  if (sec === 'audio') return (<><AudioGuide text={text} title="Hala Ząbkowice" showTranscript onState={(x) => log('audio:' + x)} /><AudioGuide text={text} title="Hala Ząbkowice – w skrócie" compact /></>);
  if (sec === "model") return (<>{q.only ? <Model3D modelId={q.only} hotspots="auto" autoRotate={false} /> : null}<Model3D modelId="lathe" hotspots="auto" class="hx-lathe" /><div class="hx-grid"><Model3D modelId="hall" /><Model3D modelId="tower" hotspots="auto" ratio="3/4" /></div></>);
  if (sec === 'pano') return (<><Panorama360 hotspots={hs} dwellMs={1200} az={az} onAz={(a) => { window.__az = a; }} onDwell={(h) => { setDw(h.id); log('dwell:' + h.id); }} onSelect={(h) => log('select:' + h.id)} />
    <p class="hx-out">dwell: {dw || '–'} <button type="button" class="hx-b" id="pano-go" onClick={() => setAz(208)}>az=208</button> <button type="button" class="hx-b" id="pano-go2" onClick={() => setAz(40)}>az=40</button></p></>);
  if (sec === 'ar') return (<div class="hx-grid hx-ar"><ARView overlay="future" label="Hala Tworzeń – 2030" onCapture={() => { setCap(cap + 1); log('capture'); }} class="hx-ar1" /><ARView overlay="info" scene="hall" /><ARView overlay="model" modelId="lathe" label="Tokarka TUJ-48" onCapture={() => {}} /><p class="hx-out">capture: {cap}</p></div>);
  if (sec === 'sound') return <Sound />;
  return null;
}
function App() {
  return (<div style={{ width: `${w}px`, margin: '0 auto' }} id="hx-frame">
    <Client id={`hx-${q.theme || 'light'}-${q.contrast || 'normal'}-${q.lang || 'pl'}`} base={base} theme={q.theme === 'night' ? 'night' : undefined} defaults={{ contrast: q.contrast || 'normal', lang: q.lang || 'pl' }}>
      <div class="hx-col"><Body /></div>
    </Client></div>);
}
const st = document.createElement('style');
st.textContent = `body{margin:0;background:#888}.hx-col{display:grid;gap:calc(var(--u)*16);padding:calc(var(--u)*12);background:var(--c-bg)}.hx-grid{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*12)}.hx-b{border:1px solid var(--c-line-strong)!important;border-radius:99px;padding:.2em .7em!important}.hx-out{color:var(--c-text)}.hx-ar>:first-child{grid-column:1/-1}.hx-card{color:var(--c-text)}`;
document.head.appendChild(st);
render(<App />, document.getElementById('app'));
