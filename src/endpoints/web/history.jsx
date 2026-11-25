// Historia: oś czasu epok, kategorie, filtry, strona artykułu (galeria, wideo, audio, 3D), galeria zdjęć, filmoteka.
import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { fmtDate, fmtDuration, paragraphs, stripMarks, clsx } from '../../kernel/util.js';
import { Icon, Button, Card, CardBody, Tag, Media, Rich, QR, Chips, Select, Tabs, Empty, Notice, Modal, SearchInput, IconButton } from '../../ui/components.jsx';
import { VideoSim, AudioGuide, Model3D, Panorama360 } from '../../ui/media.jsx';
import { useNav, enc, offlineOk, isOffline } from './nav.js';
import { PageHead, Section, EntryCard, Gallery } from './bits.jsx';

const TABS = [['', 'w.h.timeline', 'clock'], ['kategorie', 'w.h.cats', 'folder'], ['galeria', 'w.h.gallery', 'image'], ['filmy', 'w.h.videos', 'film']];

export function HistoryPage({ r }) {
  const { t } = useClient(); const { go } = useNav();
  if (r.a === 'wpis') return <Article id={r.b} />;
  const tab = r.a || '';
  const cur = TABS.find((x) => x[0] === tab) || TABS[0];
  return (<>
    <PageHead icon="history" title={tab === '' ? t('w.nav.history') : t(cur[1])} lead={t('w.h.lead')} crumbs={tab === '' ? [{ label: t('w.nav.history') }] : [{ label: t('w.nav.history'), path: 'historia' }, { label: t(cur[1]) }]}>
      <Tabs variant="pill" class="w-htabs" tabs={TABS.map(([id, k, ic]) => ({ id, label: t(k), icon: ic }))} value={tab} onChange={(id) => go(id ? `historia/${id}` : 'historia')} />
    </PageHead>
    {tab === '' && <Timeline />}
    {tab === 'kategorie' && <Categories catId={r.b} />}
    {tab === 'galeria' && <PhotoGallery />}
    {tab === 'filmy' && <VideoLibrary />}
  </>);
}

/* ── filtry (zapamiętane w client.hf) ── */
function useFilters() {
  const { client, set } = useClient(); const f = client.hf || {};
  return [f, (patch) => set({ hf: { ...f, ...patch } })];
}
function Filters({ list }) {
  const s = useStore(); const { t, L } = useClient(); const [f, setF] = useFilters();
  const all = sel.entries({ channel: 'web' });
  const districts = s.districts.filter((d) => all.some((e) => e.districtId === d.id));
  const places = s.pois.filter((p) => all.some((e) => e.poiId === p.id));
  const tags = [...new Set(all.flatMap((e) => e.tags || []))].sort();
  const any = f.eraId || f.districtId || f.poiId || f.tag || f.q;
  return (<div class="w-filters" role="group" aria-label={t('w.f.title')}>
    <SearchInput value={f.q || ''} onInput={(q) => setF({ q })} placeholder={t('w.f.q')} />
    <label class="w-fsel"><span>{t('w.f.era')}</span><Select value={f.eraId || ''} onChange={(e) => setF({ eraId: e.currentTarget.value || null })} options={[{ id: '', label: t('c.all') }, ...s.eras.map((x) => ({ id: x.id, label: `${L(x.name)} (${x.from}–${x.to})` }))]} /></label>
    <label class="w-fsel"><span>{t('w.f.district')}</span><Select value={f.districtId || ''} onChange={(e) => setF({ districtId: e.currentTarget.value || null })} options={[{ id: '', label: t('c.all') }, ...districts.map((x) => ({ id: x.id, label: x.name }))]} /></label>
    <label class="w-fsel"><span>{t('w.f.place')}</span><Select value={f.poiId || ''} onChange={(e) => setF({ poiId: e.currentTarget.value || null })} options={[{ id: '', label: t('c.all') }, ...places.map((x) => ({ id: x.id, label: L(x.name) }))]} /></label>
    <label class="w-fsel"><span>{t('w.f.tag')}</span><Select value={f.tag || ''} onChange={(e) => setF({ tag: e.currentTarget.value || null })} options={[{ id: '', label: t('c.all') }, ...tags.map((x) => ({ id: x, label: '#' + x }))]} /></label>
    <p class="w-filters__res" aria-live="polite"><b>{t('w.f.count', { n: list.length })}</b>{any && <button type="button" class="w-link" onClick={() => setF({ eraId: null, districtId: null, poiId: null, tag: null, q: '' })}>{t('w.f.clear')}</button>}</p>
  </div>);
}
function filtered(f, extra = {}) {
  return sel.entries({ channel: 'web', eraId: f.eraId || undefined, districtId: f.districtId || undefined, poiId: f.poiId || undefined, q: f.q || undefined, ...extra }).filter((e) => !f.tag || (e.tags || []).includes(f.tag));
}

