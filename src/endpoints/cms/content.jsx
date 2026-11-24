// CMS – treści: wpisy (lista + edytor z podglądem), kategorie, aktualności, galeria, filmy, biblioteka mediów.
import { useState, useEffect } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { deepClone, matches, localIso, nowIso, fmtDateTime, ago, download, clsx } from '../../kernel/util.js';
import { Icon, Button, IconButton, Modal, Input, Textarea, Select, Switch, Checkbox, SearchInput, Tabs, Tag, Notice, Empty, Media, Rich, QR, qrSvgString } from '../../ui/components.jsx';
import { useCms, useRun, useDraft, DataTable, Crud, Form, FieldBox, LangInputs, MediaSource, StatusTag, STATUS, CHANNELS, When, Seg, Head, poiOpts, langsOn, missingLangs, denyText, getIn } from './kit.jsx';

const L0 = () => ({ pl: '', en: '' });
const catOpts = () => sel.categoryTree().flatMap((c) => [{ id: c.id, label: c.name.pl }, ...c.children.map((x) => ({ id: x.id, label: `   └ ${x.name.pl}` }))]);
const catName = (id) => { const c = sel.category(id); if (!c) return '—'; const p = c.parentId && sel.category(c.parentId); return p ? `${p.name.pl} › ${c.name.pl}` : c.name.pl; };
export const MEDIA_TYPES = [{ id: 'image', label: 'Zdjęcie', icon: 'image' }, { id: 'video', label: 'Wideo', icon: 'video' }, { id: 'audio', label: 'Audio', icon: 'volume' }, { id: 'model3d', label: 'Obiekt 3D', icon: 'cube' }, { id: 'panorama', label: 'Panorama 360°', icon: 'panorama' }];
export const MODELS = [{ id: 'lathe', label: 'Tokarka (lathe)' }, { id: 'hall', label: 'Hala (hall)' }, { id: 'tower', label: 'Wieża (tower)' }];
const entryLangOk = (e, code) => !!(String(e.title?.[code] || '').trim() && String(e.body?.[code] || '').trim() && String(e.lead?.[code] || '').trim());

/* ════════════ WPISY ════════════ */
export function Entries({ openId }) {
  const { clearOpen } = useCms(); const [editId, setEditId] = useState(openId || null);
  useEffect(() => { if (openId) { setEditId(openId); clearOpen(); } }, [openId]);
  if (editId) return <EntryEditor key={editId} id={editId === 'new' ? null : editId} onClose={() => setEditId(null)} onOpen={setEditId} />;
  return <EntryList onEdit={setEditId} />;
}

function EntryList({ onEdit }) {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask } = useCms(); const run = useRun();
  const [f, setF] = useState({ status: '', cat: '', channel: '', lang: '', q: '' }); const up = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const langs = langsOn(); const ids = f.cat ? sel.categoryIds(f.cat) : null;
  const rows = s.entries.filter((e) => (!f.status || e.status === f.status) && (!ids || ids.includes(e.categoryId)) && (!f.channel || (e.channels || []).includes(f.channel)) && (!f.lang || !entryLangOk(e, f.lang))
    && (!f.q || matches(f.q, e.title.pl, e.title.en, e.lead?.pl, (e.tags || []).join(' '), e.author)));
  const edit = can('content.edit');
  const dup = (e) => { const c = deepClone(e); delete c.id; c.title = Object.fromEntries(Object.entries(c.title).map(([k, v]) => [k, v ? `${v} (kopia)` : v])); c.status = 'draft'; c.featured = false; const r = api.cms.save('entries', c); if (run(r, 'Utworzono kopię wpisu (szkic)')) onEdit(r.item.id); };
  const del = (e) => ask({ title: 'Usunąć wpis?', text: <>„{e.title.pl}” zniknie z aplikacji, strony WWW i kiosków.{s.triggers.some((t) => t.target?.type === 'entry' && t.target.id === e.id) && <Notice tone="warn">Do wpisu prowadzą wyzwalacze QR/BLE/AR – po usunięciu przestaną działać.</Notice>}</>, ok: 'Usuń wpis', onOk: () => run(api.cms.remove('entries', e.id), 'Usunięto wpis') });
  const cnt = (k) => s.entries.filter((e) => e.status === k).length;
  return (<div class="c-page">
    <Head title="Wpisy" sub="Treści aplikacji mobilnej, strony WWW i kiosków – workflow: szkic → akceptacja → publikacja">
      <Button icon="plus" disabled={!edit} title={edit ? undefined : denyText('content.edit', staff)} onClick={() => onEdit('new')}>Nowy wpis</Button>
    </Head>
    <Seg label="Status" value={f.status} onChange={(v) => up('status', v)} options={[{ id: '', label: 'Wszystkie', badge: s.entries.length }, ...Object.entries(STATUS).map(([id, [l]]) => ({ id, label: l, badge: cnt(id) }))]} />
    <div class="c-toolbar">
      <SearchInput value={f.q} onInput={(v) => up('q', v)} placeholder="Szukaj w tytułach, tagach, autorach" />
      <Select value={f.cat} onChange={(e) => up('cat', e.currentTarget.value)} aria-label="Kategoria"><option value="">Wszystkie kategorie</option>{catOpts().map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
      <Select value={f.channel} onChange={(e) => up('channel', e.currentTarget.value)} aria-label="Kanał"><option value="">Wszystkie kanały</option>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
      <Select value={f.lang} onChange={(e) => up('lang', e.currentTarget.value)} aria-label="Język niekompletny"><option value="">Wszystkie języki</option>{langs.map((l) => <option key={l.code} value={l.code}>Niekompletne: {l.name}</option>)}</Select>
      <span class="c-grow" /><span class="c-count">{rows.length} z {s.entries.length}</span>
    </div>
    <DataTable rows={rows} onRow={(e) => onEdit(e.id)} initial={{ k: 'updatedAt', dir: -1 }} empty="Brak wpisów spełniających kryteria" cols={[
      { k: 'title', label: 'Tytuł', render: (e) => <span class="c-ttl"><b>{e.title.pl || '(bez tytułu)'}</b>{e.featured && <Icon name="star" size={13} class="c-star" title="Wyróżniony" />}<small>{(e.tags || []).slice(0, 4).join(' · ')}</small></span> },
      { k: 'categoryId', label: 'Kategoria', sort: (e) => catName(e.categoryId), render: (e) => <span class="c-small">{catName(e.categoryId)}</span> },
      { k: 'status', label: 'Status', render: (e) => <StatusTag status={e.status} /> },
      { k: 'channels', label: 'Kanały', sort: false, render: (e) => <span class="c-chan">{CHANNELS.map((c) => <span key={c.id} class={(e.channels || []).includes(c.id) ? 'is-on' : ''} title={c.label}><Icon name={c.icon} size={14} /></span>)}</span> },
      { k: 'langs', label: 'Języki', sort: (e) => langs.filter((l) => entryLangOk(e, l.code)).length, render: (e) => <span class="c-langbadges">{langs.map((l) => <span key={l.code} class={entryLangOk(e, l.code) ? 'is-ok' : 'is-miss'} title={entryLangOk(e, l.code) ? `${l.name}: komplet` : `${l.name}: brak tłumaczenia`}>{l.code}</span>)}</span> },
      { k: 'views', label: 'Odsłony', align: 'right', render: (e) => (e.views || 0).toLocaleString('pl-PL') },
      { k: 'updatedAt', label: 'Zmiana', render: (e) => <span class="c-small c-nowrap" title={fmtDateTime(e.updatedAt, 'pl')}>{ago(e.updatedAt, 'pl')}<br /><span class="c-muted">{e.author}</span></span> },
      { k: '_a', label: '', sort: false, align: 'right', w: '120px', render: (e) => <span class="c-rowact">
        <IconButton icon={edit ? 'edit' : 'eye'} variant="plain" size="sm" label={edit ? 'Edytuj' : 'Podgląd'} onClick={() => onEdit(e.id)} />
        <IconButton icon="copy" variant="plain" size="sm" label={edit ? 'Duplikuj' : denyText('content.edit', staff)} disabled={!edit} onClick={() => dup(e)} />
        <IconButton icon="trash" variant="plain" size="sm" label={edit ? 'Usuń' : denyText('content.edit', staff)} disabled={!edit} onClick={() => del(e)} /></span> },
    ]} />
  </div>);
}

