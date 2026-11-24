// CMS – miejsca (POI) i mapa: tabela, edytor z współrzędnymi (klik na mapie), pozycja na planie terenu, przypisane treści i wyzwalacze.
import { useState, useEffect } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { deepClone, matches, clamp } from '../../kernel/util.js';
import { Icon, Button, IconButton, Modal, Input, Select, SearchInput, Tag, Notice } from '../../ui/components.jsx';
import { CityMap, SitePlan } from '../../ui/maps.jsx';
import { useCms, useRun, useDraft, DataTable, Form, FieldBox, LangInputs, Seg, Head, denyText, missingLangs } from './kit.jsx';

export const POI_KINDS = [['hall', 'Hala / budynek'], ['spot', 'Punkt ekspozycji'], ['nature', 'Przyroda'], ['park', 'Park'], ['tree', 'Pomnik przyrody'], ['industry', 'Dziedzictwo przemysłowe'], ['history', 'Zabytek / historia'], ['culture', 'Kultura'], ['service', 'Usługi']].map(([id, label]) => ({ id, label }));
const kindLabel = (k) => POI_KINDS.find((x) => x.id === k)?.label || k;
const L0 = () => ({ pl: '', en: '' });
const r6 = (v) => Math.round(v * 1e6) / 1e6;

export default function Places({ openId }) {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask, clearOpen } = useCms(); const run = useRun();
  const [f, setF] = useState({ scope: '', kind: '', q: '' }); const up = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [draft, setDraft, set] = useDraft(null); const edit = can('content.edit');
  useEffect(() => { if (openId) { const p = sel.poi(openId); if (p) setDraft(deepClone(p)); clearOpen(); } }, [openId]);
  const rows = s.pois.filter((p) => (!f.scope || p.scope === f.scope) && (!f.kind || p.kind === f.kind) && matches(f.q, p.name.pl, p.name.en, (p.tags || []).join(' ')));
  const nE = (id) => s.entries.filter((e) => e.poiId === id).length; const nT = (id) => s.triggers.filter((t) => t.poiId === id).length;
  const blank = () => ({ name: L0(), kind: 'spot', scope: 'fpz', lat: s.site.lat, lng: s.site.lng, site: { x: 50, y: 50 }, building: null, districtId: s.districts[0]?.id || null, short: L0(), description: L0(), accessible: true, accessNote: L0(), protection: null, tags: [], ill: 'park', active: true });
  const save = () => { if (!draft.name?.pl?.trim()) return run({ ok: false, message: { pl: 'Podaj nazwę miejsca.' } }); const d = { ...draft, site: draft.scope === 'fpz' ? draft.site || { x: 50, y: 50 } : null }; const r = api.cms.save('pois', d); if (run(r, draft.id ? 'Zapisano miejsce – mapy zaktualizowane' : 'Dodano miejsce')) setDraft(deepClone(r.item)); };
  const del = (p) => ask({ title: 'Usunąć miejsce?', text: <>„{p.name.pl}” zniknie z map i list.{(nE(p.id) + nT(p.id)) > 0 && <Notice tone="warn">Przypisane: {nE(p.id)} wpisów, {nT(p.id)} wyzwalaczy – stracą powiązanie z miejscem.</Notice>}</>, ok: 'Usuń', onOk: () => { if (run(api.cms.remove('pois', p.id), 'Usunięto miejsce')) setDraft(null); } });
  return (<div class="c-page">
    <Head title="Miejsca i mapa" sub="Obiekty na terenie FPŻ i punkty w mieście – współrzędne geograficzne, pozycja na planie terenu, dostępność">
      <Button icon="plus" disabled={!edit} title={edit ? undefined : denyText('content.edit', staff)} onClick={() => setDraft(blank())}>Nowe miejsce</Button></Head>
    <div class="c-toolbar">
      <Seg value={f.scope} onChange={(v) => up('scope', v)} options={[{ id: '', label: 'Wszystkie', badge: s.pois.length }, { id: 'fpz', label: 'Teren FPŻ', badge: s.pois.filter((p) => p.scope === 'fpz').length }, { id: 'city', label: 'Miasto', badge: s.pois.filter((p) => p.scope === 'city').length }]} />
      <Select value={f.kind} onChange={(e) => up('kind', e.currentTarget.value)} aria-label="Rodzaj"><option value="">Wszystkie rodzaje</option>{POI_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select>
      <SearchInput value={f.q} onInput={(v) => up('q', v)} placeholder="Szukaj miejsc" /><span class="c-grow" /><span class="c-count">{rows.length} miejsc</span>
    </div>
    <DataTable rows={rows} onRow={(p) => setDraft(deepClone(p))} initial={{ k: 'name', dir: 1 }} cols={[
      { k: 'name', label: 'Nazwa', render: (p) => <span class="c-ttl"><b>{p.name.pl}</b><small>{p.name.en}</small></span> },
      { k: 'scope', label: 'Zakres', render: (p) => <Tag tone={p.scope === 'fpz' ? 'green' : 'info'}>{p.scope === 'fpz' ? 'FPŻ' : 'Miasto'}</Tag> },
      { k: 'kind', label: 'Rodzaj', sort: (p) => kindLabel(p.kind), render: (p) => kindLabel(p.kind) },
      { k: 'districtId', label: 'Dzielnica', sort: (p) => s.districts.find((d) => d.id === p.districtId)?.name, render: (p) => s.districts.find((d) => d.id === p.districtId)?.name || '—' },
      { k: 'accessible', label: 'Dostępne', render: (p) => <Icon name={p.accessible ? 'wheelchair' : 'minus'} size={16} title={p.accessible ? 'dostępne' : 'ograniczona dostępność'} /> },
      { k: 'lat', label: 'Współrzędne', render: (p) => <code class="c-small c-nowrap">{p.lat?.toFixed(5)}, {p.lng?.toFixed(5)}</code> },
      { k: 'nE', label: 'Treści', align: 'right', sort: (p) => nE(p.id), render: (p) => nE(p.id) },
      { k: 'nT', label: 'Wyzw.', align: 'right', sort: (p) => nT(p.id), render: (p) => nT(p.id) },
      { k: 'active', label: 'Aktywne', render: (p) => (p.active === false ? <Tag>ukryte</Tag> : <Tag tone="green">tak</Tag>) },
    ]} />
    <Modal open={!!draft} onClose={() => setDraft(null)} size="xl" title={draft?.id ? `Miejsce: ${draft.name.pl}` : 'Nowe miejsce'}
      footer={draft && <>{draft.id && <Button variant="danger" size="sm" icon="trash" disabled={!edit} onClick={() => del(draft)}>Usuń</Button>}<span class="c-grow" /><Button variant="secondary" size="sm" onClick={() => setDraft(null)}>Zamknij</Button><Button size="sm" icon="save" disabled={!edit} onClick={save}>Zapisz</Button></>}>
      {draft && <PoiEditor draft={draft} set={set} edit={edit} />}
    </Modal>
  </div>);
}

