// Komponenty współdzielone przez wszystkie końcówki (spójność wizualna wg próbek B i C).
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import './tokens.css';
import './components.css';
import { ICONS } from './icon-data.js';
import { Illustration } from './illustrations.jsx';
import { clsx, paragraphs, fmtDuration } from '../kernel/util.js';
import { useClient, stepFontScale, stopSpeaking } from '../kernel/client.jsx';
import { useStore } from '../kernel/store.js';
import { languages } from '../kernel/i18n.js';

/* ── Ikona (zestaw Lucide; lista nazw: ICON_NAMES) ── */
export const ICON_NAMES = Object.keys(ICONS);
export function Icon({ name, size = 20, stroke = 1.9, class: cls, title, style }) {
  const nodes = ICONS[name] || ICONS[{ subtitles: 'captions' }[name]] || ICONS.circle;
  return (
    <svg class={clsx('fpz-icon', cls)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} style={style}>
      {title && <title>{title}</title>}
      {nodes.map(([Tag, attr], i) => <Tag key={i} {...attr} />)}
    </svg>
  );
}
/** Piktogram „wysokość odbiorcy” z próbki B: trzy sylwetki, aktywna wypełniona. active: 'standing' | 'child' | 'seated' */
export function HeightIcon({ active = 'standing', size = 28 }) {
  const fig = (x, h, on) => (<g transform={`translate(${x} ${30 - h})`} fill={on ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="5" cy="3.2" r="2.6" /><path d={`M1.2 8.4h7.6v${h * 0.36}H7.3v${h * 0.64 - 9.4}H2.7v-${h * 0.64 - 9.4}H1.2z`} /></g>);
  return <svg class="fpz-icon" width={size * 1.45} height={size} viewBox="0 0 44 31" aria-hidden="true">{fig(1, 29, active === 'standing')}{fig(17, 23, active === 'child')}{fig(32, 19, active === 'seated')}</svg>;
}

/* ── Przyciski ── */
export function Button({ variant = 'primary', size = 'md', icon, iconRight, block, class: cls, children, type = 'button', ...rest }) {
  const isz = size === 'lg' ? 20 : size === 'sm' ? 15 : 18;
  return (<button type={type} class={clsx('fpz-btn', `fpz-btn--${variant}`, size !== 'md' && `fpz-btn--${size}`, block && 'fpz-btn--block', cls)} {...rest}>{icon && <Icon name={icon} size={isz} />}{children}{iconRight && <Icon name={iconRight} size={isz} />}</button>);
}
export function IconButton({ icon, text, label, variant = 'round', size = 'md', active, badge, class: cls, iconSize, children, ...rest }) {
  return (<button type="button" class={clsx('fpz-iconbtn', `fpz-iconbtn--${variant}`, size !== 'md' && `fpz-iconbtn--${size}`, active && 'is-active', cls)} aria-label={label} title={label} aria-pressed={active == null ? undefined : !!active} {...rest}>
    {icon ? <Icon name={icon} size={iconSize || (size === 'lg' ? 24 : size === 'sm' ? 16 : 20)} /> : text ? <span class="fpz-iconbtn__txt">{text}</span> : children}{badge ? <span class="fpz-iconbtn__badge">{badge}</span> : null}</button>);
}
export function Chip({ active, icon, children, class: cls, ...rest }) { return <button type="button" class={clsx('fpz-chip', active && 'is-active', cls)} aria-pressed={!!active} {...rest}>{icon && <Icon name={icon} size={14} />}{children}</button>; }
/** Zestaw filtrów: options [{id,label,icon}], value, onChange(id). scroll – jeden wiersz z przewijaniem. */
export function Chips({ options, value, onChange, scroll, class: cls }) { return <div class={clsx('fpz-chips', scroll && 'fpz-chips--scroll', cls)} role="group">{options.map((o) => <Chip key={o.id} active={o.id === value} icon={o.icon} onClick={() => onChange(o.id)}>{o.label}</Chip>)}</div>; }

/* ── Karty i treść ── */
export function Card({ variant = 'plain', flat, onClick, class: cls, children, as, ...rest }) {
  const Tag = as || (onClick ? 'button' : 'div');
  return <Tag class={clsx('fpz-card', variant !== 'plain' && `fpz-card--${variant}`, flat && 'fpz-card--flat', cls)} onClick={onClick} type={Tag === 'button' ? 'button' : undefined} {...rest}>{children}</Tag>;
}
export const CardBody = ({ class: cls, children }) => <div class={clsx('fpz-card__body', cls)}>{children}</div>;
/** Odnośnik „Czytaj dalej ⌟” z narożnikiem z identyfikacji. */
export function CornerLink({ children, onClick, class: cls, as = 'button' }) { const Tag = as; return <Tag type={as === 'button' ? 'button' : undefined} class={clsx('fpz-corner', cls)} onClick={onClick}>{children}</Tag>; }
export function Tag({ tone = 'neutral', icon, children, class: cls }) { return <span class={clsx('fpz-tag', tone !== 'neutral' && `fpz-tag--${tone}`, cls)}>{icon && <Icon name={icon} size={12} />}{children}</span>; }
/** Tekst z akapitami (\n\n) i **pogrubieniem**. */
export function Rich({ text, class: cls }) { return <div class={clsx('fpz-rich', cls)}>{paragraphs(text).map((p, i) => <p key={i}>{p.map((s, j) => (s.b ? <b key={j}>{s.text}</b> : s.text))}</p>)}</div>; }
/**
 * Obraz: ilustracja systemowa (ill) albo plik wgrany w CMS (src = data URL lub id z biblioteki mediów).
 * shape: 'rounded' | 'card' | 'plain' | 'arc-tr' | 'arc-tl' | 'arc-br' | 'arc-bl' | 'circle'; ratio np. '16/9'; tone: 'duotone'|'archival'|'color'
 */
export function Media({ ill, src, tone = 'duotone', ratio = '16/9', shape = 'rounded', alt = '', class: cls, children, style }) {
  const s = useStore(); const lib = src && !String(src).startsWith('data:') ? s.media.find((m) => m.id === src) : null; const url = lib ? lib.dataUrl : src;
  return (<figure class={clsx('fpz-media', shape !== 'rounded' && `fpz-media--${shape}`, cls)} style={{ aspectRatio: ratio || undefined, ...(style || {}) }}>
    {url ? <img src={url} alt={alt} /> : <Illustration id={ill || lib?.ill || 'hall-exterior'} tone={tone} title={alt} />}
    {children && <div class="fpz-media__overlay">{children}</div>}</figure>);
}

/* ── Wzór identyfikacji (własne piktogramy liniowe w duchu próbek) ── */
const G = {
  house: 'M0 40V18L12 6l12 12v22z M8 40V28h8v12', hall: 'M0 40V20l10-8v8l10-8v8l10-8v8l10-8v28z M6 40v-8h6v8 M20 30h4 M30 30h4',
  arcade: 'M0 40V16h44v24z M6 40V28a4 4 0 0 1 8 0v12 M18 40V28a4 4 0 0 1 8 0v12 M30 40V28a4 4 0 0 1 8 0v12 M0 16l6-6h32l6 6', tower: 'M0 40V4h20v36z M5 10h3 M12 10h3 M5 17h3 M12 17h3 M5 24h3 M12 24h3 M5 31h3 M12 31h3',
  tree: 'M10 40V24 M0 14a10 10 0 1 0 20 0a10 10 0 1 0-20 0', conifer: 'M10 40v-8 M2 32l8-12 8 12z M4 22l6-10 6 10', cloud: 'M0 12a6 6 0 0 1 11-3a5 5 0 0 1 9 3z',
  sun: 'M5 12a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M12 0v3 M12 21v3 M0 12h3 M21 12h3 M3.5 3.5l2 2 M18.5 18.5l2 2 M3.5 20.5l2-2 M18.5 5.5l2-2', heart: 'M12 20C4 14 0 10 0 6a6 6 0 0 1 12-2a6 6 0 0 1 12 2c0 4-4 8-12 14z',
  balloon: 'M0 11a10 11 0 1 0 20 0a10 11 0 1 0-20 0 M6 21l1 6h6l1-6 M7 29h6v6H7z', bike: 'M0 32a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M22 32a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M7 32l6-12h10l6 12 M13 20l5 12 M11 18h5 M23 20l-2-4h4',
  book: 'M0 8c6-3 10-3 14 0v24c-4-3-8-3-14 0z M14 8c4-3 8-3 14 0v24c-6-3-10-3-14 0', gate: 'M0 40V10h30v30 M0 16h30 M6 16c0 8-2 12-6 14 M24 16c0 8 2 12 6 14 M6 40V30h18v10', dash: 'M0 0h10 M16 0h4', swirl: 'M0 20h14a6 6 0 1 0-6-6v6',
};
const TILE = [['cloud', 10, 12], ['balloon', 44, 8], ['arcade', 72, 18], ['tree', 126, 18], ['tower', 154, 18], ['cloud', 186, 8], ['sun', 214, 6], ['swirl', 248, 38], ['bike', 272, 19], ['house', 320, 18], ['dash', 352, 22], ['heart', 380, 24],
  ['heart', 8, 100], ['hall', 40, 88], ['book', 92, 94], ['cloud', 128, 80], ['gate', 158, 88], ['conifer', 198, 88], ['tower', 226, 88], ['dash', 254, 84], ['house', 272, 88], ['tree', 304, 88], ['arcade', 332, 88], ['cloud', 384, 82],
  ['tower', 6, 158], ['hall', 36, 158], ['cloud', 86, 150], ['tree', 108, 158], ['bike', 136, 159], ['sun', 184, 150], ['house', 216, 158], ['book', 250, 164], ['gate', 288, 158], ['balloon', 328, 152], ['conifer', 356, 158], ['house', 384, 158]];
let patSeq = 0;
/** Zielony pas ze wzorem identyfikacji (nagłówek/stopka kiosku, ekrany powitalne). scale – powiększenie wzoru. */
export function PatternBand({ height, scale = 1, class: cls, children, style }) {
  const id = useMemo(() => `fpzpat${++patSeq}`, []);
  return (<div class={clsx('fpz-band', cls)} style={{ height, ...(style || {}) }}>
    <svg class="fpz-band__pattern" aria-hidden="true"><defs><pattern id={id} width="420" height="210" patternUnits="userSpaceOnUse" patternTransform={`scale(${scale})`}>
      <g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{TILE.map(([g, x, y], i) => <path key={i} d={G[g]} transform={`translate(${x} ${y})`} />)}</g></pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} /></svg>
    {children && <div class="fpz-band__content">{children}</div>}</div>);
}
/** Logotyp: plik wgrany w CMS (Ustawienia → Identyfikacja) albo neutralny znak zastępczy z nazwą. */
export function Logo({ onDark, class: cls, compact }) {
  const s = useStore(); const logo = s.settings.logo;
  return (<span class={clsx('fpz-logo', onDark && 'fpz-logo--on-dark', cls)} title="Miejsce na logotyp przekazany przez Zamawiającego (CMS → Ustawienia → Identyfikacja)">
    {logo ? <img class="fpz-logo__img" src={logo} alt={s.site.name.pl} /> : (<>
      <svg class="fpz-logo__mark" viewBox="0 0 34 34" aria-hidden="true"><rect x="1.5" y="1.5" width="31" height="31" rx="7" fill="none" stroke="currentColor" stroke-width="3" /><path d="M11 25V9h12M11 17h9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" /><circle cx="24.5" cy="24.5" r="2" fill="currentColor" /></svg>
      {!compact && <span class="fpz-logo__txt"><b>Fabryka.</b><span>Pełna<br />Życia</span></span>}</>)}
  </span>);
}

