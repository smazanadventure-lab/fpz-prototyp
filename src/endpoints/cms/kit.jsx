// CMS – komponenty pomocnicze: kontekst panelu, tabela z sortowaniem, formularz z opisu pól, generyczny CRUD, wybór mediów.
import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { languages } from '../../kernel/i18n.js';
import { ROLES } from '../../kernel/api.js';
import { clsx, deepClone, matches, fmtDateTime, fmtDuration } from '../../kernel/util.js';
import { uploadMedia, mediaItem, mediaUrl, mediaRef, isMediaRef, MEDIA_ACCEPT, fmtSize } from '../../kernel/media.js';
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
    case 'image': { // ilustracja systemowa albo zdjęcie z biblioteki („media:<id>” w tym samym polu); dawne pole srcKey (id pliku) jest przenoszone do ill
      const old = f.srcKey ? getIn(draft, f.srcKey) : null; const val = !isMediaRef(v) && old && mediaItem(old) ? mediaRef(old) : v;
      return <MediaPicker label={f.label} hint={f.hint} kind="image" illustration value={val} fallbackIll={f.fallback || 'hall-exterior'} testid={`mp-${f.k}`} onChange={(ref) => { set(f.k, ref); if (f.srcKey && old) set(f.srcKey, null); }} />; }
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

/* ── pliki z biblioteki mediów: miniatura, wgrywanie z postępem, wybór (MediaPicker) ── */
export const KIND = { image: { label: 'Zdjęcie', noun: 'zdjęcie', icon: 'image' }, video: { label: 'Wideo', noun: 'film', icon: 'video' }, audio: { label: 'Audio', noun: 'nagranie', icon: 'volume' } };
const NONE_TXT = { image: 'Nie wybrano zdjęcia', video: 'Brak pliku – odtwarzana jest symulacja', audio: 'Brak nagrania – czyta lektor (synteza mowy)' };
/** Krótki opis pozycji: rodzaj · rozmiar · wymiary / długość. */
export const mediaMeta = (m) => [KIND[m.type]?.label || m.type, m.size ? fmtSize(m.size) : null, m.w && m.h ? `${m.w}×${m.h}` : null, m.durationSec ? fmtDuration(m.durationSec) : null, m.stored === 'session' ? 'tylko ta karta' : null].filter(Boolean).join(' · ');
/** Miniatura pozycji biblioteki: obraz / pierwsza klatka filmu / ikona (audio). */
export function MediaThumb({ m, size, class: cls }) {
  const ok = m && (m.type === 'image' || m.type === 'video') && mediaUrl(m);
  return (<span class={clsx('c-thumb', size === 'sm' && 'c-thumb--sm', !ok && 'c-thumb--icon', cls)}>
    {ok ? <Illustration id={mediaRef(m.id)} title="" /> : <Icon name={KIND[m?.type]?.icon || 'file'} size={size === 'sm' ? 18 : 24} />}
    {m?.type === 'video' && ok && <i class="c-thumb__badge"><Icon name="play" size={11} /></i>}
    {m?.durationSec ? <i class="c-thumb__dur">{fmtDuration(m.durationSec)}</i> : null}
  </span>);
}
/** Kolejka wgrywania (uploadMedia, pliki po kolei) → { queue, run(files, onItem), clear } */
export function useUploads() {
  const { api } = useClient(); const [queue, setQueue] = useState([]);
  const upd = (key, p) => setQueue((a) => a.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const run = async (files, onItem) => {
    const list = Array.from(files || []).map((f, i) => ({ key: `${Date.now().toString(36)}-${i}-${f.name}`, f }));
    setQueue((a) => [...list.map(({ key, f }) => ({ key, name: f.name, size: f.size, p: 0, status: 'wait' })), ...a.filter((x) => x.status !== 'ok')].slice(0, 20));
    const out = [];
    for (const { key, f } of list) {
      upd(key, { status: 'up' });
      const r = await uploadMedia(f, { api, onProgress: (p) => upd(key, { p }) });
      if (r.ok) { upd(key, { status: 'ok', p: 1, id: r.item.id, note: r.item.note }); onItem?.(r.item); } else upd(key, { status: 'err', msg: r.message?.pl || 'Nie udało się wgrać pliku.' });
      out.push(r);
    }
    return out;
  };
  return { queue, run, clear: () => setQueue((a) => a.filter((x) => x.status === 'up' || x.status === 'wait')) };
}
export function UploadQueue({ queue, onClear }) {
  if (!queue.length) return null;
  const busy = queue.some((x) => x.status === 'up' || x.status === 'wait');
  return (<ul class="c-upq" data-testid="media-queue" aria-live="polite">
    {queue.map((x) => (<li key={x.key} class={`is-${x.status}`} data-status={x.status}>
      <Icon name={{ ok: 'circleCheck', err: 'circleAlert', up: 'upload', wait: 'clock' }[x.status]} size={16} />
      <span class="c-upq__n"><b>{x.name}</b><small>{x.status === 'err' ? x.msg : x.status === 'ok' ? `Wgrano · ${fmtSize(x.size)}${x.note ? ' · ' + x.note : ''}` : x.status === 'up' ? `Wysyłanie… ${Math.round(x.p * 100)}% · ${fmtSize(x.size)}` : 'W kolejce'}</small></span>
      {x.status !== 'err' && <span class="c-upq__bar" role="progressbar" aria-label={x.name} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(x.p * 100)}><i style={{ width: `${Math.round(x.p * 100)}%` }} /></span>}
    </li>))}
    {!busy && onClear && <li class="c-upq__clr"><Button size="sm" variant="ghost" icon="close" onClick={onClear}>Wyczyść listę</Button></li>}
  </ul>);
}
/**
 * Wybór pliku z biblioteki mediów: <MediaPicker kind="image"|"video"|"audio" value onChange(ref|null, item) label hint illustration fallbackIll />
 * value – „media:<id>” (lub sam identyfikator); noneText – opis stanu bez pliku; illustration – pole może też wskazywać ilustrację systemową (wtedy „Usuń powiązanie” wraca do ilustracji).
 */
