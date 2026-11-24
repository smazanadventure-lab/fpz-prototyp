// CMS – edytowalny silnik gry terenowej: trasy, misje (kolejność), quizy, nagrody, kupony, punkty panoramy, statystyki.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel, DIFFICULTY } from '../../kernel/api.js';
import { deepClone, sum, localIso, addDays } from '../../kernel/util.js';
import { Icon, Button, IconButton, Modal, Input, Select, Tag, Notice, Media, BarChart, Stat } from '../../ui/components.jsx';
import { useCms, useRun, useDraft, DataTable, Crud, Form, FieldBox, LangInputs, Seg, Head, poiOpts, denyText } from './kit.jsx';
import { blankTrigger, KIND } from './triggers.jsx';

const L0 = () => ({ pl: '', en: '' });
export const MISSION_KINDS = [['qr', 'Kod QR', 'qr'], ['ble', 'Beacon BLE', 'bluetooth'], ['ar', 'Punkt AR', 'ar'], ['gps', 'Geolokalizacja (GPS)', 'locate'], ['quiz', 'Quiz', 'quiz'], ['panorama', 'Panorama 360°', 'panorama'], ['idea', 'Pomysł mieszkańca', 'message']].map(([id, label, icon]) => ({ id, label, icon }));
const LEVEL_W = { easy: 1, medium: 1.5, hard: 2 };
const LEVELS = [{ id: 'easy', label: 'Łatwy' }, { id: 'medium', label: 'Średni' }, { id: 'hard', label: 'Trudny' }];

