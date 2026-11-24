// Mapy wspólne (aplikacja, WWW, kioski, CMS): SitePlan – plan terenu FPŻ (aksonometria / rzut), CityMap – schematyczna mapa Dąbrowy Górniczej.
// Przesuwanie/zoom: transformacja jednej grupy SVG (bez przerysowywania geometrii); znaczniki i etykiety mają stały rozmiar ekranowy
// dzięki zmiennym CSS --inv (1/zoom) i --mu (bazowy rozmiar pisma końcówki / 16) ustawianym imperatywnie.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore, useStoreVersion } from '../kernel/store.js';
import { useClient } from '../kernel/client.jsx';
import { strings } from '../kernel/i18n.js';
import { Icon, IconButton } from './components.jsx';
import './maps.css';

strings({
  'map.sitePlan': ['Plan terenu Fabryki Pełnej Życia', 'Factory Full of Life site plan'],
  'map.cityMap': ['Mapa schematyczna Dąbrowy Górniczej', 'Schematic map of Dąbrowa Górnicza'],
  'map.hint': ['Przeciągnij, aby przesunąć; kółko, gest szczypania lub klawisze + i − zmieniają powiększenie; strzałki przesuwają mapę.', 'Drag to pan; use the wheel, a pinch or the + and − keys to zoom; arrow keys move the map.'],
  'map.zoomIn': ['Przybliż', 'Zoom in'], 'map.zoomOut': ['Oddal', 'Zoom out'], 'map.center': ['Wyśrodkuj mapę', 'Re-centre the map'],
  'map.yourPosition': ['Twoja pozycja', 'Your position'], 'map.favorite': ['ulubione', 'favourite'], 'map.selected': ['wybrane', 'selected'],
  'map.stop': ['przystanek {n}', 'stop {n}'], 'map.entrance': ['Wejście', 'Entrance'],
  'map.visited': ['odwiedzona', 'visited'], 'map.notVisited': ['jeszcze nieodwiedzona', 'not visited yet'],
  'map.districtsProgress': ['Dzielnice: {n} z {total}', 'Districts: {n} of {total}'], 'map.district': ['Dzielnica {name}', 'District {name}'],
  'map.fpzNode': ['Fabryka Pełna Życia – przybliż teren', 'Factory Full of Life – zoom in on the site'],
  'map.roledesc': ['mapa', 'map'], 'map.legend': ['Legenda', 'Legend'], 'map.north': ['Północ', 'North'], 'map.route': ['Trasa', 'Route'],
  'map.kind.fpz': ['Teren FPŻ', 'FPŻ site'], 'map.kind.nature': ['Przyroda', 'Nature'], 'map.kind.park': ['Park', 'Park'], 'map.kind.tree': ['Pomnik przyrody', 'Monument tree'],
  'map.kind.industry': ['Przemysł', 'Industry'], 'map.kind.history': ['Historia', 'History'], 'map.kind.culture': ['Kultura', 'Culture'],
  'map.kind.hall': ['Hala', 'Hall'], 'map.kind.spot': ['Miejsce', 'Spot'], 'map.kind.service': ['Usługi', 'Services'],
  'map.water': ['Woda', 'Water'], 'map.forest': ['Las', 'Forest'], 'map.rail': ['Kolej', 'Railway'], 'map.road': ['Główna droga', 'Main road'],
});

/* ───────────── narzędzia geometryczne ───────────── */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const dPoly = (p) => (p.length ? 'M' + p.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z' : '');
const dLine = (p) => (p.length ? 'M' + p.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') : '');
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function chaikin(poly, it = 2) { let p = poly; for (let k = 0; k < it; k++) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } p = o; } return p; }
/** Półpłaszczyzna bliższa punktowi a niż b (komórka Voronoi). */
function clipHalf(poly, a, b) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
  const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny; const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
function centroid(poly) { let a = 0, x = 0, y = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], c = p[0] * q[1] - q[0] * p[1]; a += c; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c; } return Math.abs(a) < 1e-9 ? poly[0] || [0, 0] : [x / (3 * a), y / (3 * a)]; }
const area = (poly) => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
function inPoly(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
/** Nieregularna, wygładzona plama (jezioro, piasek, las) – deterministyczna. */
function blob(cx, cy, rx, ry, seed, n = 9, rot = 0) {
  const r = rng(seed), p = []; const ca = Math.cos(rot), sa = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.72 + r() * 0.5; const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k; p.push([cx + x * ca - y * sa, cy + x * sa + y * ca]); }
  return chaikin(p, 2);
}
/** Krótka etykieta na mapę (pełna nazwa zostaje w aria-label i przy wyborze). */
const shortName = (txt, max = 28) => { let t = String(txt || '').replace(/\s*\(.*?\)\s*/g, ' ').split(' – ')[0].trim(); if (t.length > max) t = t.slice(0, max - 1).replace(/[\s,.-]+\S*$/, '') + '…'; return t; };
const estW = (text, fs) => text.length * fs * 0.56 + 6;
/** Rozmieszczenie etykiet bez nakładania (zachłannie wg priorytetu); pozycje ekranowe względne (przesunięcie nie ma znaczenia). */
function placeLabels(cands, k, mu, obstacles = []) {
  const boxes = obstacles.map((o) => ({ x0: o.x * k - o.r * mu, x1: o.x * k + o.r * mu, y0: o.y * k - o.r * mu, y1: o.y * k + o.r * mu }));
  const shown = new Set();
  const hit = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  for (const c of [...cands].sort((a, b) => (b.force ? 1e9 : b.pr) - (a.force ? 1e9 : a.pr))) {
    const sx = c.x * k + (c.dx || 0) * mu, sy = c.y * k + (c.dy || 0) * mu, w = c.w * mu, h = (c.h || 13) * mu;
    const x0 = c.align === 'start' ? sx : c.align === 'end' ? sx - w : sx - w / 2;
    const b = { x0: x0 - 2, x1: x0 + w + 2, y0: sy - h * 0.8, y1: sy + h * 0.3 };
    if (!c.force && hit(b)) continue;
    boxes.push(b); shown.add(c.id);
  }
  return shown;
}
let UID = 0;
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/* ───────────── wspólny mechanizm przesuwania i powiększania ───────────── */
/**
 * opts: bounds [x0,y0,x1,y1] (kadr „całość”), limit (obszar, poza który nie wolno wyjechać), boundsKey, maxZoom, initial() → {cx,cy,rel}|null
 * Zwraca: rootRef, gRef, S (stan bieżący: k, tx, ty, fitK, w, h, mu), zb (koszyk powiększenia – zmienia się co ½ kroku log2), handlers, akcje.
 */