const blankEntry = () => ({ categoryId: sel.categoryTree()[0]?.id || null, title: L0(), lead: L0(), body: L0(), year: null, eraId: null, poiId: null, districtId: null, media: [{ type: 'image', ill: 'hall-exterior', caption: L0(), credit: '' }], audioGuide: null, tags: [], featured: false, channels: ['mobile', 'web', 'kiosk'] });
const strip = (e) => { if (!e) return null; const { status, views, updatedAt, author, ...r } = e; return r; };

function EntryEditor({ id, onClose, onOpen }) {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask, go } = useCms(); const run = useRun();
  const e = id ? sel.entry(id) : null;
  const [draft, setDraft, set] = useDraft(e ? deepClone(e) : blankEntry());
  const [lang, setLang] = useState('pl'); const [pvLang, setPvLang] = useState('pl');
  if (id && !e) return <div class="c-page"><Empty icon="file" title="Wpis został usunięty"><Button variant="secondary" onClick={onClose}>Wróć do listy</Button></Empty></div>;
  const edit = can('content.edit'); const langs = langsOn();
  const dirty = JSON.stringify(strip(draft)) !== JSON.stringify(strip(e));
  const status = e?.status || 'draft';
  const doSave = (next, msg) => {
    const p = strip(draft); if (!id) p.status = 'draft';
    if (!String(p.title?.pl || '').trim()) { run({ ok: false, message: { pl: 'Podaj tytuł wpisu w języku polskim.' } }); setLang('pl'); return; }
    const r = api.cms.save('entries', p); if (!run(r, next ? null : msg || 'Zapisano wpis')) return;
    if (next) run(api.cms.setStatus(r.item.id, next), msg);
    if (!id) onOpen(r.item.id);
  };
  const L = (o) => o?.[pvLang] || o?.pl || '';
  const triggers = id ? s.triggers.filter((t) => t.target?.type === 'entry' && t.target.id === id) : [];
  const history = e ? s.audit.filter((a) => a.target === e.title.pl).slice(0, 12) : [];
  const genQr = () => { const r = api.cms.save('triggers', { kind: 'qr', label: `Wpis: ${draft.title.pl}`, target: { type: 'entry', id }, poiId: draft.poiId || null }); run(r, r.ok && `Nadano kod ${r.item.code} – od razu skanowalny w aplikacji`); };
  const publishOk = can('content.publish');
  const media = draft.media || []; const setMedia = (m) => set('media', m);
  const first = media.find((m) => m.type === 'image' || m.type === 'panorama') || media[0];
  const missing = (code) => !entryLangOk(draft, code);
  return (<div class="c-page c-editor">
    <div class="c-edbar">
      <IconButton icon="back" label="Wróć do listy wpisów" onClick={() => (dirty && edit ? ask({ title: 'Porzucić zmiany?', text: 'Niezapisane zmiany w kopii roboczej zostaną utracone.', ok: 'Porzuć', onOk: onClose }) : onClose())} />
      <div class="c-edbar__t"><small>{id ? 'Edycja wpisu' : 'Nowy wpis'}</small><b>{draft.title.pl || '(bez tytułu)'}</b></div>
      <StatusTag status={status} />{dirty && <Tag tone="warn" icon="edit">Niezapisane zmiany</Tag>}
      <span class="c-grow" />
      <div class="c-wf">
        <Button size="sm" variant="secondary" icon="save" disabled={!edit} title={edit ? undefined : denyText('content.edit', staff)} onClick={() => doSave(null, status === 'published' ? 'Zapisano – zmiany widoczne od razu' : 'Zapisano szkic')}>{status === 'published' ? 'Zapisz zmiany' : 'Zapisz szkic'}</Button>
        {(status === 'draft' || !id) && <Button size="sm" variant="mint" icon="send" disabled={!can('content.submit')} title={can('content.submit') ? undefined : denyText('content.submit', staff)} onClick={() => doSave('review', 'Wysłano do akceptacji administratora')}>Wyślij do akceptacji</Button>}
        {status !== 'published' && <Button size="sm" icon={publishOk ? 'check' : 'lock'} class={!publishOk ? 'c-locked' : ''} title={publishOk ? 'Opublikuj we wskazanych kanałach' : 'Publikuje administrator – serwer odrzuci próbę (FORBIDDEN)'} disabled={!edit && !publishOk} onClick={() => doSave('published', 'Opublikowano – wpis widoczny w wybranych kanałach')}>Opublikuj</Button>}
        {id && status !== 'draft' && <Button size="sm" variant="ghost" icon="rotate" disabled={!edit} onClick={() => run(api.cms.setStatus(id, 'draft'), 'Cofnięto do szkicu')}>Cofnij do szkicu</Button>}
        {id && status === 'published' && <Button size="sm" variant="ghost" icon="package" disabled={!edit} onClick={() => run(api.cms.setStatus(id, 'archived'), 'Przeniesiono do archiwum')}>Archiwizuj</Button>}
        {id && <IconButton icon="trash" variant="plain" label={edit ? 'Usuń wpis' : denyText('content.edit', staff)} disabled={!edit} onClick={() => ask({ title: 'Usunąć wpis?', text: `„${e.title.pl}” zniknie ze wszystkich kanałów.`, ok: 'Usuń', onOk: () => { if (run(api.cms.remove('entries', id), 'Usunięto wpis')) onClose(); } })} />}
      </div>
    </div>
    {!publishOk && status !== 'published' && <Notice tone="info" icon="shield">Twoja rola ({staff && sel.can(staff, 'content.edit') ? 'redaktor' : 'podgląd'}) może zapisywać szkice i wysyłać je do akceptacji – publikuje administrator.</Notice>}
    <div class="c-edgrid">
      <fieldset class="c-fs c-edform" disabled={!edit}>
        <section class="c-panel">
          <h3>Treść</h3>
          <Tabs variant="pill" value={lang} onChange={setLang} tabs={langs.map((l) => ({ id: l.code, label: `${l.name}${missing(l.code) ? ' •' : ''}` }))} />
          {missing(lang) && lang !== 'pl' && <p class="c-muted c-small">Brak pełnej wersji „{langs.find((l) => l.code === lang)?.name}” – w tym języku odbiorcy zobaczą tekst angielski lub polski.</p>}
          <div class="c-form c-form--1">
            <FieldBox label="Tytuł"><Input value={draft.title?.[lang] || ''} placeholder={lang !== 'pl' ? draft.title.pl : ''} onInput={(ev) => set(`title.${lang}`, ev.currentTarget.value)} /></FieldBox>
            <FieldBox label="Lead (wprowadzenie, 1–2 zdania)"><Textarea rows={2} value={draft.lead?.[lang] || ''} placeholder={lang !== 'pl' ? draft.lead?.pl : ''} onInput={(ev) => set(`lead.${lang}`, ev.currentTarget.value)} /></FieldBox>
            <FieldBox label="Treść" hint="Akapity oddziel pustą linią. **pogrubienie** – tekst między podwójnymi gwiazdkami."><Textarea rows={9} class="c-mono" value={draft.body?.[lang] || ''} placeholder={lang !== 'pl' ? draft.body?.pl : ''} onInput={(ev) => set(`body.${lang}`, ev.currentTarget.value)} /></FieldBox>
            <FieldBox label="Audioprzewodnik (tekst lektora)" hint="Odczytywany syntezą mowy w aplikacji i na kioskach; w wersji docelowej także nagranie lektora.">
              <Switch label="Wpis ma audioprzewodnik" checked={!!draft.audioGuide} onChange={(ev) => set('audioGuide', ev.currentTarget.checked ? { text: L0() } : null)} />
              {draft.audioGuide && <Textarea rows={3} value={draft.audioGuide.text?.[lang] || ''} placeholder={lang !== 'pl' ? draft.audioGuide.text?.pl : ''} onInput={(ev) => set(`audioGuide.text.${lang}`, ev.currentTarget.value)} />}
            </FieldBox>
          </div>
        </section>
        <section class="c-panel"><h3>Klasyfikacja i miejsce</h3>
          <Form draft={draft} set={set} fields={[
            { k: 'categoryId', label: 'Kategoria / podkategoria', type: 'select', opts: catOpts, empty: '— bez kategorii —' },
            { k: 'poiId', label: 'Miejsce (POI)', type: 'select', opts: poiOpts },
            { k: 'districtId', label: 'Dzielnica', type: 'select', opts: () => s.districts.map((d) => ({ id: d.id, label: d.name })) },
            { k: 'eraId', label: 'Epoka', type: 'select', opts: () => s.eras.map((x) => ({ id: x.id, label: `${x.name.pl} (${x.from}–${x.to})` })) },
            { k: 'year', label: 'Rok', type: 'number', min: 1000, max: 2100 },
            { k: 'tags', label: 'Tagi (po przecinku)', type: 'tags' },
            { k: 'featured', label: 'Wyróżniony (strona główna, kiosk)', type: 'switch' },
            { k: 'channels', label: 'Kanały publikacji', type: 'checks', opts: CHANNELS, hint: 'Wpis pojawi się tylko w zaznaczonych kanałach (po publikacji).' },
          ]} />
        </section>
        <section class="c-panel"><h3>Media <small class="c-muted">({media.length})</small></h3>
          <MediaList items={media} onChange={setMedia} />
        </section>
        <section class="c-panel"><h3>Wyzwalacze tego wpisu</h3>
          {!id ? <p class="c-muted">Zapisz wpis, aby przypisać do niego kody QR, nadajniki BLE i punkty AR.</p> : <>
            {triggers.length ? <ul class="c-trigs">{triggers.map((t) => <li key={t.id}>
              {t.kind === 'qr' ? <QR value={sel.qrPayload(t)} size={64} /> : <span class="c-trigs__ic"><Icon name={{ ble: 'bluetooth', ar: 'ar' }[t.kind]} size={24} /></span>}
              <span><b>{t.code}</b> <Tag tone={t.active === false ? 'neutral' : 'green'}>{t.active === false ? 'nieaktywny' : 'aktywny'}</Tag><small>{t.label} · skany: {t.scans || 0}</small></span>
              {t.kind === 'qr' && <IconButton icon="download" variant="plain" size="sm" label="Pobierz SVG" onClick={() => download(`${t.code}.svg`, qrSvgString(sel.qrPayload(t), 600), 'image/svg+xml')} />}
              <IconButton icon="edit" variant="plain" size="sm" label="Otwórz w rejestrze" onClick={() => go('triggers', null, t.id)} /></li>)}</ul>
              : <p class="c-muted">Do wpisu nie prowadzi jeszcze żaden kod.</p>}
            <div class="c-row"><Button size="sm" icon="qr" disabled={!can('triggers')} title={can('triggers') ? undefined : denyText('triggers', staff)} onClick={genQr}>Generuj kod QR</Button>
              <span class="c-muted c-small">Kod „zabierz na telefon” z kiosku: <code>E:{id}</code></span></div>
          </>}
        </section>
        {id && <section class="c-panel"><h3>Historia zmian</h3>
          {history.length ? <ul class="c-feed">{history.map((a, i) => <li key={i}><Icon name="activity" size={14} /><span><b>{a.action}</b><small>{sel.staff(a.staffId)?.name || a.client} · {fmtDateTime(a.at, 'pl')}</small></span></li>)}</ul> : <p class="c-muted">Brak zapisanych zmian w dzienniku.</p>}
          <p class="c-small c-muted">Utworzono przez: {e.author} · ostatnia zmiana: {fmtDateTime(e.updatedAt, 'pl')} · odsłony: {e.views || 0}</p>
        </section>}
      </fieldset>
      <aside class="c-preview" aria-label="Podgląd na żywo">
        <div class="c-preview__bar"><b>Podgląd na żywo</b><Seg label="Język podglądu" value={pvLang} onChange={setPvLang} options={langs.map((l) => ({ id: l.code, label: l.code.toUpperCase() }))} /></div>
        <div class="c-phone"><div class="c-phone__scr fpz-theme" data-theme="light">
          <div class="c-phone__status"><span>9:41</span><span>●●● 5G</span></div>
          {first && <Media ill={first.ill} src={first.src} ratio="4/3" shape="arc-br" alt={L(first.caption)} />}
          <div class="c-phone__body">
            <Tag tone="green">{sel.category(draft.categoryId)?.name[pvLang] || sel.category(draft.categoryId)?.name.pl || 'Bez kategorii'}</Tag>
            <h1>{L(draft.title) || 'Tytuł wpisu'}</h1>
            {draft.year && <p class="c-muted c-small">{draft.year}{draft.poiId ? ` · ${sel.poi(draft.poiId)?.name[pvLang] || sel.poi(draft.poiId)?.name.pl}` : ''}</p>}
            <p class="c-phone__lead">{L(draft.lead)}</p>
            {draft.audioGuide && <div class="c-phone__audio"><Icon name="headphones" size={18} /><span><b>Audioprzewodnik</b><small>{L(draft.audioGuide.text).slice(0, 90)}{L(draft.audioGuide.text).length > 90 ? '…' : ''}</small></span><Icon name="play" size={18} /></div>}
            <Rich text={L(draft.body)} />
            {media.length > 1 && <div class="c-phone__strip">{media.slice(1, 5).map((m, i) => <Media key={i} ill={m.ill} src={m.src} ratio="1/1" shape="rounded" />)}</div>}
          </div>
        </div></div>
        <div class="c-preview__ch">{CHANNELS.map((c) => <Tag key={c.id} tone={(draft.channels || []).includes(c.id) ? 'green' : 'neutral'} icon={c.icon}>{c.label}</Tag>)}</div>
      </aside>
    </div>
  </div>);
}