/* ── Kod QR (prawdziwy, czytelny dla skanerów) ── */
export function qrMatrix(value) { const q = qrcode(0, 'M'); q.addData(String(value)); q.make(); const n = q.getModuleCount(); return { n, dark: (r, c) => q.isDark(r, c) }; }
export function qrSvgString(value, size = 240) { const { n, dark } = qrMatrix(value); let d = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c} ${r}h1v1h-1z`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`; }
export function QR({ value, size = 160, label, class: cls }) {
  const { n, d } = useMemo(() => { const m = qrMatrix(value); let p = ''; for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) p += `M${c} ${r}h1v1h-1z`; return { n: m.n, d: p }; }, [value]);
  return (<span class={clsx('fpz-qr', cls)}><svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shape-rendering="crispEdges" role="img" aria-label={`Kod QR ${label || ''}`}><path d={d} fill="#000" /></svg>{label && <span class="fpz-qr__label">{label}</span>}</span>);
}

/* ── Nakładki ── */
/** Okno modalne osadzone w ramce końcówki. variant: 'center' | 'sheet' (arkusz od dołu – telefon); size: 'sm'|'md'|'lg'|'xl' */
export function Modal({ open = true, onClose, title, children, footer, size = 'md', variant = 'center', class: cls, closeLabel = 'Zamknij' }) {
  const { overlayRef } = useClient(); const [, bump] = useState(0);
  useEffect(() => { if (open && !overlayRef?.current) bump((n) => n + 1); }, [open]);
  useEffect(() => { if (!open) return; const k = (e) => { if (e.key === 'Escape') onClose?.(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [open, onClose]);
  if (!open) return null;
  const node = (<div class={clsx('fpz-modal', `fpz-modal--${size}`, variant === 'sheet' && 'fpz-modal--sheet', cls)} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
    <div class="fpz-modal__box">
      {(title || onClose) && <div class="fpz-modal__head"><div class="fpz-modal__title">{title}</div>{onClose && <IconButton icon="close" variant="plain" label={closeLabel} onClick={onClose} />}</div>}
      <div class="fpz-modal__body">{children}</div>
      {footer && <div class="fpz-modal__foot">{footer}</div>}
    </div></div>);
  return overlayRef?.current ? createPortal(node, overlayRef.current) : null;
}

/* ── Formularze ── */
export function Field({ label, hint, error, children, class: cls }) { return <label class={clsx('fpz-field', cls)}>{label && <span class="fpz-field__label">{label}</span>}{children}{error ? <span class="fpz-field__error">{error}</span> : hint ? <span class="fpz-field__hint">{hint}</span> : null}</label>; }
export const Input = ({ class: cls, pill, ...rest }) => <input class={clsx('fpz-input', pill && 'fpz-input--pill', cls)} {...rest} />;
export const Textarea = ({ class: cls, ...rest }) => <textarea class={clsx('fpz-textarea', cls)} {...rest} />;
export const Select = ({ class: cls, options, children, ...rest }) => <select class={clsx('fpz-select', cls)} {...rest}>{options ? options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>) : children}</select>;
export const Checkbox = ({ label, class: cls, ...rest }) => <label class={clsx('fpz-check', cls)}><input type="checkbox" {...rest} /><span>{label}</span></label>;
export const Switch = ({ label, class: cls, ...rest }) => <label class={clsx('fpz-switch', cls)}><input type="checkbox" role="switch" {...rest} /><span class="fpz-switch__track" /><span>{label}</span></label>;
export function SearchInput({ value, onInput, placeholder, class: cls, ...rest }) { return <div class={clsx('fpz-search', cls)}><Input pill type="search" value={value} onInput={(e) => onInput(e.currentTarget.value)} placeholder={placeholder} aria-label={placeholder} {...rest} /><Icon name="search" size={16} /></div>; }
/** Zakładki: tabs [{id,label,icon,badge}], variant 'line' | 'pill' */
export function Tabs({ tabs, value, onChange, variant = 'line', class: cls }) { return <div class={clsx('fpz-tabs', `fpz-tabs--${variant}`, cls)} role="tablist">{tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={t.id === value} class={clsx('fpz-tab', t.id === value && 'is-active')} onClick={() => onChange(t.id)}>{t.icon && <Icon name={t.icon} size={16} />}{t.label}{t.badge ? <span class="fpz-tab__badge">{t.badge}</span> : null}</button>)}</div>; }

/* ── Drobne ── */
export const Empty = ({ icon = 'info', title, text, children }) => <div class="fpz-empty"><Icon name={icon} size={30} />{title && <b>{title}</b>}{text && <span>{text}</span>}{children}</div>;
export const Progress = ({ value, max = 100, label }) => <div class="fpz-progress" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}><i style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%` }} /></div>;
export const Spinner = () => <div class="fpz-spinner" role="status" aria-label="Wczytywanie" />;
export const Notice = ({ tone = 'info', icon, children, class: cls }) => <div class={clsx('fpz-notice', tone !== 'info' && `fpz-notice--${tone}`, cls)}><Icon name={icon || { info: 'info', warn: 'alert', ok: 'circleCheck', danger: 'circleAlert' }[tone]} size={16} /><span>{children}</span></div>;
export const Stat = ({ label, value, sub, icon }) => <div class="fpz-stat"><span class="fpz-stat__label">{icon && <Icon name={icon} size={14} />}{label}</span><span class="fpz-stat__value">{value}</span>{sub && <span class="fpz-stat__sub">{sub}</span>}</div>;
/** Prosty wykres słupkowy SVG: data [{label, value}] */
export function BarChart({ data, height = 120, color = 'var(--c-accent)', labelEvery = 1 }) {
  const w = 400, max = Math.max(1, ...data.map((d) => d.value)), bw = w / data.length;
  return (<svg class="fpz-chart" viewBox={`0 0 ${w} ${height + 16}`} role="img" aria-label="Wykres słupkowy">{data.map((d, i) => { const h = (d.value / max) * (height - 6); return <g key={i}><rect x={i * bw + bw * 0.14} y={height - h} width={bw * 0.72} height={h} rx="2" fill={color}><title>{`${d.label}: ${d.value}`}</title></rect>{i % labelEvery === 0 && <text x={i * bw + bw / 2} y={height + 12} text-anchor="middle">{d.label}</text>}</g>; })}<line x1="0" x2={w} y1={height} y2={height} stroke="var(--c-line)" /></svg>);
}
/** Wykres liniowy SVG: series [{name, color, values:[…]}], labels […] */
export function LineChart({ series, labels = [], height = 130, labelEvery = 5 }) {
  const w = 400, n = Math.max(1, ...series.map((s) => s.values.length)), max = Math.max(1, ...series.flatMap((s) => s.values)), x = (i) => (n > 1 ? (i / (n - 1)) * w : w / 2), y = (v) => height - 4 - (v / max) * (height - 12);
  return (<svg class="fpz-chart" viewBox={`0 0 ${w} ${height + 16}`} role="img" aria-label="Wykres liniowy">{[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2={w} y1={y(max * g)} y2={y(max * g)} stroke="var(--c-line)" stroke-dasharray="2 4" />)}
    {series.map((s, k) => <polyline key={k} fill="none" stroke={s.color || 'var(--c-accent)'} stroke-width="2.2" stroke-linejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}><title>{s.name}</title></polyline>)}
    {labels.map((l, i) => (i % labelEvery === 0 ? <text key={i} x={x(i)} y={height + 12} text-anchor="middle">{l}</text> : null))}</svg>);
}

/** Dopasowuje treść o stałym rozmiarze projektowym (np. kiosk 1080×1920, telefon 390×844) do dostępnego miejsca. */
export function ScaleBox({ width, height, maxScale = 1, class: cls, children }) {
  const ref = useRef(null); const [k, setK] = useState(0.5);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const fit = () => { const r = el.getBoundingClientRect(); if (r.width && r.height) setK(Math.min(maxScale, r.width / width, r.height / height)); }; fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect(); }, [width, height, maxScale]);
  return (<div class={clsx('fpz-scalebox', cls)} ref={ref}><div style={{ width: width * k, height: height * k, position: 'relative', flex: 'none' }}><div class="fpz-scalebox__inner" style={{ width, height, transform: `scale(${k})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>{children}</div></div></div>);
}

