// Wspólne elementy kiosku: nawigacja wewnętrzna, gesty (swipe, pinch/pan, przeciąganie), „Zabierz na telefon”, klawiatura ekranowa.
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { Icon, IconButton, Modal, QR, Button } from '../../ui/components.jsx';
import { clsx } from '../../kernel/util.js';

/** Kontekst kiosku: { device, kiosk, nav:{stack, go, back, section, replace}, takeHome(code,title), sound } */
export const KioskCtx = createContext(null);
export const useKiosk = () => useContext(KioskCtx);

/** Skala elementu względem ekranu (kiosk jest skalowany transformacją w ScaleBox). */
export const scaleOf = (el) => { if (!el) return 1; const r = el.getBoundingClientRect(); return el.offsetWidth ? r.width / el.offsetWidth : 1; };

/** Gest przesunięcia palcem (swipe): onLeft = przesunięcie w lewo (następny), onRight = w prawo (poprzedni). */
export function useSwipe(onLeft, onRight, min = 50) {
  const st = useRef(null);
  return {
    onPointerDown: (e) => { st.current = { x: e.clientX, y: e.clientY, t: Date.now() }; },
    onPointerUp: (e) => { const s = st.current; st.current = null; if (!s) return; const k = scaleOf(e.currentTarget); const dx = (e.clientX - s.x) / k, dy = (e.clientY - s.y) / k;
      if (Math.abs(dx) > min && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - s.t < 900) { if (dx < 0) onLeft?.(); else onRight?.(); e.currentTarget.dataset.swiped = '1'; setTimeout(() => { if (e.currentTarget) delete e.currentTarget.dataset.swiped; }, 50); } },
    onPointerCancel: () => { st.current = null; },
  };
}

/**
 * Przesuwanie (1 palec / mysz), szczypanie (2 palce), kółko myszy, przyciski +/−.
 * Kliknięcia po przeciągnięciu są tłumione, aby nie wybierać obiektu przypadkiem.
 */