function Timeline() {
  const s = useStore(); const { t, L } = useClient(); const [f, setF] = useFilters();
  const list = filtered(f).sort((a, b) => (a.year || 9999) - (b.year || 9999));
  const groups = [...s.eras.map((era) => ({ era, items: list.filter((e) => e.eraId === era.id) })), { era: null, items: list.filter((e) => !e.eraId || !s.eras.some((x) => x.id === e.eraId)) }].filter((g) => g.items.length || (g.era && !f.eraId && !f.q && !f.tag && !f.districtId && !f.poiId));
  const minY = Math.min(...s.eras.map((e) => e.from)), maxY = Math.max(...s.eras.map((e) => e.to)); const span = Math.max(1, maxY - minY);
  return (<>
    <Section id="w-eras">
      <div class="w-eras" role="group" aria-label={t('w.h.eras')}>
        {s.eras.map((era) => { const n = sel.entries({ channel: 'web', eraId: era.id }).length; const on = f.eraId === era.id; return (
          <button key={era.id} type="button" class={clsx('w-era', on && 'is-active')} aria-pressed={on} style={{ flexGrow: Math.max(1, Math.sqrt(era.to - era.from)) }} onClick={() => setF({ eraId: on ? null : era.id })}>
            <span class="w-era__y">{era.from}–{era.to}</span><b>{L(era.name)}</b><span class="w-era__n">{t('w.h.n', { n })}</span>
          </button>); })}
      </div>
      <div class="w-years" aria-hidden="true">{list.filter((e) => e.year).map((e) => <i key={e.id} style={{ left: `${((e.year - minY) / span) * 100}%` }} title={`${e.year}`} />)}<span>{minY}</span><span>{maxY}</span></div>
      <Filters list={list} />
    </Section>
    <Section id="w-tl" class="w-tlsec">
      {list.length === 0 && <Empty icon="search" title={t('w.f.none')} text={t('w.f.noneT')} />}
      <ol class="w-tl">
        {groups.map((g) => (<li key={g.era?.id || 'none'} class="w-tl__era">
          <div class="w-tl__head"><span class="w-tl__dot" aria-hidden="true" /><div>
            <h2>{g.era ? L(g.era.name) : t('w.h.noEra')}</h2>
            {g.era && <p class="w-tl__years">{g.era.from}–{g.era.to}</p>}
            {g.era && <p class="w-small">{L(g.era.summary)}</p>}
          </div></div>
          {g.items.length ? <ul class="w-grid w-grid--3 w-tl__items">{g.items.map((e) => <li key={e.id}><EntryCard e={e} /></li>)}</ul> : <p class="w-small w-tl__empty">{t('w.h.eraEmpty')}</p>}
        </li>))}
      </ol>
    </Section>
  </>);
}

