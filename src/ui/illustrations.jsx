// Ilustracje systemowe FPŻ – własne sceny wektorowe zastępujące zdjęcia w prototypie (prefiks klas: ill-).
// <Illustration id="lake" tone="duotone"|"archival"|"color" class="…" title="tekst alternatywny" />
// Kadr 400×300, preserveAspectRatio="slice" – motyw główny w środku (ok. x 90–310, y 85–220), tło wypełnia całość.
// Styl: płaskie plamy w 5–6 stopniach tonalnych (pal(tone)) + cienka kreska detali (1–1,2 px) w kolorze p.ink.
import { useMemo, useState } from 'preact/hooks';
import { isMediaRef, mediaItem, mediaUrl } from '../kernel/media.js';

export const ILLUSTRATION_IDS = ['hall-exterior', 'hall-interior', 'hall-green', 'passage', 'factory-archival', 'machine-tool', 'workers', 'steelworks', 'mine', 'glassworks', 'railway', 'lake', 'desert', 'wetland', 'forest', 'park', 'tree', 'river', 'quarry', 'church', 'palace', 'city-street', 'city-panorama', 'tower', 'stage', 'market', 'food', 'workshop', 'kids', 'future-city', 'studio', 'map-old'];

/** Krótkie opisy (domyślny aria-label, gdy brak `title`). */
export const ILLUSTRATION_LABELS = {
  'hall-exterior': 'Hala fabryczna z dachem szedowym', 'hall-interior': 'Wnętrze hali z kratownicami i suwnicą', 'hall-green': 'Hala z ogrodem zimowym pod szklanym dachem',
  passage: 'Przeszklony pasaż między halami', 'factory-archival': 'Dawna fabryka z kominami i bramą', 'machine-tool': 'Tokarka w zbliżeniu', workers: 'Załoga przy maszynach',
  steelworks: 'Huta – wielki piec i estakady', mine: 'Kopalnia – wieża szybowa', glassworks: 'Huta szkła – piec i wyroby szklane', railway: 'Dworzec i parowóz',
  lake: 'Jezioro z żaglówką', desert: 'Wydmy Pustyni Błędowskiej', wetland: 'Podmokłe łąki z czaplą', forest: 'Las bukowy na wzgórzu', park: 'Aleja w parku miejskim',
  tree: 'Pomnik przyrody – okazałe drzewo', river: 'Przełom rzeki wśród skarp', quarry: 'Kamieniołom z tarasami skalnymi', church: 'Neogotycki kościół',
  palace: 'Gmach kultury z kolumnadą', 'city-street': 'Ulica z kamienicami i tramwajem', 'city-panorama': 'Panorama miasta', tower: 'Ażurowa wieża widokowa',
  stage: 'Scena koncertowa z publicznością', market: 'Jarmark ze straganami', food: 'Strefa gastronomiczna', workshop: 'Warsztaty rękodzieła', kids: 'Strefa dla dzieci',
  'future-city': 'Wizja miasta przyszłości', studio: 'Wirtualne studio', 'map-old': 'Stary plan miasta',
};

/* ── Paleta ─────────────────────────────────────────────── */
const STEPS = {
  duotone: ['#EEF6F2', '#CCE5D8', '#97CDB0', '#5FB287', '#2E8454', '#125930', '#0B3D20'],
  archival: ['#F0EBE0', '#DAD1BF', '#B8AC95', '#8E816B', '#62584A', '#3D352C', '#29231D'],
};
const COLOR = {
  sky1: '#AFC6D4', sky0: '#E6EDEC', cloud: '#F6F7F4', far: '#A9BDB6', mid: '#8C9994', near: '#5D6B66', dark: '#33403B', ink: '#28322D', night: '#27323F',
  win: '#F1F2EC', glass: '#C8DCE2', brick: '#A9644D', brickDk: '#7B4535', roof: '#525C64', metal: '#69737A', water: '#8DB4C6', waterDk: '#5A879F',
  sand: '#E6D3A8', sandDk: '#C9AE7A', leaf: '#6E9D68', leafDk: '#44704C', leafLt: '#A5C487', stone: '#C9C2B4', stoneDk: '#968E80', ground: '#A9C08B', groundDk: '#7F9D6D',
  glow: '#F4D78E', accent: '#D48A5E', accent2: '#E7C46B', paper: '#EFE4C8', person: '#36423C', wall: '#E5DED2', floor: '#C7BFB1',
};
/** Zwraca paletę semantyczną wspólną dla wszystkich scen. */
export function pal(tone) {
  if (tone === 'color') return COLOR;
  const s = STEPS[tone] || STEPS.duotone;
  return {
    sky1: s[1], sky0: s[0], cloud: s[0], far: s[2], mid: s[3], near: s[4], dark: s[5], ink: s[6], night: s[5],
    win: s[0], glass: s[1], brick: s[3], brickDk: s[4], roof: s[5], metal: s[4], water: s[1], waterDk: s[3],
    sand: s[1], sandDk: s[2], leaf: s[3], leafDk: s[4], leafLt: s[2], stone: s[2], stoneDk: s[3], ground: s[2], groundDk: s[3],
    glow: s[0], accent: s[3], accent2: s[2], paper: s[0], person: s[5], wall: s[0], floor: s[2],
  };
}

