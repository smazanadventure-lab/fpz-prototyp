// Arkusz testowych kodów QR (adres /kody): kody wyzwalaczy (miejsca, misje gry), surowe kody „z kiosków”
// i kody błędne – do skanowania aplikacją mobilną z ekranu komputera albo z wydruku (A4).
import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '../kernel/store.js';
import { sel } from '../kernel/api.js';
import { QR, Icon } from '../ui/components.jsx';
import './qrsheet.css';

const SECTIONS = [
  { id: 'places', label: 'Miejsca', title: 'Miejsca na terenie Fabryki i w mieście', lead: 'Kody wyzwalaczy przypisanych do miejsc. Najpierw teren Fabryki Pełnej Życia, potem miasto.' },
  { id: 'game', label: 'Gra terenowa', title: 'Gra terenowa – kody misji', lead: 'Zeskanowanie kodu zalicza krok misji (gdy trasa jest rozpoczęta w aplikacji).' },
  { id: 'kiosk', label: 'Z kiosków', title: 'Kody z kiosków – „Zabierz na telefon”', lead: 'Surowe kody wyświetlane przez kioski. Rozumie je tylko skaner w aplikacji – zwykły aparat pokaże sam tekst.' },
  { id: 'errors', label: 'Błędne', title: 'Kody błędne – test komunikatów', lead: 'Aplikacja powinna pokazać komunikat o błędzie zamiast treści.' },
];
const TARGET_TXT = { poi: 'Otwiera kartę miejsca', entry: 'Otwiera wpis', event: 'Otwiera wydarzenie', video: 'Odtwarza film', venue: 'Otwiera obiekt', coupon: 'Dodaje kupon', route: 'Otwiera trasę gry' };

function baseUrl() {
  try { const b = new URLSearchParams(location.search).get('base'); return b ? b.replace(/\/+$/, '') : ''; } catch { return ''; }
}

/** Buduje listę kart: [{ section, group?, items: [{ key, value, code, name, what }] }] */
function buildSheet(s, base) {
  const payload = (t) => (base ? `${base}/q/${t.code}` : sel.qrPayload(t));
  const qr = s.triggers.filter((t) => t.kind === 'qr');
  const active = qr.filter((t) => t.active !== false);
  const card = (t, extra) => ({ key: t.id, value: payload(t), code: t.code, ...extra });

  // miejsca (i inne cele niż misje): najpierw Fabryka, potem miasto
  const placeCards = active.filter((t) => t.target?.type !== 'mission').map((t) => {
    const type = t.target?.type; const poi = type === 'poi' ? sel.poi(t.target.id) : null;
    return { ...card(t, { name: poi?.name?.pl || t.label || t.code, what: TARGET_TXT[type] || 'Otwiera treść w aplikacji', sub: poi ? (poi.scope === 'fpz' ? 'Teren Fabryki' : 'Miasto') : null }), rank: poi?.scope === 'fpz' ? 0 : poi ? 1 : 2 };
  }).sort((a, b) => a.rank - b.rank);

  // misje: grupowane trasami, w kolejności tras i misji
  const missionTrig = active.filter((t) => t.target?.type === 'mission');
  const routes = s.gameRoutes || [];
  const groups = [];
  const used = new Set();
  for (const r of routes) {
    const items = [];
    for (const m of r.missions || []) for (const t of missionTrig) if (t.target.id === m.id && !used.has(t.id)) {
      used.add(t.id);
      const rt = r.name?.pl || r.title?.pl || r.id;
      items.push(card(t, { name: m.title?.pl || t.label, what: `Gra: krok misji · trasa „${rt}” · ${m.points} pkt` }));
    }
    if (items.length) groups.push({ group: r.name?.pl || r.title?.pl || r.id, items });
  }
  const orphans = missionTrig.filter((t) => !used.has(t.id)).map((t) => card(t, { name: t.label || t.code, what: 'Gra: krok misji (brak misji w danych)' }));
  if (orphans.length) groups.push({ group: 'Bez trasy', items: orphans });

  // kody z kiosków
  const raw = (prefix, id, name, what) => ({ key: `${prefix}:${id}`, value: `${prefix}:${id}`, code: `${prefix}:${id}`, name, what });
  const kiosk = [];
  (s.entries || []).filter((e) => (e.channels || []).includes('mobile')).slice(0, 2).forEach((e) => kiosk.push(raw('E', e.id, e.title?.pl || e.id, 'Otwiera wpis')));
  const p0 = s.pois?.[0]; if (p0) kiosk.push(raw('P', p0.id, p0.name?.pl || p0.id, 'Otwiera kartę miejsca'));
  const v0 = s.events?.[0]; if (v0) kiosk.push(raw('V', v0.id, v0.title?.pl || v0.id, 'Otwiera wydarzenie'));
  const f0 = s.videos?.[0]; if (f0) kiosk.push(raw('F', f0.id, f0.title?.pl || f0.id, 'Otwiera film'));
  const o0 = s.venues?.[0]; if (o0) kiosk.push(raw('O', o0.id, o0.name?.pl || o0.id, 'Otwiera obiekt'));
  const c0 = s.coupons?.[0]; if (c0) kiosk.push(raw('C', c0.id, c0.title?.pl || c0.id, 'Dodaje kupon'));

  // kody błędne
  const unknown = 'FPZ-Q-999';
  const errors = [{ key: 'unknown', value: base ? `${base}/q/${unknown}` : sel.qrPayload({ code: unknown }), code: unknown, name: 'Nieznany kod', what: 'Komunikat o błędzie: „Nie rozpoznano kodu”' }];
  qr.filter((t) => t.active === false).forEach((t) => errors.push(card(t, { name: t.label || t.code, what: 'Komunikat o błędzie: „Ten kod jest nieaktywny”' })));

  return [
    { ...SECTIONS[0], groups: [{ items: placeCards }] },
    { ...SECTIONS[1], groups },
    { ...SECTIONS[2], groups: [{ items: kiosk }] },
    { ...SECTIONS[3], groups: [{ items: errors }] },
  ].map((sec) => ({ ...sec, count: sec.groups.reduce((n, g) => n + g.items.length, 0) }));
}