/* ════════════ TRASY I MISJE ════════════ */
export function GameRoutes() {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask } = useCms(); const run = useRun();
  const [rid, setRid] = useState('nature'); const r = sel.route(rid) || s.gameRoutes[0];
  const [rd, setRd, setR] = useDraft(null); const [md, setMd, setM] = useDraft(null);
  const edit = can('game.edit');
  if (!r) return <div class="c-page"><Notice>Brak tras gry.</Notice></div>;
  const ms = r.missions; const trigs = (m) => s.triggers.filter((t) => t.target?.type === 'mission' && t.target.id === m.id);
  const saveRoute = () => { const { missions, id, ...patch } = rd; if (run(api.cms.saveRoute(r.id, patch), 'Zapisano trasę – zmiany widoczne w grze')) setRd(null); };
  const saveMission = () => { if (!md.title?.pl?.trim() || !md.poiId) return run({ ok: false, message: { pl: 'Podaj tytuł misji i miejsce.' } }); const res = api.cms.saveMission(r.id, md); if (run(res, md.id ? 'Zapisano misję' : 'Dodano misję na końcu trasy')) setMd(deepClone(res.item)); };
  const delMission = (m) => ask({ title: 'Usunąć misję?', text: <>„{m.title.pl}” zostanie usunięta z trasy i ze wszystkich wariantów długości.{trigs(m).length > 0 && <Notice tone="warn">Prowadzą do niej wyzwalacze: {trigs(m).map((t) => t.code).join(', ')}.</Notice>}</>, ok: 'Usuń misję', onOk: () => { if (run(api.cms.removeMission(r.id, m.id), 'Usunięto misję')) setMd(null); } });
  const move = (m, d) => run(api.cms.moveMission(r.id, m.id, d));
  const base = sum(ms.filter((m) => m.active !== false), (m) => m.points || 0);
  return (<div class="c-page">
    <Head title="Trasy i misje" sub="Silnik gry edytowalny bez programowania – zmiany od razu w aplikacji mobilnej" />
    <Seg value={r.id} onChange={setRid} options={s.gameRoutes.map((x) => ({ id: x.id, label: x.name.pl, badge: x.missions.length }))} />
    <section class="c-panel c-route">
      <span class="c-route__ill"><Media ill={r.ill} ratio="4/3" shape="arc-tr" /></span>
      <div class="c-route__b">
        <h3>{r.name.pl} {r.active === false && <Tag>wyłączona</Tag>}</h3><p class="c-muted">{r.tagline?.pl}</p><p class="c-small">{r.description?.pl}</p>
        <div class="c-row c-wrap">
          {(r.modes || []).map((m) => <Tag key={m.id} icon={{ walk: 'walk', bike: 'bike', access: 'wheelchair' }[m.id]}>{m.name.pl}</Tag>)}
          {(r.lengths || []).map((l) => <Tag key={l.id} tone="info">{l.name.pl}: {l.km} km · {l.durationMin} min · {l.missionIds.length} misji</Tag>)}
          {(r.variants || []).map((v) => <Tag key={v.id} tone="green">{v.name.pl}</Tag>)}
        </div>
      </div>
      <Button size="sm" variant="secondary" icon="edit" disabled={!edit} onClick={() => setRd(deepClone(r))}>Edytuj trasę</Button>
    </section>
    <div class="c-toolbar"><h3 class="c-h3">Misje ({ms.length})</h3><span class="c-grow" />
      <Button size="sm" icon="plus" disabled={!edit} title={edit ? undefined : denyText('game.edit', staff)} onClick={() => setMd({ title: L0(), poiId: ms[ms.length - 1]?.poiId || null, kind: 'gps', story: L0(), task: L0(), taskEasy: L0(), points: 50, radiusM: 40, quizId: null, eraId: null, districtId: null, variantText: (r.variants || []).length ? Object.fromEntries(r.variants.map((v) => [v.id, L0()])) : null, accessible: true, active: true })}>Nowa misja</Button></div>
    <DataTable rows={ms} onRow={(m) => setMd(deepClone(m))} cols={[
      { k: '_n', label: '#', sort: false, w: '40px', render: (m) => <b>{ms.indexOf(m) + 1}</b> },
      { k: '_o', label: 'Kolejność', sort: false, w: '84px', render: (m) => <span class="c-rowact"><IconButton icon="up" variant="plain" size="sm" label={`Przesuń wyżej: ${m.title.pl}`} disabled={!edit || ms.indexOf(m) === 0} onClick={() => move(m, -1)} /><IconButton icon="down" variant="plain" size="sm" label={`Przesuń niżej: ${m.title.pl}`} disabled={!edit || ms.indexOf(m) === ms.length - 1} onClick={() => move(m, 1)} /></span> },
      { k: 'title', label: 'Misja', sort: false, render: (m) => <span class="c-ttl"><b>{m.title.pl}</b><small>{sel.poi(m.poiId)?.name.pl || '⚠ brak miejsca'}</small></span> },
      { k: 'kind', label: 'Rodzaj', sort: false, render: (m) => { const k = MISSION_KINDS.find((x) => x.id === m.kind); return <Tag icon={k?.icon}>{k?.label || m.kind}</Tag>; } },
      { k: 'points', label: 'Pkt', sort: false, align: 'right', render: (m) => <b>{m.points}</b> },
      { k: 'radiusM', label: 'Geofence', sort: false, align: 'right', render: (m) => `${m.radiusM || 40} m` },
      { k: 'flags', label: 'Cechy', sort: false, render: (m) => <span class="c-row c-wrap">{m.accessible && <Icon name="wheelchair" size={15} title="dostępna" />}{m.quizId && <Icon name="quiz" size={15} title="z quizem" />}{m.active === false && <Tag>wyłączona</Tag>}</span> },
      { k: 'trig', label: 'Wyzwalacze', sort: false, render: (m) => <span class="c-small">{trigs(m).map((t) => t.code).join(', ') || (['qr', 'ble', 'ar'].includes(m.kind) ? <span class="c-danger">brak!</span> : '—')}</span> },
      { k: '_a', label: '', sort: false, align: 'right', render: (m) => <span class="c-rowact"><IconButton icon="edit" variant="plain" size="sm" label="Edytuj" onClick={() => setMd(deepClone(m))} /><IconButton icon="trash" variant="plain" size="sm" label="Usuń" disabled={!edit} onClick={() => delMission(m)} /></span> },
    ]} />
    <section class="c-panel"><h3>Punktacja i mnożniki trudności</h3>
      <p class="c-small c-muted">Punkty misji × mnożnik poziomu trudności z profilu gracza. Quiz: 10 pkt × waga poziomu pytania (łatwe 1 · średnie 1,5 · trudne 2) × mnożnik trudności – tylko przy pierwszym podejściu.</p>
      <table class="c-table c-table--mini"><thead><tr><th>Poziom</th><th class="c-al-right">Mnożnik</th><th class="c-al-right">Trasa „{r.name.pl}” – max pkt za misje</th></tr></thead>
        <tbody>{Object.entries(DIFFICULTY).map(([k, v]) => <tr key={k}><td>{{ easy: 'Łatwy (dzieci, rodziny)', medium: 'Średni', hard: 'Trudny (eksperci)' }[k]}</td><td class="c-al-right">×{String(v).replace('.', ',')}</td><td class="c-al-right"><b>{Math.round(base * v)}</b></td></tr>)}</tbody></table>
    </section>
    <Modal open={!!rd} onClose={() => setRd(null)} size="xl" title={`Trasa: ${r.name.pl}`} footer={<><span class="c-grow" /><Button variant="secondary" size="sm" onClick={() => setRd(null)}>Anuluj</Button><Button size="sm" icon="save" onClick={saveRoute}>Zapisz trasę</Button></>}>
      {rd && <RouteForm d={rd} set={setR} />}
    </Modal>
    <Modal open={!!md} onClose={() => setMd(null)} size="xl" title={md?.id ? `Misja: ${md.title.pl}` : `Nowa misja – ${r.name.pl}`}
      footer={md && <>{md.id && <Button variant="danger" size="sm" icon="trash" disabled={!edit} onClick={() => delMission(md)}>Usuń</Button>}<span class="c-grow" /><Button variant="secondary" size="sm" onClick={() => setMd(null)}>Zamknij</Button><Button size="sm" icon="save" disabled={!edit} onClick={saveMission}>Zapisz misję</Button></>}>
      {md && <MissionForm d={md} set={setM} route={r} edit={edit} />}
    </Modal>
  </div>);
}