/* ── Geometria (ścieżki jako tekst – wiele kształtów w jednym elemencie) ── */
const n = (v) => Math.round(v * 10) / 10;
const C = (x, y, r) => `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 1 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 1 ${n(-2 * r)} 0z`;
const E = (x, y, rx, ry) => `M${n(x - rx)} ${n(y)}a${n(rx)} ${n(ry)} 0 1 1 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 1 ${n(-2 * rx)} 0z`;
const R = (x, y, w, h) => `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
const P = (pts) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'z';
const PL = (pts) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L');
const grid = (x, y, c, r, w, h, gx, gy = gx) => { let d = ''; for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) d += R(x + i * (w + gx), y + j * (h + gy), w, h); return d; };
/** okno z półkolistym zwieńczeniem (y = wierzchołek łuku) */
const arch = (x, y, w, h) => `M${n(x)} ${n(y + h)}V${n(y + w / 2)}a${n(w / 2)} ${n(w / 2)} 0 0 1 ${n(w)} 0V${n(y + h)}z`;
/** ostrołuk (neogotyk) */
const lancet = (x, y, w, h) => `M${n(x)} ${n(y + h)}V${n(y + w * 0.75)}Q${n(x)} ${n(y + w * 0.1)} ${n(x + w / 2)} ${n(y)}Q${n(x + w)} ${n(y + w * 0.1)} ${n(x + w)} ${n(y + w * 0.75)}V${n(y + h)}z`;
const rng = (seed) => { let s = seed * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
/** szereg koron drzew (las na horyzoncie) */
const treeline = (y, x0, x1, r0, r1, seed = 1) => { const r = rng(seed); let d = R(x0, y - r0 * 0.7, x1 - x0, r0 * 0.7 + 2), x = x0; while (x < x1) { const rr = r0 + r() * (r1 - r0); d += C(x, y - rr * 0.75, rr); x += rr * (0.9 + r() * 0.5); } return d; };
/** szereg świerków */
const conifers = (y, x0, x1, h0, h1, seed = 2) => { const r = rng(seed); let d = R(x0, y - 3, x1 - x0, 5), x = x0; while (x < x1) { const h = h0 + r() * (h1 - h0), w = h * 0.32; d += `M${n(x - w)} ${n(y)}L${n(x)} ${n(y - h)}L${n(x + w)} ${n(y)}z`; x += w * (0.9 + r() * 0.7); } return d; };
/** profil dachu szedowego: [x0..x0+k*w], okap y0, kalenice y1 */
const sawPts = (x0, y0, y1, k, w) => { const pts = []; for (let i = 0; i < k; i++) pts.push([x0 + i * w, y1], [x0 + (i + 1) * w, y0]); return pts; };
/** kratownica między dwoma pasami (dwie łamane) – zygzak */
const truss = (a, b, k) => { let d = PL(a) + PL(b) + 'M'; for (let i = 0; i <= k; i++) { const t = i / k, A = lerpPt(a, t), B = lerpPt(b, t); d += `${n((i % 2 ? A : B)[0])} ${n((i % 2 ? A : B)[1])}${i < k ? 'L' : ''}`; } return d; };
const lerpPt = (pts, t) => { const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1]; return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; };
const S = (c, w = 1.2, o) => ({ fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: o });

/* ── Wspólne elementy ───────────────────────────────────── */
const sky = (u) => <rect width="400" height="300" fill={`url(#${u}s)`} />;
const cloud = (p, x, y, s = 1, f, o = 0.9) => <path d={C(x, y, 9 * s) + C(x + 13 * s, y - 6 * s, 12 * s) + C(x + 27 * s, y - 1 * s, 9 * s) + R(x, y, 27 * s, 9 * s)} fill={f || p.cloud} opacity={o} />;
const sun = (p, x, y, r = 14) => <circle cx={x} cy={y} r={r} fill={p.win} opacity=".95" />;
const ground = (y, f) => <rect x="0" y={y} width="400" height={300 - y} fill={f} />;
/** drzewo liściaste / iglaste / topola; x,y = podstawa pnia */
function tree(p, x, y, s = 1, k = 'round', f) {
  if (k === 'conifer') return <g><path d={R(x - 1.5 * s, y - 10 * s, 3 * s, 10 * s)} fill={p.dark} /><path d={`M${n(x)} ${n(y - 50 * s)}L${n(x + 11 * s)} ${n(y - 30 * s)}H${n(x + 6 * s)}L${n(x + 15 * s)} ${n(y - 9 * s)}H${n(x - 15 * s)}L${n(x - 6 * s)} ${n(y - 30 * s)}H${n(x - 11 * s)}z`} fill={f || p.leafDk} /></g>;
  if (k === 'poplar') return <g><path d={R(x - 1.3 * s, y - 12 * s, 2.6 * s, 12 * s)} fill={p.dark} /><path d={E(x, y - 32 * s, 8 * s, 23 * s)} fill={f || p.leaf} /><path d={E(x + 3 * s, y - 28 * s, 4 * s, 16 * s)} fill={p.leafDk} opacity=".6" /></g>;
  return <g>
    <path d={`M${n(x - 2 * s)} ${n(y)}L${n(x - 1.2 * s)} ${n(y - 20 * s)}H${n(x + 1.2 * s)}L${n(x + 2 * s)} ${n(y)}z`} fill={p.dark} />
    <path d={C(x, y - 31 * s, 13 * s) + C(x - 10 * s, y - 23 * s, 9 * s) + C(x + 10 * s, y - 24 * s, 10 * s)} fill={f || p.leaf} />
    <path d={C(x + 10 * s, y - 23 * s, 7.5 * s) + C(x + 3 * s, y - 20 * s, 6 * s)} fill={p.leafDk} opacity=".75" />
    <path d={C(x - 4 * s, y - 35 * s, 5 * s)} fill={p.leafLt} opacity=".8" />
  </g>;
}
const BODY = 'M-5 -9C-5.4 -17 -4 -20.5 0 -20.5S5.4 -17 5 -9H3.6L3.3 0H.7L0 -7.5L-.7 0H-3.3L-3.6 -9Z';
const DRESS = 'M-4.6 -10C-5 -17 -3.8 -20.5 0 -20.5S5 -17 4.6 -10L6.2 -5H-6.2Z M-3 -5.5h2.2V0H-3z M.8 -5.5H3V0H.8z';
/** sylwetka bez twarzy; x,y = stopy; o: { f, st (obrys), dress, helmet, arm ('up'|'hold'), cap } */
function person(p, x, y, s = 1, o = {}) {
  return <g transform={`translate(${n(x)} ${n(y)}) scale(${s})`} fill={o.f || p.person} stroke={o.st} stroke-width={o.st ? 1.1 : undefined} vector-effect={o.st ? 'non-scaling-stroke' : undefined}>
    {o.arm === 'up' && <path d="M3.4 -18L8.5 -31" stroke={o.f || p.person} stroke-width="2.4" stroke-linecap="round" fill="none" />}
    {o.arm === 'hold' && <path d="M3.4 -17L11 -15" stroke={o.f || p.person} stroke-width="2.4" stroke-linecap="round" fill="none" />}
    <circle cy="-25" r="3.6" />
    <path d={o.dress ? DRESS : BODY} />
    {o.helmet && <path d="M-4.2 -25.6a4.2 4.2 0 0 1 8.4 0h1.6v1.2H-5.8v-1.2z" fill={o.helmet === true ? p.win : o.helmet} stroke="none" />}
  </g>;
}
/** chmura dymu z komina */
const smoke = (p, x, y, s = 1) => <path d={C(x, y, 6 * s) + C(x + 10 * s, y - 6 * s, 8 * s) + C(x + 24 * s, y - 10 * s, 10 * s) + C(x + 40 * s, y - 12 * s, 9 * s)} fill={p.far} opacity=".7" />;
/** komin (trapez) z opaską */
const chimney = (p, x, yb, top, wb, wt, f) => <g><path d={P([[x - wb / 2, yb], [x - wt / 2, top], [x + wt / 2, top], [x + wb / 2, yb]])} fill={f || p.dark} /><path d={R(x - wt / 2 - 1, top + 5, wt + 2, 3) + R(x - wt / 2 - 1, top + 14, wt + 2, 2)} fill={p.near} /></g>;
/** szczeble okien (szprosy) dla prostokąta */
const mullions = (x, y, w, h, c, r) => { let d = ''; for (let i = 1; i < c; i++) d += `M${n(x + (w * i) / c)} ${n(y)}v${n(h)}`; for (let j = 1; j < r; j++) d += `M${n(x)} ${n(y + (h * j) / r)}h${n(w)}`; return d; };
const ladder = (x0, y0, x1, y1, k) => { let d = ''; for (let i = 0; i <= k; i++) { const t = i / k; d += `M${n(x0 + (x1 - x0) * t)} ${n(y0 + (y1 - y0) * t)}`; } return d; };
const spokes = (x, y, r, k = 8) => { let d = ''; for (let i = 0; i < k; i++) { const a = (i * Math.PI) / k; d += `M${n(x - Math.cos(a) * r)} ${n(y - Math.sin(a) * r)}L${n(x + Math.cos(a) * r)} ${n(y + Math.sin(a) * r)}`; } return d; };
const wheel = (p, x, y, r, f) => <g><circle cx={x} cy={y} r={r} {...S(f || p.dark, Math.max(1.6, r * 0.18))} /><path d={spokes(x, y, r, 6)} {...S(f || p.dark, 1)} /><circle cx={x} cy={y} r={r * 0.2} fill={f || p.dark} /></g>;

/* ── Hala w perspektywie (wnętrze, ogród zimowy) ───────── */
function hallInside(p, u, green) {
  const O = { L: -160, R: 560, e: 40, k: -70, f: 420 }, I = { L: 142, R: 258, e: 96, k: 72, f: 186 };
  const at = (d) => { const l = (a, b) => a + (b - a) * d; return { L: l(O.L, I.L), R: l(O.R, I.R), e: l(O.e, I.e), k: l(O.k, I.k), f: l(O.f, I.f), s: (l(O.R, I.R) - l(O.L, I.L)) / 720 }; };
  const wf = (a, t) => a.e + (a.f - a.e) * t;
  const A = at(0.42), B = at(1);
  const ridge = (a, t) => [[200 - (200 - a.L) * t, a.k + (a.e - a.k) * t], [200 + (a.R - 200) * t, a.k + (a.e - a.k) * t]];
  const [rA1, rA2] = ridge(A, 0.2), [rB1, rB2] = ridge(B, 0.2);
  const frames = [0.42, 0.6, 0.72, 0.81, 0.88, 0.93].map(at);
  let cols = '', back = mullions(I.L, I.e - 6, I.R - I.L, I.f - I.e + 6, 6, 5), roofLines = '';
  for (const t of [0.15, 0.4, 0.7]) { const a = ridge(O, t), b = ridge(B, t); roofLines += PL([a[0], b[0]]) + PL([a[1], b[1]]); }
  frames.forEach((a) => { cols += R(a.L, a.e, 9 * a.s, a.f - a.e) + R(a.R - 9 * a.s, a.e, 9 * a.s, a.f - a.e); });
  const winL = P([[A.L, wf(A, 0.1)], [B.L, wf(B, 0.1)], [B.L, wf(B, 0.5)], [A.L, wf(A, 0.5)]]) + P([[A.R, wf(A, 0.1)], [B.R, wf(B, 0.1)], [B.R, wf(B, 0.5)], [A.R, wf(A, 0.5)]]);
  const cr = at(0.46), cy = cr.e + 30 * cr.s;
  return <>
    <rect width="400" height="300" fill={p.wall} />
    <path d={P([[O.L, O.e], [200, O.k], [O.R, O.e], [I.R, I.e], [200, I.k], [I.L, I.e]])} fill={green ? p.glass : p.mid} />
    {green && <path d={roofLines} {...S(p.ink, 0.8, 0.3)} />}
    <path d={P([[rA1[0], rA1[1]], [rB1[0], rB1[1]], [rB2[0], rB2[1]], [rA2[0], rA2[1]]])} fill={p.win} />
    <path d={P([[I.L, I.f], [I.L, I.e], [200, I.k], [I.R, I.e], [I.R, I.f]])} fill={p.glass} />
    {green && <path d={treeline(186, 142, 258, 6, 10, 7)} fill={p.leafLt} />}
    <path d={back} {...S(p.ink, 0.8, 0.45)} />
    <path d={winL} fill={p.glass} />
    <path d={P([[O.L, O.f], [I.L, I.f], [I.R, I.f], [O.R, O.f]])} fill={p.floor} />
    <path d="M170 186L60 300M185 186L150 300M215 186L250 300M230 186L340 300M120 230H280M80 262H320" {...S(p.ink, 0.8, 0.14)} />
    <path d={P([[176, 50], [224, 50], [290, 300], [120, 300]])} fill={`url(#${u}b)`} opacity={green ? 0.5 : 0.6} />
    <path d={cols} fill={p.dark} />
    {frames.map((a, i) => <path key={i} d={truss([[a.L, a.e], [200, a.k], [a.R, a.e]], [[a.L, a.e + 16 * a.s], [a.R, a.e + 16 * a.s]], 12)} {...S(p.dark, Math.max(0.8, 2.6 * a.s))} />)}
    {green ? <>
      <path d="M118 66v22M150 92v18M262 90v20M290 66v24" {...S(p.dark, 0.9)} />
      <path d={C(118, 92, 7) + C(150, 113, 5) + C(262, 113, 5) + C(290, 93, 7)} fill={p.leafDk} />
      <path d={treeline(186, 142, 258, 4, 7, 3)} fill={p.leaf} />
      {tree(p, 168, 200, 0.6)}{tree(p, 236, 200, 0.6)}
      {tree(p, 205, 214, 0.9, 'round', p.leafDk)}
      <path d={R(178, 248, 50, 4) + R(181, 252, 3, 8) + R(222, 252, 3, 8)} fill={p.dark} />
      {person(p, 194, 248, 0.95)}{person(p, 214, 258, 1.05, { dress: 1 })}
      {[[86, 278, 1.9], [318, 272, 1.7]].map(([x, y, s]) => <g key={x}><path d={R(x - 17 * s, y - 12 * s, 34 * s, 14 * s)} fill={p.dark} /><path d={R(x - 17 * s, y - 12 * s, 34 * s, 2.5 * s)} fill={p.near} />{tree(p, x, y - 12 * s, s)}</g>)}
      <path d={C(30, 300, 26) + C(372, 300, 24)} fill={p.leafDk} />
    </> : <>
      <path d={R(152, 168, 26, 18) + R(222, 170, 24, 16) + R(190, 176, 14, 10)} fill={p.near} />
      <path d={R(cr.L, cy, cr.R - cr.L, 14 * cr.s)} fill={p.accent2} /><path d={`M${n(cr.L)} ${n(cy + 7 * cr.s)}H${n(cr.R)}`} {...S(p.dark, 0.8, 0.6)} /><path d={R(226, cy + 14 * cr.s, 26, 7) + R(224, 152, 28, 20)} fill={p.near} />
      <path d={`M239 ${n(cy + 14 * cr.s + 7)}V150`} {...S(p.dark, 1.1)} />
      <path d={mullions(224, 152, 28, 20, 3, 2)} {...S(p.ink, 0.7, 0.5)} />
      <path d="M30 300V250h70l20 -18h26v68z" fill={p.near} />
      <path d={C(133, 246, 9)} fill={p.dark} />
      {person(p, 160, 226, 0.85, { helmet: true })}{person(p, 214, 232, 0.9)}{person(p, 300, 276, 1.5, { helmet: true })}
    </>}
  </>;
}

/* ── Sceny ──────────────────────────────────────────────── */
const SCENES = {
  'hall-exterior': (p) => {
    const x0 = 64, w = 54, k = 5, b = 134, t = 102;
    let glz = '', pil = '', win = '', mul = '', crs = '';
    for (let i = 0; i < k; i++) {
      const x = x0 + i * w;
      glz += P([[x + 4, b - 3], [x + 4, t + 7], [x + w * 0.62, b - 3]]);
      win += arch(x + 10, 144, 34, 64); mul += mullions(x + 10, 161, 34, 47, 3, 3) + `M${x + 10} 161h34`;
      pil += R(x - 3, t, 6, 222 - t);
    }
    pil += R(x0 + k * w - 3, b, 6, 222 - b);
    for (let y = 141; y < 212; y += 7) crs += `M${x0} ${y}H${x0 + k * w}`;
    return <>
      {cloud(p, 40, 62, 1)}{cloud(p, 300, 40, 0.8)}
      <path d={treeline(214, -10, 410, 9, 16, 3)} fill={p.far} />
      {ground(212, p.ground)}
      {chimney(p, 340, 140, 40, 18, 12, p.brickDk)}
      <path d={P([[x0, 222], [x0, b], ...sawPts(x0, b, t, k, w), [x0 + k * w, 222]])} fill={p.brick} />
      <path d={crs} {...S(p.ink, 0.8, 0.16)} />
      <path d={pil} fill={p.brickDk} />
      <path d={glz + win} fill={p.glass} />
      <path d={mul} {...S(p.ink, 0.9, 0.55)} />
      <path d={PL([[x0 - 2, b], ...sawPts(x0, b, t, k, w)])} {...S(p.roof, 3)} />
      <path d={R(x0, 212, k * w, 10)} fill={p.brickDk} />
      <path d={P([[0, 300], [56, 224], [344, 224], [400, 300]])} fill={p.stone} />
      <path d="M40 246H360M20 272H380M200 224V300M130 224L100 300M270 224L300 300" {...S(p.ink, 0.8, 0.15)} />
      {tree(p, 34, 252, 1.7)}{tree(p, 372, 250, 1.5)}
      {person(p, 166, 274, 1.5)}{person(p, 186, 276, 1.5, { dress: 1 })}{person(p, 262, 258, 1.1)}
    </>;
  },

  'hall-interior': (p, u) => hallInside(p, u, false),
  'hall-green': (p, u) => hallInside(p, u, true),

  passage: (p) => {
    const lt = (x) => 30 + (88 * x) / 155, lb = (x) => 290 - (78 * x) / 155;
    const xs = [0, 36, 64, 88, 107, 122, 134, 144, 151];
    const q = (xa, xb, f0, f1, m) => { const pt = (x, f) => [m ? 400 - x : x, lt(x) + (lb(x) - lt(x)) * f]; return P([pt(xa, f0), pt(xb, f0), pt(xb, f1), pt(xa, f1)]); };
    let win = '', shop = '', ribs = '';
    for (const m of [0, 1]) for (let i = 0; i < xs.length - 1; i++) {
      const g = (xs[i + 1] - xs[i]) * 0.2, a = xs[i] + g, bb = xs[i + 1] - g;
      win += q(a, bb, 0.08, 0.34, m) + q(a, bb, 0.42, 0.66, m); shop += q(xs[i] + 1, xs[i + 1] - 1, 0.75, 0.97, m);
    }
    for (const x of [0, 20, 44, 64, 88, 107, 122, 134, 144]) ribs += `M${n(x)} ${n(lt(x))}Q200 ${n(lt(x) - 40 * (1 - x / 155))} ${n(400 - x)} ${n(lt(x))}`;
    ribs += 'M60 0L178 112M200 0V108M340 0L222 112';
    return <>
      <path d={P([[0, 0], [400, 0], [400, 30], [245, 118], [155, 118], [0, 30]])} fill={p.glass} opacity=".55" />
      <path d={treeline(206, 150, 250, 5, 9, 4)} fill={p.far} />
      <path d={R(172, 168, 56, 40)} fill={p.stone} /><path d={grid(178, 176, 4, 2, 8, 9, 5, 6)} fill={p.glass} />
      <path d={P([[0, 290], [155, 212], [245, 212], [400, 290], [400, 300], [0, 300]])} fill={p.stone} />
      <path d="M200 212V300M180 212L120 300M220 212L280 300M160 212L40 300M240 212L360 300M126 228H274M84 250H316" {...S(p.ink, 0.8, 0.16)} />
      <path d={P([[0, 30], [155, 118], [155, 212], [0, 290]]) + P([[400, 30], [245, 118], [245, 212], [400, 290]])} fill={p.brick} />
      <path d={win + shop} fill={p.glass} />
      <path d="M0 30L155 118M400 30L245 118M0 222L155 178M400 222L245 178" {...S(p.brickDk, 2.4)} />
      <path d={ribs} {...S(p.dark, 1.3, 0.8)} />
      <path d={C(20, 290, 14) + C(42, 284, 11) + C(380, 290, 14) + C(358, 284, 11)} fill={p.leafDk} />
      {person(p, 214, 224, 0.55)}{person(p, 190, 232, 0.8)}{person(p, 246, 258, 1.25, { dress: 1 })}{person(p, 264, 260, 1.3)}{person(p, 128, 290, 1.9)}
    </>;
  },

  'factory-archival': (p) => {
    let fence = ''; for (let x = 4; x < 146; x += 9) fence += `M${x} 204V236`; for (let x = 258; x < 400; x += 9) fence += `M${x} 204V236`;
    return <>
      {smoke(p, 120, 28, 1.1)}{smoke(p, 168, 20, 1.3)}{smoke(p, 306, 30, 1)}
      {chimney(p, 120, 160, 36, 18, 10)}{chimney(p, 166, 160, 26, 18, 10)}{chimney(p, 306, 160, 42, 16, 9)}
      <path d="M350 160V120M366 160V120M346 140h24" {...S(p.dark, 1.6)} /><path d={R(340, 96, 36, 26)} fill={p.dark} />
      <path d={P([[0, 220], [0, 162], ...sawPts(0, 162, 142, 10, 40), [400, 220]])} fill={p.mid} />
      <path d={grid(8, 172, 20, 2, 12, 12, 7.5, 6)} fill={p.glass} opacity=".75" />
      <path d={P([[16, 226], [16, 182], [78, 160], [140, 182], [140, 226]]) + P([[260, 226], [260, 182], [322, 160], [384, 182], [384, 226]])} fill={p.brick} />
      <path d={arch(28, 190, 14, 26) + arch(52, 186, 14, 30) + arch(86, 186, 14, 30) + arch(112, 190, 14, 26) + arch(272, 190, 14, 26) + arch(296, 186, 14, 30) + arch(330, 186, 14, 30) + arch(356, 190, 14, 26)} fill={p.dark} />
      {ground(226, p.ground)}
      <path d={fence + 'M0 210H146M254 210H400M0 230H146M254 230H400'} {...S(p.dark, 1.4)} />
      <path d={P([[158, 236], [242, 236], [330, 300], [70, 300]])} fill={p.stone} />
      <path d={R(144, 160, 16, 76) + R(240, 160, 16, 76) + R(140, 154, 24, 8) + R(236, 154, 24, 8)} fill={p.near} />
      <path d="M160 166H240M160 180H240M160 166L180 180L200 166L220 180L240 166" {...S(p.dark, 1.6)} />
      <path d={C(152, 148, 4) + C(248, 148, 4)} fill={p.dark} />
      {person(p, 184, 268, 1.15)}{person(p, 206, 270, 1.15, { helmet: p.dark })}{person(p, 232, 248, 0.8)}
    </>;
  },

  'machine-tool': (p) => <>
    <rect width="400" height="300" fill={p.wall} />
    <path d={R(30, 14, 340, 124)} fill={p.glass} />
    <path d={mullions(30, 14, 340, 124, 8, 4)} {...S(p.ink, 1, 0.45)} />
    <path d={`M${0} 10H400`} {...S(p.mid, 8)} />
    {ground(222, p.floor)}
    <path d="M0 240H400M0 268H400" {...S(p.ink, 0.8, 0.15)} />
    <path d={R(84, 176, 52, 60) + R(280, 176, 52, 60)} fill={p.near} />
    <path d={R(66, 174, 280, 10)} fill={p.mid} />
    <path d={R(66, 160, 280, 16)} fill={p.dark} />
    <path d={`M72 112h84a6 6 0 0 1 6 6v42H66v-42a6 6 0 0 1 6-6z`} fill={p.near} />
    <path d={C(92, 132, 6) + C(116, 132, 6) + C(140, 132, 4)} fill={p.wall} opacity=".8" />
    <path d={R(76, 146, 70, 4)} fill={p.dark} />
    <path d={R(162, 116, 16, 38)} fill={p.metal} />
    <path d={R(178, 122, 12, 26)} fill={p.dark} />
    <path d={R(190, 128, 98, 14)} fill={p.glass} />
    <path d="M206 128v14M222 128v14M236 128v14M248 128v14" {...S(p.ink, 0.8, 0.5)} />
    <path d={P([[290, 120], [326, 118], [332, 160], [286, 160]])} fill={p.near} />
    <path d={R(282, 130, 10, 10) + R(326, 134, 22, 6)} fill={p.metal} />
    <circle cx="352" cy="137" r="11" {...S(p.dark, 2.2)} /><path d={spokes(352, 137, 11, 3)} {...S(p.dark, 1.2)} />
    <path d={R(204, 148, 58, 12) + R(214, 160, 40, 26)} fill={p.mid} />
    <path d={R(224, 136, 18, 12)} fill={p.dark} />
    <path d="M226 142L216 136L224 134z" fill={p.dark} />
    <circle cx="234" cy="174" r="8" {...S(p.dark, 2)} /><path d={spokes(234, 174, 8, 3)} {...S(p.dark, 1)} />
    <path d="M150 112V70L186 58" {...S(p.dark, 2)} /><path d={P([[180, 52], [196, 52], [202, 66], [174, 66]])} fill={p.dark} />
    <path d={P([[176, 66], [200, 66], [220, 128], [176, 128]])} fill={p.glow} opacity=".35" />
    <path d="M208 142l6 6M214 140l8 3M211 144l3 8" {...S(p.dark, 1)} />
  </>,

  workers: (p) => <>
    <rect width="400" height="300" fill={p.wall} />
    <path d={R(30, 20, 340, 120)} fill={p.glass} />
    <path d={mullions(30, 20, 340, 120, 8, 4)} {...S(p.ink, 1, 0.4)} />
    <path d="M0 14H400" {...S(p.mid, 10)} />
    {ground(206, p.floor)}
    <path d="M0 230H400M0 262H400" {...S(p.ink, 0.8, 0.15)} />
    <path d={R(0, 158, 120, 34) + R(10, 192, 22, 30) + R(90, 192, 22, 30) + R(118, 168, 12, 18)} fill={p.near} />
    <path d={R(0, 150, 60, 10)} fill={p.dark} />
    <path d={R(334, 80, 14, 140) + R(306, 82, 56, 30) + R(300, 216, 90, 8) + R(312, 168, 46, 6)} fill={p.near} />
    <path d="M326 112v24" {...S(p.dark, 3)} />
    {person(p, 136, 252, 2.2, { st: p.wall, f: p.near, helmet: true })}{person(p, 178, 250, 2.3, { st: p.wall })}
    {person(p, 222, 250, 2.3, { st: p.wall, f: p.near, helmet: true })}{person(p, 264, 252, 2.2, { st: p.wall, dress: 1 })}
    {person(p, 156, 294, 2.6, { st: p.wall, dress: 1 })}{person(p, 200, 294, 2.7, { st: p.wall, f: p.near, helmet: true })}{person(p, 244, 294, 2.6, { st: p.wall })}
  </>,

  steelworks: (p, u) => <>
    {smoke(p, 196, 34, 1.4)}{smoke(p, 46, 30, 1)}
    <path d="M0 214Q100 186 200 200T400 196V300H0z" fill={p.far} />
    {chimney(p, 48, 222, 38, 12, 8)}
    {[70, 96, 122].map((x) => <path key={x} d={arch(x, 108, 22, 114)} fill={p.near} />)}
    <path d="M70 132h74M70 170h74" {...S(p.dark, 1)} />
    <path d={P([[300, 222], [300, 140], [324, 132], [348, 140], [348, 222]])} fill={p.mid} />
    <path d={truss([[222, 104], [392, 176]], [[226, 116], [392, 188]], 14)} {...S(p.dark, 1.3)} />
    <path d="M300 222V146M356 222V170M378 222V182" {...S(p.dark, 2.4)} />
    <path d="M186 104V54M214 104V54M186 90L214 70M214 90L186 70" {...S(p.dark, 1.6)} />
    <path d={R(180, 48, 40, 7)} fill={p.dark} />
    <path d="M200 60Q206 40 236 52L262 118" {...S(p.near, 7)} />
    <path d={arch(250, 110, 26, 64) + P([[250, 174], [276, 174], [266, 196], [260, 196]])} fill={p.near} />
    <path d={P([[170, 222], [170, 160], [182, 116], [218, 116], [230, 160], [230, 222]])} fill={p.dark} />
    <path d={R(178, 100, 44, 18)} fill={p.near} />
    <path d="M176 142H224M172 166H228M172 186H228" {...S(p.mid, 1.4)} />
    <path d={R(140, 194, 120, 28)} fill={p.mid} />
    <path d={P([[136, 196], [200, 180], [264, 196]])} fill={p.near} />
    <ellipse cx="200" cy="214" rx="70" ry="22" fill={`url(#${u}g)`} />
    <path d={R(190, 204, 20, 12)} fill={p.glow} />
    {ground(222, p.near)}
    <path d="M0 262H400M0 268H400" {...S(p.dark, 1.4)} />
    <path d={E(124, 248, 34, 13) + R(96, 250, 56, 8)} fill={p.dark} />
    <path d={E(124, 238, 18, 4)} fill={p.glow} />
    <circle cx="104" cy="261" r="5" fill={p.ink} /><circle cx="144" cy="261" r="5" fill={p.ink} />
    {person(p, 260, 268, 1.2, { helmet: true })}
  </>,

  mine: (p) => {
    const ly = [222, 184, 148, 114, 82], xl = (y) => 176 + ((222 - y) / 140) * 12, xr = (y) => 224 - ((222 - y) / 140) * 12;
    let br = ''; for (let i = 0; i < ly.length - 1; i++) { const a = ly[i], b = ly[i + 1]; br += `M${n(xl(a))} ${a}L${n(xr(b))} ${b}M${n(xr(a))} ${a}L${n(xl(b))} ${b}M${n(xl(b))} ${b}H${n(xr(b))}`; }
    return <>
      {cloud(p, 300, 46, 0.9)}{cloud(p, 40, 70, 0.7)}
      <path d="M-10 222L56 150Q70 142 84 150L170 222z" fill={p.far} />
      <path d={treeline(222, 250, 410, 6, 11, 5)} fill={p.far} />
      {ground(220, p.ground)}
      {chimney(p, 368, 150, 80, 12, 9, p.brickDk)}
      <path d={P([[280, 222], [280, 152], [330, 124], [380, 152], [380, 222]])} fill={p.brick} />
      <path d="M276 152L330 122L384 152" {...S(p.roof, 4)} />
      <path d={arch(292, 166, 18, 42) + arch(321, 160, 18, 48) + arch(350, 166, 18, 42) + C(330, 140, 5)} fill={p.glass} />
      <path d="M214 52L292 170M230 46L300 162" {...S(p.ink, 0.9, 0.7)} />
      <path d="M204 84L262 222M214 98L276 222" {...S(p.dark, 3)} />
      <path d="M216 120L242 136M226 150L254 168M236 180L266 198M230 136L244 160" {...S(p.dark, 1.2)} />
      <path d={br} {...S(p.dark, 1.4)} />
      <path d="M176 222L188 82M224 222L212 82" {...S(p.dark, 4)} />
      <path d={R(170, 72, 60, 8)} fill={p.dark} />
      {wheel(p, 184, 52, 17)}{wheel(p, 216, 52, 17)}
      <path d={R(150, 192, 100, 30)} fill={p.brick} /><path d={R(146, 186, 108, 6)} fill={p.roof} /><path d={R(192, 202, 16, 20) + grid(158, 200, 2, 1, 12, 10, 8) + grid(222, 200, 2, 1, 12, 10, 8)} fill={p.dark} />
      <path d="M0 258H400M0 264H400" {...S(p.dark, 1.6)} />
      <path d="M10 266v4M40 266v4M70 266v4M100 266v4M130 266v4M160 266v4M190 266v4M220 266v4M250 266v4M280 266v4M310 266v4M340 266v4M370 266v4" {...S(p.dark, 3)} />
      <path d={P([[54, 228], [116, 228], [110, 252], [60, 252]])} fill={p.near} />
      <path d="M58 229Q85 212 112 229z" fill={p.dark} />
      <circle cx="70" cy="254" r="5.5" fill={p.dark} /><circle cx="100" cy="254" r="5.5" fill={p.dark} />
      {person(p, 136, 262, 1.25, { helmet: true })}
    </>;
  },

  glassworks: (p, u) => {
    const vase = (x, y, h, w, k) => k === 0 ? `M${x - w * 0.18} ${y - h}h${w * 0.36}v${h * 0.3}c${w * 0.32} ${h * 0.08} ${w * 0.32} ${h * 0.2} ${w * 0.32} ${h * 0.35}V${y}h${-w * 0.64}V${y - h * 0.35}c0 ${-h * 0.15} 0 ${-h * 0.27} ${w * 0.32} ${-h * 0.35}z`
      : k === 1 ? `M${x - w * 0.3} ${y - h}h${w * 0.6}c${-w * 0.1} ${h * 0.2} ${w * 0.25} ${h * 0.4} ${w * 0.2} ${h * 0.65}c${-w * 0.02} ${h * 0.2} ${-w * 0.2} ${h * 0.35} ${-w * 0.2} ${h * 0.35}h${-w * 0.4}c0 0 ${-w * 0.18} ${-h * 0.15} ${-w * 0.2} ${-h * 0.35}c${-w * 0.05} ${-h * 0.25} ${w * 0.3} ${-h * 0.45} ${w * 0.2} ${-h * 0.65}z`
        : `M${x - w / 2} ${y - h}h${w}c0 ${h * 0.7} ${-w * 0.25} ${h} ${-w / 2} ${h}s${-w / 2} ${-h * 0.3} ${-w / 2} ${-h}z`;
    return <>
      <rect width="400" height="300" fill={p.mid} />
      <path d={grid(-4, 20, 4, 2, 26, 40, 8, 10) + grid(296, 20, 4, 2, 26, 40, 8, 10)} fill={p.glass} opacity=".55" />
      <path d={P([[146, 0], [254, 0], [242, 62], [158, 62]])} fill={p.dark} />
      <ellipse cx="200" cy="168" rx="150" ry="90" fill={`url(#${u}g)`} opacity=".55" />
      <path d="M108 226V150Q108 80 200 80Q292 80 292 150V226z" fill={p.brickDk} />
      <path d="M108 120H292M108 196H292M116 100H284" {...S(p.ink, 0.8, 0.25)} />
      <path d="M108 150Q108 80 200 80Q292 80 292 150" {...S(p.dark, 4)} />
      <path d={C(153, 170, 26) + C(200, 162, 30) + C(247, 170, 26)} fill={`url(#${u}g)`} />
      <path d={arch(140, 152, 26, 30) + arch(186, 140, 28, 42) + arch(234, 152, 26, 30)} fill={p.glow} />
      {ground(224, p.near)}
      <path d="M0 246H400" {...S(p.dark, 0.8, 0.4)} />
      {person(p, 78, 290, 2.9, { f: p.dark, arm: 'hold' })}
      <path d="M104 245L174 170" {...S(p.dark, 2.6)} />
      <circle cx="177" cy="168" r="6" fill={p.glow} />
      <path d="M298 196H392M298 150H392" {...S(p.dark, 3)} />
      <path d={vase(312, 194, 30, 18, 0) + vase(336, 194, 22, 20, 1) + vase(364, 194, 16, 22, 2) + vase(384, 194, 28, 16, 0) + vase(318, 148, 20, 22, 1) + vase(346, 148, 26, 14, 0) + vase(372, 148, 14, 24, 2)} fill={p.glass} opacity=".9" stroke={p.ink} stroke-width=".9" />
      <path d={R(262, 246, 138, 10)} fill={p.dark} /><path d="M276 256v44M388 256v44" {...S(p.dark, 4)} />
      <path d={vase(290, 246, 34, 22, 1) + vase(322, 246, 44, 20, 0) + vase(356, 246, 22, 32, 2)} fill={p.win} opacity=".9" stroke={p.ink} stroke-width=".9" />
    </>;
  },

  railway: (p) => <>
    {cloud(p, 50, 50, 0.9)}{cloud(p, 330, 34, 0.7)}
    <path d={treeline(200, -10, 410, 8, 14, 9)} fill={p.far} />
    <path d={P([[20, 200], [20, 140], [100, 140], [100, 110], [136, 86], [172, 110], [172, 140], [260, 140], [260, 200]])} fill={p.brick} />
    <path d={P([[14, 142], [60, 124], [106, 142]]) + P([[166, 142], [214, 124], [266, 142]]) + P([[96, 112], [136, 80], [176, 112]])} fill={p.roof} />
    <circle cx="136" cy="112" r="9" fill={p.win} /><path d="M136 106v6l4 3" {...S(p.ink, 1.2)} />
    <path d={arch(28, 156, 14, 34) + arch(50, 156, 14, 34) + arch(72, 156, 14, 34) + arch(112, 132, 16, 58) + arch(144, 132, 16, 58) + arch(182, 156, 14, 34) + arch(204, 156, 14, 34) + arch(226, 156, 14, 34)} fill={p.glass} />
    <path d={R(0, 200, 400, 16)} fill={p.stone} />
    <path d="M0 200H400" {...S(p.dark, 1.2)} />
    {ground(216, p.groundDk)}
    <path d={C(323, 166, 7) + C(308, 156, 10) + C(287, 148, 12) + C(262, 142, 13) + C(236, 140, 12) + C(212, 142, 10) + C(192, 146, 8)} fill={p.cloud} opacity=".92" />
    <path d={R(190, 216, 136, 14) + R(220, 196, 96, 26)} fill={p.dark} />
    <path d="M226 196a13 13 0 0 1 0 26" fill={p.dark} />
    <path d={R(316, 192, 14, 32) + R(320, 178, 8, 16) + R(312, 176, 16, 4) + 'M262 196a9 8 0 0 1 18 0z'} fill={p.dark} />
    <path d={R(180, 172, 44, 50) + R(176, 168, 52, 6)} fill={p.near} />
    <path d={R(188, 180, 14, 14) + R(206, 180, 12, 14)} fill={p.glass} />
    <path d={P([[330, 230], [348, 230], [334, 246]])} fill={p.dark} />
    {wheel(p, 222, 240, 13, p.ink)}{wheel(p, 254, 240, 13, p.ink)}{wheel(p, 286, 240, 13, p.ink)}
    <circle cx="316" cy="246" r="7" fill={p.ink} />
    <path d="M222 244H286" {...S(p.metal, 2.4)} />
    <path d="M0 254H400M0 260H400" {...S(p.dark, 1.6)} />
    <path d="M0 262H400" stroke={p.dark} stroke-width="5" stroke-dasharray="3 9" />
    {person(p, 54, 214, 0.8)}{person(p, 74, 214, 0.75, { dress: 1 })}
  </>,

  lake: (p, u) => {
    let rip = ''; for (let i = 0; i < 9; i++) { const y = 182 + i * 13, x = 30 + ((i * 97) % 280); rip += `M${x} ${y}h${30 + (i % 3) * 14}M${(x + 170) % 380} ${y + 6}h${22 + (i % 2) * 16}`; }
    return <>
      {sun(p, 300, 70, 16)}{cloud(p, 50, 60, 1)}{cloud(p, 230, 36, 0.7)}
      <path d="M0 170Q60 140 130 156T260 148T400 156V176H0z" fill={p.far} />
      <path d={conifers(178, -10, 410, 14, 26, 11)} fill={p.leafDk} />
      <rect x="0" y="176" width="400" height="124" fill={`url(#${u}w)`} />
      <path d={rip} {...S(p.win, 1.4, 0.7)} />
      <path d="M190 212h44M196 220h30M202 228h18" {...S(p.dark, 1.6, 0.45)} />
      <path d="M210 112V204" {...S(p.dark, 1.6)} />
      <path d={P([[212, 114], [212, 196], [254, 196]])} fill={p.win} />
      <path d={P([[208, 124], [208, 196], [174, 196]])} fill={p.win} opacity=".85" />
      <path d="M212 114L254 196M208 124L174 196" {...S(p.ink, 0.8, 0.35)} />
      <path d={P([[168, 198], [256, 198], [246, 210], [178, 210]])} fill={p.dark} />
      <path d={P([[300, 300], [346, 300], [306, 232], [294, 232]])} fill={p.stoneDk} />
      <path d="M302 240v12M314 260v14M326 280v18" {...S(p.dark, 2)} />
      <path d="M0 300V270Q40 256 90 274Q110 284 120 300z" fill={p.leafDk} />
      <path d="M20 272L16 236M30 270L32 230M42 272L48 240M56 276L54 246M68 278L76 250" {...S(p.leafDk, 1.6)} />
    </>;
  },

  desert: (p) => {
    let tuft = ''; for (const [x, y, s] of [[70, 262, 1.3], [118, 276, 1], [300, 254, 1.2], [346, 272, 1.5], [250, 286, 0.9], [36, 230, 0.8], [372, 226, 0.8]]) tuft += `M${x} ${y}l${-6 * s} ${-12 * s}M${x} ${y}l${-1 * s} ${-15 * s}M${x} ${y}l${5 * s} ${-13 * s}M${x} ${y}l${9 * s} ${-7 * s}M${x} ${y}l${-10 * s} ${-5 * s}`;
    return <>
      {sun(p, 110, 64, 18)}{cloud(p, 250, 54, 0.8)}
      <path d={treeline(178, -10, 410, 5, 9, 12)} fill={p.far} />
      <path d="M0 184Q80 170 160 178Q240 150 300 166Q350 176 400 172V300H0z" fill={p.sandDk} />
      <path d="M0 190Q90 172 160 180Q200 150 248 152Q300 180 400 186V300H0z" fill={p.sand} />
      <path d="M248 152Q300 180 400 186V214Q320 210 248 152z" fill={p.sandDk} />
      <path d="M0 236Q70 206 130 212Q190 218 230 236Q300 222 400 232V300H0z" fill={p.sandDk} />
      <path d="M130 212Q190 218 230 236Q180 240 130 212z" fill={p.dark} opacity=".18" />
      <path d="M160 180Q200 150 248 152" {...S(p.win, 1.6, 0.9)} />
      <path d="M40 252Q120 244 200 262M210 276Q290 262 380 272M10 288Q90 280 160 292" {...S(p.sandDk, 1.2)} />
      <path d={tuft} {...S(p.leafDk, 1.4)} />
      {person(p, 222, 154, 0.55)}{person(p, 234, 153, 0.5, { dress: 1 })}
    </>;
  },

  wetland: (p) => {
    let reed = '', heads = ''; for (const [x0, y, k] of [[20, 250, 7], [290, 236, 6], [320, 266, 8], [96, 214, 4]]) for (let i = 0; i < k; i++) { const x = x0 + i * 6, h = 30 + ((i * 7) % 4) * 8, b = ((i % 3) - 1) * 4; reed += `M${x} ${y}q${b / 2} ${-h / 2} ${b} ${-h}`; if (i % 2 === 0) heads += E(x + b, y - h + 6, 1.8, 5); }
    return <>
      {cloud(p, 60, 54, 0.9)}{cloud(p, 270, 40, 0.8)}
      <path d="M92 70l7 5 7-5M122 60l6 4 6-4M300 96l6 4 6-4" {...S(p.dark, 1.4)} />
      <path d={treeline(182, -10, 410, 8, 16, 21)} fill={p.far} />
      {ground(180, p.ground)}
      <path d="M0 198Q100 192 200 200T400 196" {...S(p.groundDk, 6, 0.6)} />
      <path d="M150 196Q240 186 300 204Q320 220 270 228Q180 238 130 224Q100 210 150 196z" fill={p.water} />
      <path d="M-10 262Q60 244 140 254Q190 262 170 282Q130 300 40 300H-10z" fill={p.water} />
      <path d="M180 212h40M236 220h30M40 272h50M100 282h30" {...S(p.win, 1.4, 0.7)} />
      <path d="M212 186Q228 176 244 182Q240 192 222 192Z" fill={p.dark} />
      <path d="M240 182Q234 168 242 160Q248 154 243 147" {...S(p.dark, 3.4)} />
      <circle cx="244" cy="146" r="3.4" fill={p.dark} /><path d="M246 146L260 150" {...S(p.dark, 1.6)} />
      <path d="M226 191l-2 22M233 191l1 22" {...S(p.dark, 1.4)} />
      <path d="M218 222h26" {...S(p.dark, 1.2, 0.35)} />
      <path d={reed} {...S(p.leafDk, 1.6)} />
      <path d={heads} fill={p.dark} />
      <path d="M0 300Q100 280 200 294T400 286V300z" fill={p.groundDk} />
    </>;
  },

  forest: (p) => {
    const hill = (x) => 214 - 104 * Math.exp(-(((x - 200) / 150) ** 2));
    const r = rng(31); let back = '', mid = '', hi = '';
    for (let j = 0; j < 8; j++) for (let x0 = 6 + (j % 2) * 10; x0 < 396; x0 += 19) { const x = x0 + r() * 6, y = hill(x) + 8 + j * 15 + r() * 6; if (y > 222) continue; const rr = 10 + r() * 5; back += C(x + 3, y + 4, rr); mid += C(x, y, rr * 0.86); if (r() > 0.4) hi += C(x - rr * 0.3, y - rr * 0.35, rr * 0.35); }
    return <>
      {cloud(p, 250, 40, 0.8)}{cloud(p, 120, 30, 0.6)}
      <path d={treeline(200, -10, 410, 8, 14, 33)} fill={p.far} />
      <path d={`M-10 230L-10 214${Array.from({ length: 22 }, (_, i) => `L${n(-10 + i * 20)} ${n(hill(-10 + i * 20) + 6)}`).join('')}L410 230z`} fill={p.leafDk} />
      <path d={back} fill={p.leafDk} /><path d={mid} fill={p.leaf} /><path d={hi} fill={p.leafLt} opacity=".8" />
      {ground(222, p.ground)}
      <path d="M200 300Q180 268 210 250Q236 236 220 222" {...S(p.sand, 9)} />
      <path d="M22 300V-10M54 300V-10M368 300V-10" {...S(p.stoneDk, 9)} />
      <path d="M22 300V-10M54 300V-10M368 300V-10" {...S(p.win, 1.4, 0.4)} transform="translate(-2 0)" />
      <path d={C(30, 6, 46) + C(-6, 54, 30) + C(84, -6, 30) + C(380, 10, 42) + C(410, 60, 26)} fill={p.leafDk} />
      <path d={C(20, 0, 22) + C(70, -10, 16) + C(372, 0, 20)} fill={p.leaf} />
      <path d="M0 300Q60 276 120 290Q160 298 190 300z" fill={p.groundDk} />
      {person(p, 218, 248, 0.7)}
    </>;
  },

  park: (p) => {
    const rows = [0, 1, 2, 3]; const t = (i) => i / 3.3;
    return <>
      {cloud(p, 40, 40, 0.8)}{cloud(p, 300, 30, 0.7)}
      <path d={treeline(166, 120, 280, 8, 12, 41)} fill={p.far} />
      {ground(160, p.ground)}
      <path d={P([[186, 162], [214, 162], [330, 300], [70, 300]])} fill={p.sand} />
      <path d="M200 162V300" {...S(p.sandDk, 1, 0.6)} />
      {rows.slice().reverse().map((i) => { const s = 1.9 - t(i) * 1.6; return <g key={i}>{tree(p, 64 + t(i) * 110, 268 - t(i) * 100, s)}{tree(p, 336 - t(i) * 110, 268 - t(i) * 100, s)}</g>; })}
      <path d="M112 284V170" {...S(p.dark, 2.4)} /><path d={P([[104, 160], [120, 160], [116, 172], [108, 172]]) + R(108, 152, 8, 6)} fill={p.dark} /><path d={R(108, 162, 8, 7)} fill={p.glow} />
      <path d="M262 252h44M264 240h40M264 240v-12h40v12M266 252v10M302 252v10" {...S(p.dark, 3)} />
      {person(p, 196, 214, 0.8)}{person(p, 208, 215, 0.76, { dress: 1 })}
      {person(p, 150, 286, 1.5)}
    </>;
  },

  tree: (p) => {
    const cr = [[200, 92, 50], [148, 112, 38], [254, 108, 40], [118, 140, 26], [284, 138, 26], [170, 66, 32], [232, 64, 34], [200, 136, 34], [150, 146, 26], [252, 148, 26]];
    return <>
      {cloud(p, 30, 40, 0.8)}{cloud(p, 320, 30, 0.7)}
      <path d={treeline(204, -10, 410, 7, 12, 51)} fill={p.far} />
      <path d="M0 214Q200 196 400 214V300H0z" fill={p.ground} />
      <path d="M174 234C184 214 186 196 184 176L162 150L170 146L190 168L194 132H206L208 166L230 142L238 148L216 178C214 200 216 216 226 234Z" fill={p.dark} />
      <path d={cr.map(([x, y, r]) => C(x + 5, y + 7, r)).join('')} fill={p.leafDk} />
      <path d={cr.map(([x, y, r]) => C(x, y, r * 0.9)).join('')} fill={p.leaf} />
      <path d={cr.slice(0, 7).map(([x, y, r]) => C(x - r * 0.3, y - r * 0.35, r * 0.38)).join('')} fill={p.leafLt} opacity=".85" />
      <path d="M188 168L176 150M210 166L222 152M196 160V140" {...S(p.dark, 3)} opacity=".9" />
      <path d={E(200, 236, 46, 5)} fill={p.groundDk} opacity=".7" />
      <path d="M140 244H260M146 236V250M200 236V250M254 236V250" {...S(p.dark, 1.6)} />
      <path d="M292 256V236" {...S(p.dark, 1.6)} /><path d={R(284, 226, 16, 11)} fill={p.dark} />
      {person(p, 312, 254, 1)}
      <path d="M0 300Q100 282 200 292T400 284V300z" fill={p.groundDk} />
    </>;
  },

  river: (p, u) => <>
    {cloud(p, 160, 40, 0.8)}
    <path d="M100 160Q160 132 200 146T300 150V180H100z" fill={p.far} />
    <path d="M0 76Q60 70 96 84Q130 100 146 136Q164 168 160 196Q150 240 136 300H0z" fill={p.stoneDk} />
    <path d="M96 84Q130 100 146 136Q164 168 160 196Q150 240 136 300H96Q120 240 120 196Q118 150 96 84z" fill={p.near} />
    <path d="M400 70Q340 66 310 82Q276 104 258 140Q244 172 248 200Q256 250 280 300H400z" fill={p.stoneDk} />
    <path d="M310 82Q276 104 258 140Q244 172 248 200Q256 250 280 300H306Q282 240 280 196Q282 140 310 82z" fill={p.near} />
    <path d="M10 120Q50 116 80 126M20 168Q60 160 104 172M8 220Q50 210 112 226M392 118Q350 112 300 126M396 168Q340 160 280 172M396 222Q340 214 280 226" {...S(p.ink, 0.9, 0.3)} />
    <path d="M182 166Q206 164 222 168Q244 184 250 214Q256 250 290 300H110Q148 250 158 216Q166 182 182 166z" fill={`url(#${u}w)`} />
    <path d="M190 184h22M176 210h34M216 222h22M160 250h40M226 262h32M140 284h50" {...S(p.win, 1.4, 0.7)} />
    <path d={conifers(80, -10, 104, 16, 28, 61)} fill={p.leafDk} />
    <path d={conifers(76, 300, 410, 16, 28, 62)} fill={p.leafDk} />
    <path d={treeline(150, 150, 250, 6, 10, 63)} fill={p.leaf} />
    <path d={E(172, 284, 14, 7) + E(262, 276, 10, 5) + E(230, 236, 6, 3)} fill={p.near} />
  </>,

  quarry: (p, u) => {
    const bowl = (x) => 20 * (1 - ((x - 200) / 220) ** 2), r = rng(171);
    const lv = [0, 1, 2, 3].map((i) => {
      const y0 = 86 + i * 34; let top = [], crk = '';
      for (let x = -10; x <= 410; x += 14) top.push([x, y0 + bowl(x) + r() * 5 - (x % 28 ? 3 : 0)]);
      for (let k = 0; k < 7; k++) { const x = 20 + k * 58 + r() * 20; const y = y0 + bowl(x) + 4; crk += `M${n(x)} ${n(y)}l${n(r() * 4 - 2)} ${n(12 + r() * 6)}`; }
      return { i, d: 'M' + top.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + `L410 ${n(y0 + 24)}Q200 ${n(y0 + 46)} -10 ${n(y0 + 24)}z`, crk };
    });
    return <>
      {cloud(p, 60, 36, 0.8)}{cloud(p, 290, 30, 0.7)}
      <path d={treeline(80, -10, 410, 8, 14, 71)} fill={p.leaf} />
      <rect x="0" y="76" width="400" height="224" fill={p.stone} />
      {lv.map(({ i, d, crk }) => <g key={i}><path d={d} fill={i % 2 ? p.stoneDk : p.mid} /><path d={crk} {...S(p.ink, 1, 0.35)} /></g>)}
      <path d="M-10 222Q200 246 410 222V300H-10z" fill={p.floor} />
      <path d="M-10 222Q200 246 410 222" {...S(p.win, 1.2, 0.6)} />
      <path d={E(126, 262, 64, 15)} fill={`url(#${u}w)`} />
      <path d="M96 260h30M138 266h24" {...S(p.win, 1.2, 0.7)} />
      <path d={C(300, 300, 40) + C(352, 296, 24) + C(40, 304, 30)} fill={p.stoneDk} />
      <path d={R(242, 238, 46, 16) + R(258, 226, 22, 14)} fill={p === COLOR ? p.accent2 : p.dark} />
      <path d={R(262, 229, 14, 8)} fill={p.glass} />
      <path d="M244 236L222 216L206 232" {...S(p.dark, 3.4)} /><path d="M200 228h12l-4 10h-8z" fill={p.dark} />
      <path d={R(238, 254, 54, 8)} fill={p.dark} />
      {person(p, 316, 266, 1.4, { helmet: true })}
    </>;
  },

  church: (p) => {
    const bt = (x, y) => P([[x - 5, y], [x, y - 14], [x + 5, y]]);
    return <>
      {cloud(p, 40, 50, 0.9)}{cloud(p, 300, 36, 0.8)}
      <path d={treeline(220, -10, 410, 8, 14, 81)} fill={p.far} />
      {ground(218, p.ground)}
      <path d={P([[126, 150], [200, 104], [274, 150]])} fill={p.roof} />
      <path d={P([[110, 222], [110, 156], [178, 128], [178, 222]]) + P([[290, 222], [290, 156], [222, 128], [222, 222]])} fill={p.brick} />
      <path d="M106 158L178 126M294 158L222 126" {...S(p.roof, 4)} />
      <path d={R(176, 96, 48, 126)} fill={p.brick} />
      <path d={P([[172, 100], [200, 14], [228, 100]])} fill={p.roof} />
      <path d={bt(176, 100) + bt(224, 100) + bt(110, 160) + bt(290, 160)} fill={p.roof} />
      <path d={R(106, 160, 8, 62) + R(170, 128, 8, 94) + R(222, 128, 8, 94) + R(286, 160, 8, 62)} fill={p.brickDk} />
      <path d={lancet(122, 168, 14, 40) + lancet(146, 160, 14, 48) + lancet(240, 160, 14, 48) + lancet(264, 168, 14, 40) + lancet(186, 104, 10, 30) + lancet(204, 104, 10, 30)} fill={p.glass} />
      <circle cx="200" cy="160" r="12" fill={p.glass} /><path d={spokes(200, 160, 12, 4)} {...S(p.ink, 0.8, 0.6)} />
      <path d={lancet(188, 186, 24, 36)} fill={p.dark} />
      <path d={mullions(122, 182, 14, 26, 2, 1) + mullions(146, 176, 14, 32, 2, 1) + mullions(240, 176, 14, 32, 2, 1) + mullions(264, 182, 14, 26, 2, 1)} {...S(p.ink, 0.8, 0.5)} />
      <path d="M176 140H224M176 178H224" {...S(p.brickDk, 2)} />
      <path d="M200 14V6M196 9h8" {...S(p.roof, 1.4)} />
      {tree(p, 60, 236, 1.6)}{tree(p, 348, 236, 1.7)}{tree(p, 90, 226, 1, 'poplar')}
      <path d={P([[0, 300], [130, 224], [270, 224], [400, 300]])} fill={p.stone} />
      {person(p, 186, 262, 1.1)}{person(p, 214, 258, 1, { dress: 1 })}
    </>;
  },

  palace: (p) => {
    let col = ''; for (let i = 0; i < 8; i++) col += R(130 + i * 19.5, 140, 8, 66);
    return <>
      {cloud(p, 30, 50, 0.9)}{cloud(p, 290, 40, 0.8)}
      <path d={treeline(210, -10, 410, 8, 14, 91)} fill={p.far} />
      {ground(214, p.ground)}
      <path d={R(30, 138, 340, 80)} fill={p.stone} />
      <path d={R(26, 132, 348, 8)} fill={p.stoneDk} />
      <path d={grid(40, 150, 4, 2, 12, 22, 9, 12) + grid(279, 150, 4, 2, 12, 22, 9, 12)} fill={p.dark} />
      <path d={R(118, 140, 164, 70)} fill={p.near} />
      <path d={grid(140, 156, 3, 1, 16, 42, 42) + 'M180 210V178h40v32z'} fill={p.dark} />
      <path d={col} fill={p.wall} />
      <path d={R(112, 124, 176, 16)} fill={p.wall} />
      <path d={P([[110, 126], [200, 88], [290, 126]])} fill={p.wall} />
      <path d={P([[132, 120], [200, 96], [268, 120]])} fill={p.stoneDk} />
      <path d="M110 126L200 88L290 126" {...S(p.stoneDk, 2)} />
      <path d={R(108, 206, 184, 5) + R(100, 211, 200, 5) + R(92, 216, 216, 5)} fill={p.wall} />
      <path d="M108 211H292M100 216H300" {...S(p.ink, 0.8, 0.3)} />
      {tree(p, 14, 240, 1.5, 'conifer')}{tree(p, 386, 240, 1.5, 'conifer')}
      <path d={P([[0, 300], [92, 221], [308, 221], [400, 300]])} fill={p.sand} />
      <path d={E(200, 262, 40, 9)} fill={p.stoneDk} /><path d={E(200, 260, 34, 6)} fill={p.water} />
      <path d="M200 260V244" {...S(p.water, 3)} />
      {person(p, 130, 272, 1.2)}{person(p, 272, 268, 1.1, { dress: 1 })}{person(p, 288, 270, 0.8)}
    </>;
  },

  'city-street': (p) => {
    const hs = [[-10, 72, 70, p.brick], [62, 88, 58, p.stone], [150, 76, 74, p.wall], [226, 88, 66, p.sandDk], [314, 96, 76, p.brick]];
    return <>
      {cloud(p, 120, 30, 0.7)}
      <path d={hs.map(([x, w, top]) => R(x + w * 0.7, top - 14, 6, 14) + R(x - 2, top - 4, w + 4, 6)).join('')} fill={p.dark} />
      {hs.map(([x, w, top, f], i) => <g key={i}>
        <path d={R(x, top + 2, w, 198 - top)} fill={f} />
        <path d={grid(x + 8, top + 14, Math.floor((w - 8) / 16), Math.floor((150 - top) / 24), 9, 15, 7, 9)} fill={p.dark} opacity=".8" />
        <path d={R(x + 4, 168, w - 8, 26)} fill={p.glass} />
        <path d={R(x + 4, 162, w - 8, 6)} fill={i % 2 ? p.accent : p.near} />
      </g>)}
      <path d={R(0, 194, 400, 12)} fill={p.stone} />
      {ground(206, p.near)}
      <path d="M0 132H400" {...S(p.ink, 0.8)} />
      <path d="M0 256H400M0 264H400" {...S(p.dark, 1.6)} />
      <path d="M190 182L210 132H232M196 182L220 132" {...S(p.ink, 1.2)} />
      <path d="M96 252V194q0-12 14-12h196q16 0 20 12l8 22v36z" fill={p.accent2} />
      <path d={R(96, 230, 238, 10)} fill={p.accent} />
      <path d={grid(108, 192, 6, 1, 26, 22, 8)} fill={p.dark} opacity=".85" />
      <path d="M312 192h12l6 18v6h-18z" fill={p.dark} opacity=".85" />
      <path d={R(106, 252, 220, 4)} fill={p.dark} />
      <circle cx="132" cy="256" r="6" fill={p.ink} /><circle cx="164" cy="256" r="6" fill={p.ink} /><circle cx="268" cy="256" r="6" fill={p.ink} /><circle cx="300" cy="256" r="6" fill={p.ink} />
      <path d="M40 206V140M360 206V140" {...S(p.dark, 2.4)} /><path d={E(40, 138, 7, 4) + E(360, 138, 7, 4)} fill={p.dark} />
      {person(p, 30, 204, 0.75)}{person(p, 376, 204, 0.75, { dress: 1 })}{person(p, 62, 204, 0.72)}
      <path d={R(0, 266, 400, 34)} fill={p.stone} />
      {person(p, 60, 298, 1.4)}{person(p, 340, 296, 1.3, { dress: 1 })}
    </>;
  },

  'city-panorama': (p) => {
    const bl = [[30, 150, 34, 70], [76, 130, 26, 90], [112, 160, 44, 60], [240, 140, 30, 80], [282, 156, 46, 64], [336, 128, 28, 92]];
    return <>
      {cloud(p, 70, 44, 0.8)}{cloud(p, 300, 34, 0.9)}
      <path d="M0 170Q80 130 170 150T330 138T400 150V230H0z" fill={p.far} />
      <path d="M150 180Q155 150 148 120H178Q170 150 176 180z" fill={p.stoneDk} />
      {chimney(p, 216, 190, 54, 8, 5, p.near)}{chimney(p, 232, 190, 70, 8, 5, p.near)}
      {smoke(p, 216, 48, 0.6)}
      <path d={P([[56, 160], [56, 120], [62, 96], [68, 120], [68, 160]]) + P([[188, 170], [188, 124], [196, 104], [204, 124], [204, 170]])} fill={p.near} />
      {bl.map(([x, y, w, h], i) => <g key={i}><path d={R(x, y, w, h)} fill={i % 2 ? p.wall : p.stone} /><path d={grid(x + 4, y + 6, Math.floor((w - 4) / 7), Math.floor((h - 10) / 8), 4, 4, 3, 4)} fill={p.dark} opacity=".55" /></g>)}
      <path d={treeline(222, -10, 410, 9, 16, 101)} fill={p.leafDk} />
      <path d={treeline(240, -10, 410, 7, 12, 102)} fill={p.leaf} />
      {ground(236, p.ground)}
      <path d="M0 268Q200 250 400 270V300H0z" fill={p.groundDk} />
    </>;
  },

  tower: (p) => {
    const ly = [222, 192, 164, 138, 114, 92, 72]; const xl = (y) => 168 + ((222 - y) / 150) * 20, xr = (y) => 232 - ((222 - y) / 150) * 20;
    let br = ''; for (let i = 0; i < ly.length - 1; i++) { const a = ly[i], b = ly[i + 1]; br += `M${n(xl(a))} ${a}L${n(xr(b))} ${b}M${n(xr(a))} ${a}L${n(xl(b))} ${b}M${n(xl(b))} ${b}H${n(xr(b))}`; }
    return <>
      {cloud(p, 40, 50, 1)}{cloud(p, 290, 70, 0.8)}
      <path d="M0 240Q100 200 200 214T400 230V300H0z" fill={p.far} />
      <g transform="translate(0 14)">
      <path d={br} {...S(p.dark, 1.2)} />
      <path d={`M168 222L${xl(72)} 72M232 222L${xr(72)} 72M200 222V72`} {...S(p.dark, 3)} />
      <path d={R(178, 64, 44, 8)} fill={p.dark} />
      <path d="M178 64V50H222V64M178 56H222M189 50V64M200 50V64M211 50V64" {...S(p.dark, 1.2)} /><path d={P([[172, 51], [200, 36], [228, 51]])} fill={p.dark} />
      {person(p, 188, 64, 0.34)}{person(p, 210, 64, 0.32)}
      </g>
      <path d="M0 250Q120 208 220 220T400 240V300H0z" fill={p.ground} />
      <path d={treeline(244, -10, 160, 9, 15, 111) + treeline(246, 240, 410, 9, 15, 112)} fill={p.leafDk} />
      {tree(p, 70, 266, 1.4, 'conifer')}{tree(p, 330, 268, 1.6, 'conifer')}{tree(p, 360, 270, 1.2)}
      <path d="M200 300Q190 270 200 228" {...S(p.sand, 6)} />
      {person(p, 210, 270, 0.9)}
    </>;
  },

  stage: (p, u) => {
    let crowd = '', arms = ''; const r = rng(121);
    for (let x = -8; x < 414; x += 23) { const y = 250 + r() * 14; crowd += C(x, y - 8, 10) + `M${x - 17} 300V${n(y + 14)}q0-12 17-12t17 12V300z`; if (r() > 0.55) arms += `M${x + 13} ${n(y + 8)}L${n(x + 24 + r() * 6)} ${n(y - 26)}`; }
    return <>
      <rect width="400" height="300" fill={p.night} />
      <path d="M40 40h1M90 22h1M330 30h1M360 60h1M20 90h1M376 100h1" {...S(p.glass, 2.4)} />
      <path d={R(94, 80, 212, 108)} fill={p.near} />
      <path d={R(100, 86, 200, 96)} fill={p.mid} opacity=".8" />
      <path d={C(200, 134, 30)} fill={p.glass} opacity=".35" />
      {[[120, 66, 150], [200, 66, 200], [280, 66, 250]].map(([x, y, tx], i) => <path key={i} d={P([[x - 4, y], [x + 4, y], [tx + 34, 194], [tx - 34, 194]])} fill={`url(#${u}b)`} opacity=".7" />)}
      <path d={truss([[66, 52], [334, 52]], [[66, 64], [334, 64]], 26) + truss([[66, 52], [66, 200]], [[78, 52], [78, 200]], 14) + truss([[322, 52], [322, 200]], [[334, 52], [334, 200]], 14)} {...S(p.metal, 1.2)} />
      <path d={R(112, 64, 16, 8) + R(192, 64, 16, 8) + R(272, 64, 16, 8)} fill={p.glow} />
      <path d={R(0, 206, 400, 94)} fill={p.near} /><ellipse cx="200" cy="210" rx="190" ry="40" fill={`url(#${u}g)`} opacity=".3" /><path d={R(60, 188, 280, 18)} fill={p.mid} /><path d={R(60, 200, 280, 6)} fill={p.dark} />
      <path d={R(82, 150, 22, 38) + R(296, 150, 22, 38)} fill={p.ink} />
      {person(p, 160, 188, 1.6, { f: p.ink, arm: 'hold' })}{person(p, 200, 188, 1.75, { f: p.ink, arm: 'up' })}{person(p, 244, 188, 1.6, { f: p.ink })}
      <path d="M212 188V160" {...S(p.ink, 1.4)} />
      <path d={crowd} fill={p.ink} />
      <path d={arms} {...S(p.ink, 5.5)} />
    </>;
  },

  market: (p) => {
    const scal = (x0, x1, y) => { let d = `M${x0} ${y}`; for (let x = x0; x < x1; x += 12) d += `a6 6 0 0 0 12 0`; return d; };
    const stall = (x, w, top, i) => { let st = ''; for (let k = 0; k < w; k += 24) st += P([[x + k, top + 22], [x + k + 6 + (k / w) * 0, top], [x + k + 18, top], [x + k + 12, top + 22]]); return <g key={i}>
      <path d={`M${x + 4} ${top + 22}V230M${x + w - 4} ${top + 22}V230`} {...S(p.dark, 2.4)} />
      <path d={R(x + 6, top + 22, w - 12, 46)} fill={p.near} opacity=".35" />
      <path d={P([[x, top + 22], [x + 8, top], [x + w - 8, top], [x + w, top + 22]])} fill={p.win} />
      <path d={grid(x + 4, top, Math.ceil(w / 24), 1, 12, 22, 12)} fill={i === 1 ? p.accent : p.mid} />
      <path d={scal(x, x + w, top + 22) + 'z'} fill={i === 1 ? p.accent : p.mid} />
      <path d={R(x + 2, 192, w - 4, 38)} fill={p.brickDk} />
      <path d={C(x + 16, 188, 6) + C(x + 30, 187, 7) + C(x + 46, 188, 6) + C(x + w - 18, 186, 8)} fill={i === 1 ? p.leaf : p.accent2} />
    </g>; };
    let bulbs = ''; for (let x = 10; x < 400; x += 22) bulbs += C(x, 52 + Math.sin((x / 400) * Math.PI * 2) * 6 + 6, 2.4);
    return <>
      <path d={P([[0, 200], [0, 110], ...sawPts(0, 110, 86, 8, 50), [400, 200]])} fill={p === COLOR ? p.brick : p.far} />
      <path d={grid(10, 124, 13, 2, 16, 20, 14, 10)} fill={p.glass} />
      <path d="M0 56Q100 70 200 56T400 56" {...S(p.dark, 1)} />
      <path d={bulbs} fill={p.glow} />
      {ground(222, p.stone)}
      {stall(16, 118, 124, 0)}{stall(140, 120, 112, 1)}{stall(266, 118, 124, 2)}
      <path d="M0 250H400" {...S(p.ink, 0.8, 0.15)} />
      {person(p, 60, 276, 1.5, { st: p.stone })}{person(p, 160, 268, 1.4, { dress: 1, st: p.stone })}{person(p, 176, 270, 0.9, { st: p.stone })}{person(p, 270, 278, 1.5, { arm: 'hold', st: p.stone })}{person(p, 340, 268, 1.35, { dress: 1, st: p.stone })}
    </>;
  },

  food: (p, u) => {
    const table = (x, y, s) => <g key={x}>
      <path d={`M${x} ${y}V${y + 30 * s}M${x - 10 * s} ${y + 30 * s}H${x + 10 * s}`} {...S(p.dark, 2.4 * s)} />
      <path d={E(x, y, 24 * s, 5 * s)} fill={p.dark} />
      <path d={`M${x - 34 * s} ${y + 30 * s}V${y - 8 * s}M${x - 34 * s} ${y + 6 * s}H${x - 20 * s}V${y + 30 * s}M${x + 34 * s} ${y + 30 * s}V${y - 8 * s}M${x + 34 * s} ${y + 6 * s}H${x + 20 * s}V${y + 30 * s}`} {...S(p.near, 2 * s)} />
      <path d={E(x - 8 * s, y - 2 * s, 5 * s, 2 * s) + E(x + 9 * s, y - 2 * s, 5 * s, 2 * s)} fill={p.win} />
    </g>;
    return <>
      <rect width="400" height="300" fill={p.wall} />
      <path d={R(0, 0, 400, 110)} fill={p.glass} />
      <path d={mullions(0, 0, 400, 110, 10, 3)} {...S(p.ink, 0.9, 0.4)} />
      <path d={R(0, 106, 400, 8)} fill={p.mid} />
      <path d={treeline(110, -10, 410, 8, 12, 131)} fill={p.leafLt} opacity=".5" />
      <path d={R(70, 120, 210, 4) + R(70, 140, 210, 4)} fill={p.near} />
      <path d={grid(78, 126, 13, 1, 6, 14, 10) + grid(84, 146, 12, 1, 8, 12, 9)} fill={p.mid} />
      {ground(214, p.floor)}
      <path d={R(60, 160, 230, 54)} fill={p.near} /><path d={R(54, 156, 242, 8)} fill={p.dark} />
      <path d="M70 176H280M70 196H280" {...S(p.wall, 0.8, 0.3)} />
      {person(p, 168, 180, 1.7, { f: p.dark })}
      {[110, 180, 250].map((x) => <g key={x}><path d={`M${x} 0V58`} {...S(p.dark, 1)} /><path d={P([[x - 12, 72], [x - 5, 58], [x + 5, 58], [x + 12, 72]])} fill={p.dark} /><path d={P([[x - 12, 72], [x + 12, 72], [x + 40, 156], [x - 40, 156]])} fill={`url(#${u}b)`} opacity=".45" /><path d={E(x, 72, 12, 3)} fill={p.glow} /></g>)}
      <path d="M96 214V232M124 214V232M88 214h16M116 214h16M234 214V232M262 214V232M226 214h16M254 214h16" {...S(p.dark, 2)} />
      {person(p, 104, 226, 1.6)}{person(p, 256, 226, 1.6, { dress: 1 })}
      {table(130, 256, 1.6)}{table(300, 252, 1.4)}
      {person(p, 62, 296, 2.1, { st: p.floor })}{person(p, 356, 292, 1.9, { dress: 1, st: p.floor })}
      <path d={R(352, 190, 22, 24)} fill={p.dark} /><path d={C(363, 176, 16) + C(352, 186, 9) + C(374, 184, 10)} fill={p.leaf} />
    </>;
  },

  workshop: (p) => {
    let dots = ''; for (let y = 28; y < 140; y += 12) for (let x = 112; x < 300; x += 12) dots += `M${x} ${y}h.1`;
    return <>
      <rect width="400" height="300" fill={p.wall} />
      <path d={R(16, 30, 70, 100)} fill={p.glass} /><path d={mullions(16, 30, 70, 100, 2, 3)} {...S(p.ink, 0.9, 0.5)} />
      <path d={R(104, 20, 200, 128)} fill={p.stone} />
      <path d={dots} {...S(p.stoneDk, 2.2)} />
      <path d="M128 40V96M120 40h16v10h-16zM160 36l16 16M176 36l-16 16M168 44V100M196 40v58l10 6 10-6V40M240 40l24 50l-4 4l-26-50zM280 40c-10 0-12 14 0 14s10 14 0 14" {...S(p.dark, 2)} />
      <path d={R(316, 40, 74, 4) + R(316, 80, 74, 4) + R(316, 120, 74, 4)} fill={p.near} />
      <path d={grid(320, 26, 4, 1, 12, 14, 6) + grid(322, 64, 3, 1, 16, 16, 8) + grid(320, 104, 4, 1, 12, 16, 6)} fill={p.mid} />
      {ground(210, p.floor)}
      <path d="M200 0V40" {...S(p.dark, 1)} /><path d={P([[184, 54], [192, 40], [208, 40], [216, 54]])} fill={p.dark} />
      <path d={P([[184, 54], [216, 54], [250, 200], [150, 200]])} fill={p.glow} opacity=".3" />
      {person(p, 128, 240, 3.1, { st: p.wall })}{person(p, 200, 236, 3.2, { dress: 1, st: p.wall, f: p.near })}{person(p, 272, 240, 3.1, { st: p.wall })}
      <path d={R(70, 194, 260, 10)} fill={p.brickDk} />
      <path d={R(80, 204, 240, 6)} fill={p.dark} />
      <path d="M86 204V290M314 204V290M86 260H314" {...S(p.dark, 5)} />
      <path d={P([[176, 194], [176, 176], [190, 166], [204, 176], [204, 194]]) + R(112, 186, 40, 8) + R(240, 182, 30, 12)} fill={p.sandDk} />
      <path d={C(190, 180, 3)} fill={p.dark} />
      <path d="M220 190l20 -6M244 184h8" {...S(p.dark, 2.4)} />
    </>;
  },

  kids: (p) => {
    const cube = (x, y, s, i) => <g key={i}><path d={R(x, y, s, s)} fill={[p.accent, p.mid, p.accent2][i % 3]} /><path d={R(x, y, s, s)} {...S(p.ink, 1, 0.5)} /><path d={i % 2 ? C(x + s / 2, y + s / 2, s * 0.22) : P([[x + s * 0.25, y + s * 0.72], [x + s / 2, y + s * 0.28], [x + s * 0.75, y + s * 0.72]])} fill={p.win} /></g>;
    return <>
      {sun(p, 70, 60, 16)}{cloud(p, 200, 40, 0.7)}
      <path d={treeline(200, -10, 410, 9, 16, 141)} fill={p.far} />
      {ground(198, p.ground)}
      <path d={E(200, 262, 210, 50)} fill={p.sand} />
      <path d="M152 206V130M176 206V130M152 140h24M152 154h24M152 168h24M152 182h24M152 196h24" {...S(p.dark, 2)} />
      <path d={R(146, 122, 78, 8)} fill={p.dark} />
      <path d="M196 206V130M222 206V130" {...S(p.dark, 3)} />
      <path d={P([[146, 122], [185, 92], [224, 122]])} fill={p.accent} />
      <path d="M222 128C252 128 262 200 310 206L318 196C272 188 262 120 222 118z" fill={p.mid} />
      <path d="M222 118C262 120 272 188 318 196" {...S(p.dark, 1.4)} />
      {person(p, 196, 122, 0.95, { arm: 'up' })}
      {cube(70, 210, 24, 0)}{cube(96, 210, 24, 1)}{cube(83, 186, 24, 2)}{cube(118, 222, 12, 3)}
      <path d="M300 100Q306 140 296 196M318 86Q314 140 300 196M336 104Q326 150 302 196" {...S(p.dark, 0.9)} />
      <path d={E(300, 86, 12, 15)} fill={p.accent} /><path d={E(320, 70, 12, 15)} fill={p.accent2} /><path d={E(338, 92, 11, 14)} fill={p.mid} />
      <path d={C(296, 80, 3) + C(316, 64, 3) + C(334, 86, 3)} fill={p.win} opacity=".7" />
      {person(p, 298, 232, 1.4, { arm: 'up', dress: 1 })}{person(p, 140, 256, 1.5)}{person(p, 236, 274, 2.1, { st: p.sand })}
    </>;
  },

  'future-city': (p) => {
    const turb = (x, y, s) => <g key={x}><path d={`M${x} ${y}V${y - 60 * s}`} {...S(p.win, 2 * s)} /><path d={`M${x} ${y - 60 * s}l0 ${-26 * s}M${x} ${y - 60 * s}l${22 * s} ${13 * s}M${x} ${y - 60 * s}l${-22 * s} ${13 * s}`} {...S(p.win, 2.4 * s)} /></g>;
    const drone = (x, y) => <g key={x}><path d={`M${x - 12} ${y}H${x + 12}M${x - 10} ${y}v-4M${x + 10} ${y}v-4M${x - 17} ${y - 4}h14M${x + 3} ${y - 4}h14M${x - 4} ${y + 4}l-3 4M${x + 4} ${y + 4}l3 4`} {...S(p.dark, 1.6)} /><path d={R(x - 5, y - 2, 10, 6)} fill={p.dark} /></g>;
    let fins = ''; for (let y = 60; y < 200; y += 10) fins += `M186 ${y}h28`;
    return <>
      <path d="M0 190Q80 160 170 176T400 168V230H0z" fill={p.far} />
      {turb(40, 176, 1)}{turb(76, 168, 0.8)}{turb(360, 166, 0.9)}
      {drone(110, 60)}{drone(300, 44)}
      <path d={P([[184, 220], [184, 60], [200, 20], [216, 60], [216, 220]])} fill={p.glass} />
      <path d={fins + 'M200 20V-4'} {...S(p.dark, 1, 0.5)} />
      <path d="M184 60L200 20L216 60" {...S(p.dark, 1.4)} />
      <path d="M100 220V130Q100 118 112 118H170V220z M232 220V140H300Q312 140 312 152V220z" fill={p.mid} />
      <path d="M100 160H170M100 190H170M232 170H312M232 196H312M120 118V220M146 118V220M256 140V220M284 140V220" {...S(p.win, 1, 0.7)} />
      <path d={treeline(118, 100, 170, 5, 8, 151) + treeline(140, 232, 312, 5, 8, 152)} fill={p.leafDk} />
      <path d="M40 220V176H96V220z M316 220V160H376V220z" fill={p.wall} />
      <path d={P([[44, 176], [60, 166], [92, 166], [92, 176]]) + P([[320, 160], [336, 150], [372, 150], [372, 160]])} fill={p.dark} />
      <path d="M52 166V176M68 166V176M84 166V176M336 150V160M352 150V160" {...S(p.win, 0.8)} />
      <path d={grid(48, 186, 3, 2, 12, 10, 6) + grid(324, 172, 3, 3, 14, 10, 6)} fill={p.glass} />
      {ground(218, p.ground)}
      <path d="M0 236H400" {...S(p.sand, 8)} />
      {tree(p, 30, 270, 1.4)}{tree(p, 130, 262, 1.1)}{tree(p, 280, 264, 1.2)}{tree(p, 370, 272, 1.5)}
      {person(p, 196, 260, 1.1)}{person(p, 214, 262, 1.05, { dress: 1 })}
      <path d="M232 256a6 6 0 1 0 0.1 0M256 256a6 6 0 1 0 0.1 0M232 262l10-10h10l4 10" {...S(p.dark, 1.6)} />
    </>;
  },

  studio: (p, u) => <>
    <rect width="400" height="300" fill={p.near} />
    <path d={R(110, 50, 200, 120)} fill={p.dark} />
    <rect x="116" y="56" width="188" height="108" fill={`url(#${u}s)`} />
    <path d="M116 140Q160 120 210 132T304 126V164H116z" fill={p.far} />
    <path d={P([[170, 150], [170, 128], ...sawPts(170, 128, 118, 3, 22), [236, 150]])} fill={p.mid} />
    <path d={R(116, 150, 188, 14)} fill={p.leaf} />
    <path d={R(196, 170, 28, 6)} fill={p.dark} />
    {ground(228, p.dark)}
    <path d="M60 250L140 228H280L350 250" {...S(p.mid, 1, 0.5)} />
    {person(p, 244, 232, 2.4, { f: p.ink, arm: 'hold' })}
    <path d="M60 300L82 214L104 300M82 214V300" {...S(p.ink, 2.4)} />
    <path d={R(58, 186, 52, 30) + R(108, 192, 20, 18) + R(64, 176, 18, 10)} fill={p.ink} />
    <path d={C(132, 201, 9)} fill={p.glass} />
    <path d="M330 300V140M320 300H340" {...S(p.ink, 2)} />
    <path d={P([[312, 96], [372, 76], [380, 120], [322, 136]])} fill={p.win} />
    <path d={P([[322, 136], [312, 96], [180, 150], [210, 230]])} fill={`url(#${u}b)`} opacity=".35" />
    <path d="M290 300V200M290 200L270 182" {...S(p.ink, 1.8)} />
    <path d={E(268, 180, 4, 7)} fill={p.ink} />
    <circle cx="70" cy="183" r="3" fill={p.accent} />
  </>,

  'map-old': (p) => {
    let st = ''; for (let i = 0; i < 9; i++) st += `M${40 + i * 40} 24L${30 + i * 40} 276`; for (let j = 0; j < 7; j++) st += `M24 ${50 + j * 36}L376 ${44 + j * 36}`;
    const r = rng(161); let bl = ''; for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) if (r() > 0.35) { const x = 44 + i * 40 - j * 1.5, y = 54 + j * 36 - i * 0.6; if (x + 28 < 372 && y + 24 < 276) bl += R(x, y, 28, 24); }
    let park = ''; for (let i = 0; i < 9; i++) park += C(286 + (i % 3) * 12, 70 + Math.floor(i / 3) * 12, 4);
    return <>
      <rect width="400" height="300" fill={p.stoneDk} />
      <rect x="12" y="10" width="376" height="280" fill={p.paper} />
      <path d={bl} fill={p.sandDk} opacity=".55" />
      <path d={st} {...S(p.ink, 1, 0.45)} />
      <path d={R(272, 56, 54, 46)} fill={p.paper} /><path d={R(276, 58, 46, 40)} fill={p.leafLt} opacity=".6" /><path d={park} fill={p.leaf} />
      <path d="M12 220C80 200 120 250 180 228S260 140 320 160S370 200 388 190" {...S(p.waterDk, 16, 0.8)} />
      <path d="M12 220C80 200 120 250 180 228S260 140 320 160S370 200 388 190" {...S(p.ink, 0.8, 0.5)} transform="translate(0 -8)" />
      <path d="M12 220C80 200 120 250 180 228S260 140 320 160S370 200 388 190" {...S(p.ink, 0.8, 0.5)} transform="translate(0 8)" />
      <path d="M12 120Q160 100 240 70T388 40" {...S(p.ink, 2.2)} />
      <path d="M12 120Q160 100 240 70T388 40" fill="none" stroke={p.ink} stroke-width="7" stroke-dasharray="1.2 6" />
      <path d={C(200, 150, 20)} fill={p.paper} opacity=".85" /><path d={C(200, 150, 20)} {...S(p.ink, 1)} />
      <path d="M200 124L205 150L200 176L195 150zM174 150L200 145L226 150L200 155z" fill={p.ink} opacity=".8" />
      <path d={R(40, 262, 20, 5) + R(80, 262, 20, 5)} fill={p.ink} /><path d={R(40, 262, 80, 5)} {...S(p.ink, 0.8)} />
      <path d={R(18, 16, 364, 268)} {...S(p.ink, 2)} /><path d={R(23, 21, 354, 258)} {...S(p.ink, 0.6)} />
      <path d="M200 10V290M12 150H388" {...S(p.dark, 1, 0.18)} />
    </>;
  },
};