export function MediaPicker({ kind = 'image', value, onChange, label, hint, illustration = false, fallbackIll = 'hall-exterior', testid, noneText }) {
  const s = useStore(); const [open, setOpen] = useState(null); const [q, setQ] = useState(''); const up = useUploads();
  const [prevIll, setPrevIll] = useState(!isMediaRef(value) && value ? value : null);
  const cur = value && (isMediaRef(value) || !illustration) ? mediaItem(value) : null; const missing = value && isMediaRef(value) && !cur;
  const ill = illustration && value && !isMediaRef(value) ? value : null;
  const choose = (m) => { if (ill) setPrevIll(ill); onChange(mediaRef(m.id), m); setOpen(null); };
  const unlink = () => onChange(illustration ? prevIll || fallbackIll : null, null);
  const lib = s.media.filter((m) => m.type === kind && matches(q, m.name, (m.tags || []).join(' ')));
  const k = KIND[kind] || KIND.image;
  const box = (<div class={clsx('c-mpick', (cur || ill) && 'has-value')} data-testid={testid} data-kind={kind}>
    <div class="c-mpick__cur">
      {cur ? <MediaThumb m={cur} /> : ill ? <span class="c-thumb"><Illustration id={ill} /></span> : <span class="c-thumb c-thumb--icon"><Icon name={missing ? 'circleAlert' : k.icon} size={24} /></span>}
      <span class="c-mpick__txt"><b>{cur ? cur.name : ill ? `Ilustracja: ${ill}` : missing ? 'Plik usunięty z biblioteki' : noneText || NONE_TXT[kind]}</b>
        <small>{cur ? mediaMeta(cur) : ill ? 'ilustracja systemowa – możesz zastąpić ją zdjęciem' : missing ? 'wyświetlana jest ilustracja / symulacja' : `wybierz ${k.noun} z biblioteki lub wgraj nowy plik`}</small></span>
    </div>
    <div class="c-mpick__act">
      <Button size="sm" variant="secondary" icon="folder" onClick={() => setOpen('lib')} data-testid={testid && `${testid}-lib`}>Wybierz z biblioteki</Button>
      <label class="fpz-btn fpz-btn--secondary fpz-btn--sm c-filebtn"><Icon name="upload" size={15} />Wgraj nowy
        <input type="file" accept={MEDIA_ACCEPT[kind]} class="c-sr" data-testid={testid && `${testid}-file`} onChange={(e) => { const f = e.currentTarget.files; up.run(f, (m) => { if (m.type === kind) choose(m); }); e.currentTarget.value = ''; }} /></label>
      {illustration && <Button size="sm" variant="ghost" icon="image" onClick={() => setOpen('ill')}>Ilustracja…</Button>}
      {(cur || missing) && <Button size="sm" variant="ghost" icon="close" onClick={unlink} data-testid={testid && `${testid}-clear`}>Usuń powiązanie</Button>}
    </div>
    <UploadQueue queue={up.queue.filter((x) => x.status !== 'ok')} />
    {up.queue.some((x) => x.status === 'err') && <Button size="sm" variant="ghost" icon="close" onClick={up.clear}>Ukryj komunikaty</Button>}
    <Modal open={!!open} onClose={() => setOpen(null)} size="lg" title={open === 'ill' ? 'Ilustracje systemowe' : `Biblioteka mediów – ${KIND[kind]?.label.toLowerCase()}`}>
      {open === 'ill' ? <div class="c-illgrid">{ILLUSTRATION_IDS.map((id) => <button key={id} type="button" class={clsx('c-illgrid__it', ill === id && 'is-on')} onClick={() => { setPrevIll(id); onChange(id, null); setOpen(null); }}><span class="c-thumb"><Illustration id={id} /></span><small>{id}</small></button>)}</div>
        : <>
          <div class="c-toolbar"><SearchInput value={q} onInput={setQ} placeholder="Szukaj w bibliotece" /><span class="c-grow" /><span class="c-count">{lib.length} plików</span></div>
          {lib.length ? <div class="c-illgrid c-illgrid--lib">{lib.map((m) => <button key={m.id} type="button" class={clsx('c-illgrid__it', cur?.id === m.id && 'is-on')} onClick={() => choose(m)} data-media={m.id}><MediaThumb m={m} /><small title={m.name}>{m.name}</small><small class="c-muted">{mediaMeta(m)}</small></button>)}</div>
            : <Empty icon={k.icon} title={s.media.some((m) => m.type === kind) ? 'Brak plików spełniających kryteria' : `W bibliotece nie ma jeszcze plików: ${KIND[kind]?.label.toLowerCase()}`} text="Użyj przycisku „Wgraj nowy” albo sekcji Treści → Biblioteka mediów." />}
        </>}
    </Modal>
  </div>);
  return label || hint ? <FieldBox label={label} hint={hint} span>{box}</FieldBox> : box;
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