function Categories({ catId }) {
  const { t, L } = useClient(); const { go } = useNav(); useStore(); const [f] = useFilters();
  const tree = sel.categoryTree(); const cat = catId && sel.category(catId);
  if (cat) {
    const parent = cat.parentId && sel.category(cat.parentId); const kids = tree.find((x) => x.id === cat.id)?.children || [];
    const list = filtered(f, { categoryId: cat.id });
    return (<Section id="w-cat" title={L(cat.name)} kicker={parent ? L(parent.name) : t('w.h.cats')} more={t('w.h.allCats')} onMore={() => go('historia/kategorie')}>
      {kids.length > 0 && <div class="fpz-chips w-mb">{kids.map((k) => <button key={k.id} type="button" class="fpz-chip" onClick={() => go(`historia/kategorie/${enc(k.id)}`)}>{L(k.name)} · {sel.entries({ channel: 'web', categoryId: k.id }).length}</button>)}</div>}
      <Filters list={list} />
      {list.length ? <ul class="w-grid w-grid--3 w-mt">{list.map((e) => <li key={e.id}><EntryCard e={e} /></li>)}</ul> : <Empty icon="folder" title={t('w.f.none')} />}
    </Section>);
  }
  return (<Section id="w-cats" title={t('w.h.catsAll')}>
    <ul class="w-grid w-grid--2 w-cats">{tree.map((c) => { const n = sel.entries({ channel: 'web', categoryId: c.id }).length; const ex = sel.entries({ channel: 'web', categoryId: c.id })[0]; return (
      <li key={c.id}><Card class="w-catcard" as="article">
        <Media ill={ex ? (ex.media || []).find((m) => m.ill)?.ill || 'map-old' : 'map-old'} ratio="5/2" shape="arc-tr" alt="" />
        <CardBody>
          <div class="w-row w-row--between"><h2 class="w-h3"><Icon name={c.icon || 'folder'} size={20} /> {L(c.name)}</h2><Tag tone="green">{t('w.h.n', { n })}</Tag></div>
          <ul class="w-catcard__sub">{c.children.map((k) => <li key={k.id}><a href="#" onClick={(e) => { e.preventDefault(); go(`historia/kategorie/${enc(k.id)}`); }}>{L(k.name)} <span>({sel.entries({ channel: 'web', categoryId: k.id }).length})</span></a></li>)}</ul>
          <Button size="sm" variant="secondary" iconRight="arrowRight" class="w-self-end" onClick={() => go(`historia/kategorie/${enc(c.id)}`)}>{t('w.h.openCat')}</Button>
        </CardBody>
      </Card></li>); })}</ul>
  </Section>);
}

/* ── strona artykułu ── */
const sentences = (txt) => stripMarks(txt).replace(/\n+/g, ' ').split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
/** Napisy dla nagrania w artykule (wpis nie zawiera osobnych napisów – powstają z narracji wpisu). */
function captionsFor(e, m) { const src = m.caption ? [m.caption] : []; const pl = [...src.map((x) => x.pl), ...sentences(e.lead.pl), ...sentences(e.body.pl).slice(0, 5)], en = [...src.map((x) => x.en), ...sentences(e.lead.en), ...sentences(e.body.en).slice(0, 5)]; const n = Math.min(pl.length, en.length, 7); return Array.from({ length: n }, (_, i) => ({ t: i * 6, text: { pl: pl[i], en: en[i] } })); }

export function Transcript({ captions, title }) {
  const { t, L } = useClient();
  return (<details class="w-details"><summary><Icon name="file" size={16} />{title || t('c.transcript')}</summary>
    <ol class="w-transcript">{captions.map((c, i) => <li key={i}><span>{fmtDuration(c.t)}</span>{L(c.text)}</li>)}</ol></details>);
}
export function VideoBlock({ video, caption, description }) {
  const { t } = useClient();
  return (<div class="w-video">
    <VideoSim video={video} description={description} />
    {caption && <p class="w-video__cap">{caption}</p>}
    <p class="w-video__acc"><Icon name="captions" size={15} /> {t('w.v.acc')}</p>
    <Transcript captions={video.captions || []} />
  </div>);
}

