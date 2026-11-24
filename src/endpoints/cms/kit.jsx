// CMS – komponenty pomocnicze: kontekst panelu, tabela z sortowaniem, formularz z opisu pól, generyczny CRUD, wybór mediów.
import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { languages } from '../../kernel/i18n.js';
import { ROLES } from '../../kernel/api.js';
import { clsx, deepClone, matches, fmtDateTime } from '../../kernel/util.js';
import { Icon, Button, IconButton, Modal, Input, Textarea, Select, Switch, Checkbox, SearchInput, Empty, Tag, Notice } from '../../ui/components.jsx';
import { Illustration, ILLUSTRATION_IDS } from '../../ui/illustrations.jsx';

/* ── kontekst panelu ── */
export const CmsCtx = createContext(null);
export const useCms = () => useContext(CmsCtx);

export const PERM_LABEL = {
  'content.view': 'przeglądanie treści', 'content.edit': 'edycja treści', 'content.submit': 'wysyłanie do akceptacji', 'content.publish': 'publikacja treści', media: 'biblioteka mediów',
  translations: 'tłumaczenia', 'game.edit': 'edycja gry terenowej', 'offer.edit': 'edycja oferty', triggers: 'wyzwalacze QR/BLE/AR', stats: 'statystyki', 'ugc.moderate': 'moderacja treści UGC',
  inquiries: 'zapytania o termin', 'orders.view': 'podgląd zamówień', 'orders.refund': 'zwroty zamówień', 'tickets.validate': 'walidacja biletów', devices: 'urządzenia', playlists: 'playlisty',
  schedules: 'harmonogramy', incidents: 'zgłoszenia awarii', users: 'konta klientów (dane osobowe)', push: 'powiadomienia push', settings: 'ustawienia systemu', staff: 'konta personelu',
};
export const roleName = (staff) => ROLES[staff?.role]?.name || staff?.role || '';
export const denyText = (perm, staff) => `Brak uprawnienia „${PERM_LABEL[perm] || perm}” dla roli ${roleName(staff)}.`;

/* ── ścieżki w obiektach ── */
export const getIn = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setIn(o, p, v) { const [k, ...r] = String(p).split('.'); const c = Array.isArray(o) ? [...o] : { ...(o || {}) }; c[k] = r.length ? setIn(o?.[k], r.join('.'), v) : v; return c; }
export const plOf = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v.pl ?? '' : v);
export const langsOn = () => languages();
/** Brakujące wersje językowe obiektu L (pusty tekst). */
export const missingLangs = (obj, langs = langsOn()) => langs.filter((l) => !String(obj?.[l.code] || '').trim()).map((l) => l.code);

/* ── wynik operacji API → komunikat ── */
export function useRun() {
  const { toast } = useClient();
  return (res, okText) => { if (res?.ok) { if (okText) toast(okText, 'ok'); return true; } toast(res?.message?.pl || 'Operacja nie powiodła się.', 'error', 5000); return false; };
}

