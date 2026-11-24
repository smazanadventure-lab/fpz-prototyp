// CMS – wielojęzyczność bez programowania: języki, teksty interfejsu (nadpisania), raport kompletności treści.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { stringKeys, stringDefault } from '../../kernel/i18n.js';
import { matches, clsx } from '../../kernel/util.js';
import { Button, IconButton, Input, Select, Switch, SearchInput, Tag, Notice, Progress, Field } from '../../ui/components.jsx';
import { useCms, useRun, DataTable, Head, SubNav } from './kit.jsx';

const GROUPS = { c: 'Wspólne', m: 'Aplikacja mobilna', g: 'Gra terenowa', r: 'System rezerwacji', w: 'Strona WWW', k: 'Kioski', s: 'Ekrany LCD', map: 'Mapy', md: 'Multimedia' };
export default function Translations() {
  const [tab, setTab] = useState('ui');
  return (<div class="c-page"><Head title="Tłumaczenia" sub="Dodawanie wersji językowych i tłumaczenie interfejsu bez prac programistycznych – zmiany od razu we wszystkich końcówkach" />
    <Languages />
    <SubNav value={tab} onChange={setTab} items={[{ id: 'ui', label: 'Teksty interfejsu', icon: 'text' }, { id: 'content', label: 'Kompletność treści', icon: 'file' }]} />
    {tab === 'ui' ? <UiStrings /> : <ContentReport />}
  </div>);
}