function Article({ id }) {
  const s = useStore(); const { t, L, lang, api, set } = useClient(); const { go } = useNav();
  const e = sel.entry(id);
  useEffect(() => { if (e && e.status === 'published') api.stats.track('entry', id); }, [id]);
  if (!e || e.status !== 'published') return (<><PageHead title={t('w.a.nf')} crumbs={[{ label: t('w.nav.history'), path: 'historia' }, { label: t('w.a.nf') }]} /><Section><Empty icon="file" title={t('w.a.nf')} text={t('w.a.nfT')}><Button onClick={() => go('historia')}>{t('w.nav.history')}</Button></Empty></Section></>);
  const cat = sel.category(e.categoryId); const parent = cat?.parentId && sel.category(cat.parentId); const era = s.eras.find((x) => x.id === e.eraId); const poi = e.poiId && sel.poi(e.poiId); const district = s.districts.find((d) => d.id === e.districtId);
  if (!offlineOk('entry', e.id)) return (<><PageHead title={L(e.title)} lead={L(e.lead)} crumbs={[{ label: t('w.nav.history'), path: 'historia' }, { label: L(e.title) }]} /><Section><Notice tone="warn" icon="wifiOff">{t('w.off.entry')}</Notice></Section></>);
  const media = e.media || []; const images = media.filter((m) => m.type === 'image'); const videos = media.filter((m) => m.type === 'video'); const audios = media.filter((m) => m.type === 'audio');
  const models = media.filter((m) => m.type === 'model3d'); const panos = media.filter((m) => m.type === 'panorama');
  const tone = e.year && e.year < 1990 ? 'archival' : 'duotone';
  const paras = paragraphs(L(e.body));
  const quoteSrc = e.audioGuide ? sentences(L(e.audioGuide.text))[0] : sentences(L(e.body))[1];
  // galeria: zdjęcia wpisu + powiązane zdjęcia z galerii (wspólne tagi)
  const related = s.gallery.filter((g) => (g.tags || []).some((x) => (e.tags || []).includes(x))).slice(0, 6);
  const gal = [...images.map((m) => ({ ill: m.ill, tone, title: L(m.caption) || L(e.title), caption: L(m.caption), credit: m.credit })), ...related.map((g) => ({ ill: g.ill, tone: g.year && g.year < 1990 ? 'archival' : 'duotone', title: L(g.title), caption: `${L(g.description)}${g.year ? ` (${g.year})` : ''}`, credit: g.author }))];
  const hero = images[0] || media.find((m) => m.ill);
  const rel = sel.entries({ channel: 'web' }).filter((x) => x.id !== e.id).map((x) => ({ x, sc: (x.categoryId === e.categoryId ? 2 : 0) + (x.eraId && x.eraId === e.eraId ? 2 : 0) + (x.poiId && x.poiId === e.poiId ? 3 : 0) + (x.tags || []).filter((g) => (e.tags || []).includes(g)).length })).filter((o) => o.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 3).map((o) => o.x);
  const words = stripMarks(L(e.body)).split(/\s+/).length; const mins = Math.max(1, Math.round(words / 200));
  const crumbs = [{ label: t('w.nav.history'), path: 'historia' }, ...(parent ? [{ label: L(parent.name), path: `historia/kategorie/${enc(parent.id)}` }] : []), ...(cat ? [{ label: L(cat.name), path: `historia/kategorie/${enc(cat.id)}` }] : []), { label: L(e.title) }].filter((c, i, a) => i === 0 || c.label !== a[i - 1].label);
  const off = isOffline();
  return (<article class="w-article">
    <PageHead title={L(e.title)} crumbs={crumbs} band={false}>
      <div class="w-meta w-article__meta">
        {era && <Tag tone="green">{L(era.name)}</Tag>}{e.year && <Tag tone="deep">{e.year}</Tag>}{cat && <span>{L(cat.name)}</span>}
        <span><Icon name="clock" size={14} /> {t('w.a.read', { n: mins })}</span><span><Icon name="eye" size={14} /> {t('w.a.views', { n: e.views || 0 })}</span>
        {e.updatedAt && <span>{t('w.a.updated')}: {fmtDate(e.updatedAt, lang)}</span>}
      </div>
    </PageHead>
    <div class="w-wrap w-article__grid">
      <div class="w-article__main">
        <p class="w-article__lead">{L(e.lead)}</p>
        {hero && <figure class="w-fig w-fig--hero"><Media ill={hero.ill} src={hero.src} tone={tone} ratio="16/9" shape="arc-tr" alt={L(hero.caption) || L(e.title)} /><figcaption>{L(hero.caption)}{hero.credit && <span> · {hero.credit}</span>}</figcaption></figure>}
        <div class="w-prose fpz-rich">
          {paras.map((p, i) => (<Fragment key={i}>
            <p>{p.map((x, j) => (x.b ? <b key={j}>{x.text}</b> : x.text))}</p>
            {i === 0 && quoteSrc && <blockquote class="w-pull"><p>{quoteSrc}</p></blockquote>}
            {i === 1 && images[1] && <figure class="w-fig w-fig--inline"><Media ill={images[1].ill} tone={tone} ratio="4/3" shape="arc-bl" alt={L(images[1].caption)} /><figcaption>{L(images[1].caption)}{images[1].credit && <span> · {images[1].credit}</span>}</figcaption></figure>}
          </Fragment>))}
        </div>

        {videos.length > 0 && <section class="w-asec" aria-labelledby="w-a-vid"><h2 id="w-a-vid"><Icon name="video" size={20} /> {t('w.a.video')}</h2>
          {off ? <Notice tone="warn" icon="wifiOff">{t('w.off.video')}</Notice> : videos.map((m, i) => { const caps = captionsFor(e, m); return <VideoBlock key={i} video={{ title: m.caption || e.title, ill: m.ill, durationSec: m.durationSec || caps.length * 6 + 4, captions: caps, kind: tone === 'archival' ? 'archive' : 'studio' }} caption={`${L(m.caption)}${m.credit ? ' · ' + m.credit : ''}`} description={`${L(m.caption)}. ${L(e.lead)}`} />; })}
        </section>}

        {(audios.length > 0) && <section class="w-asec" aria-labelledby="w-a-aud"><h2 id="w-a-aud"><Icon name="headphones" size={20} /> {t('w.a.audio')}</h2>
          {audios.map((m, i) => { const txt = `${L(m.caption)}. ${L(e.lead)}`; return (<div key={i} class="w-audio"><AudioGuide src={m.src} title={L(m.caption)} text={txt} /></div>); })}
        </section>}

        {gal.length > 0 && <section class="w-asec" aria-labelledby="w-a-gal"><h2 id="w-a-gal"><Icon name="image" size={20} /> {t('w.a.gallery')} <span class="w-count">{gal.length}</span></h2><Gallery items={gal} /></section>}

        {models.length > 0 && <section class="w-asec" aria-labelledby="w-a-3d"><h2 id="w-a-3d"><Icon name="cube" size={20} /> {t('w.a.model')}</h2>
          {models.map((m, i) => <figure key={i} class="w-fig"><Model3D modelId={m.modelId || 'lathe'} hotspots="auto" /><figcaption>{L(m.caption)} · {t('w.a.modelHint')}</figcaption></figure>)}
        </section>}

        {panos.length > 0 && <section class="w-asec" aria-labelledby="w-a-360"><h2 id="w-a-360"><Icon name="panorama" size={20} /> {t('w.a.pano')}</h2>
          {panos.map((m, i) => <figure key={i} class="w-fig"><Panorama360 hotspots={s.futureHotspots || []} /><figcaption>{L(m.caption)} · {t('w.a.panoHint')}</figcaption></figure>)}
        </section>}

        {(e.tags || []).length > 0 && <ul class="w-tags" aria-label={t('w.f.tag')}>{e.tags.map((g) => <li key={g}><button type="button" class="fpz-chip" onClick={() => { set({ hf: { tag: g } }); go('historia'); }}>#{g}</button></li>)}</ul>}
      </div>

      <aside class="w-article__aside" aria-label={t('w.a.aside')}>
        {e.audioGuide && <Card variant="mint" class="w-aside__card"><CardBody>
          <h2 class="w-h4"><Icon name="headphones" size={18} /> {t('w.a.guide')}</h2>
          <AudioGuide src={e.audioGuide.src} title={L(e.title)} text={L(e.audioGuide.text)} />
        </CardBody></Card>}
        <Card class="w-aside__card"><CardBody>
          <h2 class="w-h4">{t('w.a.facts')}</h2>
          <dl class="w-dl">
            {e.year && <><dt>{t('w.a.year')}</dt><dd>{e.year}</dd></>}
            {era && <><dt>{t('w.f.era')}</dt><dd>{L(era.name)} ({era.from}–{era.to})</dd></>}
            {district && <><dt>{t('w.f.district')}</dt><dd>{district.name}</dd></>}
            {poi && <><dt>{t('w.f.place')}</dt><dd>{L(poi.name)}</dd></>}
          </dl>
          {poi && <Button size="sm" variant="secondary" icon="map" onClick={() => go(`mapa/miejsce/${enc(poi.id)}`)}>{t('w.a.onMap')}</Button>}
        </CardBody></Card>
        <Card class="w-aside__card"><CardBody>
          <h2 class="w-h4"><Icon name="smartphone" size={18} /> {t('w.a.inApp')}</h2>
          <div class="w-qrrow"><QR value={'E:' + e.id} size={104} /><p class="w-small">{t('w.a.inAppT')}</p></div>
        </CardBody></Card>
      </aside>
    </div>

    {rel.length > 0 && <Section id="w-rel" tone="mint" title={t('w.a.related')}>
      <ul class="w-grid w-grid--3">{rel.map((x) => <li key={x.id}><EntryCard e={x} /></li>)}</ul>
    </Section>}
  </article>);
}

/* ── galeria zdjęć ── */
function PhotoGallery() {
  const s = useStore(); const { t, L } = useClient(); const [tag, setTag] = useState('all');
  const tags = [...new Set(s.gallery.flatMap((g) => g.tags || []))].slice(0, 10);
  const list = s.gallery.filter((g) => tag === 'all' || (g.tags || []).includes(tag)).sort((a, b) => (a.year || 0) - (b.year || 0));
  const items = list.map((g) => ({ ill: g.ill, tone: g.year && g.year < 1990 ? 'archival' : 'duotone', title: L(g.title), caption: `${L(g.description)}${g.year ? ` (${g.year})` : ''}`, credit: g.author }));
  return (<Section id="w-gal">
    <Chips class="w-mb" options={[{ id: 'all', label: t('c.all') }, ...tags.map((x) => ({ id: x, label: '#' + x }))]} value={tag} onChange={setTag} />
    {items.length ? <Gallery items={items} cols={4} /> : <Empty icon="image" title={t('c.empty')} />}
  </Section>);
}

/* ── filmoteka ── */
export function VideoLibrary({ kinds = ['studio', 'archive', 'live'], title }) {
  const s = useStore(); const { t, L } = useClient(); const [k, setK] = useState('all'); const [open, setOpen] = useState(null);
  const list = s.videos.filter((v) => kinds.includes(v.kind) && (k === 'all' || v.kind === k));
  const v = open && s.videos.find((x) => x.id === open);
  return (<Section id="w-vids" title={title}>
    <Chips class="w-mb" options={[{ id: 'all', label: t('c.all') }, ...kinds.map((x) => ({ id: x, label: t('w.vk.' + x) }))]} value={k} onChange={setK} />
    {list.length ? <ul class="w-grid w-grid--3">{list.map((x) => <li key={x.id}><Card as="article" class="w-vcard2">
      <button type="button" class="w-vthumb" onClick={() => setOpen(x.id)} aria-label={`${t('c.play')}: ${L(x.title)}`}>
        <Media ill={x.ill} src={x.src} tone={x.kind === 'archive' ? 'archival' : 'duotone'} ratio="16/9" shape="plain" alt="" />
        <span class="w-vthumb__play" aria-hidden="true"><Icon name="play" size={26} /></span>
        <span class="w-vthumb__dur">{x.kind === 'live' ? t('c.live') : fmtDuration(x.durationSec)}</span>
      </button>
      <CardBody><div class="w-meta"><Tag tone={x.kind === 'archive' ? 'neutral' : 'green'}>{t('w.vk.' + x.kind)}</Tag>{x.year && <span>{x.year}</span>}<span><Icon name="captions" size={14} /> {t('c.captions')}</span></div>
        <h3>{L(x.title)}</h3><p class="w-small">{L(x.description)}</p></CardBody>
    </Card></li>)}</ul> : <Empty icon="film" title={t('c.empty')} />}
    {v && <Modal open onClose={() => setOpen(null)} size="lg" title={L(v.title)} closeLabel={t('c.close')}>
      {isOffline() ? <Notice tone="warn" icon="wifiOff">{t('w.off.video')}</Notice> : <VideoBlock video={v} caption={L(v.description)} />}
    </Modal>}
  </Section>);
}