/* ── tabela z sortowaniem po nagłówku ── */
const cmpVals = (a, b) => { a = plOf(a); b = plOf(b); if (a == null || a === '') return 1; if (b == null || b === '') return -1; if (typeof a === 'number' && typeof b === 'number') return a - b; if (typeof a === 'boolean') return (a ? 0 : 1) - (b ? 0 : 1); return String(a).localeCompare(String(b), 'pl', { numeric: true }); };
/** cols: [{ k, label, render(row), sort(row)|false, w, cls, align }] */
export function DataTable({ rows, cols, onRow, empty = 'Brak pozycji do wyświetlenia', emptyIcon = 'info', initial, page = 60, rowClass, caption }) {
  const [sort, setSort] = useState(initial || null); const [limit, setLimit] = useState(page);
  let list = rows;
  if (sort) { const c = cols.find((x) => x.k === sort.k); const f = (c && typeof c.sort === 'function') ? c.sort : (r) => getIn(r, sort.k); list = [...rows].sort((a, b) => cmpVals(f(a), f(b)) * sort.dir); }
  const toggle = (c) => { if (c.sort === false) return; setSort((s) => (s?.k === c.k ? (s.dir === 1 ? { k: c.k, dir: -1 } : null) : { k: c.k, dir: 1 })); };
  return (
    <div class="c-tablewrap">
      <table class="c-table">
        {caption && <caption class="c-sr">{caption}</caption>}
        <thead><tr>{cols.map((c) => (
          <th key={c.k} style={c.w ? { width: c.w } : null} class={clsx(c.cls, c.align && `c-al-${c.align}`)} aria-sort={sort?.k === c.k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
            {c.sort === false || !c.label ? c.label : <button type="button" class="c-th" onClick={() => toggle(c)}>{c.label}<Icon name={sort?.k === c.k ? (sort.dir === 1 ? 'up' : 'down') : 'up'} size={12} class={clsx('c-th__ic', sort?.k === c.k && 'is-on')} /></button>}
          </th>))}</tr></thead>
        <tbody>
          {list.slice(0, limit).map((r, i) => (
            <tr key={r.id || i} class={clsx(onRow && 'is-click', rowClass?.(r))} onClick={onRow ? (e) => { if (!e.target.closest('button,a,input,select,label')) onRow(r); } : undefined}>
              {cols.map((c) => <td key={c.k} class={clsx(c.cls, c.align && `c-al-${c.align}`)}>{c.render ? c.render(r) : String(plOf(getIn(r, c.k)) ?? '')}</td>)}
            </tr>))}
        </tbody>
      </table>
      {!list.length && <Empty icon={emptyIcon} title={empty} />}
      {list.length > limit && <div class="c-more"><Button variant="ghost" size="sm" icon="plus" onClick={() => setLimit((l) => l + page)}>Pokaż więcej ({list.length - limit})</Button></div>}
    </div>
  );
}

/* ── pola formularza ── */
export function FieldBox({ label, hint, children, span, class: cls }) {
  return <div class={clsx('fpz-field c-fld', span && 'c-span', cls)}>{label && <span class="fpz-field__label">{label}</span>}{children}{hint && <span class="fpz-field__hint">{hint}</span>}</div>;
}
export function LangInputs({ value, onChange, multiline, rows = 3, placeholder }) {
  const langs = langsOn();
  return (<div class="c-langs">{langs.map((l) => {
    const v = value?.[l.code] || ''; const set = (x) => onChange({ ...(value || {}), [l.code]: x });
    return (<div class={clsx('c-lang', !v.trim() && 'is-missing')} key={l.code}><span class="c-lang__code" title={l.name}>{l.code.toUpperCase()}</span>
      {multiline ? <Textarea rows={rows} value={v} placeholder={placeholder || (l.code !== 'pl' ? value?.pl : '')} onInput={(e) => set(e.currentTarget.value)} aria-label={`${l.name}`} />
        : <Input value={v} placeholder={placeholder || (l.code !== 'pl' ? value?.pl : '')} onInput={(e) => set(e.currentTarget.value)} aria-label={`${l.name}`} />}</div>);
  })}</div>);
}
const optList = (o, d) => (typeof o === 'function' ? o(d) : o) || [];
/** Pojedyncze pole z opisu: { k, label, type, opts, hint, span, show(d), min, max, step, rows, placeholder, render(d,set) } */
export function FormField({ f, draft, set }) {
  if (f.show && !f.show(draft)) return null;
  const v = getIn(draft, f.k); const up = (x) => set(f.k, x);
  let input;
  switch (f.type) {
    case 'L': case 'Ltext': return <FieldBox label={f.label} hint={f.hint} span class="c-fld--L"><LangInputs value={v} onChange={up} multiline={f.type === 'Ltext'} rows={f.rows} /></FieldBox>;
    case 'textarea': input = <Textarea rows={f.rows || 3} value={v ?? ''} placeholder={f.placeholder} onInput={(e) => up(e.currentTarget.value)} />; break;
    case 'number': input = <Input type="number" value={v ?? ''} min={f.min} max={f.max} step={f.step || 'any'} onInput={(e) => up(e.currentTarget.value === '' ? null : +e.currentTarget.value)} />; break;
    case 'range': input = <div class="c-range"><input type="range" min={f.min} max={f.max} step={f.step || 1} value={v ?? f.min} onInput={(e) => up(+e.currentTarget.value)} aria-label={f.label} /><b>{v ?? f.min}{f.unit ? ` ${f.unit}` : ''}</b></div>; break;
    case 'datetime': input = <Input type="datetime-local" value={(v || '').slice(0, 16)} onInput={(e) => up(e.currentTarget.value)} />; break;
    case 'date': input = <Input type="date" value={(v || '').slice(0, 10)} onInput={(e) => up(e.currentTarget.value)} />; break;
    case 'select': { const os = optList(f.opts, draft); input = <Select value={v ?? ''} onChange={(e) => { const x = e.currentTarget.value; up(x === '' ? null : f.num ? +x : x); }}>{f.empty !== false && <option value="">{f.empty || '— brak —'}</option>}{os.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>; break; }
    case 'switch': return <FieldBox span={f.span} hint={f.hint}><Switch label={f.label} checked={f.invert ? v === false : !!v} onChange={(e) => up(f.invert ? !e.currentTarget.checked ? false : true : e.currentTarget.checked)} /></FieldBox>;
    case 'checks': { const os = optList(f.opts, draft); const arr = v || []; return <FieldBox label={f.label} hint={f.hint} span={f.span ?? true}><div class="c-checks">{os.map((o) => <Checkbox key={o.id} label={o.label} checked={arr.includes(o.id)} onChange={(e) => up(e.currentTarget.checked ? [...arr, o.id] : arr.filter((x) => x !== o.id))} />)}{!os.length && <span class="c-muted">Brak pozycji.</span>}</div></FieldBox>; }
    case 'tags': input = <Input value={(v || []).join(', ')} placeholder="np. historia, architektura" onChange={(e) => up(e.currentTarget.value.split(',').map((x) => x.trim()).filter(Boolean))} />; break;
    case 'image': return <FieldBox label={f.label} hint={f.hint} span={f.span}><MediaSource ill={v} src={f.srcKey ? getIn(draft, f.srcKey) : null} allowLib={!!f.srcKey} onChange={({ ill, src }) => { set(f.k, ill); if (f.srcKey) set(f.srcKey, src || null); }} /></FieldBox>;
    case 'custom': return <FieldBox label={f.label} hint={f.hint} span={f.span ?? true}>{f.render(draft, set)}</FieldBox>;
    default: input = <Input value={v ?? ''} placeholder={f.placeholder} onInput={(e) => up(e.currentTarget.value)} />;
  }
  return <FieldBox label={f.label} hint={f.hint} span={f.span}>{input}</FieldBox>;
}
export function Form({ fields, draft, set, cols }) {
  return <div class={clsx('c-form', cols === 1 && 'c-form--1')}>{fields.map((f, i) => (f.section ? <h4 key={i} class="c-form__sec">{f.section}</h4> : <FormField key={f.k || i} f={f} draft={draft} set={set} />))}</div>;
}
/** Kopia robocza rekordu: [draft, setDraft, set(path, value)] */
export function useDraft(init = null) {
  const [draft, setDraft] = useState(init);
  const set = (p, v) => setDraft((d) => setIn(d, p, v));
  return [draft, setDraft, set];
}

/* ── wybór obrazu: ilustracja systemowa albo plik z biblioteki mediów ── */
export function MediaSource({ ill, src, onChange, allowLib = true }) {
  const s = useStore(); const [open, setOpen] = useState(false); const [tab, setTab] = useState(src ? 'lib' : 'ill');
  const lib = s.media.filter((m) => m.dataUrl); const cur = src ? s.media.find((m) => m.id === src) : null;
  return (<div class="c-msrc">
    <button type="button" class="c-msrc__btn" onClick={() => setOpen(true)} aria-label="Wybierz obraz">
      <span class="c-thumb">{cur?.dataUrl ? <img src={cur.dataUrl} alt="" /> : <Illustration id={ill || 'hall-exterior'} />}</span>
      <span><b>{cur ? cur.name : ill || '— wybierz —'}</b><small>{cur ? 'plik z biblioteki mediów' : 'ilustracja systemowa'}</small></span><Icon name="edit" size={15} />
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title="Wybór obrazu" size="lg">
      {allowLib && <div class="c-seg">{[['ill', 'Ilustracje systemowe'], ['lib', `Biblioteka mediów (${lib.length})`]].map(([id, l]) => <button key={id} type="button" class={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{l}</button>)}</div>}
      {tab === 'ill' || !allowLib ? <div class="c-illgrid">{ILLUSTRATION_IDS.map((id) => <button key={id} type="button" class={clsx('c-illgrid__it', !src && ill === id && 'is-on')} onClick={() => { onChange({ ill: id, src: null }); setOpen(false); }}><span class="c-thumb"><Illustration id={id} /></span><small>{id}</small></button>)}</div>
        : lib.length ? <div class="c-illgrid">{lib.map((m) => <button key={m.id} type="button" class={clsx('c-illgrid__it', src === m.id && 'is-on')} onClick={() => { onChange({ ill: ill || 'hall-exterior', src: m.id }); setOpen(false); }}><span class="c-thumb"><img src={m.dataUrl} alt="" /></span><small>{m.name}</small></button>)}</div>
          : <Empty icon="image" title="Biblioteka mediów jest pusta" text="Wgraj obraz w sekcji Treści → Biblioteka mediów." />}
    </Modal>
  </div>);
}

/* ── generyczny CRUD kolekcji ── */
/**
 * <Crud col fields cols blank title perm search filters toolbar extra beforeSave stayOpen openId deleteWarn labelOf rows />
 * Lista czytana zawsze ze stanu (rows lub state[col]); edycja na kopii roboczej w oknie; zapis api.cms.save / usuwanie api.cms.remove.
 */
export function Crud({ col, rows, fields, cols, blank, title, noun = 'pozycję', perm = 'content.edit', search, toolbar, extra, beforeSave, stayOpen, openId, deleteWarn, labelOf, modalSize = 'lg', noDelete, intro, empty, filterBar }) {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask, clearOpen } = useCms(); const run = useRun();
  const [q, setQ] = useState(''); const [draft, setDraft, set] = useDraft(null);
  const editable = can(perm);
  const all = rows || s[col] || [];
  const list = q && search ? all.filter((r) => matches(q, ...search(r))) : all;
  const label = (r) => (labelOf ? labelOf(r) : plOf(r.title) || plOf(r.name) || r.label || r.code || r.id);
  useEffect(() => { if (!openId) return; const r = all.find((x) => x.id === openId); if (r) setDraft(deepClone(r)); clearOpen?.(); }, [openId]);
  const save = () => {
    const payload = beforeSave ? beforeSave(draft) : draft; if (!payload) return run({ ok: false, message: { pl: 'Uzupełnij wymagane pola formularza.' } });
    const res = api.cms.save(col, payload);
    if (run(res, draft.id ? 'Zapisano zmiany' : `Dodano: ${label(res.item || payload)}`)) setDraft(stayOpen ? deepClone(res.item) : null);
  };
  const remove = (r) => ask({ title: `Usunąć ${noun}?`, text: <>„{label(r)}” zostanie trwale usunięte.{deleteWarn?.(r) && <Notice tone="warn">{deleteWarn(r)}</Notice>}</>, ok: 'Usuń', onOk: () => { if (run(api.cms.remove(col, r.id), 'Usunięto')) setDraft(null); } });
  const actions = { k: '_act', label: '', sort: false, w: '88px', align: 'right', render: (r) => (<span class="c-rowact">
    <IconButton icon={editable ? 'edit' : 'eye'} variant="plain" size="sm" label={editable ? 'Edytuj' : 'Podgląd'} onClick={() => setDraft(deepClone(r))} />
    {!noDelete && <IconButton icon="trash" variant="plain" size="sm" label={editable ? 'Usuń' : denyText(perm, staff)} disabled={!editable} onClick={() => remove(r)} />}</span>) };
  return (<div class="c-crud">
    {intro}
    <div class="c-toolbar">
      {search && <SearchInput value={q} onInput={setQ} placeholder={`Szukaj: ${title.toLowerCase()}`} />}
      {filterBar}
      <span class="c-grow" />
      <span class="c-count">{list.length} poz.</span>
      {toolbar}
      {blank && <Button icon="plus" size="sm" disabled={!editable} title={editable ? undefined : denyText(perm, staff)} onClick={() => setDraft(typeof blank === 'function' ? blank() : deepClone(blank))}>Dodaj</Button>}
    </div>
    {!editable && <Notice tone="info" icon="key">Tylko podgląd – {denyText(perm, staff).toLowerCase()}</Notice>}
    <DataTable rows={list} cols={[...cols, actions]} onRow={(r) => setDraft(deepClone(r))} empty={empty || `Brak pozycji: ${title.toLowerCase()}`} />
    <Modal open={!!draft} onClose={() => setDraft(null)} size={modalSize} title={draft && (draft.id ? `${title}: ${label(draft)}` : `Nowa pozycja – ${title.toLowerCase()}`)}
      footer={draft && <>
        {draft.id && !noDelete && <Button variant="danger" size="sm" icon="trash" disabled={!editable} onClick={() => remove(draft)}>Usuń</Button>}
        <span class="c-grow" />
        <Button variant="secondary" size="sm" onClick={() => setDraft(null)}>Anuluj</Button>
        <Button size="sm" icon="save" disabled={!editable} title={editable ? undefined : denyText(perm, staff)} onClick={save}>Zapisz</Button></>}>
      {draft && <fieldset class="c-fs" disabled={!editable}><Form fields={typeof fields === 'function' ? fields(draft) : fields} draft={draft} set={set} />{extra?.(draft, setDraft, set)}</fieldset>}
    </Modal>
  </div>);
}

/* ── drobne ── */
export const STATUS = { draft: ['Szkic', 'neutral'], review: ['Do akceptacji', 'warn'], published: ['Opublikowany', 'green'], archived: ['Archiwum', 'info'] };
export const StatusTag = ({ status }) => { const [l, t] = STATUS[status] || [status, 'neutral']; return <Tag tone={t}>{l}</Tag>; };
export const CHANNELS = [{ id: 'mobile', label: 'Aplikacja', icon: 'phone' }, { id: 'web', label: 'WWW', icon: 'globe' }, { id: 'kiosk', label: 'Kioski', icon: 'monitor' }];
export const When = ({ iso }) => <span class="c-nowrap">{iso ? fmtDateTime(iso, 'pl') : '—'}</span>;
export function Seg({ options, value, onChange, label }) { return <div class="c-seg" role="group" aria-label={label}>{options.map((o) => <button key={o.id} type="button" class={value === o.id ? 'is-on' : ''} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.icon && <Icon name={o.icon} size={14} />}{o.label}{o.badge != null && <span class="c-badge">{o.badge}</span>}</button>)}</div>; }
export const poiOpts = () => getState().pois.map((p) => ({ id: p.id, label: `${p.name.pl}${p.scope === 'fpz' ? ' (FPŻ)' : ''}` })).sort((a, b) => a.label.localeCompare(b.label, 'pl'));
export function Head({ title, sub, children }) { return <div class="c-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div><div class="c-head__act">{children}</div></div>; }
export function SubNav({ items, value, onChange }) {
  const { can, staff } = useCms();
  return (<nav class="c-subnav" aria-label="Podsekcje">{items.map((it) => { const ok = !it.perm || can(it.perm); return (
    <button key={it.id} type="button" class={clsx(value === it.id && 'is-on', !ok && 'is-locked')} aria-current={value === it.id ? 'page' : undefined} title={ok ? undefined : denyText(it.perm, staff)} onClick={() => onChange(it.id)}>
      {it.icon && <Icon name={ok ? it.icon : 'lock'} size={15} />}{it.label}{it.badge ? <span class="c-badge">{it.badge}</span> : null}</button>); })}</nav>);
}
export function Denied({ perm }) { const { staff } = useCms(); return <div class="c-denied"><Icon name="shield" size={36} /><h3>Brak dostępu</h3><p>{denyText(perm, staff)} Poproś administratora o nadanie uprawnień (Ustawienia → Użytkownicy i role).</p></div>; }