function usePanZoom(opts) {
  const rootRef = useRef(null), gRef = useRef(null), O = useRef(opts); O.current = opts;
  const S = useRef(null); if (!S.current) S.current = { k: 1, tx: 0, ty: 0, fitK: 1, w: 0, h: 0, mu: 1, zb: 0, inited: false, touched: false, ptrs: new Map(), start: null, pinch: null, moved: false, suppress: false, anim: 0, listeners: new Set(), dragging: false };
  const s = S.current;
  const [zb, setZb] = useState(0); const [size, setSize] = useState({ w: 0, h: 0, mu: 1 });

  const fitK = () => { const [x0, y0, x1, y1] = O.current.bounds; const kx = s.w / Math.max(1e-6, x1 - x0), ky = s.h / Math.max(1e-6, y1 - y0);
    return Math.max(1e-6, Math.min(Math.min(kx, ky) * (O.current.pad || 0.9) * (O.current.fill || 1), Math.max(kx, ky))); };
  const kMin = () => s.fitK * (O.current.minZoom || 0.6), kMax = () => s.fitK * (O.current.maxZoom || 8);
  const centerOn = (cx, cy, k) => { s.k = k; s.tx = s.w / 2 - cx * k; s.ty = s.h / 2 - cy * k; };
  const viewCenter = () => [(s.w / 2 - s.tx) / s.k, (s.h / 2 - s.ty) / s.k];
  const clampView = () => {
    s.k = clamp(s.k, kMin(), kMax());
    const [x0, y0, x1, y1] = O.current.limit || O.current.bounds; const [cx, cy] = viewCenter();
    const nx = clamp(cx, x0, x1), ny = clamp(cy, y0, y1); if (nx !== cx || ny !== cy) centerOn(nx, ny, s.k);
  };
  const apply = () => {
    const g = gRef.current, r = rootRef.current; if (!g || !r || !s.w) return;
    g.setAttribute('transform', `translate(${s.tx.toFixed(2)} ${s.ty.toFixed(2)}) scale(${s.k.toPrecision(6)})`);
    r.style.setProperty('--inv', (1 / s.k).toPrecision(6));
    s.listeners.forEach((fn) => fn(s));
    const b = Math.round(Math.log2(s.k / s.fitK) * 2) / 2; if (b !== s.zb) { s.zb = b; setZb(b); }
  };
  const initialView = () => { const iv = O.current.initial?.(s); const [x0, y0, x1, y1] = O.current.bounds; if (iv) centerOn(iv.cx, iv.cy, s.fitK * (iv.rel || 1)); else centerOn((x0 + x1) / 2, (y0 + y1) / 2, s.fitK); clampView(); };
  const stopAnim = () => { if (s.anim) cancelAnimationFrame(s.anim); s.anim = 0; };
  const animateTo = (cx, cy, k, ms = 320) => {
    stopAnim(); k = clamp(k, kMin(), kMax());
    if (!s.w) return; if (reducedMotion() || ms <= 0) { centerOn(cx, cy, k); clampView(); apply(); return; }
    const [sx, sy] = viewCenter(), sk = s.k, t0 = performance.now();
    const step = (now) => { const t = clamp((now - t0) / ms, 0, 1), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      centerOn(sx + (cx - sx) * e, sy + (cy - sy) * e, sk * Math.pow(k / sk, e)); clampView(); apply(); s.anim = t < 1 ? requestAnimationFrame(step) : 0; };
    s.anim = requestAnimationFrame(step);
  };
  const toLocal = (e) => { const r = rootRef.current.getBoundingClientRect(); return { x: (e.clientX - r.left) * (r.width ? s.w / r.width : 1), y: (e.clientY - r.top) * (r.height ? s.h / r.height : 1) }; };
  const toWorld = (p) => [(p.x - s.tx) / s.k, (p.y - s.ty) / s.k];
  const zoomAt = (p, f) => { stopAnim(); const [wx, wy] = toWorld(p); s.k = clamp(s.k * f, kMin(), kMax()); s.tx = p.x - wx * s.k; s.ty = p.y - wy * s.k; clampView(); s.touched = true; apply(); };
  const zoomBy = (f) => { const [cx, cy] = viewCenter(); s.touched = true; animateTo(cx, cy, s.k * f, 220); };
  const reset = () => { s.touched = false; const iv = O.current.initial?.(s); const [x0, y0, x1, y1] = O.current.bounds; if (iv) animateTo(iv.cx, iv.cy, s.fitK * (iv.rel || 1)); else animateTo((x0 + x1) / 2, (y0 + y1) / 2, s.fitK); };
  const ensureVisible = (wx, wy, margin = 40) => { const x = wx * s.k + s.tx, y = wy * s.k + s.ty; if (x < margin || y < margin || x > s.w - margin || y > s.h - margin) animateTo(wx, wy, s.k, 250); };

  // rozmiar kontenera (także po odkryciu z display:none) i rozmiar pisma końcówki
  const measure = () => {
    const el = rootRef.current; if (!el) return; const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    const mu = Math.round(((parseFloat(getComputedStyle(el).fontSize) || 16) / 16) * 1000) / 1000;
    if (w === s.w && h === s.h && mu === s.mu && s.inited) return;
    el.style.setProperty('--mu', String(mu));
    if (!s.inited) { s.w = w; s.h = h; s.mu = mu; s.fitK = fitK(); initialView(); s.inited = true; }
    else { const [cx, cy] = viewCenter(), rel = s.k / s.fitK; s.w = w; s.h = h; s.mu = mu; s.fitK = fitK(); if (s.touched) centerOn(cx, cy, s.fitK * rel); else initialView(); clampView(); }
    apply(); setSize({ w, h, mu });
  };
  useLayoutEffect(() => { const ro = new ResizeObserver(measure); ro.observe(rootRef.current); measure(); return () => { ro.disconnect(); stopAnim(); }; }, []);
  useLayoutEffect(() => { measure(); }); // zmiana skali tekstu (A↑/A↓) nie zmienia rozmiaru kontenera
  useLayoutEffect(() => { if (!s.inited) return; s.fitK = fitK(); s.touched = false; initialView(); apply(); }, [opts.boundsKey]);
  useEffect(() => {
    const el = rootRef.current;
    const onWheel = (e) => { if (e.target.closest?.('.map-callout, .map-legend')) return; e.preventDefault(); const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY; zoomAt(toLocal(e), Math.exp(-clamp(dy, -300, 300) * 0.0018)); };
    el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const pinchInfo = () => { const [a, b] = [...s.ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; };
  const handlers = {
    onPointerDown: (e) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest?.('.map-ui')) return;
      stopAnim(); const p = toLocal(e); s.ptrs.set(e.pointerId, p);
      if (s.ptrs.size === 1) { s.start = { x: p.x, y: p.y, tx: s.tx, ty: s.ty, id: e.pointerId }; s.moved = false; }
      else if (s.ptrs.size === 2) { const { d, m } = pinchInfo(); s.pinch = { d, m, k: s.k, w: toWorld(m) }; s.moved = true; for (const id of s.ptrs.keys()) { try { rootRef.current.setPointerCapture(id); } catch { /* wskaźnik już zwolniony */ } } }
    },
    onPointerMove: (e) => {
      if (!s.ptrs.has(e.pointerId)) return; const p = toLocal(e); s.ptrs.set(e.pointerId, p);
      if (s.ptrs.size >= 2 && s.pinch) {
        const { d, m } = pinchInfo(); s.k = clamp(s.pinch.k * (d / s.pinch.d), kMin(), kMax()); s.tx = m.x - s.pinch.w[0] * s.k; s.ty = m.y - s.pinch.w[1] * s.k; clampView(); s.touched = true; apply(); return;
      }
      const st = s.start; if (!st) return; const dx = p.x - st.x, dy = p.y - st.y;
      if (!s.moved && Math.hypot(dx, dy) > 6) { s.moved = true; s.dragging = true; rootRef.current.classList.add('is-dragging'); try { rootRef.current.setPointerCapture(e.pointerId); } catch { /* nic */ } }
      if (s.moved) { s.tx = st.tx + dx; s.ty = st.ty + dy; clampView(); s.touched = true; apply(); }
    },
    onPointerUp: (e) => end(e), onPointerCancel: (e) => end(e),
    onClickCapture: (e) => { if (s.suppress) { e.stopPropagation(); e.preventDefault(); } },
    onKeyDown: (e) => {
      if (e.target !== rootRef.current) return; const st = 60;
      const mv = { ArrowLeft: [st, 0], ArrowRight: [-st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
      if (mv) { e.preventDefault(); stopAnim(); s.tx += mv[0]; s.ty += mv[1]; clampView(); s.touched = true; apply(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.5); } else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / 1.5); } else if (e.key === '0') { e.preventDefault(); reset(); }
    },
  };
  function end(e) {
    if (!s.ptrs.has(e.pointerId)) return; s.ptrs.delete(e.pointerId);
    if (s.ptrs.size === 1) { const [id, p] = [...s.ptrs.entries()][0]; s.start = { x: p.x, y: p.y, tx: s.tx, ty: s.ty, id }; s.pinch = null; return; }
    if (s.ptrs.size === 0) {
      if (s.moved) { s.suppress = true; setTimeout(() => { s.suppress = false; }, 0); }
      s.start = null; s.pinch = null; s.dragging = false; rootRef.current?.classList.remove('is-dragging');
    }
  }
  return { rootRef, gRef, S: s, zb, size, handlers, zoomBy, reset, animateTo, toLocal, toWorld, ensureVisible, apply };
}

/** Dymek HTML zakotwiczony w punkcie świata (+ przesunięcie w jednostkach projektowych); mieści się w kadrze. */
function useCallout(pz, anchor, dep) {
  const ref = useRef(null); const A = useRef(anchor); A.current = anchor;
  useLayoutEffect(() => {
    const place = (s) => {
      const el = ref.current, a = A.current; if (!el) return; if (!a) { el.style.visibility = 'hidden'; return; }
      const px = a.x * s.k + s.tx, py = a.y * s.k + s.ty - (a.up || 0) * s.mu; const w = el.offsetWidth, h = el.offsetHeight, m = 8;
      const out = px < -20 || py < -20 || px > s.w + 20 || py > s.h + 20 + (a.up || 0) * s.mu;
      let x = px + 14 * s.mu, y = py - h - 6 * s.mu;
      if (x + w > s.w - m) x = px - w - 14 * s.mu; if (x < m) x = clamp(px - w / 2, m, Math.max(m, s.w - w - m));
      if (y < m) y = Math.min(py + 18 * s.mu, s.h - h - m); y = clamp(y, m, Math.max(m, s.h - h - m));
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; el.style.visibility = out ? 'hidden' : 'visible';
    };
    pz.S.listeners.add(place); place(pz.S); return () => pz.S.listeners.delete(place);
  });
  return ref;
}

/** Po zmianie wyboru przesuwa mapę tak, by dymek zmieścił się nad obiektem (bez zasłaniania go). */
function useCalloutPan(pz, cRef, anchor, key) {
  const A = useRef(anchor); A.current = anchor;
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const s = pz.S, a = A.current, el = cRef.current; if (!a || !el || !s.w) return;
      const ch = el.offsetHeight, cw = el.offsetWidth, up = (a.up || 0) * s.mu; const px = a.x * s.k + s.tx, py = a.y * s.k + s.ty - up;
      const needY = ch + 24 * s.mu; const fitsSide = px + 14 * s.mu + cw < s.w - 8 || px - 14 * s.mu - cw > 8;
      if (py >= needY && py < s.h - 30 * s.mu && px > 30 && px < s.w - 30 && (fitsSide || py >= needY)) return;
      const ty = clamp(needY + up + 10 * s.mu, s.h * 0.35, s.h - 40 * s.mu); const tx = s.w / 2;
      s.touched = true; pz.animateTo(a.x + (s.w / 2 - tx) / s.k, a.y + (s.h / 2 - ty) / s.k, s.k, 300);
    });
    return () => cancelAnimationFrame(id);
  }, [key, pz.size.w > 0]);
}

