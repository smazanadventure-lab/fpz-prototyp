import { render } from 'preact';
import { Illustration, ILLUSTRATION_IDS } from '../src/ui/illustrations.jsx';
const q = new URLSearchParams(location.hash.slice(1));
const view = q.get('view') || 'tones';
const tone = q.get('tone') || 'duotone';
const only = q.get('ids') ? q.get('ids').split(',') : ILLUSTRATION_IDS;
const css = `.fpz-ill{display:block;width:100%;height:100%} body{margin:0;font:12px system-ui;background:#fff;color:#123} .g{display:grid;gap:10px;padding:10px}
.t figure{margin:0} .t .m{border-radius:12px;overflow:hidden} figcaption{padding:2px 0 0} .night{background:#1b2230;filter:none}
.r{display:flex;gap:8px;align-items:flex-start;padding:4px 10px} .r div{overflow:hidden;border-radius:8px;flex:none}`;
function App() {
  if (view === 'tones') return <div class="g t" style={{ gridTemplateColumns: `repeat(${q.get('cols') || 6},1fr)` }}>{only.map((id) => <figure key={id}><div class="m" style={{ aspectRatio: '4/3' }}><Illustration id={id} tone={tone} /></div><figcaption>{id}</figcaption></figure>)}</div>;
  if (view === 'ratios') return <div>{only.map((id) => <div class="r" key={id}><b style={{ width: '90px' }}>{id}</b>{[[120, 120], [213, 120], [90, 120], [300, 100], [80, 60]].map(([w, h], i) => <div key={i} style={{ width: w + 'px', height: h + 'px' }}><Illustration id={id} tone={['duotone', 'archival', 'color', 'duotone', 'duotone'][i]} /></div>)}</div>)}</div>;
  if (view === 'big') return <div class="g" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>{only.map((id) => ['duotone', 'archival', 'color'].map((t) => <div key={id + t} style={{ aspectRatio: '4/3' }}><Illustration id={id} tone={t} /></div>))}</div>;
  if (view === 'modes') return <div class="g" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>{only.map((id) => <div key={id} style={{ aspectRatio: '4/3', filter: q.get('f') || 'none' }}><Illustration id={id} tone={tone} /></div>)}</div>;
  return null;
}
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
render(<App />, document.body);