let seq = 0;
/** <Illustration id tone class title /> – SVG wypełniające rodzica (preserveAspectRatio slice). */
export function Illustration({ id, tone = 'duotone', class: cls, title }) {
  if (isMediaRef(id)) return <MediaFrame id={id} tone={tone} cls={cls} title={title} />;
  return <IllustrationSvg id={id} tone={tone} cls={cls} title={title} />;
}
/**
 * Plik z biblioteki mediów („media:<id>”) w kadrze ilustracji: obraz → <img> (object-fit: cover),
 * wideo → pierwsza klatka filmu; brak pliku / błąd wczytania → ilustracja domyślna.
 */
function MediaFrame({ id, tone, cls, title }) {
  const [bad, setBad] = useState(null); const m = mediaItem(id); const url = m && mediaUrl(m);
  const c = `fpz-ill fpz-ill--file${cls ? ' ' + cls : ''}`; const alt = title || m?.alt?.pl || m?.name || '';
  if (url && bad !== url) {
    if (m.type === 'image') return <img class={c} src={url} alt={alt} loading="lazy" decoding="async" onError={() => setBad(url)} />;
    if (m.type === 'video') return <video class={c} src={url + '#t=0.5'} muted playsinline preload="metadata" aria-label={alt} role="img" onError={() => setBad(url)} />;
  }
  return <IllustrationSvg id="hall-exterior" tone={tone} cls={cls} title={title} />;
}
function IllustrationSvg({ id, tone = 'duotone', cls, title }) {
  const u = useMemo(() => `ill${(++seq).toString(36)}-`, []);
  const t = tone === 'archival' || tone === 'color' ? tone : 'duotone';
  const p = pal(t);
  const scene = SCENES[id] || SCENES['hall-exterior'];
  return (
    <svg class={`fpz-ill ill-${t}${cls ? ' ' + cls : ''}`} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label={title || ILLUSTRATION_LABELS[id] || ILLUSTRATION_LABELS['hall-exterior']}>
      <defs>
        <linearGradient id={u + 's'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={p.sky1} /><stop offset="1" stop-color={p.sky0} /></linearGradient>
        <linearGradient id={u + 'w'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={p.water} /><stop offset="1" stop-color={p.waterDk} /></linearGradient>
        <linearGradient id={u + 'b'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={p.glow} stop-opacity=".9" /><stop offset="1" stop-color={p.glow} stop-opacity="0" /></linearGradient>
        <radialGradient id={u + 'g'}><stop offset="0" stop-color={p.glow} stop-opacity="1" /><stop offset="1" stop-color={p.glow} stop-opacity="0" /></radialGradient>
        {t === 'archival' && <radialGradient id={u + 'v'} cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color={p.ink} stop-opacity="0" /><stop offset="1" stop-color={p.ink} stop-opacity=".45" /></radialGradient>}
      </defs>
      {sky(u)}
      {scene(p, u)}
      {t === 'archival' && <rect width="400" height="300" fill={`url(#${u}v)`} />}
    </svg>
  );
}