/** Lista mediów wpisu: typ, źródło (ilustracja / biblioteka), podpisy per język, model 3D. */
export function MediaList({ items, onChange }) {
  const upd = (i, patch) => onChange(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const move = (i, d) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (<div class="c-mlist">
    {items.map((m, i) => (<div class="c-mitem" key={i}>
      <div class="c-mitem__src"><MediaSource ill={m.ill} src={m.src} onChange={({ ill, src }) => upd(i, { ill, src: src || undefined })} />
        <div class="c-mitem__ord"><IconButton icon="up" variant="plain" size="sm" label="W górę" disabled={i === 0} onClick={() => move(i, -1)} /><IconButton icon="down" variant="plain" size="sm" label="W dół" disabled={i === items.length - 1} onClick={() => move(i, 1)} /><IconButton icon="trash" variant="plain" size="sm" label="Usuń element" onClick={() => onChange(items.filter((_, j) => j !== i))} /></div></div>
      <div class="c-mitem__f">
        <div class="c-row">
          <FieldBox label="Typ"><Select value={m.type} onChange={(e) => upd(i, { type: e.currentTarget.value })}>{MEDIA_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></FieldBox>
          {m.type === 'model3d' && <FieldBox label="Model 3D (modelId)"><Select value={m.modelId || 'lathe'} onChange={(e) => upd(i, { modelId: e.currentTarget.value })}>{MODELS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></FieldBox>}
          {(m.type === 'video' || m.type === 'audio') && <FieldBox label="Czas (s)"><Input type="number" min="0" value={m.durationSec ?? ''} onInput={(e) => upd(i, { durationSec: +e.currentTarget.value || null })} /></FieldBox>}
          <FieldBox label="Autor / źródło"><Input value={m.credit || ''} onInput={(e) => upd(i, { credit: e.currentTarget.value })} /></FieldBox>
        </div>
        <FieldBox label="Podpis / tekst alternatywny"><LangInputs value={m.caption} onChange={(v) => upd(i, { caption: v })} /></FieldBox>
      </div>
    </div>))}
    {!items.length && <p class="c-muted">Brak mediów – dodaj zdjęcie, film, nagranie, obiekt 3D lub panoramę.</p>}
    <div class="c-row">{MEDIA_TYPES.map((t) => <Button key={t.id} size="sm" variant="secondary" icon={t.icon} onClick={() => onChange([...items, { type: t.id, ill: t.id === 'panorama' ? 'city-panorama' : 'hall-interior', caption: L0(), credit: '', ...(t.id === 'model3d' ? { modelId: 'lathe' } : {}), ...(t.id === 'video' || t.id === 'audio' ? { durationSec: 60 } : {}) }])}>{t.label}</Button>)}</div>
  </div>);
}

/* ════════════ KATEGORIE ════════════ */
const CAT_ICONS = ['history', 'people', 'leaf', 'factory', 'calendar', 'info', 'star', 'map', 'building', 'music', 'book', 'tree', 'pickaxe', 'camera', 'sparkles', 'community'];
export function Categories() {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask } = useCms(); const run = useRun();
  const [draft, setDraft, set] = useDraft(null); const edit = can('content.edit');
  const tree = sel.categoryTree(); const count = (id) => s.entries.filter((e) => sel.categoryIds(id).includes(e.categoryId)).length;
  const move = (list, i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; const a = list.map((c) => c.id); [a[i], a[j]] = [a[j], a[i]]; a.forEach((id, k) => { const c = sel.category(id); if (c.order !== k + 1) api.cms.save('categories', { id, order: k + 1 }); }); };
  const del = (c) => { const n = count(c.id); const kids = s.categories.filter((x) => x.parentId === c.id);
    ask({ title: 'Usunąć kategorię?', text: <>„{c.name.pl}” zostanie usunięta.{(n > 0 || kids.length > 0) && <Notice tone="warn">{n > 0 && `W kategorii jest ${n} wpisów – pozostaną bez kategorii (filtr „bez kategorii” na liście wpisów). `}{kids.length > 0 && `Podkategorie (${kids.length}) staną się kategoriami głównymi.`}</Notice>}</>, ok: 'Usuń kategorię',
      onOk: () => { kids.forEach((k) => api.cms.save('categories', { id: k.id, parentId: null })); run(api.cms.remove('categories', c.id), 'Usunięto kategorię'); } }); };
  const save = () => { if (!draft.name?.pl?.trim()) return run({ ok: false, message: { pl: 'Podaj nazwę kategorii.' } }); if (run(api.cms.save('categories', draft), draft.id ? 'Zapisano kategorię' : 'Dodano kategorię')) setDraft(null); };
  const row = (c, list, i, depth) => (<li key={c.id} class={clsx('c-tree__row', depth && 'is-sub')}>
    <span class="c-tree__ic"><Icon name={c.icon || 'folder'} size={18} /></span>
    <span class="c-tree__n"><b>{c.name.pl}</b><small>{langsOn().filter((l) => l.code !== 'pl').map((l) => `${l.code.toUpperCase()}: ${c.name[l.code] || '—'}`).join(' · ')}</small></span>
    <Tag>{count(c.id)} wpisów</Tag>
    <span class="c-rowact">
      <IconButton icon="up" variant="plain" size="sm" label="Przesuń wyżej" disabled={!edit || i === 0} onClick={() => move(list, i, -1)} />
      <IconButton icon="down" variant="plain" size="sm" label="Przesuń niżej" disabled={!edit || i === list.length - 1} onClick={() => move(list, i, 1)} />
      {!depth && <IconButton icon="plus" variant="plain" size="sm" label="Dodaj podkategorię" disabled={!edit} onClick={() => setDraft({ parentId: c.id, name: L0(), icon: c.icon, order: (c.children?.length || 0) + 1 })} />}
      <IconButton icon="edit" variant="plain" size="sm" label="Zmień nazwę i ikonę" disabled={!edit} onClick={() => setDraft(deepClone(sel.category(c.id)))} />
      <IconButton icon="trash" variant="plain" size="sm" label="Usuń" disabled={!edit} onClick={() => del(c)} /></span>
  </li>);
  return (<div class="c-page">
    <Head title="Kategorie i podkategorie" sub="Struktura nawigacji treści w aplikacji, na stronie WWW i w kioskach"><Button icon="plus" disabled={!edit} title={edit ? undefined : denyText('content.edit', staff)} onClick={() => setDraft({ parentId: null, name: L0(), icon: 'info', order: tree.length + 1 })}>Nowa kategoria</Button></Head>
    <section class="c-panel"><ul class="c-tree">{tree.map((c, i) => [row(c, tree, i, 0), c.children.length ? <li key={c.id + '-k'}><ul class="c-tree c-tree--sub">{c.children.map((x, j) => row(x, c.children, j, 1))}</ul></li> : null])}</ul>
      {!tree.length && <Empty title="Brak kategorii" />}</section>
    <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edycja kategorii' : draft?.parentId ? 'Nowa podkategoria' : 'Nowa kategoria'} size="md"
      footer={<><Button variant="secondary" size="sm" onClick={() => setDraft(null)}>Anuluj</Button><Button size="sm" icon="save" onClick={save}>Zapisz</Button></>}>
      {draft && <Form draft={draft} set={set} cols={1} fields={[
        { k: 'name', label: 'Nazwa', type: 'L' },
        { k: 'parentId', label: 'Kategoria nadrzędna', type: 'select', empty: '— kategoria główna —', opts: () => s.categories.filter((c) => !c.parentId && c.id !== draft.id).map((c) => ({ id: c.id, label: c.name.pl })) },
        { k: 'icon', label: 'Ikona', type: 'custom', render: (d, st) => <div class="c-icons">{CAT_ICONS.map((ic) => <button key={ic} type="button" class={d.icon === ic ? 'is-on' : ''} aria-label={ic} aria-pressed={d.icon === ic} onClick={() => st('icon', ic)}><Icon name={ic} size={20} /></button>)}</div> },
        { k: 'order', label: 'Kolejność', type: 'number', min: 1 },
      ]} />}
    </Modal>
  </div>);
}

/* ════════════ AKTUALNOŚCI · GALERIA · FILMY ════════════ */
export function NewsCrud({ openId }) {
  return (<div class="c-page"><Head title="Aktualności" sub="Komunikaty na stronie WWW, w aplikacji i na ekranach LCD" />
    <Crud col="news" title="Aktualności" noun="aktualność" openId={openId} search={(n) => [n.title.pl, n.title.en]}
      blank={() => ({ title: L0(), body: L0(), date: localIso(new Date()), ill: 'hall-exterior', status: 'draft' })}
      cols={[{ k: 'title', label: 'Tytuł', render: (n) => <b>{n.title.pl}</b> }, { k: 'date', label: 'Data', render: (n) => <When iso={n.date} /> }, { k: 'status', label: 'Status', render: (n) => <Tag tone={n.status === 'draft' ? 'neutral' : 'green'}>{n.status === 'draft' ? 'Szkic' : 'Opublikowana'}</Tag> }]}
      fields={[{ k: 'title', label: 'Tytuł', type: 'L' }, { k: 'body', label: 'Treść', type: 'Ltext', rows: 4 }, { k: 'date', label: 'Data publikacji', type: 'datetime' },
        { k: 'status', label: 'Status', type: 'select', empty: false, opts: [{ id: 'published', label: 'Opublikowana' }, { id: 'draft', label: 'Szkic (niewidoczna)' }] }, { k: 'ill', label: 'Ilustracja', type: 'image', srcKey: 'src' }]} />
  </div>);
}
export function GalleryCrud({ openId }) {
  return (<div class="c-page"><Head title="Galeria" sub="Zdjęcia archiwalne i współczesne (sekcja Historia → Galeria)" />
    <Crud col="gallery" title="Galeria" noun="zdjęcie" openId={openId} search={(g) => [g.title.pl, g.author, (g.tags || []).join(' ')]}
      blank={() => ({ title: L0(), description: L0(), ill: 'factory-archival', year: null, author: '', tags: [] })}
      cols={[{ k: 'ill', label: '', sort: false, w: '64px', render: (g) => <span class="c-thumb c-thumb--sm"><Media ill={g.ill} src={g.src} ratio="1/1" shape="plain" /></span> }, { k: 'title', label: 'Tytuł', render: (g) => <b>{g.title.pl}</b> }, { k: 'year', label: 'Rok' }, { k: 'author', label: 'Autor' }]}
      fields={[{ k: 'title', label: 'Tytuł', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext' }, { k: 'ill', label: 'Obraz', type: 'image', srcKey: 'src' }, { k: 'year', label: 'Rok', type: 'number' }, { k: 'author', label: 'Autor / źródło' }, { k: 'tags', label: 'Tagi', type: 'tags' }]} />
  </div>);
}
export function VideosCrud({ openId }) {
  return (<div class="c-page"><Head title="Filmy" sub="Filmy z wirtualnego studia, archiwalne i transmisje – z napisami (wymóg dostępności)" />
    <Crud col="videos" title="Filmy" noun="film" openId={openId} modalSize="xl" search={(v) => [v.title.pl, v.title.en]}
      blank={() => ({ title: L0(), description: L0(), durationSec: 60, ill: 'studio', kind: 'studio', year: null, captions: [{ t: 0, text: L0() }] })}
      beforeSave={(d) => ({ ...d, captions: (d.captions || []).slice().sort((a, b) => a.t - b.t) })}
      cols={[{ k: 'title', label: 'Tytuł', render: (v) => <b>{v.title.pl}</b> }, { k: 'kind', label: 'Rodzaj', render: (v) => ({ studio: 'Studio', archive: 'Archiwalny', live: 'Transmisja' }[v.kind] || v.kind) }, { k: 'durationSec', label: 'Czas', align: 'right', render: (v) => `${Math.floor(v.durationSec / 60)}:${String(v.durationSec % 60).padStart(2, '0')}` }, { k: 'captions', label: 'Napisy', sort: (v) => v.captions?.length || 0, render: (v) => <Tag tone={v.captions?.length ? 'green' : 'warn'} icon="captions">{v.captions?.length || 0} linii</Tag> }]}
      fields={[{ k: 'title', label: 'Tytuł', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext', rows: 2 }, { k: 'kind', label: 'Rodzaj', type: 'select', empty: false, opts: [{ id: 'studio', label: 'Wirtualne studio' }, { id: 'archive', label: 'Archiwalny' }, { id: 'live', label: 'Transmisja' }] },
        { k: 'year', label: 'Rok', type: 'number' }, { k: 'durationSec', label: 'Czas trwania (s)', type: 'number', min: 1 }, { k: 'ill', label: 'Kadr / miniatura', type: 'image' },
        { k: 'captions', label: 'Napisy (linie z czasem rozpoczęcia)', type: 'custom', render: (d, set) => <CaptionsEditor value={d.captions || []} onChange={(v) => set('captions', v)} max={d.durationSec} /> }]} />
  </div>);
}
function CaptionsEditor({ value, onChange, max }) {
  const upd = (i, p) => onChange(value.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (<div class="c-caps">
    {value.map((c, i) => <div class="c-caps__row" key={i}><FieldBox label="Od (s)"><Input type="number" min="0" max={max} value={c.t} onInput={(e) => upd(i, { t: +e.currentTarget.value || 0 })} /></FieldBox>
      <LangInputs value={c.text} onChange={(v) => upd(i, { text: v })} /><IconButton icon="trash" variant="plain" size="sm" label="Usuń linię" onClick={() => onChange(value.filter((_, j) => j !== i))} /></div>)}
    <Button size="sm" variant="secondary" icon="plus" onClick={() => onChange([...value, { t: value.length ? Math.min(max || 9999, Math.max(...value.map((c) => c.t)) + 5) : 0, text: L0() }])}>Dodaj linię napisów</Button>
  </div>);
}

/* ════════════ BIBLIOTEKA MEDIÓW ════════════ */
const MAX_IMG = 1.2 * 1024 * 1024;
/** Tryb serwerowy (pilotaż): obrazy trafiają jako dataUrl do wspólnego stanu na serwerze – mniejszy limit. */
export const REMOTE_IMG = 300 * 1024;
export const isRemote = (s) => s.net?.mode === 'remote';
export const imgLimit = (s, local = MAX_IMG) => (isRemote(s) ? Math.min(REMOTE_IMG, local) : local);
const kindOf = (f) => (f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : /\.(glb|gltf|obj|fbx|usdz)$/i.test(f.name) ? 'model3d' : 'other');
export const fmtSize = (b) => (b == null ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} kB` : `${(b / 1048576).toFixed(1)} MB`);
export function mediaUsages(s, m) {
  const out = [];
  s.entries.forEach((e) => (e.media || []).forEach((x) => { if (x.src === m.id) out.push(`Wpis: ${e.title.pl}`); }));
  ['gallery', 'news', 'venues'].forEach((c) => s[c].forEach((x) => { if (x.src === m.id) out.push(`${{ gallery: 'Galeria', news: 'Aktualność', venues: 'Obiekt' }[c]}: ${x.title?.pl || x.name?.pl}`); }));
  if (m.dataUrl && s.settings.logo === m.dataUrl) out.push('Logotyp (Ustawienia → Identyfikacja)');
  return out;
}
export function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
export function MediaLibrary() {
  const s = useStore(); const { api, toast } = useClient(); const { can, ask } = useCms(); const run = useRun();
  const [type, setType] = useState(''); const [q, setQ] = useState(''); const [cur, setCur, set] = useDraft(null); const [over, setOver] = useState(false);
  const ok = can('media'); const remote = isRemote(s); const lim = imgLimit(s); const limTxt = remote ? '300\u00a0kB' : '1,2\u00a0MB';
  const upload = async (files) => {
    for (const f of Array.from(files || [])) {
      const k = kindOf(f);
      if (k === 'image') { if (f.size > lim) { toast(`„${f.name}” ma ${fmtSize(f.size)} – ${remote ? 'w pilotażu serwerowym' : 'w prototypie'} obrazy do ${limTxt}.`, 'error', 5000); continue; }
        const dataUrl = await readFile(f); run(api.cms.save('media', { name: f.name, type: 'image', mime: f.type, dataUrl, size: f.size, tags: [], uploadedAt: nowIso() }), `Wgrano „${f.name}”`); }
      else run(api.cms.save('media', { name: f.name, type: k, mime: f.type || '', dataUrl: null, size: f.size, tags: [], uploadedAt: nowIso(), note: 'Prototyp: zapisano tylko metadane – w wersji docelowej plik trafia na serwer treści (CDN) z transkodowaniem.' }), `Zarejestrowano „${f.name}” (metadane)`);
    }
  };
  const list = s.media.filter((m) => (!type || m.type === type) && matches(q, m.name, (m.tags || []).join(' ')));
  const del = (m) => { const u = mediaUsages(s, m); ask({ title: 'Usunąć plik?', text: <>„{m.name}” zostanie usunięty z biblioteki.{u.length > 0 && <Notice tone="warn">Plik jest używany ({u.length}): {u.join('; ')}. Te miejsca wrócą do ilustracji systemowej.</Notice>}</>, ok: 'Usuń plik', onOk: () => { if (run(api.cms.remove('media', m.id), 'Usunięto plik')) setCur(null); } }); };
  return (<div class="c-page">
    <Head title="Biblioteka mediów" sub="Zdjęcia, nagrania audio, filmy i obiekty 3D wykorzystywane we wpisach, galerii i ofercie" />
    <label class={clsx('c-drop', over && 'is-over', !ok && 'is-off')} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); if (ok) upload(e.dataTransfer.files); }}>
      <input type="file" multiple disabled={!ok} accept="image/*,audio/*,video/*,.glb,.gltf,.obj,.fbx,.usdz" class="c-sr" data-testid="media-upload" onChange={(e) => { upload(e.currentTarget.files); e.currentTarget.value = ''; }} />
      <Icon name="upload" size={28} /><span><b>Przeciągnij pliki tutaj lub kliknij, aby wybrać</b><small>Obrazy (JPG, PNG, SVG, WebP) do {limTxt} zapisują się w prototypie w całości. Audio, wideo i 3D (GLB/GLTF/USDZ) – tylko metadane; w wersji docelowej pliki trafiają na serwer.</small></span>
    </label>
    {remote && <Notice tone="info" icon="cloud" data-testid="media-remote-note">Pilotaż serwerowy: wgrane obrazy trafiają do wspólnego stanu na serwerze (widoczne na wszystkich urządzeniach), dlatego limit wynosi 300 kB na plik. Zmniejsz zdjęcia przed wgraniem.</Notice>}
    <div class="c-toolbar"><SearchInput value={q} onInput={setQ} placeholder="Szukaj plików" />
      <Seg value={type} onChange={setType} options={[{ id: '', label: 'Wszystkie' }, ...MEDIA_TYPES.filter((t) => t.id !== 'panorama').map((t) => ({ ...t, badge: s.media.filter((m) => m.type === t.id).length }))]} />
      <span class="c-grow" /><span class="c-count">{list.length} plików</span></div>
    {list.length ? <div class="c-mgrid">{list.map((m) => { const u = mediaUsages(s, m).length; return (
      <button type="button" class="c-mcard" key={m.id} onClick={() => setCur(deepClone(m))}>
        <span class="c-mcard__pv">{m.dataUrl ? <img src={m.dataUrl} alt="" /> : <Icon name={MEDIA_TYPES.find((t) => t.id === m.type)?.icon || 'file'} size={34} />}</span>
        <b>{m.name}</b><small>{MEDIA_TYPES.find((t) => t.id === m.type)?.label || 'Plik'} · {fmtSize(m.size)} · {u ? `użyty ${u}×` : 'nieużywany'}</small></button>); })}</div>
      : <Empty icon="image" title={s.media.length ? 'Brak plików spełniających kryteria' : 'Biblioteka jest pusta'} text="Wgraj pierwszy plik powyżej." />}
    <Modal open={!!cur} onClose={() => setCur(null)} size="lg" title={cur?.name}
      footer={cur && <><Button variant="danger" size="sm" icon="trash" disabled={!ok} onClick={() => del(cur)}>Usuń</Button><span class="c-grow" /><Button variant="secondary" size="sm" onClick={() => setCur(null)}>Zamknij</Button><Button size="sm" icon="save" disabled={!ok} onClick={() => { if (run(api.cms.save('media', cur), 'Zapisano')) setCur(null); }}>Zapisz</Button></>}>
      {cur && <div class="c-split">
        <div class="c-mprev">{cur.dataUrl ? <img src={cur.dataUrl} alt={cur.alt?.pl || cur.name} /> : <div class="c-mprev__ph"><Icon name={MEDIA_TYPES.find((t) => t.id === cur.type)?.icon || 'file'} size={48} /><span>Podgląd niedostępny w prototypie</span></div>}</div>
        <div><Form draft={cur} set={set} cols={1} fields={[{ k: 'name', label: 'Nazwa pliku' }, { k: 'alt', label: 'Tekst alternatywny / opis', type: 'L' }, { k: 'tags', label: 'Tagi', type: 'tags' }]} />
          <dl class="c-dl"><dt>Typ</dt><dd>{cur.mime || cur.type}</dd><dt>Rozmiar</dt><dd>{fmtSize(cur.size)}</dd><dt>Wgrano</dt><dd>{cur.uploadedAt ? fmtDateTime(cur.uploadedAt, 'pl') : '—'}</dd>
            <dt>Użycia</dt><dd>{mediaUsages(s, cur).join('; ') || 'nieużywany – wybierz go w edytorze wpisu (Media → obraz → Biblioteka mediów)'}</dd></dl>
          {cur.note && <Notice tone="info">{cur.note}</Notice>}</div>
      </div>}
    </Modal>
  </div>);
}