function Controls({ pz, t }) {
  return (<div class="map-ui map-controls" role="group" aria-label={t('map.zoomIn') + ' / ' + t('map.zoomOut')}>
    <IconButton icon="zoomIn" variant="mint" label={t('map.zoomIn')} onClick={() => pz.zoomBy(1.6)} />
    <IconButton icon="zoomOut" variant="mint" label={t('map.zoomOut')} onClick={() => pz.zoomBy(1 / 1.6)} />
    <IconButton icon="target" variant="mint" label={t('map.center')} onClick={() => pz.reset()} />
  </div>);
}
const keyAct = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
const KIND_ICON = { hall: 'building', spot: 'star', nature: 'leaf', park: 'tree', tree: 'tree', industry: 'factory', history: 'history', culture: 'book', service: 'info' };
const Heart = ({ x = 0, y = 0 }) => <path class="map-heart" transform={`translate(${x} ${y})`} d="M0 3.2C-1.6 1.2-5 .9-5-1.9c0-1.6 1.2-2.7 2.6-2.7 1 0 1.8.6 2.4 1.4.6-.8 1.4-1.4 2.4-1.4 1.4 0 2.6 1.1 2.6 2.7C5 .9 1.6 1.2 0 3.2z" />;

/* ═════════════ SitePlan – plan terenu FPŻ ═════════════ */
const TH = Math.PI / 6, IC = Math.cos(TH), IS = Math.sin(TH), TILT = 0.58, ZF = 1.45; // aksonometria: obrót 30°, pochylenie, skala wysokości
const SHADOW = [-0.75, 0.45]; // przesunięcie cienia na metr wysokości (zachód-południe)

function buildSite(s, view, list) {
  const sp = s.sitePlan || {}; const W = sp.widthM || 300, H = sp.heightM || 220, ux = W / 100, uy = H / 100; const iso = view === 'iso';
  const P = iso ? (x, y, z = 0) => [x * IC - y * IS, (x * IS + y * IC) * TILT - z * ZF] : (x, y) => [x, y];
  const ground = iso ? `matrix(${IC} ${IS * TILT} ${-IS} ${IC * TILT} 0 0)` : null;
  const M = (pt) => [pt[0] * ux, pt[1] * uy];
  // budynki POI
  const boxes = []; const byId = {};
  for (const p of list) {
    const b = p.building; if (!p.site || !b || !b.w || !b.d) continue;
    const cx = p.site.x * ux, cy = p.site.y * uy, hw = (b.w * ux) / 2, hd = (b.d * uy) / 2;
    const ind = b.roof !== 'flat' || p.kind === 'hall'; const fh = ind ? 5.5 : 3.5;
    const box = { id: p.id, poi: p, x0: cx - hw, x1: cx + hw, y0: cy - hd, y1: cy + hd, h: Math.max(1, b.floors || 1) * fh, floors: Math.max(1, b.floors || 1), roof: b.roof || 'flat', ind };
    boxes.push(box); byId[p.id] = box;
  }
  // bryły kontekstu miejskiego (deterministyczne, nie są POI)
  const R = rng(hash('fpz-context-v2')); const E = [-78, -54, -30, -8, 108, 130, 154, 178]; const ctx = []; const ctxStreets = [];
  for (const e of [-30, -54, 130, 154]) { ctxStreets.push([[e, E[0]], [e, E[E.length - 1]]], [[E[0], e], [E[E.length - 1], e]]); }
  for (let i = 0; i < E.length - 1; i++) for (let j = 0; j < E.length - 1; j++) {
    if (E[i] === -8 && E[j] === -8) continue;
    const cx0 = E[i] + 3, cx1 = E[i + 1] - 3, cy0 = E[j] + 3, cy1 = E[j + 1] - 3; if (cx1 - cx0 < 8 || cy1 - cy0 < 8) continue;
    let x = cx0; while (x < cx1 - 7) {
      const w = Math.min(cx1 - x, 7 + R() * 11); const dd = Math.min(cy1 - cy0, 6 + R() * 12); const y = cy0 + R() * Math.max(0, cy1 - cy0 - dd);
      if (R() < 0.85) { const fl = 2 + Math.floor(R() * 4); ctx.push({ id: 'ctx' + ctx.length, x0: x * ux, x1: (x + w) * ux, y0: y * uy, y1: (y + dd) * uy, h: fl * 3.3, floors: fl, roof: R() < 0.22 ? 'gable' : 'flat', ctx: true }); }
      x += w + 2 + R() * 4;
    }
  }
  // drzewa w zieleni
  const greens = (sp.greens || []).map((g) => ({ name: g.name, poly: (g.points || []).map(M) })).filter((g) => g.poly.length > 2);
  const trees = []; const all = boxes.concat(ctx);
  const freeAt = (x, y) => !all.some((b) => x > b.x0 - 4 && x < b.x1 + 4 && y > b.y0 - 4 && y < b.y1 + 4);
  greens.forEach((g, gi) => {
    const r = rng(hash('tree' + gi + g.name)); const xs = g.poly.map((q) => q[0]), ys = g.poly.map((q) => q[1]);
    const n = clamp(Math.round(area(g.poly) / 380), 2, 16); let tries = 0, made = 0;
    while (made < n && tries++ < n * 12) { const x = Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + r() * (Math.max(...ys) - Math.min(...ys)); if (inPoly([x, y], g.poly) && freeAt(x, y) && !trees.some((t) => Math.hypot(t.x - x, t.y - y) < 9)) { trees.push({ id: 't' + trees.length, x, y, x0: x, x1: x, y0: y, y1: y, h: 6 + r() * 3, tree: true }); made++; } }
  });
  // ulice
  const streets = (sp.streets || []).map((st) => ({ name: st.name, pts: (st.points || []).map(M) })).filter((st) => st.pts.length > 1);
  const ctxSt = ctxStreets.map((l) => l.map(M));
  // geometria brył
  const items = all.concat(iso ? trees : []);
  const faces = (b) => {
    const { x0, x1, y0, y1, h } = b; const out = [];
    if (!iso) {
      out.push({ d: dPoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), c: 'map-roof' });
      let rl = '';
      if (b.roof === 'gable') { if (x1 - x0 >= y1 - y0) rl = dLine([[x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]]); else rl = dLine([[(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]]); }
      else if (b.roof === 'sawtooth') { const n = Math.max(2, Math.round((y1 - y0) / 9)); for (let i = 1; i < n; i++) { const y = y0 + ((y1 - y0) * i) / n; rl += dLine([[x0, y], [x1, y]]); } }
      else { const m = Math.min(1.5, (x1 - x0) / 6, (y1 - y0) / 6); rl = dPoly([[x0 + m, y0 + m], [x1 - m, y0 + m], [x1 - m, y1 - m], [x0 + m, y1 - m]]); }
      out.push({ d: rl, c: 'map-roofline' }); return out;
    }
    out.push({ d: dPoly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)]), c: 'map-wall-s' });
    out.push({ d: dPoly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)]), c: 'map-wall-e' });
    // rytm okien – jedna ścieżka na bryłę
    let wd = ''; const fh = h / b.floors;
    const row = (len, f, put) => {
      const sp2 = b.ind ? 4.6 : 3.4, ww = b.ind ? 2.4 : 1.4; const n = Math.floor((len - 1.5) / sp2); if (n < 1) return; const off = (len - n * sp2) / 2 + (sp2 - ww) / 2;
      const z0 = f * fh + fh * (b.ind ? 0.22 : 0.3), z1 = (f + 1) * fh - fh * (b.ind ? 0.16 : 0.25);
      for (let i = 0; i < n; i++) { const u = off + i * sp2; wd += dPoly([put(u, z0), put(u + ww, z0), put(u + ww, z1), put(u, z1)]); }
    };
    for (let f = 0; f < b.floors; f++) { row(x1 - x0, f, (u, z) => P(x0 + u, y1, z)); row(y1 - y0, f, (u, z) => P(x1, y0 + u, z)); }
    if (wd) out.push({ d: wd, c: 'map-win' });
    if (b.roof === 'sawtooth') {
      const n = Math.max(2, Math.round((y1 - y0) / 9)), st = (y1 - y0) / n, th = Math.min(3.6, h * 0.55);
      for (let i = 0; i < n; i++) { const ya = y0 + i * st, yb = ya + st;
        out.push({ d: dPoly([P(x0, ya, h), P(x1, ya, h), P(x1, yb, h + th), P(x0, yb, h + th)]), c: 'map-roof' });
        out.push({ d: dPoly([P(x0, yb, h), P(x1, yb, h), P(x1, yb, h + th), P(x0, yb, h + th)]), c: 'map-glass' });
        out.push({ d: dPoly([P(x1, ya, h), P(x1, yb, h), P(x1, yb, h + th)]), c: 'map-wall-e' }); }
      b.top = h + th;
    } else if (b.roof === 'gable') {
      if (x1 - x0 >= y1 - y0) { const ym = (y0 + y1) / 2, rh = Math.min((y1 - y0) * 0.32, 7);
        out.push({ d: dPoly([P(x0, y0, h), P(x1, y0, h), P(x1, ym, h + rh), P(x0, ym, h + rh)]), c: 'map-roof-2' });
        out.push({ d: dPoly([P(x0, ym, h + rh), P(x1, ym, h + rh), P(x1, y1, h), P(x0, y1, h)]), c: 'map-roof' });
        out.push({ d: dPoly([P(x1, y0, h), P(x1, y1, h), P(x1, ym, h + rh)]), c: 'map-wall-e' }); b.top = h + rh;
      } else { const xm = (x0 + x1) / 2, rh = Math.min((x1 - x0) * 0.32, 7);
        out.push({ d: dPoly([P(x0, y0, h), P(xm, y0, h + rh), P(xm, y1, h + rh), P(x0, y1, h)]), c: 'map-roof' });
        out.push({ d: dPoly([P(xm, y0, h + rh), P(x1, y0, h), P(x1, y1, h), P(xm, y1, h + rh)]), c: 'map-roof-2' });
        out.push({ d: dPoly([P(x0, y1, h), P(x1, y1, h), P(xm, y1, h + rh)]), c: 'map-wall-s' }); b.top = h + rh; }
    } else {
      out.push({ d: dPoly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)]), c: 'map-roof' });
      const m = Math.min(0.9, (x1 - x0) / 6, (y1 - y0) / 6); out.push({ d: dPoly([P(x0 + m, y0 + m, h), P(x1 - m, y0 + m, h), P(x1 - m, y1 - m, h), P(x0 + m, y1 - m, h)]), c: 'map-roofline' }); b.top = h;
    }
    return out;
  };
  for (const b of all) { b.faces = faces(b); if (b.top == null) b.top = b.h; }
  // sortowanie głębi (topologiczne, krawędzie tylko dla par nachodzących na ekranie)
  let order = items;
  if (iso) {
    const sb = items.map((b) => { const c = b.tree ? [P(b.x, b.y, 0), P(b.x, b.y, b.h + 3)] : [P(b.x0, b.y0, 0), P(b.x1, b.y0, 0), P(b.x0, b.y1, 0), P(b.x1, b.y1, 0), P(b.x0, b.y0, b.top), P(b.x1, b.y1, b.top)];
      const xs = c.map((q) => q[0]), ys = c.map((q) => q[1]); const pad = b.tree ? 4 : 0; return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; });
    const depth = (b) => ((b.x0 + b.x1) / 2) * IS + ((b.y0 + b.y1) / 2) * IC;
    const behind = (a, b) => { if (a.x1 <= b.x0 && !(b.y1 <= a.y0)) return true; if (b.x1 <= a.x0 && !(a.y1 <= b.y0)) return false; if (a.y1 <= b.y0 && !(b.x1 <= a.x0)) return true; if (b.y1 <= a.y0 && !(a.x1 <= b.x0)) return false; return depth(a) < depth(b); };
    const n = items.length, before = items.map(() => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = sb[i], B = sb[j]; if (A[0] >= B[2] || B[0] >= A[2] || A[1] >= B[3] || B[1] >= A[3]) continue;
      if (behind(items[i], items[j])) before[j].push(i); else before[i].push(j);
    }
    const idx = items.map((_, i) => i).sort((a, b) => depth(items[a]) - depth(items[b])); const mark = new Uint8Array(n); order = [];
    const visit = (i) => { if (mark[i]) return; mark[i] = 1; for (const j of before[i]) visit(j); order.push(items[i]); };
    idx.forEach(visit);
  }
  // cienie (na gruncie, w metrach)
  const shadows = iso ? all.map((b) => { const dx = SHADOW[0] * b.top, dy = SHADOW[1] * b.top; const c = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]; return dPoly(hull(c.concat(c.map((q) => [q[0] + dx, q[1] + dy])))); }).join('') + trees.map((t) => { const x = t.x + SHADOW[0] * t.h * 0.8, y = t.y + SHADOW[1] * t.h * 0.8; return `M${f1(x - 3.4)} ${f1(y)}a3.4 2.6 0 1 0 6.8 0a3.4 2.6 0 1 0-6.8 0Z`; }).join('')
    : all.map((b) => { const o = Math.min(3, 0.12 * b.top); return dPoly([[b.x0 + o, b.y0 + o], [b.x1 + o, b.y0 + o], [b.x1 + o, b.y1 + o], [b.x0 + o, b.y1 + o]]); }).join('');
  // punkty zakotwiczeń POI (ekran świata): grunt (front), szczyt (etykieta), punkt trasy
  const anchors = {};
  for (const p of list) {
    if (!p.site) continue; const b = byId[p.id]; const cx = p.site.x * ux, cy = p.site.y * uy;
    if (b) { const bx = (b.x0 + b.x1) / 2; anchors[p.id] = { top: P(bx, (b.y0 + b.y1) / 2, b.top), front: iso ? P(b.x1 - Math.min(6, (b.x1 - b.x0) * 0.2), b.y1 + 3, 0) : [b.x1 - Math.min(6, (b.x1 - b.x0) * 0.25), b.y1 + 2], center: P(bx, (b.y0 + b.y1) / 2, 0), route: iso ? P(bx, b.y1 + 2, 0) : [bx, (b.y0 + b.y1) / 2], box: b }; }
    else anchors[p.id] = { top: P(cx, cy, 0), front: P(cx, cy, 0), center: P(cx, cy, 0), route: P(cx, cy, 0), pin: true };
  }
  // granice kadru
  const corners = [[0, 0], [W, 0], [W, H], [0, H]].map((q) => P(q[0], q[1], 0)); const tops = boxes.map((b) => P(b.x0, b.y0, b.top));
  const bb = (pts, m) => { const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]); return [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m]; };
  const bounds = bb(corners.concat(tops), iso ? 10 : 12);
  const limit = bb(corners, 0);
  const outer = [[E[0], E[0]], [E[E.length - 1], E[0]], [E[E.length - 1], E[E.length - 1]], [E[0], E[E.length - 1]]].map(M);
  const site = [[0, 0], [100, 0], [100, 100], [0, 100]].map(M);
  // etykiety ulic: środek najdłuższego odcinka, kąt na ekranie
  const streetLabels = streets.map((st, i) => {
    let best = 0, bi = 0; for (let k = 0; k < st.pts.length - 1; k++) { const L = Math.hypot(st.pts[k + 1][0] - st.pts[k][0], st.pts[k + 1][1] - st.pts[k][1]); if (L > best) { best = L; bi = k; } }
    const a = st.pts[bi], b = st.pts[bi + 1]; const pa = P(a[0], a[1], 0), pb = P(b[0], b[1], 0); let ang = (Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const t = 0.32 + (i % 3) * 0.18; const m = P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0); return { id: 'st' + i, name: st.name, x: m[0], y: m[1], ang };
  });
  return { iso, W, H, ux, uy, P, ground, boxes, byId, order, shadows, anchors, bounds, limit, outer, site, greens, streets, ctxSt, streetLabels, trees,
    entrances: (sp.entrances || []).map((e) => ({ ...e, pt: P(e.x * ux, e.y * uy, 0) })), origin: sp.origin };
}