function Languages() {
  const s = useStore(); const { api } = useClient(); const run = useRun(); const [n, setN] = useState({ code: '', name: '' });
  const keys = stringKeys(); const ov = s.i18n.overrides;
  const pct = (c) => (keys.length ? Math.round((keys.filter((k) => ov[c]?.[k] || stringDefault(k, c)).length / keys.length) * 100) : 100);
  const add = (e) => { e.preventDefault(); if (run(api.cms.addLanguage(n), `Dodano język: ${n.name}. Uzupełnij tłumaczenia poniżej.`)) setN({ code: '', name: '' }); };
  return (<section class="c-panel"><h3>Języki</h3>
    <div class="c-langlist">{s.settings.languages.map((l) => (<div key={l.code} class={clsx('c-langcard', !l.enabled && 'is-off')}>
      <span class="c-langcard__code">{l.code.toUpperCase()}</span><span class="c-grow"><b>{l.name}</b><small>interfejs: {pct(l.code)}%{l.code === s.settings.defaultLang ? ' · domyślny' : ''}</small><Progress value={pct(l.code)} label={`Kompletność ${l.name}`} /></span>
      <Switch label={<span class="c-sr">Włączony {l.name}</span>} checked={l.enabled} disabled={l.code === 'pl'} onChange={(e) => run(api.cms.setLanguage(l.code, { enabled: e.currentTarget.checked }), e.currentTarget.checked ? `Włączono: ${l.name}` : `Wyłączono: ${l.name}`)} />
    </div>))}</div>
    <form class="c-row c-row--end" onSubmit={add}>
      <Field label="Kod (ISO 639-1)"><Input value={n.code} maxLength={2} placeholder="np. de" data-testid="lang-code" onInput={(e) => setN({ ...n, code: e.currentTarget.value })} /></Field>
      <Field label="Nazwa języka"><Input value={n.name} placeholder="np. Deutsch" data-testid="lang-name" onInput={(e) => setN({ ...n, name: e.currentTarget.value })} /></Field>
      <Button type="submit" size="sm" icon="plus">Dodaj język</Button>
      <span class="c-grow" />
      <Field label="Język domyślny"><Select value={s.settings.defaultLang} onChange={(e) => run(api.cms.setSetting({ defaultLang: e.currentTarget.value }), 'Zmieniono język domyślny')}>{s.settings.languages.filter((l) => l.enabled).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></Field>
    </form>
  </section>);
}

function UiStrings() {
  const s = useStore(); const { api } = useClient(); const { can } = useCms(); const run = useRun();
  const langs = s.settings.languages.filter((l) => l.enabled); const ov = s.i18n.overrides; const keys = stringKeys();
  const [q, setQ] = useState(''); const [miss, setMiss] = useState(''); const [grp, setGrp] = useState('');
  const val = (k, c) => ov[c]?.[k] ?? stringDefault(k, c);
  const rows = keys.filter((k) => (!grp || k.split('.')[0] === grp) && (!miss || !val(k, miss)) && (!q || matches(q, k, ...langs.map((l) => val(k, l.code) || '')))).map((k) => ({ id: k, k }));
  const groups = [...new Set(keys.map((k) => k.split('.')[0]))];
  const ok = can('translations');
  return (<div>
    <div class="c-toolbar"><SearchInput value={q} onInput={setQ} placeholder="Szukaj klucza lub tekstu" />
      <Select value={grp} onChange={(e) => setGrp(e.currentTarget.value)} aria-label="Moduł"><option value="">Wszystkie moduły</option>{groups.map((g) => <option key={g} value={g}>{GROUPS[g] || g} ({g}.)</option>)}</Select>
      <Select value={miss} onChange={(e) => setMiss(e.currentTarget.value)} aria-label="Brakujące"><option value="">Wszystkie teksty</option>{langs.map((l) => <option key={l.code} value={l.code}>Brakujące: {l.name}</option>)}</Select>
      <span class="c-grow" /><span class="c-count">{rows.length} z {keys.length} kluczy</span></div>
    <p class="c-small c-muted">Pole puste = tekst domyślny (szary podpowiedź). Wpisz własny tekst, aby go nadpisać; zmiana zapisuje się po opuszczeniu pola. Teksty z <code>{'{zmienna}'}</code> zachowują znaczniki.</p>
    <DataTable rows={rows} page={80} initial={{ k: 'k', dir: 1 }} empty="Brak tekstów spełniających kryteria" cols={[
      { k: 'k', label: 'Klucz', w: '220px', render: (r) => <code class="c-key">{r.k}</code> },
      ...langs.map((l) => ({ k: l.code, label: `${l.name} (${l.code})`, sort: (r) => val(r.k, l.code) || '', render: (r) => { const o = ov[l.code]?.[r.k]; const d = stringDefault(r.k, l.code); return (
        <div class={clsx('c-tr', o && 'is-ov', !o && !d && 'is-miss')}>
          <input class="fpz-input" value={o || ''} placeholder={d || (l.code !== 'pl' ? `⚠ brak – ${stringDefault(r.k, 'en') || stringDefault(r.k, 'pl') || ''}` : '')} disabled={!ok} aria-label={`${r.k} – ${l.name}`} data-key={r.k} data-lang={l.code}
            onChange={(e) => { const v = e.currentTarget.value.trim(); if (v !== (o || '')) run(api.cms.setTranslation(l.code, r.k, v), v ? `Zapisano tłumaczenie (${l.code.toUpperCase()})` : 'Przywrócono tekst domyślny'); }} />
          {o && <IconButton icon="undo" variant="plain" size="sm" label="Przywróć domyślny" onClick={() => run(api.cms.setTranslation(l.code, r.k, ''), 'Przywrócono tekst domyślny')} />}
        </div>); } })),
    ]} />
  </div>);
}

function ContentReport() {
  const s = useStore(); const { go } = useCms();
  const langs = s.settings.languages.filter((l) => l.enabled && l.code !== 'pl');
  const has = (o, c) => !!String(o?.[c] || '').trim();
  const sets = [
    ['Wpisy', s.entries, (e, c) => has(e.title, c) && has(e.lead, c) && has(e.body, c), (e) => e.title.pl, (e) => go('content', 'entries', e.id)],
    ['Miejsca', s.pois, (p, c) => has(p.name, c) && has(p.description, c), (p) => p.name.pl, (p) => go('places', null, p.id)],
    ['Kategorie', s.categories, (x, c) => has(x.name, c), (x) => x.name.pl, () => go('content', 'categories')],
    ['Wydarzenia', s.events, (x, c) => has(x.title, c) && has(x.description, c), (x) => x.title.pl, (x) => go('offer', 'events', x.id)],
    ['Obiekty', s.venues, (x, c) => has(x.name, c) && has(x.description, c), (x) => x.name.pl, (x) => go('offer', 'venues', x.id)],
    ['Aktualności', s.news, (x, c) => has(x.title, c) && has(x.body, c), (x) => x.title.pl, (x) => go('content', 'news', x.id)],
  ];
  if (!langs.length) return <Notice>Włącz co najmniej jeden język poza polskim.</Notice>;
  return (<div class="c-report">{langs.map((l) => (<section class="c-panel" key={l.code}><h3>{l.name} ({l.code})</h3>
    <table class="c-table c-table--mini"><thead><tr><th>Rodzaj treści</th><th class="c-al-right">Kompletne</th><th>Brakuje (pierwsze pozycje)</th></tr></thead><tbody>
      {sets.map(([name, arr, okf, lab, open]) => { const missing = arr.filter((x) => !okf(x, l.code)); const pc = arr.length ? Math.round(((arr.length - missing.length) / arr.length) * 100) : 100; return (
        <tr key={name}><td><b>{name}</b></td><td class="c-al-right"><Tag tone={pc === 100 ? 'green' : pc > 60 ? 'warn' : 'danger'}>{arr.length - missing.length}/{arr.length} · {pc}%</Tag></td>
          <td class="c-small">{missing.slice(0, 4).map((x, i) => <span key={i}>{i > 0 && ', '}<button type="button" class="c-link" onClick={() => open(x)}>{lab(x)}</button></span>)}{missing.length > 4 && ` … i ${missing.length - 4} więcej`}{!missing.length && '—'}</td></tr>); })}
    </tbody></table></section>))}</div>);
}