function Card({ it, size, onOpen }) {
  return (<button type="button" class="qs-card" data-code={it.code} data-value={it.value} onClick={onOpen} aria-label={`${it.code} – ${it.name}. Powiększ kod`}>
    <span class={`qs-qr qs-qr--${size}`}><QR value={it.value} size={size === 'large' ? 220 : 148} label="" /></span>
    <span class="qs-card__code">{it.code}</span>
    <span class="qs-card__name">{it.name}</span>
    <span class="qs-card__what">{it.what}</span>
  </button>);
}

function Zoom({ list, index, onIndex, onClose }) {
  const it = list[index]; const closeRef = useRef(null);
  const prev = () => onIndex((index - 1 + list.length) % list.length);
  const next = () => onIndex((index + 1) % list.length);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); } else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });
  useEffect(() => { closeRef.current?.focus(); }, []);
  if (!it) return null;
  return (<div class="qs-zoom" role="dialog" aria-modal="true" aria-label={`Kod ${it.code}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="qs-zoom__box">
      <div class="qs-zoom__qr" data-value={it.value}><QR value={it.value} size={480} label="" /></div>
      <div class="qs-zoom__code">{it.code}</div>
      <div class="qs-zoom__name">{it.name}</div>
      <div class="qs-zoom__what">{it.what}</div>
      <div class="qs-zoom__nav">
        <button type="button" class="qs-btn" onClick={prev} aria-label="Poprzedni kod"><Icon name="back" size={18} />Poprzedni</button>
        <span class="qs-zoom__pos">{index + 1} / {list.length}</span>
        <button type="button" class="qs-btn" onClick={next} aria-label="Następny kod">Następny<Icon name="forward" size={18} /></button>
        <button type="button" class="qs-btn qs-btn--primary" ref={closeRef} onClick={onClose}><Icon name="close" size={18} />Zamknij</button>
      </div>
      <div class="qs-zoom__hint">Strzałki ← / → – poprzedni / następny kod, Esc – zamknij</div>
    </div>
  </div>);
}

export function QrSheet() {
  const s = useStore();
  const [filter, setFilter] = useState('all');
  const [size, setSize] = useState('normal');
  const [zoom, setZoom] = useState(null); // indeks w liście widocznych kart
  const lastFocus = useRef(null);
  const sheet = buildSheet(s, baseUrl());
  const visible = sheet.filter((sec) => filter === 'all' || sec.id === filter);
  const flat = visible.flatMap((sec) => sec.groups.flatMap((g) => g.items));
  const total = sheet.reduce((n, sec) => n + sec.count, 0);
  const open = (it) => { lastFocus.current = document.activeElement; setZoom(flat.indexOf(it)); };
  const close = () => { setZoom(null); const el = lastFocus.current; lastFocus.current = null; setTimeout(() => el?.focus?.(), 0); };
  useEffect(() => { if (zoom != null && zoom >= flat.length) setZoom(flat.length ? flat.length - 1 : null); });

  return (<div class={`qs-root qs-size-${size}`}>
    <header class="qs-head">
      <div class="qs-head__main">
        <h1 class="qs-title">Kody QR do testów aplikacji</h1>
        <ol class="qs-steps">
          <li><span><b>W aplikacji</b> wybierz <b>Skanuj → Kamera</b>.</span></li>
          <li><span><b>Skieruj aparat</b> na kod na ekranie lub na wydruku.</span></li>
          <li><span><b>Aplikacja</b> otworzy miejsce albo zaliczy krok misji.</span></li>
        </ol>
        <p class="qs-note"><Icon name="info" size={16} /><span>Kody miejsc i misji zawierają adres strony – zeskanowane zwykłym aparatem telefonu otworzą aplikację w przeglądarce. Kody „z kiosków” działają tylko w skanerze aplikacji.</span></p>
      </div>
      <div class="qs-tools">
        <div class="qs-seg" role="group" aria-label="Sekcje">
          <button type="button" class={`qs-chip${filter === 'all' ? ' is-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Wszystkie <span class="qs-chip__n">{total}</span></button>
          {sheet.map((sec) => <button key={sec.id} type="button" class={`qs-chip${filter === sec.id ? ' is-on' : ''}`} aria-pressed={filter === sec.id} data-filter={sec.id} onClick={() => setFilter(sec.id)}>{sec.label} <span class="qs-chip__n">{sec.count}</span></button>)}
        </div>
        <div class="qs-tools__row">
          <div class="qs-seg qs-seg--size" role="group" aria-label="Rozmiar kodów">
            <button type="button" class={`qs-chip${size === 'normal' ? ' is-on' : ''}`} aria-pressed={size === 'normal'} onClick={() => setSize('normal')}>Normalne</button>
            <button type="button" class={`qs-chip${size === 'large' ? ' is-on' : ''}`} aria-pressed={size === 'large'} onClick={() => setSize('large')}>Duże</button>
          </div>
          <button type="button" class="qs-btn qs-btn--primary" onClick={() => window.print()}><Icon name="printer" size={18} />Drukuj</button>
        </div>
      </div>
    </header>

    {visible.map((sec) => (<section key={sec.id} class="qs-sec" data-section={sec.id}>
      <div class="qs-sec__head">
        <h2 class="qs-sec__title">{sec.title} <span class="qs-sec__n">{sec.count}</span></h2>
        <p class="qs-sec__lead">{sec.lead}</p>
      </div>
      {sec.count === 0 && <p class="qs-empty">Brak kodów w tej sekcji.</p>}
      {sec.groups.map((g, gi) => g.items.length > 0 && (<div key={g.group || gi} class="qs-group">
        {g.group && <h3 class="qs-group__title">{/^trasa/i.test(g.group) ? g.group : `Trasa: ${g.group}`}</h3>}
        <div class="qs-grid">{g.items.map((it) => <Card key={it.key} it={it} size={size} onOpen={() => open(it)} />)}</div>
      </div>))}
    </section>))}

    <footer class="qs-foot">Arkusz generowany z bieżących danych systemu – po zmianach w CMS odświeża się sam.</footer>
    {zoom != null && flat[zoom] && <Zoom list={flat} index={zoom} onIndex={setZoom} onClose={close} />}
  </div>);
}
