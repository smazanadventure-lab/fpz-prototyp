// CMS – rejestr wyzwalaczy: kody QR (generowanie, SVG, arkusz do druku), nadajniki BLE (zasięg), punkty AR.
import { useState, useEffect } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { deepClone, matches, download } from '../../kernel/util.js';
import { Icon, Button, IconButton, Modal, Select, Switch, SearchInput, Tag, Notice, QR, qrSvgString } from '../../ui/components.jsx';
import { useCms, useRun, useDraft, DataTable, Form, FieldBox, Seg, Head, poiOpts, denyText } from './kit.jsx';
import { MODELS } from './content.jsx';

export const KIND = { qr: ['Kod QR', 'qr'], ble: ['Nadajnik BLE', 'bluetooth'], ar: ['Punkt AR', 'ar'] };
export const TARGETS = [{ id: 'entry', label: 'Wpis' }, { id: 'poi', label: 'Miejsce' }, { id: 'mission', label: 'Misja gry' }, { id: 'coupon', label: 'Kupon' }];
export function targetOpts(type) {
  const s = getState();
  if (type === 'entry') return s.entries.map((e) => ({ id: e.id, label: e.title.pl + (e.status !== 'published' ? ` (${e.status})` : '') }));
  if (type === 'poi') return poiOpts();
  if (type === 'mission') return s.gameRoutes.flatMap((r) => r.missions.map((m) => ({ id: m.id, label: `${r.name.pl} › ${m.title.pl}` })));
  if (type === 'coupon') return s.coupons.map((c) => ({ id: c.id, label: c.title.pl }));
  return [];
}
export function targetLabel(t) {
  const x = t?.target; if (!x) return '—'; const s = getState();
  const it = { entry: () => sel.entry(x.id)?.title.pl, poi: () => sel.poi(x.id)?.name.pl, mission: () => sel.mission(x.id)?.title.pl, coupon: () => s.coupons.find((c) => c.id === x.id)?.title.pl }[x.type]?.();
  return `${TARGETS.find((y) => y.id === x.type)?.label || x.type}: ${it || '⚠ brak celu'}`;
}
const UUID = 'F0018B9B-7509-4C31-A905-1A27D39C003C';
export const blankTrigger = (kind, extra = {}) => ({ kind, label: '', target: { type: 'poi', id: null }, poiId: null, active: true,
  ...(kind === 'ble' ? { ble: { uuid: UUID, major: 100, minor: 500 + Math.floor(Math.random() * 400), rangeM: 15, txPower: -59, battery: 100 } } : {}),
  ...(kind === 'ar' ? { ar: { marker: 'wzorzec na tablicy', scene: 'plaza', overlay: 'info', modelId: null } } : {}), ...extra });
const svgFor = (t) => qrSvgString(sel.qrPayload(t), 600);