/* ── Dostępność ── */
/** Przełączanie języka: 2 języki → przełącznik; więcej → lista w oknie. */
export function useLangSwitch() {
  const { client, set } = useClient(); useStore(); const langs = languages(); const [open, setOpen] = useState(false);
  const next = langs[(langs.findIndex((l) => l.code === client.lang) + 1) % Math.max(1, langs.length)] || langs[0];
  return { langs, current: client.lang, next, open, setOpen, toggle: () => (langs.length > 2 ? setOpen(true) : set({ lang: next.code })), choose: (c) => { set({ lang: c }); setOpen(false); } };
}
export function LangMenu({ sw, title }) { return (<Modal open={sw.open} onClose={() => sw.setOpen(false)} title={title || 'Język / Language'} size="sm"><div class="fpz-langmenu">{sw.langs.map((l) => <button key={l.code} type="button" class={l.code === sw.current ? 'is-active' : ''} onClick={() => sw.choose(l.code)}><span>{l.name}</span><span>{l.code.toUpperCase()}</span></button>)}</div></Modal>); }
/**
 * Pasek dostępności z próbki B: język, kontrast, A↑, A↓, lektor (+ opcjonalnie tłumacz PJM i tryb nocny).
 * show: lista spośród 'lang','contrast','bigger','smaller','lector','pjm','night'; onPjm – otwarcie połączenia z tłumaczem
 */