/**
 * Plan terenu FPŻ.
 * props: view 'iso'|'plan'; pois (domyślnie wszystkie scope 'fpz'); selectedId; highlightId (hala kiosku); hereId (POI „Tu jesteś”);
 *        position {lat,lng} (pozycja zwiedzającego); favorites [poiId]; routePoiIds [poiId] (łamana trasy); filter(poi)→bool (przygaszenie pozostałych);
 *        onSelect(poi); labels 'all'|'selected'|'none'; class
 *        + nowe (opcjonalne): callout (JSX – dymek przy wybranym obiekcie), controls (przyciski + / − / wyśrodkuj), focusId (płynne wyśrodkowanie),
 *          streetNames (domyślnie true), ariaLabel
 */
export function SitePlan({ view = 'plan', pois, selectedId, highlightId, hereId, position, favorites = [], routePoiIds = [], filter, onSelect, labels = 'all', class: cls, callout, controls, focusId, streetNames = true, ariaLabel }) {
  const s = useStore(); const ver = useStoreVersion(); const { t, L } = useClient();
  const list = (pois || s.pois.filter((p) => p.scope === 'fpz')).filter((p) => p && p.site);
  const listKey = list.map((p) => p.id).join(',');
  const G = useMemo(() => buildSite(s, view, list), [view, listKey, ver]);
  const [hover, setHover] = useState(null);
  const pz = usePanZoom({ bounds: G.bounds, limit: G.limit, boundsKey: view + '|' + G.bounds.map(Math.round).join(','), maxZoom: 7, minZoom: 0.7, pad: 0.94, fill: view === 'iso' ? 1.25 : 1.1 });
  const { S } = pz; const k = S.k, mu = S.mu;
  useEffect(() => { const a = focusId && G.anchors[focusId]; if (a && S.inited) pz.animateTo(a.top[0], a.top[1], Math.max(S.k, S.fitK * 1.5)); }, [focusId, view, pz.size.w > 0]);
  const fav = new Set(favorites || []);
  const pin = (id) => G.anchors[id];
  const sel = (p) => onSelect && onSelect(p);
  // „Tu jesteś”, pozycja zwiedzającego
  const here = hereId && pin(hereId);
  let posPt = null;
  if (position && G.origin) {
    const pp = position.poiId && list.find((p) => p.id === position.poiId);
    const X = pp ? pp.site.x * G.ux : (position.lng - G.origin.lng) * Math.cos((G.origin.lat * Math.PI) / 180) * 111320;
    const Y = pp ? pp.site.y * G.uy : (G.origin.lat - position.lat) * 110574;
    if (X > -0.05 * G.W && X < 1.05 * G.W && Y > -0.05 * G.H && Y < 1.05 * G.H) posPt = G.P(X, Y, 0);
  }
  // etykiety (z unikaniem kolizji, gęstsze przy zbliżeniu)
  const shownLbl = useMemo(() => {
    if (labels === 'none' && !hover && !selectedId) return new Set();
    const c = [];
    for (const p of list) { const a = pin(p.id); if (!a) continue; const forced = p.id === selectedId || p.id === hover; if (labels === 'none' && !forced) continue; if (labels === 'selected' && !forced && p.id !== highlightId) continue;
      if (callout && p.id === selectedId) continue;
      const txt = forced ? L(p.name) : shortName(L(p.name)); const top = a.pin ? -32 : -8; c.push({ id: p.id, x: a.top[0], y: a.top[1], dy: top, w: estW(txt, 11.5), h: 14, force: forced, pr: (p.id === highlightId ? 50 : 0) + (a.box ? 10 + Math.min(20, (a.box.x1 - a.box.x0) / 5) : 5) - (filter && !filter(p) ? 30 : 0) }); }
    if (streetNames && labels !== 'none') G.streetLabels.forEach((sl) => c.push({ id: sl.id, x: sl.x, y: sl.y, dy: 3, w: Math.abs(Math.cos((sl.ang * Math.PI) / 180)) * estW(sl.name, 9.5) + 8, h: Math.abs(Math.sin((sl.ang * Math.PI) / 180)) * estW(sl.name, 9.5) + 11, pr: -5 }));
    if (!G.iso && labels === 'all') G.greens.forEach((g, i) => { const c0 = centroid(g.poly); c.push({ id: 'g' + i, x: c0[0], y: c0[1], dy: 3, w: estW(g.name || '', 9.5), h: 12, pr: -8 }); });
    const obst = [];
    if (here) obst.push({ x: here.front[0], y: here.front[1] - 22 / k * mu, r: 26 });
    return placeLabels(c, k, mu, obst);
  }, [G, labels, selectedId, hover, highlightId, pz.zb, mu, pz.size.w, listKey, s.clients]);
  const anchor = selectedId && pin(selectedId) && callout ? { x: pin(selectedId).top[0], y: pin(selectedId).top[1], up: pin(selectedId).pin ? 34 : 6 } : null;
  const cRef = useCallout(pz, anchor);
  useCalloutPan(pz, cRef, anchor, selectedId);
  const hoverOn = (id) => (e) => { if (e.pointerType === 'mouse' && !S.dragging) setHover(id); };
  const hoverOff = (e) => { if (e.pointerType === 'mouse') setHover(null); };
  const poiProps = (p) => ({ 'data-poi': p.id, role: onSelect ? 'button' : 'img', tabindex: onSelect ? '0' : undefined, 'aria-label': L(p.name) + (p.id === selectedId ? ', ' + t('map.selected') : '') + (fav.has(p.id) ? ', ' + t('map.favorite') : '') + (p.id === hereId ? ', ' + t('c.youAreHere') : ''),
    onClick: () => sel(p), onKeyDown: keyAct(() => sel(p)), onPointerEnter: hoverOn(p.id), onPointerLeave: hoverOff, onFocus: () => { const a = pin(p.id); a && pz.ensureVisible(a.top[0], a.top[1]); } });
  const stateCls = (p) => `${p.id === highlightId ? ' map-hi' : ''}${p.id === selectedId ? ' map-sel' : ''}${filter && !filter(p) ? ' map-dim' : ''}${p.id === hover ? ' map-hov' : ''}`;
  const route = (routePoiIds || []).map((id) => pin(id)).filter(Boolean);
  const hereLines = (() => { const txt = t('c.youAreHere'); const i = txt.lastIndexOf(' '); return txt.length > 8 && i > 0 ? [txt.slice(0, i), txt.slice(i + 1)] : [txt]; })();

  return (
    <div ref={pz.rootRef} class={`map-root map-site map-site--${view} ${cls || ''}`} tabIndex={0} role="region" aria-label={ariaLabel || t('map.sitePlan')} aria-roledescription={t('map.roledesc')} {...pz.handlers}>
      <span class="fpz-sr">{t('map.hint')}</span>
      <svg class="map-svg" width={pz.size.w || 1} height={pz.size.h || 1} viewBox={`0 0 ${pz.size.w || 1} ${pz.size.h || 1}`} focusable="false">
        <g ref={pz.gRef}>
          <g transform={G.ground || undefined} aria-hidden="true">
            <path class="map-ground" d={dPoly(G.outer)} />
            {G.ctxSt.map((l, i) => <path key={'c' + i} class="map-street map-street--ctx" d={dLine(l)} />)}
            <path class="map-site-area" d={dPoly(G.site)} />
            {G.greens.map((g, i) => <path key={'g' + i} class="map-green" d={dPoly(g.poly)} />)}
            {G.streets.map((st, i) => <path key={'s' + i} class="map-street-edge" d={dLine(st.pts)} />)}
            {G.streets.map((st, i) => <path key={'S' + i} class="map-street" d={dLine(st.pts)} />)}
            <path class="map-shadow" d={G.shadows} />
            {!G.iso && G.trees.map((tr) => <circle key={tr.id} class="map-tree" cx={tr.x} cy={tr.y} r="3.4" />)}
          </g>
          <g class="map-blds">
            {G.order.map((b) => {
              if (b.tree) { const a = G.P(b.x, b.y, 0), c = G.P(b.x, b.y, b.h); return <g key={b.id} aria-hidden="true"><path class="map-trunk" d={dLine([a, c])} /><circle class="map-tree" cx={f1(c[0])} cy={f1(c[1] - 1)} r="3.6" /></g>; }
              if (b.ctx) return <g key={b.id} class="map-ctx" aria-hidden="true">{b.faces.map((fc, i) => <path key={i} class={'map-face ' + fc.c} d={fc.d} />)}</g>;
              const p = b.poi; return <g key={b.id} class={'map-poi map-bld' + stateCls(p)} {...poiProps(p)}>{b.faces.map((fc, i) => <path key={i} class={'map-face ' + fc.c} d={fc.d} />)}</g>;
            })}
          </g>
          {route.length > 1 && <path class="map-route" d={dLine(route.map((a) => a.route))} aria-hidden="true" />}
          <g class="map-pins">
            {G.entrances.map((e, i) => <g key={'e' + i} transform={`translate(${f1(e.pt[0])} ${f1(e.pt[1])})`} aria-hidden="true"><g class="map-cs"><title>{L(e.name) || t('map.entrance')}</title><circle class="map-entr" r="7.5" /><g transform="translate(-5.5 -5.5)"><Icon name="doorOpen" size={11} stroke={2.2} /></g></g></g>)}
            {list.filter((p) => pin(p.id)?.pin).map((p) => { const a = pin(p.id); return (
              <g key={p.id} class={'map-poi map-pin' + stateCls(p)} transform={`translate(${f1(a.top[0])} ${f1(a.top[1])})`} {...poiProps(p)}>
                <g class="map-cs"><ellipse class="map-pin-shadow" cx="0" cy="0" rx="5" ry="2" /><circle class="map-hit" cx="0" cy="-16" r="18" />
                  <path class="map-pin-body" d="M0 0C-3.5-6.5-11-10.5-11-19.5A11 11 0 1 1 11-19.5C11-10.5 3.5-6.5 0 0Z" />
                  <g class="map-pin-icon" transform="translate(-6.5 -26)"><Icon name={KIND_ICON[p.kind] || 'pin'} size={13} stroke={2.2} /></g></g>
              </g>); })}
            {route.map((a, i) => <g key={'r' + i} transform={`translate(${f1(a.route[0])} ${f1(a.route[1])})`} aria-hidden="true"><g class="map-cs"><circle class="map-stop" r="8.5" /><text class="map-stop-n" y="3.6">{i + 1}</text></g></g>)}
          </g>
          <g class="map-lbls" aria-hidden="true">
            {G.streetLabels.filter((sl) => shownLbl.has(sl.id)).map((sl) => <g key={sl.id} transform={`translate(${f1(sl.x)} ${f1(sl.y)})`}><g class="map-cs"><text class="map-lbl map-lbl--street" transform={`rotate(${f1(sl.ang)})`} y="3">{sl.name}</text></g></g>)}
            {!G.iso && G.greens.map((g, i) => { if (!shownLbl.has('g' + i)) return null; const c0 = centroid(g.poly); return <g key={'gl' + i} transform={`translate(${f1(c0[0])} ${f1(c0[1])})`}><g class="map-cs"><text class="map-lbl map-lbl--green" y="3">{g.name}</text></g></g>; })}
            {list.map((p) => { const a = pin(p.id); if (!a) return null; const show = shownLbl.has(p.id), hf = fav.has(p.id); if (!show && !hf) return null; const dy = a.pin ? -32 : -8; const txt = p.id === selectedId || p.id === hover ? L(p.name) : shortName(L(p.name)); return (
              <g key={p.id} class={'map-lblg' + stateCls(p)} transform={`translate(${f1(a.top[0])} ${f1(a.top[1])})`}><g class="map-cs">
                {show && <text class="map-lbl" y={dy}>{txt}</text>}
                {hf && <Heart x={show ? estW(txt, 11.5) / 2 + 3 : a.pin ? 10 : 0} y={show ? dy - 4 : a.pin ? -30 : -10} />}
              </g></g>); })}
          </g>
          {posPt && <g transform={`translate(${f1(posPt[0])} ${f1(posPt[1])})`} class="map-pos" aria-hidden="true"><g class="map-cs"><circle class="map-pos-halo" r="15" /><circle class="map-pos-dot" r="6.5" /></g></g>}
          {here && <g transform={`translate(${f1(here.front[0])} ${f1(here.front[1])})`} class="map-here" aria-hidden="true"><g class="map-cs">
            <path class="map-here-body" d="M0 0V-28Q0-46 18-46H30Q48-46 48-28V-18Q48 0 30 0Z" />
            {hereLines.map((ln, i) => <text key={i} class="map-here-t" x="24" y={(hereLines.length === 1 ? -19 : -26) + i * 11.5}>{ln}</text>)}</g></g>}
        </g>
      </svg>
      {posPt && <span class="fpz-sr">{t('map.yourPosition')}</span>}
      {callout && <div ref={cRef} class="map-ui map-callout" onPointerDown={(e) => e.stopPropagation()}>{callout}</div>}
      {controls && <Controls pz={pz} t={t} />}
    </div>
  );
}