export default function Triggers({ openId }) {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask, clearOpen } = useCms(); const run = useRun();
  const [kind, setKind] = useState(''); const [q, setQ] = useState(''); const [draft, setDraft, set] = useDraft(null); const [sheet, setSheet] = useState(false);
  const edit = can('triggers');
  useEffect(() => { if (openId) { const t = sel.trigger(openId); if (t) setDraft(deepClone(t)); clearOpen(); } }, [openId]);
  const rows = s.triggers.filter((t) => (!kind || t.kind === kind) && matches(q, t.code, t.label, targetLabel(t), sel.poi(t.poiId)?.name.pl));
  const save = () => {
    if (!draft.target?.id) return run({ ok: false, message: { pl: 'Wybierz cel wyzwalacza (wpis, miejsce, misję lub kupon).' } });
    const d = { ...draft, label: draft.label || targetLabel(draft) };
    const r = api.cms.save('triggers', d); if (run(r, draft.id ? 'Zapisano wyzwalacz' : `Nadano kod ${r.item?.code}${draft.kind === 'qr' ? ' – od razu skanowalny w aplikacji' : ''}`)) setDraft(deepClone(r.item));
  };
  const del = (t) => ask({ title: 'Usunąć wyzwalacz?', text: `${t.code} („${t.label}”) przestanie działać w aplikacji i grze.`, ok: 'Usuń', onOk: () => { if (run(api.cms.remove('triggers', t.id), 'Usunięto wyzwalacz')) setDraft(null); } });
  const qrList = rows.filter((t) => t.kind === 'qr' && t.active !== false);
  return (<div class="c-page">
    <Head title="Wyzwalacze QR · BLE · AR" sub="Kody i nadajniki prowadzące do treści, miejsc, misji gry i kuponów">
      {Object.entries(KIND).map(([k, [l, ic]]) => <Button key={k} size="sm" variant={k === 'qr' ? 'primary' : 'secondary'} icon={ic} disabled={!edit} title={edit ? undefined : denyText('triggers', staff)} onClick={() => setDraft(blankTrigger(k))}>{k === 'qr' ? 'Generuj kod QR' : k === 'ble' ? 'Rejestruj beacon' : 'Nowy punkt AR'}</Button>)}
    </Head>
    <div class="c-toolbar">
      <Seg value={kind} onChange={setKind} options={[{ id: '', label: 'Wszystkie', badge: s.triggers.length }, ...Object.entries(KIND).map(([id, [l, icon]]) => ({ id, label: l, icon, badge: s.triggers.filter((t) => t.kind === id).length }))]} />
      <SearchInput value={q} onInput={setQ} placeholder="Kod, etykieta, cel, miejsce" />
      <span class="c-grow" /><Button size="sm" variant="secondary" icon="printer" disabled={!qrList.length} onClick={() => setSheet(true)}>Arkusz do druku ({qrList.length})</Button>
    </div>
    <DataTable rows={rows} onRow={(t) => setDraft(deepClone(t))} initial={{ k: 'code', dir: 1 }} cols={[
      { k: 'code', label: 'Kod', render: (t) => <span class="c-code"><Icon name={KIND[t.kind][1]} size={15} /><b>{t.code}</b></span> },
      { k: 'label', label: 'Etykieta', render: (t) => <span class="c-small">{t.label}</span> },
      { k: 'target', label: 'Cel', sort: (t) => targetLabel(t), render: (t) => <span class="c-small">{targetLabel(t)}</span> },
      { k: 'poiId', label: 'Miejsce', sort: (t) => sel.poi(t.poiId)?.name.pl, render: (t) => <span class="c-small">{sel.poi(t.poiId)?.name.pl || '—'}</span> },
      { k: 'param', label: 'Parametry', sort: false, render: (t) => (t.kind === 'ble' ? <span class="c-small c-nowrap">{t.ble?.rangeM} m · <Icon name="battery" size={12} /> {t.ble?.battery}%</span> : t.kind === 'ar' ? <span class="c-small">{t.ar?.overlay}</span> : <span class="c-small c-muted">URL</span>) },
      { k: 'active', label: 'Aktywny', render: (t) => <Switch label={<span class="c-sr">Aktywny {t.code}</span>} checked={t.active !== false} disabled={!edit} onChange={(e) => run(api.cms.save('triggers', { id: t.id, active: e.currentTarget.checked }), e.currentTarget.checked ? `${t.code} aktywny` : `${t.code} wyłączony`)} /> },
      { k: 'scans', label: 'Skany', align: 'right', render: (t) => (t.scans || 0).toLocaleString('pl-PL') },
      { k: '_a', label: '', sort: false, align: 'right', render: (t) => <span class="c-rowact">{t.kind === 'qr' && <IconButton icon="download" variant="plain" size="sm" label={`Pobierz SVG ${t.code}`} onClick={() => download(`${t.code}.svg`, svgFor(t), 'image/svg+xml')} />}<IconButton icon="edit" variant="plain" size="sm" label="Edytuj" onClick={() => setDraft(deepClone(t))} /><IconButton icon="trash" variant="plain" size="sm" label="Usuń" disabled={!edit} onClick={() => del(t)} /></span> },
    ]} />
    <Modal open={!!draft} onClose={() => setDraft(null)} size="lg" title={draft && (draft.id ? `${KIND[draft.kind][0]} ${draft.code}` : `${KIND[draft.kind][0]} – nowy`)}
      footer={draft && <>{draft.id && <Button variant="danger" size="sm" icon="trash" disabled={!edit} onClick={() => del(draft)}>Usuń</Button>}<span class="c-grow" /><Button variant="secondary" size="sm" onClick={() => setDraft(null)}>Zamknij</Button><Button size="sm" icon="save" disabled={!edit} onClick={save}>{draft.id ? 'Zapisz' : draft.kind === 'qr' ? 'Generuj kod' : 'Zarejestruj'}</Button></>}>
      {draft && <TriggerForm draft={draft} set={set} edit={edit} />}
    </Modal>
    <Modal open={sheet} onClose={() => setSheet(false)} size="xl" title={`Arkusz kodów QR do druku (${qrList.length})`}
      footer={<><span class="c-muted c-small">Kody wskazują adres https://app.fpz.example/q/&lt;kod&gt; – otwierają aplikację lub stronę WWW.</span><span class="c-grow" /><Button size="sm" icon="printer" onClick={() => printSheet(qrList)}>Drukuj</Button></>}>
      <div class="c-sheet">{qrList.map((t) => <figure key={t.id}><QR value={sel.qrPayload(t)} size={120} /><figcaption><b>{t.code}</b><span>{t.label}</span></figcaption></figure>)}</div>
    </Modal>
  </div>);
}