export function A11yBar({ horizontal, show = ['lang', 'contrast', 'bigger', 'smaller', 'lector'], onPjm, class: cls }) {
  const { client, set, t } = useClient(); const sw = useLangSwitch();
  const b = { lang: <IconButton key="lang" text={(sw.langs.length > 2 ? client.lang : sw.next?.code || 'en').toUpperCase()} label={t('c.language')} onClick={sw.toggle} />,
    contrast: <IconButton key="contrast" icon="contrast" label={t('c.contrast')} class={client.contrast === 'high' ? 'is-on' : ''} aria-pressed={client.contrast === 'high'} onClick={() => set({ contrast: client.contrast === 'high' ? 'normal' : 'high' })} />,
    bigger: <IconButton key="bigger" text="A↑" label={t('c.textBigger')} onClick={() => set({ fs: stepFontScale(client.fs || 1, 1) })} />,
    smaller: <IconButton key="smaller" text="A↓" label={t('c.textSmaller')} onClick={() => set({ fs: stepFontScale(client.fs || 1, -1) })} />,
    lector: <IconButton key="lector" icon="ear" label={t('c.lector')} class={client.lector ? 'is-on' : ''} aria-pressed={!!client.lector} onClick={() => { if (client.lector) stopSpeaking(); set({ lector: !client.lector }); }} />,
    pjm: <IconButton key="pjm" icon="hand" label={t('c.pjm')} onClick={onPjm} />,
    night: <IconButton key="night" icon={client.theme === 'night' ? 'sun' : 'moon'} label={t('c.night')} onClick={() => set({ theme: client.theme === 'night' ? 'light' : 'night' })} /> };
  return <div class={clsx('fpz-a11y', horizontal && 'fpz-a11y--h', cls)} role="toolbar" aria-label="Dostępność">{show.map((k) => b[k])}<LangMenu sw={sw} /></div>;
}