/* ═════════════ CityMap – schematyczna mapa Dąbrowy Górniczej ═════════════ */
const LNG0 = 19.14, LATN = 50.43, LAT0 = 50.36, KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180), KY = 110.57;
const prj = (lat, lng) => [(lng - LNG0) * KX, (LATN - lat) * KY];
const unprj = (x, y) => ({ lng: LNG0 + x / KX, lat: LATN - y / KY });
const LL = (arr) => arr.map(([lng, lat]) => prj(lat, lng));
// uproszczone linie tła (schemat): rzeki, główne drogi, kolej
const RIVERS = [
  [[19.493, 50.357], [19.465, 50.352], [19.44, 50.349], [19.415, 50.347], [19.395, 50.343], [19.375, 50.336], [19.36, 50.326], [19.35, 50.312], [19.335, 50.298], [19.31, 50.288], [19.285, 50.282]],
  [[19.165, 50.43], [19.158, 50.405], [19.15, 50.38], [19.145, 50.355], [19.142, 50.33], [19.14, 50.3]],
  [[19.285, 50.405], [19.272, 50.39], [19.258, 50.375], [19.246, 50.36], [19.232, 50.35], [19.215, 50.342], [19.2, 50.336], [19.19, 50.33]],
];
const ROADS = [
  [[19.14, 50.3225], [19.17, 50.3235], [19.19, 50.323], [19.22, 50.319], [19.25, 50.312], [19.28, 50.305], [19.32, 50.3], [19.37, 50.302], [19.42, 50.306], [19.49, 50.31]],
  [[19.158, 50.43], [19.163, 50.4], [19.168, 50.37], [19.172, 50.34], [19.17, 50.31], [19.163, 50.285]],
  [[19.19, 50.325], [19.21, 50.335], [19.235, 50.347], [19.262, 50.365], [19.28, 50.385], [19.295, 50.41], [19.305, 50.43]],
  [[19.262, 50.365], [19.3, 50.36], [19.34, 50.356], [19.39, 50.352], [19.43, 50.352], [19.49, 50.36]],
];
const RAILS = [
  [[19.14, 50.334], [19.165, 50.332], [19.186, 50.3298], [19.21, 50.338], [19.235, 50.35], [19.255, 50.36], [19.267, 50.3683], [19.285, 50.39], [19.3, 50.41], [19.312, 50.43]],
  [[19.25, 50.292], [19.29, 50.298], [19.33, 50.304], [19.38, 50.312], [19.43, 50.318], [19.49, 50.322]],
];
const FORESTS = [ // duże kompleksy leśne (schemat)
  [[19.3, 50.37], [19.35, 50.395], [19.4, 50.39], [19.43, 50.37], [19.4, 50.36], [19.34, 50.362]],
  [[19.21, 50.405], [19.26, 50.42], [19.29, 50.405], [19.26, 50.395], [19.23, 50.392]],
  [[19.3, 50.315], [19.34, 50.322], [19.38, 50.318], [19.37, 50.305], [19.32, 50.3]],
];
const dName = (n) => String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
const KIND_ORDER = ['fpz', 'nature', 'park', 'tree', 'industry', 'history', 'culture'];
const kindGroup = (p) => (p.scope === 'fpz' || ['hall', 'spot', 'service'].includes(p.kind) ? 'fpz' : p.kind);
function MarkerShape({ g, r }) {
  switch (g) {
    case 'nature': return <circle class="map-mk" r={r} />;
    case 'park': return <path class="map-mk" d={`M${-r} ${-r * 0.55}Q${-r} ${-r} ${-r * 0.55} ${-r}H${r * 0.55}Q${r} ${-r} ${r} ${-r * 0.55}V${r}H${-r * 0.55}Q${-r} ${r} ${-r} ${r * 0.55}Z`} />;
    case 'tree': return <path class="map-mk" d={`M0 ${-r * 1.25}L${r * 1.15} ${r * 0.8}H${-r * 1.15}Z`} />;
    case 'industry': return <rect class="map-mk" x={-r * 0.92} y={-r * 0.92} width={r * 1.84} height={r * 1.84} />;
    case 'history': return <path class="map-mk" d={`M0 ${-r * 1.2}L${r * 1.2} 0L0 ${r * 1.2}L${-r * 1.2} 0Z`} />;
    case 'culture': { const a = r * 1.1; return <path class="map-mk" d={`M${a} 0L${a / 2} ${a * 0.87}H${-a / 2}L${-a} 0L${-a / 2} ${-a * 0.87}H${a / 2}Z`} />; }
    default: return <rect class="map-mk" x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.45} />;
  }
}