export function PanZoom({ children, class: cls, max = 4, controls = true, resetKey }) {
  const { t } = useClient();
  const ref = useRef(null); const [v, setV] = useState({ k: 1, x: 0, y: 0 }); const vRef = useRef(v); vRef.current = v;
  const pts = useRef(new Map()); const g = useRef(null); const moved = useRef(false);
  useEffect(() => { setV({ k: 1, x: 0, y: 0 }); }, [resetKey]);
  const clampV = (n) => { const el = ref.current; const w = el?.offsetWidth || 1000, h = el?.offsetHeight || 1000; const k = Math.max(1, Math.min(max, n.k)); const mx = (w * (k - 1)) / 2 + w * 0.15, my = (h * (k - 1)) / 2 + h * 0.15; return { k, x: Math.max(-mx, Math.min(mx, n.x)), y: Math.max(-my, Math.min(my, n.y)) }; };
  const start = () => { const arr = [...pts.current.values()]; const s = vRef.current; if (arr.length === 1) g.current = { mode: 'pan', p: arr[0], v: s }; else if (arr.length >= 2) { const [a, b] = arr; g.current = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v: s }; } };
  useEffect(() => {
    const move = (e) => { if (!pts.current.has(e.pointerId)) return; pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const G = g.current; if (!G) return; const k = scaleOf(ref.current);
      if (G.mode === 'pan') { const dx = (e.clientX - G.p.x) / k, dy = (e.clientY - G.p.y) / k; if (Math.abs(dx) + Math.abs(dy) > 8) moved.current = true; if (moved.current) setV(clampV({ k: G.v.k, x: G.v.x + dx, y: G.v.y + dy })); }
      else { const [a, b] = [...pts.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; moved.current = true; setV(clampV({ k: G.v.k * (d / G.d), x: G.v.x + (m.x - G.m.x) / k, y: G.v.y + (m.y - G.m.y) / k })); } };
    const up = (e) => { if (!pts.current.has(e.pointerId)) return; pts.current.delete(e.pointerId); if (pts.current.size) start(); else { g.current = null; setTimeout(() => { moved.current = false; }, 30); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);
  const down = (e) => { if (e.target.closest?.('.k-pz__ctl')) return; pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = false; start(); };
  const wheel = (e) => { e.preventDefault(); setV((s) => clampV({ ...s, k: s.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15) })); };
  useEffect(() => { const el = ref.current; el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel); }, []);
  const zoom = (f) => setV((s) => clampV({ ...s, k: s.k * f }));
  return (
    <div class={clsx('k-pz', cls)} ref={ref} onPointerDown={down} onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); } }} style={{ touchAction: 'none' }}>
      <div class="k-pz__in" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})`, transition: g.current ? 'none' : undefined }}>{children}</div>
      {controls && <div class="k-pz__ctl">
        <IconButton icon="zoomIn" label={t('k.zoomIn')} onClick={() => zoom(1.4)} />
        <IconButton icon="zoomOut" label={t('k.zoomOut')} onClick={() => zoom(1 / 1.4)} />
        <IconButton icon="locate" label={t('k.zoomReset')} onClick={() => setV({ k: 1, x: 0, y: 0 })} />
      </div>}
    </div>
  );
}

/** Nagłówek podstrony wg próbki: tytuł + linia (przycisk wstecz jest w lewym panelu kontekstowym). */
export function ScreenHead({ title, right }) {
  return (
    <header class="k-head">
      <h1 class="k-title">{title}</h1>
      {right && <div class="k-head__right">{right}</div>}
    </header>
  );
}

/** Przycisk „Zabierz na telefon” – otwiera kod QR do zeskanowania aplikacją. */
export function TakeHomeButton({ code, title, label, variant = 'secondary', size = 'md', icon = 'phone' }) {
  const { t } = useClient(); const { takeHome } = useKiosk();
  return <Button variant={variant} size={size} icon={icon} onClick={(e) => { e.stopPropagation(); takeHome(code, title); }}>{label || t('k.takeHome')}</Button>;
}
export function TakeHomeModal({ data, onClose }) {
  const { t } = useClient();
  if (!data) return null;
  return (
    <Modal open onClose={onClose} title={data.label || t('k.takeHome')} size="md" closeLabel={t('c.close')}>
      <div class="k-qrbox">
        <QR value={data.code} size={240} />
        <div>
          <h3>{data.title}</h3>
          <p>{data.hint || t('k.takeHomeHint')}</p>
          <code class="k-qrbox__code">{data.code}</code>
        </div>
      </div>
    </Modal>
  );
}

/** Klawiatura ekranowa (kiosk nie ma fizycznej klawiatury). */
const ROWS = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ł'], ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ą', 'ę', 'ó'], ['ś', 'ż', 'ź', 'ć', 'ń', '-']];
export function Keyboard({ value, onChange, onClose }) {
  const { t } = useClient();
  return (
    <div class="k-kbd" role="group" aria-label={t('k.keyboard')}>
      {ROWS.map((r, i) => <div key={i} class="k-kbd__row">{r.map((c) => <button key={c} type="button" onClick={() => onChange(value + c)}>{c}</button>)}</div>)}
      <div class="k-kbd__row">
        <button type="button" class="wide" onClick={() => onChange(value + ' ')}>{t('k.space')}</button>
        <button type="button" aria-label="Backspace" onClick={() => onChange(value.slice(0, -1))}><Icon name="back" size={20} /></button>
        <button type="button" class="mid" onClick={() => onChange('')}>{t('k.clear')}</button>
        {onClose && <button type="button" aria-label={t('c.close')} onClick={onClose}><Icon name="close" size={20} /></button>}
      </div>
    </div>
  );
}

/** Pigułkowy przełącznik siatka / lista. */
export function ViewToggle({ value, onChange }) {
  const { t } = useClient();
  return (<div class="k-vt" role="group">
    <IconButton icon="grid" variant="plain" iconSize={22} label={t('k.grid')} active={value === 'grid'} onClick={() => onChange('grid')} />
    <IconButton icon="list" variant="plain" iconSize={22} label={t('k.list')} active={value === 'list'} onClick={() => onChange('list')} />
  </div>);
}

export const WEATHER_ICON = { sunny: 'sun', clear: 'sun', cloudy: 'cloud', partly: 'cloudSun', rain: 'cloudRain', snow: 'snow', wind: 'wind', storm: 'zap', fog: 'cloud' };