function printSheet(list) {
  const esc = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Kody QR – Fabryka Pełna Życia</title><style>body{font:12px Helvetica,Arial,sans-serif;margin:12mm;color:#000}h1{font-size:16px}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:8mm}figure{margin:0;border:1px dashed #999;padding:4mm;text-align:center;break-inside:avoid}svg{width:38mm;height:38mm}b{display:block;font-size:13px;margin-top:2mm}span{font-size:10px}</style></head><body><h1>Kody QR – Fabryka Pełna Życia (wersja testowa)</h1><div class="g">${list.map((t) => `<figure>${svgFor(t)}<b>${esc(t.code)}</b><span>${esc(t.label)}</span></figure>`).join('')}</div><script>setTimeout(function(){window.print()},300)<\/script></body></html>`;
  let w = null; try { w = window.open('', '_blank', 'width=900,height=700'); } catch { w = null; }
  if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); } else window.print();
}

function TriggerForm({ draft, set, edit }) {
  const s = useStore();
  const t = draft.target || { type: 'poi', id: null };
  const setTarget = (type, id) => { set('target', { type, id }); if (type === 'poi' && id) set('poiId', id); if (type === 'entry' && id && !draft.poiId) set('poiId', sel.entry(id)?.poiId || null); if (type === 'mission' && id && !draft.poiId) set('poiId', sel.mission(id)?.poiId || null); };
  const ble = draft.ble || {}; const live = draft.id ? sel.trigger(draft.id) : null;
  return (<fieldset class="c-fs" disabled={!edit}>
    <div class="c-split">
      <div>
        <Form draft={draft} set={set} cols={1} fields={[{ k: 'label', label: 'Etykieta (opis dla obsługi)', placeholder: 'np. Tablica przy wejściu do hali' }]} />
        <div class="c-row">
          <FieldBox label="Cel – rodzaj"><Select value={t.type} onChange={(e) => setTarget(e.currentTarget.value, null)}>{TARGETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></FieldBox>
          <FieldBox label="Cel – pozycja" class="c-grow"><Select value={t.id || ''} onChange={(e) => setTarget(t.type, e.currentTarget.value || null)}><option value="">— wybierz —</option>{targetOpts(t.type).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></FieldBox>
        </div>
        <Form draft={draft} set={set} cols={1} fields={[{ k: 'poiId', label: 'Miejsce instalacji', type: 'select', opts: poiOpts, hint: 'Położenie nadajnika / tablicy – służy do wykrywania zasięgu i statystyk.' }, { k: 'active', label: 'Aktywny', type: 'switch' }]} />
      </div>
      <div>
        {draft.kind === 'qr' && (draft.code ? <div class="c-qrbox">
          <QR value={sel.qrPayload(draft)} size={180} label={draft.code} />
          <code class="c-small">{sel.qrPayload(draft)}</code>
          <div class="c-row"><Button size="sm" icon="download" onClick={() => download(`${draft.code}.svg`, svgFor(draft), 'image/svg+xml')}>Pobierz SVG</Button><Button size="sm" variant="secondary" icon="printer" onClick={() => printSheet([draft])}>Drukuj</Button></div>
          <Notice tone="ok" icon="phone">Nowy kod jest od razu skanowalny w aplikacji – wybierz go w panelu „Otoczenie telefonu” (kod w kadrze kamery).</Notice>
          {live && <p class="c-small c-muted">Skany: {live.scans || 0}</p>}
        </div> : <Notice tone="info" icon="qr">Kod zostanie nadany automatycznie po zapisaniu (seria FPZ-Q-…). Potem możesz pobrać plik SVG do druku.</Notice>)}
        {draft.kind === 'ble' && <div class="c-form c-form--1">
          {draft.code && <p><Tag tone="info" icon="bluetooth">{draft.code}</Tag></p>}
          <FieldBox label="UUID"><input class="fpz-input c-mono" value={ble.uuid || ''} onInput={(e) => set('ble.uuid', e.currentTarget.value)} /></FieldBox>
          <div class="c-row"><FieldBox label="Major"><input class="fpz-input" type="number" value={ble.major ?? ''} onInput={(e) => set('ble.major', +e.currentTarget.value)} /></FieldBox><FieldBox label="Minor"><input class="fpz-input" type="number" value={ble.minor ?? ''} onInput={(e) => set('ble.minor', +e.currentTarget.value)} /></FieldBox><FieldBox label="Moc (dBm @1 m)"><input class="fpz-input" type="number" value={ble.txPower ?? -59} onInput={(e) => set('ble.txPower', +e.currentTarget.value)} /></FieldBox></div>
          <FieldBox label="Zasięg wyzwalania" hint="Telefon uruchamia treść, gdy znajdzie się bliżej niż ustawiony zasięg (symulacja: panel otoczenia telefonu).">
            <div class="c-range"><input type="range" min="1" max="70" step="1" value={ble.rangeM ?? 15} aria-label="Zasięg w metrach" data-testid="ble-range" onInput={(e) => set('ble.rangeM', +e.currentTarget.value)} /><b>{ble.rangeM ?? 15} m</b></div>
            <div class="c-bleviz" aria-hidden="true"><span style={{ width: `${((ble.rangeM ?? 15) / 70) * 100}%` }} /></div></FieldBox>
          <FieldBox label="Stan baterii"><div class="c-range"><input type="range" min="0" max="100" value={ble.battery ?? 100} aria-label="Bateria" onInput={(e) => set('ble.battery', +e.currentTarget.value)} /><b class={ble.battery < 25 ? 'c-danger' : ''}>{ble.battery ?? 100}%</b></div></FieldBox>
          {ble.battery < 25 && <Notice tone="warn">Niski stan baterii – zaplanuj wymianę.</Notice>}
        </div>}
        {draft.kind === 'ar' && <div class="c-form c-form--1">
          {draft.code && <p><Tag tone="info" icon="ar">{draft.code}</Tag></p>}
          <Form draft={draft} set={set} cols={1} fields={[
            { k: 'ar.marker', label: 'Wzorzec (opis znacznika rozpoznawanego przez kamerę)', placeholder: 'np. tablica z grafiką hali' },
            { k: 'ar.scene', label: 'Scena', type: 'select', empty: false, opts: [{ id: 'hall', label: 'Wnętrze hali' }, { id: 'plaza', label: 'Plac / teren otwarty' }, { id: 'city', label: 'Miasto' }] },
            { k: 'ar.overlay', label: 'Typ nakładki', type: 'select', empty: false, opts: [{ id: 'future', label: 'future – wizja przyszłości' }, { id: 'info', label: 'info – plansza informacyjna' }, { id: 'model', label: 'model – obiekt 3D' }] },
            { k: 'ar.modelId', label: 'Obiekt 3D', type: 'select', opts: MODELS, show: (d) => d.ar?.overlay === 'model' },
          ]} />
          <Notice tone="info">Rozpoznawanie wzorca jest w prototypie symulowane (panel otoczenia telefonu → „wzorzec AR w kadrze”).</Notice>
        </div>}
      </div>
    </div>
  </fieldset>);
}