/** Napisy na żywo (symultaniczny przekaz tekstowy) – ostatnie linie z transmisji. */
export function LiveCaptions({ lines = 3, class: cls, idleText }) {
  const s = useStore(); const caps = s.live.captions.slice(-lines);
  return <div class={clsx('fpz-captions', cls)} aria-live="polite">{caps.length ? caps.map((c) => <p key={c.id}>{c.text}</p>) : <p class="fpz-captions__idle">{idleText || (s.live.onAir ? 'Oczekiwanie na napisy…' : 'Napisy pojawią się po rozpoczęciu transmisji.')}</p>}</div>;
}

/** Połączenie wideo z tłumaczem PJM/SJM (symulacja usługi zewnętrznej). Jedno naciśnięcie = połączenie. */
export function PjmCall({ open, onClose, where }) {
  const { api, t, lang } = useClient(); const [phase, setPhase] = useState('connecting'); const [sec, setSec] = useState(0); const [msgs, setMsgs] = useState([]); const [txt, setTxt] = useState(''); const callRef = useRef(null);
  useEffect(() => { if (!open) return; setPhase('connecting'); setSec(0); setMsgs([]); const r = api.pjm.request(where); callRef.current = r.call?.id; const a = setTimeout(() => setPhase('active'), 1800); const i = setInterval(() => setSec((x) => x + 1), 1000); return () => { clearTimeout(a); clearInterval(i); if (callRef.current) api.pjm.end(callRef.current); callRef.current = null; }; }, [open]);
  if (!open) return null; const pl = lang === 'pl';
  const send = (e) => { e.preventDefault(); if (!txt.trim()) return; const m = txt.trim(); setMsgs((x) => [...x, { me: true, text: m }]); setTxt(''); setTimeout(() => setMsgs((x) => [...x, { me: false, text: pl ? 'Tłumacz: rozumiem, już przekazuję obsłudze.' : 'Interpreter: understood, passing it on to the staff.' }]), 1200); };
  return (<Modal open onClose={onClose} title={t('c.pjm')} size="md" footer={<Button variant="danger" icon="phoneOff" onClick={onClose}>{pl ? 'Zakończ połączenie' : 'End call'}</Button>}>
    <div class="fpz-pjm">
      <div class="fpz-pjm__video">
        <svg viewBox="0 0 200 220" aria-hidden="true"><circle cx="100" cy="62" r="30" fill="#CCE5D8" /><path d="M40 220c0-50 26-78 60-78s60 28 60 78z" fill="#5FB287" /><g class="fpz-pjm__hand"><path d="M62 150l-22 38" stroke="#CCE5D8" stroke-width="13" stroke-linecap="round" /></g><g class="fpz-pjm__hand fpz-pjm__hand--r"><path d="M138 150l22 38" stroke="#CCE5D8" stroke-width="13" stroke-linecap="round" /></g></svg>
        <div class="fpz-pjm__status">{phase === 'connecting' ? <Tag tone="warn">{pl ? 'Łączenie…' : 'Connecting…'}</Tag> : <><Tag tone="live">{pl ? 'Połączono' : 'Connected'}</Tag><Tag>{fmtDuration(sec)}</Tag></>}</div>
        <div class="fpz-pjm__self"><Icon name="user" size={22} /></div>
      </div>
      <Notice tone="info">{pl ? 'Symulacja połączenia wideo. W wersji docelowej: usługa tłumacza PJM/SJM on-line zewnętrznego dostawcy, uruchamiana jednym przyciskiem.' : 'Simulated video call. In production: an online PJM/SJM interpreter service from an external provider, started with one button.'}</Notice>
      <div class="fpz-pjm__chat">{msgs.map((m, i) => <div key={i} class={m.me ? 'me' : ''}>{m.text}</div>)}</div>
      <form onSubmit={send} style={{ display: 'flex', gap: '8px' }}><Input pill value={txt} onInput={(e) => setTxt(e.currentTarget.value)} placeholder={pl ? 'Wiadomość tekstowa do tłumacza…' : 'Text message to the interpreter…'} /><IconButton icon="send" label={pl ? 'Wyślij' : 'Send'} type="submit" /></form>
    </div></Modal>);
}