function buildCity(s, list, ds) {
  const site = s.sitePlan?.origin && s.sitePlan.widthM ? (() => { const o = s.sitePlan.origin, a = prj(o.lat, o.lng); return { x0: a[0], y0: a[1], x1: a[0] + s.sitePlan.widthM / 1000, y1: a[1] + s.sitePlan.heightM / 1000 }; })()
    : (() => { const a = prj(s.site?.lat || 50.3246, s.site?.lng || 19.1879); return { x0: a[0] - 0.15, y0: a[1] - 0.11, x1: a[0] + 0.15, y1: a[1] + 0.11 }; })();
  site.cx = (site.x0 + site.x1) / 2; site.cy = (site.y0 + site.y1) / 2;
  const dp = ds.map((d) => ({ d, p: prj(d.lat, d.lng) }));
  // obrys miasta: otoczka środków dzielnic (z marginesem), wygładzona
  const seeds = []; const addRing = (p, r) => { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; seeds.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]); } };
  dp.forEach(({ p }) => addRing(p, 2.2)); addRing([site.cx, site.cy], 2.2);
  if (dp.length < 2) { const a = prj(50.43, 19.14), b = prj(50.285, 19.49); seeds.push(a, [b[0], a[1]], b, [a[0], b[1]]); }
  const outline = chaikin(hull(seeds), 3);
  // komórki Voronoi przycięte do obrysu
  const cells = dp.map(({ d, p }, i) => { let poly = outline; dp.forEach((o, j) => { if (j !== i && poly.length) poly = clipHalf(poly, p, o.p); }); const c = poly.length > 2 ? centroid(poly) : p; return { d, p, poly, c, area: area(poly) }; });
  // tło: jeziora, piaski, mokradła, lasy
  const water = [], sand = [], marsh = [], forest = FORESTS.map((f) => chaikin(LL(f), 2));
  for (const p of s.pois) {
    if (p.lat == null || p.scope === 'fpz') continue; const [x, y] = prj(p.lat, p.lng), h = hash(p.id);
    const isPog = p.id.includes('pogoria');
    if ((isPog && p.ill !== 'wetland') || p.ill === 'lake') { const big = isPog ? 0.55 + (h % 100) / 100 * 0.5 : 0.4; water.push(blob(x, y, big, big * 0.55, h, 9, ((h >> 8) % 60 - 30) * 0.02)); }
    else if (isPog || p.ill === 'wetland') marsh.push(blob(x, y, 0.55, 0.38, h, 8));
    if (p.id.startsWith('pustynia')) sand.push(blob(x - 0.4, y, 2.8, 1.25, h, 10, -0.08)); else if (p.ill === 'desert') sand.push(blob(x, y, 1.0, 0.6, h, 9));
    if (p.ill === 'forest') forest.push(blob(x, y, 1.3, 0.9, h, 9));
  }
  const all = [...outline, ...seeds]; const xs = all.map((q) => q[0]), ys = all.map((q) => q[1]);
  const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const pts = {}; for (const p of list) if (p.lat != null) pts[p.id] = prj(p.lat, p.lng);
  return { site, outline, cells, water, sand, marsh, forest, bounds, pts, rivers: RIVERS.map(LL), roads: ROADS.map(LL), rails: RAILS.map(LL), outer: [bounds[0] - 30, bounds[1] - 30, bounds[2] + 30, bounds[3] + 30] };
}

/**
 * Schematyczna mapa Dąbrowy Górniczej.
 * props: pois (domyślnie wszystkie); districts (domyślnie wszystkie); showDistricts; tickboxes (pola wyboru dzielnic – trasa historyczna);
 *        visitedDistrictIds [id]; routes [{id,color,poiIds}]; selectedId; position {lat,lng}; filter(poi)→bool; onSelect(poi); onDistrict(d); onMapClick({lat,lng});
 *        focus 'city'|'fpz'|{lat,lng,zoom}; class
 *        + nowe (opcjonalne): legend (bool), controls (bool), selectedDistrictId, callout (JSX – dymek przy wybranym POI), ariaLabel
 *        focus.zoom = powiększenie względem widoku całego miasta (1–40).
 */