function PoiEditor({ draft, set, edit }) {
  const s = useStore(); const { api } = useClient(); const { go, can } = useCms(); const run = useRun();
  const preview = { ...draft, id: draft.id || '__new', name: draft.name.pl ? draft.name : { pl: 'Nowe miejsce', en: 'New place' } };
  const others = (scope) => s.pois.filter((p) => p.id !== draft.id && (!scope || p.scope === scope));
  const sp = s.sitePlan; const fromPlan = () => { const o = sp.origin || { lat: s.site.lat, lng: s.site.lng }; const lat = o.lat - ((draft.site.y / 100) * (sp.heightM || 400)) / 111320; const lng = o.lng + ((draft.site.x / 100) * (sp.widthM || 600)) / (111320 * Math.cos((lat * Math.PI) / 180)); set('lat', r6(lat)); set('lng', r6(lng)); };
  const planClick = (e) => { if (!edit) return; const r = e.currentTarget.getBoundingClientRect(); set('site', { ...(draft.site || {}), x: Math.round(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)), y: Math.round(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)) }); };
  const entries = draft.id ? s.entries.filter((e) => e.poiId === draft.id) : []; const trig = draft.id ? s.triggers.filter((t) => t.poiId === draft.id) : [];
  const addTrig = (kind) => { const base = { kind, label: `${{ qr: 'QR', ble: 'Beacon', ar: 'AR' }[kind]} – ${draft.name.pl}`, target: { type: 'poi', id: draft.id }, poiId: draft.id };
    const r = api.cms.save('triggers', kind === 'ble' ? { ...base, ble: { uuid: 'F0018B9B-7509-4C31-A905-1A27D39C003C', major: 100, minor: 900 + s.triggers.length, rangeM: 15, txPower: -59, battery: 100 } } : kind === 'ar' ? { ...base, ar: { marker: 'wzorzec na tablicy', scene: 'plaza', overlay: 'info', modelId: null } } : base); run(r, r.ok && `Nadano kod ${r.item.code}`); };
  const miss = missingLangs(draft.name).concat(missingLangs(draft.description));
  return (<div class="c-poied">
    <fieldset class="c-fs" disabled={!edit}>
      {miss.length > 0 && <Notice tone="warn">Brakujące wersje językowe: {[...new Set(miss)].join(', ').toUpperCase()}</Notice>}
      <Form draft={draft} set={set} fields={[
        { k: 'name', label: 'Nazwa', type: 'L' }, { k: 'short', label: 'Krótki opis (1 zdanie)', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext', rows: 3 },
        { k: 'kind', label: 'Rodzaj', type: 'select', empty: false, opts: POI_KINDS }, { k: 'scope', label: 'Zakres', type: 'select', empty: false, opts: [{ id: 'fpz', label: 'Teren Fabryki Pełnej Życia' }, { id: 'city', label: 'Miasto i okolica' }] },
        { k: 'districtId', label: 'Dzielnica', type: 'select', opts: () => s.districts.map((d) => ({ id: d.id, label: d.name })) }, { k: 'ill', label: 'Ilustracja', type: 'image' },
        { k: 'accessible', label: 'Dostępne dla osób z niepełnosprawnościami', type: 'switch' }, { k: 'active', label: 'Widoczne w aplikacji, na stronie i w kioskach', type: 'switch', invert: false },
        { k: 'accessNote', label: 'Informacja o dostępności', type: 'L' },
        { k: 'protection', label: 'Forma ochrony (np. użytek ekologiczny, rejestr zabytków)', type: 'custom', render: (d, st) => <>{d.protection ? <FormProtection d={d} st={st} /> : <Button size="sm" variant="secondary" icon="shield" onClick={() => st('protection', { pl: '', en: '' })}>Dodaj formę ochrony</Button>}</> },
        { k: 'tags', label: 'Tagi', type: 'tags' },
      ]} />
    </fieldset>
    <div class="c-poied__maps">
      <section class="c-panel c-panel--tight"><h3>Współrzędne geograficzne</h3>
        <div class="c-row"><FieldBox label="Szerokość (lat)"><Input type="number" step="0.00001" disabled={!edit} value={draft.lat} onInput={(e) => set('lat', +e.currentTarget.value)} /></FieldBox>
          <FieldBox label="Długość (lng)"><Input type="number" step="0.00001" disabled={!edit} value={draft.lng} onInput={(e) => set('lng', +e.currentTarget.value)} /></FieldBox></div>
        <div class="c-map" data-testid="poi-citymap"><CityMap pois={[...others(), preview]} selectedId={preview.id} position={{ lat: draft.lat, lng: draft.lng }} focus={draft.scope === 'fpz' ? 'fpz' : 'city'} onMapClick={edit ? ({ lat, lng }) => { set('lat', r6(lat)); set('lng', r6(lng)); } : undefined} /></div>
        <p class="c-small c-muted"><Icon name="pointer" size={13} /> Kliknij na mapie, aby wskazać położenie. Mapa schematyczna – w wersji docelowej podkład mapowy zgodny z licencją.</p>
      </section>
      {draft.scope === 'fpz' && <section class="c-panel c-panel--tight"><h3>Pozycja na planie terenu FPŻ</h3>
        <div class="c-row"><FieldBox label="x (0–100, zachód→wschód)"><Input type="number" min="0" max="100" disabled={!edit} value={draft.site?.x ?? 50} onInput={(e) => set('site', { ...(draft.site || {}), x: +e.currentTarget.value })} /></FieldBox>
          <FieldBox label="y (0–100, północ→południe)"><Input type="number" min="0" max="100" disabled={!edit} value={draft.site?.y ?? 50} onInput={(e) => set('site', { ...(draft.site || {}), y: +e.currentTarget.value })} /></FieldBox>
          <Button size="sm" variant="ghost" icon="locate" disabled={!edit} onClick={fromPlan} title="Wylicz lat/lng z pozycji na planie">Przelicz na lat/lng</Button></div>
        <div class="c-plan" onClick={planClick}><SitePlan view="plan" pois={[...others('fpz').filter((p) => p.site), { ...preview, site: draft.site || { x: 50, y: 50 } }]} selectedId={preview.id} labels="selected" /></div>
        <p class="c-small c-muted">Kliknij na planie, aby ustawić pozycję obiektu (podgląd jak w kiosku i aplikacji).</p>
      </section>}
      {draft.id && <section class="c-panel c-panel--tight"><h3>Przypisane treści ({entries.length})</h3>
        {entries.length ? <ul class="c-links">{entries.map((e) => <li key={e.id}><button type="button" class="c-link" onClick={() => go('content', 'entries', e.id)}>{e.title.pl}</button></li>)}</ul> : <p class="c-muted c-small">Brak wpisów przypisanych do miejsca (pole „Miejsce” w edytorze wpisu).</p>}
        <h3>Wyzwalacze ({trig.length})</h3>
        {trig.length ? <ul class="c-links">{trig.map((t) => <li key={t.id}><button type="button" class="c-link" onClick={() => go('triggers', null, t.id)}><Icon name={{ qr: 'qr', ble: 'bluetooth', ar: 'ar' }[t.kind]} size={13} /> {t.code}</button> <span class="c-small c-muted">{t.label}</span></li>)}</ul> : <p class="c-muted c-small">Brak.</p>}
        <div class="c-row">{['qr', 'ble', 'ar'].map((k) => <Button key={k} size="sm" variant="secondary" icon={{ qr: 'qr', ble: 'bluetooth', ar: 'ar' }[k]} disabled={!can('triggers')} onClick={() => addTrig(k)}>+ {k.toUpperCase()}</Button>)}</div>
      </section>}
    </div>
  </div>);
}
function FormProtection({ d, st }) {
  return <div class="c-row c-row--top"><div class="c-grow"><LangInputs value={d.protection} onChange={(v) => st('protection', v)} /></div><IconButton icon="trash" variant="plain" size="sm" label="Usuń formę ochrony" onClick={() => st('protection', null)} /></div>;
}