function ListEditor({ items, onChange, make, render, addLabel }) {
  const upd = (i, p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (<div class="c-listed">{items.map((x, i) => <div class="c-listed__row" key={i}><div class="c-grow">{render(x, (p) => upd(i, p), i)}</div><IconButton icon="trash" variant="plain" size="sm" label="Usuń" onClick={() => onChange(items.filter((_, j) => j !== i))} /></div>)}
    <Button size="sm" variant="secondary" icon="plus" onClick={() => onChange([...items, make(items)])}>{addLabel}</Button></div>);
}
function RouteForm({ d, set }) {
  const opts = d.missions.map((m) => ({ id: m.id, label: m.title.pl }));
  return (<div>
    <Form draft={d} set={set} fields={[{ k: 'name', label: 'Nazwa trasy', type: 'L' }, { k: 'tagline', label: 'Hasło', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext', rows: 3 }, { k: 'ill', label: 'Ilustracja', type: 'image' }, { k: 'active', label: 'Trasa dostępna w grze', type: 'switch' }]} />
    <h4 class="c-form__sec">Tryby przejścia</h4>
    <ListEditor items={d.modes || []} onChange={(v) => set('modes', v)} addLabel="Dodaj tryb" make={() => ({ id: 'walk', name: L0(), note: L0() })} render={(m, up) => <div class="c-row c-row--top"><FieldBox label="Rodzaj"><Select value={m.id} onChange={(e) => up({ id: e.currentTarget.value })}><option value="walk">pieszo</option><option value="bike">rowerem</option><option value="access">trasa dostępna</option></Select></FieldBox><FieldBox label="Nazwa" class="c-grow"><LangInputs value={m.name} onChange={(v) => up({ name: v })} /></FieldBox><FieldBox label="Uwagi" class="c-grow"><LangInputs value={m.note} onChange={(v) => up({ note: v })} /></FieldBox></div>} />
    <h4 class="c-form__sec">Długości (wariant trasy przyrodniczej) – przypisanie misji</h4>
    <ListEditor items={d.lengths || []} onChange={(v) => set('lengths', v)} addLabel="Dodaj długość" make={(a) => ({ id: ['s', 'm', 'l'][a.length] || `len${a.length}`, name: L0(), km: 5, durationMin: 90, missionIds: [] })} render={(l, up) => <div>
      <div class="c-row c-row--top"><FieldBox label="Id"><Input value={l.id} onInput={(e) => up({ id: e.currentTarget.value })} /></FieldBox><FieldBox label="Nazwa" class="c-grow"><LangInputs value={l.name} onChange={(v) => up({ name: v })} /></FieldBox><FieldBox label="km"><Input type="number" value={l.km} onInput={(e) => up({ km: +e.currentTarget.value })} /></FieldBox><FieldBox label="min"><Input type="number" value={l.durationMin} onInput={(e) => up({ durationMin: +e.currentTarget.value })} /></FieldBox></div>
      <div class="c-checks">{opts.map((o) => <label key={o.id} class="fpz-check"><input type="checkbox" checked={l.missionIds.includes(o.id)} onChange={(e) => up({ missionIds: e.currentTarget.checked ? d.missions.filter((m) => m.id === o.id || l.missionIds.includes(m.id)).map((m) => m.id) : l.missionIds.filter((x) => x !== o.id) })} /><span>{o.label}</span></label>)}</div></div>} />
    <h4 class="c-form__sec">Warianty (trasa przemysłowa)</h4>
    <ListEditor items={d.variants || []} onChange={(v) => set('variants', v)} addLabel="Dodaj wariant" make={(a) => ({ id: `wariant${a.length + 1}`, name: L0(), description: L0() })} render={(v, up) => <div class="c-row c-row--top"><FieldBox label="Id"><Input value={v.id} onInput={(e) => up({ id: e.currentTarget.value })} /></FieldBox><FieldBox label="Nazwa" class="c-grow"><LangInputs value={v.name} onChange={(x) => up({ name: x })} /></FieldBox><FieldBox label="Opis" class="c-grow"><LangInputs value={v.description} onChange={(x) => up({ description: x })} /></FieldBox></div>} />
  </div>);
}

function MissionForm({ d, set, route, edit }) {
  const s = useStore(); const { api, staff } = useClient(); const { can, go } = useCms(); const run = useRun();
  const trig = d.id ? s.triggers.filter((t) => t.target?.type === 'mission' && t.target.id === d.id) : [];
  const addTrig = (kind) => { const r = api.cms.save('triggers', blankTrigger(kind, { label: `Gra: ${d.title.pl}`, target: { type: 'mission', id: d.id }, poiId: d.poiId })); run(r, r.ok && `Nadano kod ${r.item.code} dla misji`); };
  return (<fieldset class="c-fs" disabled={!edit}>
    <Form draft={d} set={set} fields={[
      { k: 'title', label: 'Tytuł misji', type: 'L' },
      { k: 'poiId', label: 'Miejsce', type: 'select', opts: poiOpts }, { k: 'kind', label: 'Rodzaj zaliczenia', type: 'select', empty: false, opts: MISSION_KINDS },
      { k: 'points', label: 'Punkty (bazowo)', type: 'number', min: 0 }, { k: 'radiusM', label: 'Promień geofencingu', type: 'range', min: 10, max: 400, step: 5, unit: 'm' },
      { k: 'quizId', label: 'Quiz po dotarciu', type: 'select', opts: () => s.quizzes.map((q) => ({ id: q.id, label: q.title.pl })) },
      { k: 'accessible', label: 'Dostępna dla osób z niepełnosprawnościami', type: 'switch' }, { k: 'active', label: 'Aktywna', type: 'switch' },
      { section: 'Treść misji' },
      { k: 'story', label: 'Opowieść (po dotarciu)', type: 'Ltext', rows: 3 }, { k: 'task', label: 'Zadanie', type: 'Ltext', rows: 2 }, { k: 'taskEasy', label: 'Zadanie uproszczone (dzieci / poziom łatwy)', type: 'Ltext', rows: 2 },
      ...(route.id === 'history' || d.eraId || d.districtId ? [{ section: 'Trasa historyczna' }, { k: 'eraId', label: 'Epoka', type: 'select', opts: () => s.eras.map((e) => ({ id: e.id, label: e.name.pl })) }, { k: 'districtId', label: 'Dzielnica (tablica)', type: 'select', opts: () => s.districts.map((x) => ({ id: x.id, label: `${x.name}${x.boardCode ? ` (${x.boardCode})` : ''}` })) }] : []),
      ...((route.variants || []).length ? [{ section: 'Teksty wariantów trasy' }, ...route.variants.map((v) => ({ k: `variantText.${v.id}`, label: `Wariant „${v.name.pl}”`, type: 'Ltext', rows: 2 }))] : []),
    ]} />
    <h4 class="c-form__sec">Wyzwalacze misji</h4>
    {!d.id ? <p class="c-muted c-small">Zapisz misję, aby przypisać kod QR, beacon lub punkt AR.</p> : <>
      {trig.length ? <ul class="c-links">{trig.map((t) => <li key={t.id}><button type="button" class="c-link" onClick={() => go('triggers', null, t.id)}><Icon name={KIND[t.kind][1]} size={13} /> {t.code}</button> <span class="c-small c-muted">{t.label}{t.kind === 'ble' ? ` · ${t.ble?.rangeM} m` : ''}</span></li>)}</ul> : <p class="c-small c-muted">Misja korzysta z wyzwalaczy miejsca (jeśli są) albo z geolokalizacji.</p>}
      <div class="c-row">{['qr', 'ble', 'ar'].map((k) => <Button key={k} size="sm" variant="secondary" icon={KIND[k][1]} disabled={!can('triggers')} title={can('triggers') ? undefined : denyText('triggers', staff)} onClick={() => addTrig(k)}>+ {KIND[k][0]}</Button>)}</div></>}
  </fieldset>);
}

/* ════════════ QUIZY ════════════ */
export function Quizzes({ openId }) {
  return (<div class="c-page"><Head title="Quizy" sub="Pytania z czterema odpowiedziami, poziom trudności i wyjaśnienie" />
    <Crud col="quizzes" title="Quizy" noun="quiz" perm="game.edit" openId={openId} modalSize="xl" search={(q) => [q.title.pl]}
      blank={() => ({ title: L0(), questions: [newQ()] })}
      cols={[{ k: 'title', label: 'Quiz', render: (q) => <b>{q.title.pl}</b> }, { k: 'questions', label: 'Pytania', align: 'right', sort: (q) => q.questions.length, render: (q) => q.questions.length },
        { k: 'used', label: 'Użyty w misjach', sort: false, render: (q) => <UsedIn quizId={q.id} /> }]}
      fields={[{ k: 'title', label: 'Tytuł', type: 'L' }, { k: 'questions', label: 'Pytania', type: 'custom', render: (d, set) => <QuestionsEditor value={d.questions} onChange={(v) => set('questions', v)} /> }]} />
  </div>);
}
const newQ = () => ({ id: `q${Date.now().toString(36)}`, q: L0(), answers: [L0(), L0(), L0(), L0()], correct: 0, explain: L0(), level: 'easy' });
function UsedIn({ quizId }) { const s = useStore(); const ms = s.gameRoutes.flatMap((r) => r.missions.filter((m) => m.quizId === quizId)); return <span class="c-small">{ms.map((m) => m.title.pl).join(', ') || '—'}</span>; }
function QuestionsEditor({ value, onChange }) {
  const upd = (i, p) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (<div class="c-qs">{value.map((q, i) => (<div class="c-q" key={q.id || i}>
    <div class="c-q__h"><b>Pytanie {i + 1}</b><Select value={q.level} onChange={(e) => upd(i, { level: e.currentTarget.value })} aria-label="Poziom">{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label} (waga {String(LEVEL_W[l.id]).replace('.', ',')})</option>)}</Select><span class="c-grow" /><IconButton icon="trash" variant="plain" size="sm" label="Usuń pytanie" onClick={() => onChange(value.filter((_, j) => j !== i))} /></div>
    <LangInputs value={q.q} onChange={(v) => upd(i, { q: v })} />
    <div class="c-q__ans">{q.answers.map((a, k) => <div key={k} class={`c-q__a${q.correct === k ? ' is-ok' : ''}`}><label class="c-radio"><input type="radio" name={`ok-${q.id}-${i}`} checked={q.correct === k} onChange={() => upd(i, { correct: k })} /><span>{'ABCD'[k]}{q.correct === k ? ' ✓' : ''}</span></label><LangInputs value={a} onChange={(v) => upd(i, { answers: q.answers.map((x, j) => (j === k ? v : x)) })} /></div>)}</div>
    <FieldBox label="Wyjaśnienie (po odpowiedzi)"><LangInputs value={q.explain} onChange={(v) => upd(i, { explain: v })} /></FieldBox>
  </div>))}<Button size="sm" variant="secondary" icon="plus" onClick={() => onChange([...value, newQ()])}>Dodaj pytanie</Button></div>);
}

/* ════════════ NAGRODY · KUPONY · PANORAMA ════════════ */
export function Rewards({ openId }) {
  return (<div class="c-page"><Head title="Nagrody" sub="Katalog nagród za punkty – koszt, stan magazynowy, warunki i miejsce odbioru" />
    <Crud col="rewards" title="Nagrody" noun="nagrodę" perm="game.edit" openId={openId} search={(r) => [r.name.pl]}
      blank={() => ({ name: L0(), description: L0(), cost: 100, stock: 20, pickup: L0(), ill: 'kids', active: true })}
      cols={[{ k: 'name', label: 'Nagroda', render: (r) => <b>{r.name.pl}</b> }, { k: 'cost', label: 'Koszt', align: 'right', render: (r) => `${r.cost} pkt` }, { k: 'stock', label: 'Stan', align: 'right', render: (r) => <Tag tone={r.stock > 5 ? 'green' : r.stock > 0 ? 'warn' : 'danger'}>{r.stock} szt.</Tag> }, { k: 'active', label: 'Aktywna', render: (r) => (r.active === false ? 'nie' : 'tak') }]}
      fields={[{ k: 'name', label: 'Nazwa', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext', rows: 2 }, { k: 'cost', label: 'Koszt w punktach', type: 'number', min: 0 }, { k: 'stock', label: 'Stan (szt.)', type: 'number', min: 0 }, { k: 'pickup', label: 'Warunki i miejsce odbioru', type: 'Ltext', rows: 2 }, { k: 'ill', label: 'Ilustracja', type: 'image' }, { k: 'active', label: 'Dostępna w katalogu', type: 'switch' }]} />
  </div>);
}
const COND = [{ id: 'none', label: 'Brak warunku' }, { id: 'points', label: 'Liczba punktów' }, { id: 'mission', label: 'Ukończona misja' }, { id: 'route', label: 'Ukończona trasa' }];
export function Coupons({ openId }) {
  const s = useStore();
  const condText = (c) => { const t = c.condition?.type || 'none', v = c.condition?.value; return t === 'points' ? `${v} pkt` : t === 'mission' ? `misja: ${sel.mission(v)?.title.pl || v}` : t === 'route' ? `trasa: ${sel.route(v)?.name.pl || v}` : 'brak'; };
  return (<div class="c-page"><Head title="Kupony" sub="Rabaty u partnerów – odblokowywane warunkiem w grze, realizowane w punkcie kasowym (bileter)" />
    <Crud col="coupons" title="Kupony" noun="kupon" perm="game.edit" openId={openId} search={(c) => [c.title.pl]}
      blank={() => ({ title: L0(), description: L0(), venueId: s.venues[0]?.id || null, discount: L0(), condition: { type: 'none', value: null }, validUntil: localIso(addDays(new Date(), 60)), active: true })}
      cols={[{ k: 'title', label: 'Kupon', render: (c) => <b>{c.title.pl}</b> }, { k: 'discount', label: 'Rabat', render: (c) => c.discount?.pl }, { k: 'venueId', label: 'Partner', sort: (c) => sel.venue(c.venueId)?.name.pl, render: (c) => sel.venue(c.venueId)?.name.pl || '—' }, { k: 'cond', label: 'Warunek', sort: condText, render: condText }, { k: 'validUntil', label: 'Ważny do', render: (c) => (c.validUntil || '').slice(0, 10) }]}
      fields={(d) => [{ k: 'title', label: 'Tytuł', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext', rows: 2 }, { k: 'discount', label: 'Rabat (np. −15%)', type: 'L' }, { k: 'venueId', label: 'Partner (obiekt)', type: 'select', opts: () => s.venues.map((v) => ({ id: v.id, label: v.name.pl })) },
        { k: 'condition.type', label: 'Warunek odblokowania', type: 'select', empty: false, opts: COND },
        ...(d.condition?.type === 'points' ? [{ k: 'condition.value', label: 'Wymagane punkty', type: 'number', min: 0 }] : []),
        ...(d.condition?.type === 'mission' ? [{ k: 'condition.value', label: 'Misja', type: 'select', opts: () => s.gameRoutes.flatMap((r) => r.missions.map((m) => ({ id: m.id, label: `${r.name.pl} › ${m.title.pl}` }))) }] : []),
        ...(d.condition?.type === 'route' ? [{ k: 'condition.value', label: 'Trasa', type: 'select', opts: () => s.gameRoutes.map((r) => ({ id: r.id, label: r.name.pl })) }] : []),
        { k: 'validUntil', label: 'Ważny do', type: 'datetime' }, { k: 'active', label: 'Aktywny', type: 'switch' }]} />
  </div>);
}
export function Hotspots({ openId }) {
  return (<div class="c-page"><Head title="Punkty panoramy 360°" sub="Obiekty widoczne z wieży widokowej – „teraz” i „w przyszłości” (trasa innowacji)" />
    <Crud col="futureHotspots" title="Punkty panoramy" noun="punkt" perm="game.edit" openId={openId} search={(h) => [h.name.pl]}
      blank={() => ({ name: L0(), az: 0, kind: 'fpz', poiId: null, now: L0(), future: L0(), effects: { social: L0(), cultural: L0(), urban: L0(), demographic: L0() } })}
      cols={[{ k: 'name', label: 'Punkt', render: (h) => <b>{h.name.pl}</b> }, { k: 'az', label: 'Azymut', align: 'right', render: (h) => <span class="c-nowrap"><Icon name="compass" size={13} /> {h.az}°</span> }, { k: 'kind', label: 'Rodzaj', render: (h) => (h.kind === 'fpz' ? 'FPŻ' : 'Miasto') }, { k: 'poiId', label: 'Miejsce', sort: (h) => sel.poi(h.poiId)?.name.pl, render: (h) => sel.poi(h.poiId)?.name.pl || '—' }]}
      fields={[{ k: 'name', label: 'Nazwa', type: 'L' }, { k: 'az', label: 'Azymut na panoramie', type: 'range', min: 0, max: 359, unit: '°' }, { k: 'kind', label: 'Rodzaj', type: 'select', empty: false, opts: [{ id: 'fpz', label: 'Teren FPŻ' }, { id: 'city', label: 'Miasto' }] }, { k: 'poiId', label: 'Miejsce', type: 'select', opts: poiOpts },
        { k: 'now', label: 'Stan obecny', type: 'Ltext', rows: 2 }, { k: 'future', label: 'Wizja przyszłości', type: 'Ltext', rows: 2 },
        { section: 'Efekty zmian' }, { k: 'effects.social', label: 'Społeczne', type: 'L' }, { k: 'effects.cultural', label: 'Kulturowe', type: 'L' }, { k: 'effects.urban', label: 'Urbanistyczne', type: 'L' }, { k: 'effects.demographic', label: 'Demograficzne', type: 'L' }]} />
  </div>);
}

/* ════════════ STATYSTYKI GRY ════════════ */
export function GameStats() {
  const s = useStore(); const g = s.gameStats; const p = s.player;
  const lb = sel.leaderboard();
  return (<div class="c-page"><Head title="Statystyki gry" sub="Zsynchronizowane wyniki graczy, ranking i stan gracza testowego (telefon w prototypie)" />
    <div class="c-tiles c-tiles--4">
      <Stat icon="flag" label="Misje zaliczone" value={g.missionsDone.toLocaleString('pl-PL')} /><Stat icon="people" label="Gracze (sync)" value={g.playersSynced} />
      <Stat icon="gift" label="Nagrody wydane (test)" value={p.rewards.length} /><Stat icon="message" label="Pomysły" value={s.ideas.length} />
    </div>
    <div class="c-grid2">
      <section class="c-panel"><h3>Zaliczenia wg tras</h3><BarChart data={s.gameRoutes.map((r) => ({ label: r.name.pl.replace('Trasa ', ''), value: g.byRoute[r.id] || 0 }))} height={140} />
        <ul class="c-legend c-legend--col">{s.gameRoutes.map((r) => <li key={r.id}>{r.name.pl}: <b>{g.byRoute[r.id] || 0}</b></li>)}</ul></section>
      <section class="c-panel"><h3>Ranking</h3><DataTable rows={lb} cols={[{ k: 'rank', label: '#', w: '40px' }, { k: 'nick', label: 'Gracz', render: (x) => (x.me ? <b>{x.nick} (telefon testowy)</b> : x.nick) }, { k: 'points', label: 'Punkty', align: 'right' }]} /></section>
    </div>
    <section class="c-panel"><h3>Gracz testowy (aplikacja w prototypie)</h3>
      <dl class="c-dl c-dl--row"><dt>Pseudonim</dt><dd>{p.nick}</dd><dt>Profil</dt><dd>{p.profile.age} · trudność {p.profile.difficulty} · tryb {p.profile.mode}</dd>
        <dt>Punkty</dt><dd>{sel.points()} (zdobyte {sel.pointsEarned()}, w synchronizacji {sel.pointsSynced()})</dd><dt>Aktywna trasa</dt><dd>{p.activeRoute ? sel.route(p.activeRoute.routeId)?.name.pl : '—'}</dd>
        <dt>Misje ukończone</dt><dd>{Object.keys(p.done).length} {p.pending.length > 0 && <Tag tone="warn">{p.pending.length} czeka na synchronizację (offline)</Tag>}</dd><dt>Quizy</dt><dd>{Object.keys(p.quiz).length}</dd>
        <dt>Nagrody</dt><dd>{p.rewards.map((r) => `${s.rewards.find((x) => x.id === r.rewardId)?.name.pl} (${r.status === 'collected' ? 'odebrana' : 'do odbioru'})`).join(', ') || '—'}</dd><dt>Kupony</dt><dd>{p.coupons.length}</dd></dl>
    </section>
  </div>);
}