export function CityMap({ pois, districts, showDistricts = true, tickboxes, visitedDistrictIds = [], routes = [], selectedId, position, filter, onSelect, onDistrict, onMapClick, focus = 'city', class: cls, legend, controls, selectedDistrictId, callout, ariaLabel }) {
  const s = useStore(); const ver = useStoreVersion(); const { t, L } = useClient();
  const list = (pois || s.pois).filter((p) => p && p.lat != null); const ds = (districts || s.districts || []).filter((d) => d && d.lat != null);
  const listKey = list.map((p) => p.id).join(','), dKey = ds.map((d) => d.id).join(',');
  const G = useMemo(() => buildCity(s, list, ds), [listKey, dKey, ver]);
  const [hover, setHover] = useState(null);
  const uid = useMemo(() => 'mapc' + (++UID), []);
  const focusView = (st) => {
    if (!focus || focus === 'city') { // całe miasto; gdy kadr przycina mapę – nie gubimy centrum (teren FPŻ przy zachodniej krawędzi)
      if (!st || !st.w) return null; const [x0, y0, x1, y1] = G.bounds; const hw = st.w / (2 * st.fitK), hh = st.h / (2 * st.fitK), m = 70 / st.fitK * st.mu;
      let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; if (hw * 2 < x1 - x0) cx = Math.max(x0 + hw, Math.min(cx, G.site.cx + Math.min(hw - m, hw * 0.55))); if (hh * 2 < y1 - y0) cy = Math.min(cy, G.site.cy + Math.min(hh - m, hh * 0.5));
      return { cx, cy, rel: 1 };
    }
    if (focus === 'fpz') return { cx: G.site.cx, cy: G.site.cy, rel: st && st.w ? clamp((0.5 * Math.min(st.w, st.h * 1.4)) / ((G.site.x1 - G.site.x0) * st.fitK), 6, 40) : 14 };
    if (focus && typeof focus === 'object' && focus.lat != null) { const [x, y] = prj(focus.lat, focus.lng); return { cx: x, cy: y, rel: focus.zoom || 6 }; }
    return null;
  };
  const pz = usePanZoom({ bounds: G.bounds, limit: G.bounds, boundsKey: G.bounds.map((v) => v.toFixed(2)).join(','), maxZoom: 48, minZoom: 0.8, pad: 0.96, fill: 1.22, initial: focusView });
  const { S } = pz; const k = S.k, mu = S.mu, rel = k / S.fitK;
  const fKey = typeof focus === 'object' && focus ? `${focus.lat},${focus.lng},${focus.zoom}` : String(focus);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } S.touched = false; const v = focusView(S); const [x0, y0, x1, y1] = G.bounds; if (v) pz.animateTo(v.cx, v.cy, S.fitK * v.rel, 450); else pz.animateTo((x0 + x1) / 2, (y0 + y1) / 2, S.fitK, 450); }, [fKey]);
  // podziałka – aktualizowana imperatywnie
  const scaleRef = useRef(null);
  useLayoutEffect(() => { const fn = (st) => { const el = scaleRef.current; if (!el) return; const maxKm = (90 * st.mu) / st.k; const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]; const km = nice.filter((n) => n <= maxKm).pop() || 0.05; const px = (km * st.k) / st.mu;
    el.querySelector('.map-scale-bar').setAttribute('width', px.toFixed(1)); el.querySelector('.map-scale-t').textContent = km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m`; };
    S.listeners.add(fn); fn(S); return () => S.listeners.delete(fn); });

  const visited = new Set(visitedDistrictIds || []);
  const collapsed = (G.site.x1 - G.site.x0) * k < 46 * mu; // teren FPŻ jako jeden węzeł
  const big = rel >= 2.8; const r = big ? 10 : 5.5;
  const shownPois = list.filter((p) => !(collapsed && p.scope === 'fpz') && G.pts[p.id]);
  const selPoi = selectedId && list.find((p) => p.id === selectedId);
  const selCollapsed = selPoi && selPoi.scope === 'fpz' && collapsed;
  const fpzActive = list.some((p) => p.scope === 'fpz');
  const labelsShown = useMemo(() => {
    const c = [];
    for (const p of shownPois) { const [x, y] = G.pts[p.id]; const forced = p.id === selectedId || p.id === hover; if (!forced && rel < 2) continue; const txt = forced ? L(p.name) : shortName(L(p.name), 24); c.push({ id: p.id, x, y, dx: r + 4, dy: 4, align: 'start', w: estW(txt, 11), h: 13, force: forced, pr: (filter && !filter(p) ? -20 : 0) + (p.kind === 'industry' || p.kind === 'culture' || p.kind === 'history' ? 2 : 0) }); }
    const dl = []; if (showDistricts) G.cells.forEach((cl) => dl.push({ id: 'd:' + cl.d.id, x: cl.c[0], y: cl.c[1], dx: tickboxes ? 8 : 0, dy: 4, align: tickboxes ? 'start' : 'middle', w: dName(cl.d.name).length * 10 * 0.7 + 6, h: 12, pr: 10 + Math.min(0.9, cl.area / 200) }));
    if (fpzActive && collapsed) c.push({ id: 'fpz', x: G.site.cx, y: G.site.cy, dx: 17, dy: 4, align: 'start', w: estW(selCollapsed ? L(selPoi.name) : L(s.site?.name) || 'FPŻ', 11), h: 13, force: true });
    const obst = shownPois.map((p) => ({ x: G.pts[p.id][0], y: G.pts[p.id][1], r: r + 1 }));
    // dzielnice (pola wyboru) najpierw – kolidują tylko ze sobą i z wymuszonymi etykietami; potem etykiety POI omijają wszystko
    const forced = c.filter((x) => x.force); const a = placeLabels(forced.concat(tickboxes ? dl : []), k, mu, fpzActive && collapsed ? [{ x: G.site.cx, y: G.site.cy, r: 14 }] : []);
    const placed = [...forced, ...(tickboxes ? dl : [])].filter((x) => a.has(x.id));
    const b = placeLabels(placed.map((x) => ({ ...x, force: true })).concat(tickboxes ? [] : dl, c.filter((x) => !x.force)), k, mu, obst);
    return new Set([...a, ...b]);
  }, [G, pz.zb, mu, pz.size.w, selectedId, hover, showDistricts, tickboxes, listKey, collapsed, s.clients]);
  const selAnchor = selPoi && callout ? (selCollapsed ? { x: G.site.cx, y: G.site.cy, up: 14 } : G.pts[selPoi.id] ? { x: G.pts[selPoi.id][0], y: G.pts[selPoi.id][1], up: r + 2 } : null) : null;
  const cRef = useCallout(pz, selAnchor);
  useCalloutPan(pz, cRef, selAnchor, selectedId);
  const hoverOn = (id) => (e) => { if (e.pointerType === 'mouse' && !S.dragging) setHover(id); };
  const hoverOff = (e) => { if (e.pointerType === 'mouse') setHover(null); };
  const sel = (p) => onSelect && onSelect(p);
  const zoomFpz = () => { S.touched = true; pz.animateTo(G.site.cx, G.site.cy, S.fitK * clamp((0.5 * Math.min(S.w, S.h * 1.4)) / ((G.site.x1 - G.site.x0) * S.fitK), 6, 40), 450); };
  const onRootClick = (e) => {
    if (!onMapClick || e.target.closest?.('[data-poi],[data-district],.map-ui')) return;
    const [x, y] = pz.toWorld(pz.toLocal(e)); onMapClick(unprj(x, y));
  };
  let pos = null; if (position && position.lat != null) pos = prj(position.lat, position.lng);
  const accKm = Math.max(0.02, (position?.accuracy || 25) / 1000);
  const kinds = KIND_ORDER.filter((g) => list.some((p) => kindGroup(p) === g));
  const [legOpen, setLegOpen] = useState(false); const legCompact = pz.size.w && pz.size.w < 520 * mu;

  return (
    <div ref={pz.rootRef} class={`map-root map-city ${big ? 'map-city--big' : ''} ${cls || ''}`} tabIndex={0} role="region" aria-label={ariaLabel || t('map.cityMap')} aria-roledescription={t('map.roledesc')} {...pz.handlers} onClick={onRootClick}>
      <span class="fpz-sr">{t('map.hint')}</span>
      <svg class="map-svg" width={pz.size.w || 1} height={pz.size.h || 1} viewBox={`0 0 ${pz.size.w || 1} ${pz.size.h || 1}`} focusable="false">
        <defs>
          <pattern id={uid + "f"} width="0.3" height="0.3" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><path class="map-pat-forest" d="M.07 .12l.045-.075.045.075zM.22 .27l.045-.075.045.075z" /></pattern>
          <pattern id={uid + "s"} width="0.18" height="0.18" patternUnits="userSpaceOnUse"><circle class="map-pat-sand" cx=".05" cy=".05" r=".018" /><circle class="map-pat-sand" cx=".14" cy=".13" r=".014" /></pattern>
          <pattern id={uid + "m"} width="0.25" height="0.16" patternUnits="userSpaceOnUse"><path class="map-pat-marsh" d="M.03 .1h.08M.15 .04h.07" /></pattern>
        </defs>
        <g ref={pz.gRef}>
          <g aria-hidden="true">
            <rect class="map-outside" x={G.outer[0]} y={G.outer[1]} width={G.outer[2] - G.outer[0]} height={G.outer[3] - G.outer[1]} />
            <path class="map-city-area" d={dPoly(G.outline)} />
            {G.forest.map((f, i) => <path key={'f' + i} class="map-forest" d={dPoly(f)} />)}
            <path class="map-forest-pat" d={G.forest.map(dPoly).join('')} fill={`url(#${uid}f)`} />
            {G.sand.map((f, i) => <path key={'s' + i} class="map-sand" d={dPoly(f)} />)}
            <path d={G.sand.map(dPoly).join('')} fill={`url(#${uid}s)`} />
            {G.marsh.map((f, i) => <path key={'m' + i} class="map-marsh" d={dPoly(f)} />)}
            <path d={G.marsh.map(dPoly).join('')} fill={`url(#${uid}m)`} />
            {G.rivers.map((l, i) => <path key={'r' + i} class="map-river" d={dLine(l)} />)}
            {G.water.map((f, i) => <path key={'w' + i} class="map-water" d={dPoly(f)} />)}
          </g>
          {showDistricts && <g class="map-districts">
            {G.cells.map((cl) => { const v = visited.has(cl.d.id); const sd = cl.d.id === selectedDistrictId; const act = !!onDistrict; return (
              <path key={cl.d.id} class={`map-cell${v ? ' is-visited' : ''}${sd ? ' is-selected' : ''}${act ? ' is-active' : ''}`} d={dPoly(cl.poly)} data-district={act ? cl.d.id : undefined}
                role={act ? 'button' : undefined} tabindex={act ? '0' : undefined} aria-label={act ? t('map.district', { name: cl.d.name }) + (tickboxes ? ', ' + t(v ? 'map.visited' : 'map.notVisited') : '') : undefined}
                aria-pressed={act && tickboxes ? String(v) : undefined}
                onClick={act ? (e) => { e.stopPropagation(); onDistrict(cl.d); } : undefined} onKeyDown={act ? keyAct(() => onDistrict(cl.d)) : undefined} />); })}
          </g>}
          <path class="map-city-line" d={dPoly(G.outline)} aria-hidden="true" />
          <g aria-hidden="true">
            {G.roads.map((l, i) => <path key={'rd' + i} class="map-road" d={dLine(l)} />)}
            {G.rails.map((l, i) => <g key={'rl' + i}><path class="map-rail" d={dLine(l)} /><path class="map-rail-ties" d={dLine(l)} /></g>)}
            <path class={`map-site-rect${collapsed ? '' : ' is-open'}`} d={dPoly([[G.site.x0, G.site.y0], [G.site.x1, G.site.y0], [G.site.x1, G.site.y1], [G.site.x0, G.site.y1]])} />
          </g>
          {(routes || []).map((rt) => { const pp = (rt.poiIds || []).map((id) => { const p = list.find((x) => x.id === id) || s.pois.find((x) => x.id === id); return p && p.lat != null ? (collapsed && p.scope === 'fpz' ? [G.site.cx, G.site.cy] : prj(p.lat, p.lng)) : null; }).filter(Boolean);
            return pp.length > 1 ? <path key={rt.id} class="map-route" d={dLine(pp)} style={rt.color ? { stroke: rt.color } : undefined} aria-hidden="true" /> : null; })}
          <g class="map-pois">
            {shownPois.map((p) => { const [x, y] = G.pts[p.id]; const g = kindGroup(p); const isSel = p.id === selectedId; const dim = filter && !filter(p); return (
              <g key={p.id} class={`map-poi map-k-${g}${isSel ? ' map-sel' : ''}${dim ? ' map-dim' : ''}${p.id === hover ? ' map-hov' : ''}`} transform={`translate(${x.toFixed(3)} ${y.toFixed(3)})`} data-poi={p.id}
                role={onSelect ? 'button' : 'img'} tabindex={onSelect ? '0' : undefined} aria-label={L(p.name) + ' – ' + t('map.kind.' + (g === 'fpz' ? p.kind : g)) + (isSel ? ', ' + t('map.selected') : '')}
                onClick={(e) => { e.stopPropagation(); sel(p); }} onKeyDown={keyAct(() => sel(p))} onPointerEnter={hoverOn(p.id)} onPointerLeave={hoverOff} onFocus={() => pz.ensureVisible(x, y)}>
                <g class="map-cs"><circle class="map-hit" r={Math.max(r + 5, 12)} /><MarkerShape g={g} r={isSel ? r * 1.25 : r} />
                  {big && <g class="map-mk-icon" transform={`translate(${isSel ? -7.5 : -6} ${isSel ? -7.5 : -6})`}><Icon name={KIND_ICON[p.kind] || 'pin'} size={isSel ? 15 : 12} stroke={2.3} /></g>}</g>
              </g>); })}
            {fpzActive && collapsed && <g class={`map-poi map-fpz${selCollapsed ? ' map-sel' : ''}`} transform={`translate(${G.site.cx.toFixed(3)} ${G.site.cy.toFixed(3)})`} data-poi="fpz" role="button" tabindex="0" aria-label={t('map.fpzNode')}
              onClick={(e) => { e.stopPropagation(); zoomFpz(); }} onKeyDown={keyAct(zoomFpz)}>
              <g class="map-cs"><circle class="map-hit" r="18" /><rect class="map-fpz-body" x="-13" y="-13" width="26" height="26" rx="6" /><text class="map-fpz-t" y="3.6">FPŻ</text></g></g>}
          </g>
          {(routes || []).map((rt) => (rt.poiIds || []).map((id, i) => { const p = list.find((x) => x.id === id) || s.pois.find((x) => x.id === id); if (!p || p.lat == null) return null; const q = collapsed && p.scope === 'fpz' ? [G.site.cx, G.site.cy] : prj(p.lat, p.lng);
            return <g key={rt.id + i} transform={`translate(${q[0].toFixed(3)} ${q[1].toFixed(3)})`} aria-hidden="true"><g class="map-cs"><g transform={`translate(${r + 2} ${-r - 2})`}><circle class="map-stop" r="7.5" style={rt.color ? { fill: rt.color } : undefined} /><text class="map-stop-n map-stop-n--s" y="3.2">{i + 1}</text></g></g></g>; }))}
          {showDistricts && <g class="map-dlbls" aria-hidden="true">
            {G.cells.map((cl) => { const v = visited.has(cl.d.id); const show = labelsShown.has('d:' + cl.d.id); if (!show && !tickboxes) return null; return (
              <g key={cl.d.id} transform={`translate(${cl.c[0].toFixed(3)} ${cl.c[1].toFixed(3)})`} class={v ? 'is-visited' : ''}><g class="map-cs">
                {tickboxes && <g><rect class="map-tick" x="-6" y="-5.5" width="12" height="12" rx="2.5" />{v && <path class="map-tick-v" d="M-3.2 .6l2.2 2.3 4.2-5" />}</g>}
                {show && <text class="map-lbl map-lbl--district" x={tickboxes ? 8 : 0} y="4" text-anchor={tickboxes ? 'start' : 'middle'}>{dName(cl.d.name)}</text>}
              </g></g>); })}
          </g>}
          <g class="map-lbls" aria-hidden="true">
            {shownPois.filter((p) => labelsShown.has(p.id)).map((p) => { const [x, y] = G.pts[p.id]; const rr = p.id === selectedId ? r * 1.25 : r; return (
              <g key={p.id} transform={`translate(${x.toFixed(3)} ${y.toFixed(3)})`} class={filter && !filter(p) ? 'map-dim' : ''}><g class="map-cs"><text class={'map-lbl map-lbl--poi' + (p.id === selectedId ? ' is-sel' : '')} x={rr + 4} y="4">{L(p.name)}</text></g></g>); })}
            {fpzActive && collapsed && labelsShown.has('fpz') && <g transform={`translate(${G.site.cx.toFixed(3)} ${G.site.cy.toFixed(3)})`}><g class="map-cs"><text class="map-lbl map-lbl--poi is-sel" x="17" y="4">{selCollapsed ? L(selPoi.name) : L(s.site?.name) || 'FPŻ'}</text></g></g>}
          </g>
          {pos && <g transform={`translate(${pos[0].toFixed(3)} ${pos[1].toFixed(3)})`} class="map-pos" aria-hidden="true"><circle class="map-pos-acc" r={accKm} /><g class="map-cs"><circle class="map-pos-halo" r="13" /><circle class="map-pos-dot" r="6" /></g></g>}
        </g>
        <g class="map-ui-svg" aria-hidden="true">
          <g ref={scaleRef} class="map-scale" style={{ transform: `translate(${10 * mu}px, ${(pz.size.h || 0) - 12 * mu}px) scale(${mu})` }}>
            <rect class="map-scale-bar" x="0" y="-4" width="40" height="4" /><text class="map-scale-t" x="0" y="-8">1 km</text></g>
          <g class="map-north" style={{ transform: `translate(${(pz.size.w || 0) - 20 * mu}px, ${22 * mu}px) scale(${mu})` }}>
            <circle r="13" class="map-north-bg" /><path class="map-north-a" d="M0-9L5 5L0 2L-5 5Z" /><text class="map-north-t" y="-15" >N</text></g>
        </g>
      </svg>
      {pos && <span class="fpz-sr">{t('map.yourPosition')}</span>}
      {tickboxes && showDistricts && <div class="map-ui map-progress" aria-live="polite"><Icon name="flag" size={14} /> {t('map.districtsProgress', { n: ds.filter((d) => visited.has(d.id)).length, total: ds.length })}</div>}
      {legend && legCompact && <button type="button" class={`map-ui map-legend-btn${tickboxes && showDistricts ? ' map-legend-btn--low' : ''}`} aria-expanded={String(legOpen)} onClick={() => setLegOpen(!legOpen)}><Icon name="layers" size={14} /> {t('map.legend')}</button>}
      {legend && (!legCompact || legOpen) && <div class={`map-ui map-legend${legCompact ? ' map-legend--drop' : ''}${tickboxes && showDistricts ? ' map-legend--low' : ''}`} aria-label={t('map.legend')} role="group">
        {kinds.map((g) => <span key={g} class={`map-legend-i map-k-${g}`}><svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true"><MarkerShape g={g} r={5.2} /></svg>{t('map.kind.' + g)}</span>)}
        {(routes || []).length > 0 && <span class="map-legend-i"><svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true"><path class="map-route" d="M1 8H17" /></svg>{t('map.route')}</span>}
        <span class="map-legend-i"><svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true"><path class="map-rail" d="M1 8H17" /><path class="map-rail-ties" d="M1 8H17" /></svg>{t('map.rail')}</span>
      </div>}
      <p class="map-ui map-note" title={t('c.schematicMap')}>{t('c.schematicMap')}</p>
      {callout && <div ref={cRef} class="map-ui map-callout" onPointerDown={(e) => e.stopPropagation()}>{callout}</div>}
      {controls && <Controls pz={pz} t={t} />}
    </div>
  );
}
