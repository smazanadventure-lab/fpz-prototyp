// Kategorie → podkategorie → wpisy; wpis (galeria zdjęć, filmy, 3D, audio, udostępnianie); galerie zdjęć i filmów; transmisja.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient, useEnv } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDuration, fmtDistance } from '../../kernel/util.js';
import { Button, Card, CardBody, Chips, Empty, Icon, IconButton, LiveCaptions, Media, Modal, QR, Rich, Tag } from '../../ui/components.jsx';
import { VideoSim, AudioGuide, Model3D, Panorama360 } from '../../ui/media.jsx';
import { useApp, entryAvailable, useSlowLoad } from './ctx.js';
import { Screen, SectionHead, EntryCard, Skeleton, NeedsNet } from './ui.jsx';
import { EventCard, EventSheet } from './home.jsx';

strings({
  'm.cat.entries': ['{n} wpisów', '{n} entries'], 'm.cat.all': ['Wszystkie', 'All'], 'm.grid': ['Siatka', 'Grid'], 'm.list': ['Lista', 'List'], 'm.cat.sub': ['Podkategorie', 'Subcategories'],
  'm.gal.photos': ['Galeria zdjęć', 'Photo gallery'], 'm.gal.videos': ['Galeria filmów', 'Video gallery'], 'm.gal.count': ['{n} pozycji', '{n} items'], 'm.galleries': ['Galerie', 'Galleries'],
  'm.e.gallery': ['Zdjęcia', 'Photos'], 'm.e.videos': ['Filmy', 'Videos'], 'm.e.model': ['Obiekt 3D', '3D object'], 'm.e.panorama': ['Panorama 360°', '360° panorama'], 'm.e.audio': ['Audioprzewodnik', 'Audio guide'],
  'm.e.place': ['Powiązane miejsce', 'Related place'], 'm.e.related': ['Zobacz też', 'See also'], 'm.e.queue': ['Słuchaj w odtwarzaczu', 'Play in the player'], 'm.e.recording': ['Nagranie', 'Recording'],
  'm.e.alive': ['Ożyw zdjęcie', 'Bring photo to life'], 'm.e.aliveNote': ['Animacja archiwalnego zdjęcia (efekt poglądowy)', 'Animated archival photo (illustrative effect)'],
  'm.share.title': ['Udostępnij', 'Share'], 'm.share.lead': ['Pokaż kod znajomemu – zeskanuje go w aplikacji – albo skopiuj odnośnik.', 'Show the code to a friend to scan in the app, or copy the link.'], 'm.share.copy': ['Kopiuj odnośnik', 'Copy link'], 'm.share.copied': ['Skopiowano odnośnik', 'Link copied'],
  'm.lb.author': ['Autor', 'Author'], 'm.lb.year': ['Data powstania', 'Date'], 'm.lb.prev': ['Poprzednie zdjęcie', 'Previous photo'], 'm.lb.next': ['Następne zdjęcie', 'Next photo'], 'm.lb.of': ['{n} z {of}', '{n} of {of}'], 'm.lb.swipe': ['Przesuń palcem, aby zobaczyć kolejne', 'Swipe to see more'],
  'm.v.studio': ['Wirtualne studio', 'Virtual studio'], 'm.v.archive': ['Archiwum', 'Archive'], 'm.v.live': ['Transmisje', 'Live'], 'm.v.transcript': ['Transkrypcja', 'Transcript'],
  'm.live.title': ['Transmisja online', 'Live stream'], 'm.live.off': ['Transmisja nie trwa', 'Not on air'], 'm.live.offText': ['Gdy rozpocznie się transmisja z wirtualnego studia lub sceny, otrzymasz powiadomienie.', 'You will be notified when a stream from the virtual studio or stage starts.'],
  'm.live.viewers': ['Oglądających: {n}', 'Viewers: {n}'], 'm.live.captions': ['Napisy na żywo', 'Live captions'],
  'm.com.events': ['Wydarzenia społeczności', 'Community events'], 'm.com.latest': ['Najnowsze wpisy', 'Latest entries'], 'm.com.social': ['FPŻ w mediach społecznościowych', 'FPŻ on social media'],
  'm.about.title': ['O Fabryce', 'About the Factory'], 'm.more.explore': ['Odkrywaj', 'Explore'],
});

const sectionOf = (cat) => { let c = cat; while (c?.parentId) c = sel.category(c.parentId); return c && (c.id === 'spolecznosc' || c.icon === 'people') ? 'community' : 'history'; };
const catIll = (catId) => { const e = sel.entries({ categoryId: catId, channel: 'mobile' }).find((x) => (x.media || []).some((m) => m.ill)); return e ? { ill: e.media.find((m) => m.ill).ill, tone: e.year && e.year < 1990 ? 'archival' : 'duotone' } : { ill: 'hall-exterior', tone: 'duotone' }; };

function CatTile({ cat, onClick }) {
  const { L, t } = useClient(); const im = catIll(cat.id); const n = sel.entries({ categoryId: cat.id, channel: 'mobile' }).length;
  return <button type="button" class="m-cattile" onClick={onClick}><Media ill={im.ill} src={im.src} tone={im.tone} ratio="4/3" shape="arc-tr" alt="" /><b>{L(cat.name)}</b><small>{t('m.cat.entries', { n })}</small></button>;
}

/** Zakładka Historia / Społeczność – kategorie z CMS (nowe pojawiają się same). */
export function CatalogRoot({ section }) {
  const app = useApp(); const { t, L } = useClient(); const s = getState();
  const roots = sel.categoryTree().filter((r) => sectionOf(r) === section);
  const loading = useSlowLoad(section);
  return (<Screen root title={t(section === 'history' ? 'm.tab.history' : 'm.tab.community')}>
    {loading ? <Skeleton lines={6} /> : <div class="m-stack">
      {roots.map((r) => (<div key={r.id} class="m-catsec">
        <SectionHead title={L(r.name)} action={t('m.cat.all')} onAction={() => app.push('category', { id: r.id })} />
        {r.children.length ? <div class="m-hscroll m-hscroll--tiles">{r.children.map((c) => <CatTile key={c.id} cat={c} onClick={() => app.push('category', { id: c.id })} />)}</div>
          : <div class="m-hscroll">{sel.entries({ categoryId: r.id, channel: 'mobile' }).slice(0, 6).map((e) => <EntryCard key={e.id} entry={e} onClick={() => app.openEntry(e.id)} />)}</div>}
      </div>))}
      {section === 'history' && <><SectionHead title={t('m.galleries')} />
        <div class="m-grid2">
          <button type="button" class="m-galtile" onClick={() => app.push('gallery')}><Media ill={s.gallery[0]?.ill || 'factory-archival'} tone="archival" ratio="1/1" shape="arc-tl" alt="" /><b><Icon name="image" size={16} />{t('m.gal.photos')}</b><small>{t('m.gal.count', { n: s.gallery.length })}</small></button>
          <button type="button" class="m-galtile" onClick={() => app.push('videos')}><Media ill={s.videos[1]?.ill || 'studio'} tone="archival" ratio="1/1" shape="arc-tr" alt="" /><b><Icon name="video" size={16} />{t('m.gal.videos')}</b><small>{t('m.gal.count', { n: s.videos.length })}</small></button>
        </div></>}
      {section === 'community' && <CommunityExtras />}
    </div>}
  </Screen>);
}

function CommunityExtras() {
  const app = useApp(); const { t, L } = useClient(); const s = getState(); const [ev, setEv] = useState(null);
  const events = sel.events().filter((e) => ['spotkanie', 'warsztaty', 'dzieci', 'targi', 'sport'].includes(e.category)).slice(0, 3);
  return (<>
    {s.live.onAir && <Card variant="deep" class="m-live" onClick={() => app.push('live')}><CardBody><Tag tone="live">{t('c.live')}</Tag><h2>{L(s.live.title)}</h2></CardBody></Card>}
    {events.length > 0 && <><SectionHead title={t('m.com.events')} action={t('m.cat.all')} onAction={() => app.openReservation({ view: 'events' })} />{events.map((e) => <EventCard key={e.id} ev={e} onMore={() => setEv(e.id)} />)}</>}
    <div class="m-grid2">
      <button type="button" class="m-galtile" onClick={() => app.push('videos')}><Media ill="studio" ratio="1/1" shape="arc-tl" alt="" /><b><Icon name="video" size={16} />{t('m.d.videos')}</b></button>
      <button type="button" class="m-galtile" onClick={() => app.push('social')}><Media ill="kids" ratio="1/1" shape="arc-tr" alt="" /><b><Icon name="share" size={16} />{t('m.d.social')}</b></button>
    </div>
    {ev && <EventSheet id={ev} onClose={() => setEv(null)} />}
  </>);
}

function LayoutToggle() {
  const { client, set, t } = useClient(); const v = client.layout || 'grid';
  return <span class="m-layout" role="group"><IconButton icon="grid" variant="plain" size="sm" label={t('m.grid')} active={v === 'grid'} onClick={() => set({ layout: 'grid' })} /><IconButton icon="list" variant="plain" size="sm" label={t('m.list')} active={v === 'list'} onClick={() => set({ layout: 'list' })} /></span>;
}

export function CategoryScreen({ id }) {
  const app = useApp(); const { t, L, client } = useClient(); const cat = sel.category(id); const [sub, setSub] = useState('all'); const loading = useSlowLoad(id);
  if (!cat) return <Screen title="—"><Empty title={t('c.empty')} /></Screen>;
  const parent = cat.parentId && sel.category(cat.parentId); const children = getState().categories.filter((c) => c.parentId === id).sort((a, b) => a.order - b.order);
  const list = sel.entries({ categoryId: sub === 'all' ? id : sub, channel: 'mobile' }); const layout = client.layout || 'grid';
  const crumbs = [t(sectionOf(cat) === 'community' ? 'm.tab.community' : 'm.tab.history'), parent && L(parent.name), L(cat.name)].filter(Boolean);
  return (<Screen title={L(cat.name)} crumbs={crumbs} actions={<LayoutToggle />} below={children.length > 0 && <Chips scroll value={sub} onChange={setSub} class="m-filters" options={[{ id: 'all', label: t('c.all') }, ...children.map((c) => ({ id: c.id, label: L(c.name) }))]} />}>
    {loading ? <Skeleton lines={5} /> : list.length === 0 ? <Empty icon="folder" title={t('c.empty')} /> :
      <div class={layout === 'grid' ? 'm-grid2' : 'm-list'} key={sub + layout}>{list.map((e) => <EntryCard key={e.id} entry={e} layout={layout} onClick={() => app.openEntry(e.id)} />)}</div>}
  </Screen>);
}

/** Zdjęcie z opcjonalnym „ożywieniem” (archiwalne). */
function AliveMedia({ ill, tone, ratio, shape, alt, onClick }) {
  const { t } = useClient(); const [alive, setAlive] = useState(false);
  useEffect(() => { if (!alive) return; const x = setTimeout(() => setAlive(false), 6500); return () => clearTimeout(x); }, [alive]);
  return (<div class={clsx('m-alive', alive && 'is-alive')}>
    <button type="button" class="m-alive__img" onClick={onClick} aria-label={alt}><Media ill={ill} tone={tone} ratio={ratio} shape={shape} alt={alt} /></button>
    {tone === 'archival' && <IconButton icon="sparkles" variant="round" size="sm" class="m-alive__btn" label={t('m.e.alive')} active={alive} onClick={() => setAlive(true)} />}
    {alive && <small class="m-alive__note" role="status">{t('m.e.aliveNote')}</small>}
  </div>);
}

/** Podgląd zdjęć na pełnym ekranie z przesuwaniem gestem. items: [{ill, tone, title, caption, author, year, description}] */
export function Lightbox({ items, index = 0, onClose }) {
  const { t, L } = useClient(); const [i, setI] = useState(index); const [dx, setDx] = useState(0); const x0 = useRef(null); const it = items[i]; if (!it) return null;
  const go = (d) => setI((k) => Math.max(0, Math.min(items.length - 1, k + d)));
  const up = (e) => { if (x0.current == null) return; const d = e.clientX - x0.current; x0.current = null; setDx(0); if (d < -50) go(1); else if (d > 50) go(-1); };
  return (<Modal open variant="sheet" size="xl" class="m-lightbox" onClose={onClose} title={t('m.lb.of', { n: i + 1, of: items.length })} closeLabel={t('c.close')}>
    <div class="m-lb__stage" onPointerDown={(e) => { x0.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); }} onPointerMove={(e) => { if (x0.current != null) setDx(e.clientX - x0.current); }} onPointerUp={up} onPointerCancel={up}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }} tabIndex={0} aria-label={t('m.lb.swipe')}>
      <div class="m-lb__track" style={{ transform: `translateX(calc(${-i * 100}% + ${dx}px))`, transition: dx ? 'none' : undefined }}>
        {items.map((x, k) => <div key={k} class="m-lb__slide"><AliveMedia ill={x.ill} src={x.src} tone={x.tone} ratio="4/3" shape="card" alt={x.title || ''} /></div>)}
      </div>
      {i > 0 && <IconButton icon="back" variant="round" size="sm" class="m-lb__prev" label={t('m.lb.prev')} onClick={() => go(-1)} />}
      {i < items.length - 1 && <IconButton icon="forward" variant="round" size="sm" class="m-lb__next" label={t('m.lb.next')} onClick={() => go(1)} />}
    </div>
    <div class="m-lb__info" aria-live="polite"><h2>{it.title}</h2>
      {(it.author || it.year) && <dl class="m-dl m-dl--row">{it.author && <><dt>{t('m.lb.author')}</dt><dd>{it.author}</dd></>}{it.year && <><dt>{t('m.lb.year')}</dt><dd>{it.year}</dd></>}</dl>}
      {it.description && <p>{it.description}</p>}<small class="m-muted">{t('m.lb.swipe')}</small></div>
  </Modal>);
}

export function ShareSheet({ id, title, onClose }) {
  const { t, toast } = useClient(); const link = `https://fpz.example/wpis/${id}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); } catch { /* schowek niedostępny w ramce testowej */ } toast(t('m.share.copied'), 'ok'); };
  return (<Modal open variant="sheet" size="sm" onClose={onClose} title={t('m.share.title')} closeLabel={t('c.close')}>
    <div class="m-share"><p>{t('m.share.lead')}</p><QR value={`E:${id}`} size={180} label={`E:${id}`} /><b>{title}</b><code class="m-share__link">{link}</code>
      <Button icon="copy" onClick={copy}>{t('m.share.copy')}</Button></div></Modal>);
}

export function EntryScreen({ id }) {
  const app = useApp(); const { t, L, api, client } = useClient(); useEnv(); const e = sel.entry(id); const loading = useSlowLoad(id);
  const [lb, setLb] = useState(null); const [share, setShare] = useState(false);
  useEffect(() => { if (e) api.stats.track('entry', id); }, [id]);
  if (!e) return <Screen title="—" crumbs={[t('c.back')]}><Empty title={t('c.empty')} /></Screen>;
  const cat = sel.category(e.categoryId); const parent = cat?.parentId && sel.category(cat.parentId);
  const crumbs = [t(sectionOf(cat) === 'community' ? 'm.tab.community' : 'm.tab.history'), cat && L(cat.name)].filter(Boolean);
  const ok = entryAvailable(id, client);
  const media = e.media || []; const imgs = media.filter((m) => m.type === 'image'); const vids = media.filter((m) => m.type === 'video'); const models = media.filter((m) => m.type === 'model3d');
  const panos = media.filter((m) => m.type === 'panorama'); const audios = media.filter((m) => m.type === 'audio');
  const tone = e.year && e.year < 1990 ? 'archival' : 'duotone'; const hero = imgs[0] || media.find((m) => m.ill);
  const lbItems = imgs.map((m) => ({ ill: m.ill, tone, title: L(m.caption) || L(e.title), author: m.credit, year: e.year, description: L(e.lead) }));
  const poi = e.poiId && sel.poi(e.poiId); const related = sel.entries({ categoryId: e.categoryId, channel: 'mobile' }).filter((x) => x.id !== id).slice(0, 4);
  const actions = <IconButton icon="share" variant="plain" label={t('c.share')} onClick={() => setShare(true)} />;
  return (<Screen title={app.platform === 'android' ? L(e.title) : null} crumbs={crumbs} actions={actions}>
    {!ok ? <NeedsNet /> : loading ? <Skeleton lines={8} /> : <article class="m-entry">
      {e.year && <small class="m-kicker">{e.year}{parent ? ` · ${L(parent.name)}` : ''}</small>}
      <h1 class="m-entry__title">{L(e.title)}</h1>
      <p class="m-entry__lead">{L(e.lead)}</p>
      {hero && <figure class="m-entry__hero"><AliveMedia ill={hero.ill} src={hero.src} tone={tone} ratio={getState().env.network === 'slow' ? '16/9' : '4/3'} shape="arc-tr" alt={L(hero.caption) || L(e.title)} onClick={() => imgs.length && setLb(0)} />{hero.caption && <figcaption>{L(hero.caption)}{hero.credit ? ` · ${hero.credit}` : ''}</figcaption>}</figure>}
      {e.audioGuide && <section class="m-entry__sec"><h2 class="m-h3"><Icon name="headphones" size={18} />{t('m.e.audio')}</h2>
        <AudioGuide src={e.audioGuide.src} text={L(e.audioGuide.text)} title={L(e.title)} />
        <button type="button" class="m-link" onClick={() => app.playAudio([id])}><Icon name="playlist" size={15} />{t('m.e.queue')}</button></section>}
      <Rich text={L(e.body)} class="m-entry__body" />
      {imgs.length > 1 && <section class="m-entry__sec"><h2 class="m-h3"><Icon name="image" size={18} />{t('m.e.gallery')} <small>({imgs.length})</small></h2>
        <div class="m-thumbs">{imgs.map((m, k) => <button key={k} type="button" onClick={() => setLb(k)} aria-label={L(m.caption)}><Media ill={m.ill} src={m.src} tone={tone} ratio="1/1" shape={k % 2 ? 'arc-tl' : 'rounded'} alt="" /></button>)}</div></section>}
      {vids.length > 0 && <section class="m-entry__sec"><h2 class="m-h3"><Icon name="video" size={18} />{t('m.e.videos')}</h2>{vids.map((m, k) => <div key={k} class="m-vid"><VideoSim title={L(m.caption)} ill={m.ill} src={m.src} durationSec={m.durationSec} captions={m.captions} /><small>{L(m.caption)}{m.credit ? ` · ${m.credit}` : ''}</small></div>)}</section>}
      {models.length > 0 && <section class="m-entry__sec"><h2 class="m-h3"><Icon name="cube" size={18} />{t('m.e.model')}</h2>{models.map((m, k) => <div key={k}><Model3D modelId={m.modelId || 'lathe'} /><small class="m-muted">{L(m.caption)}</small></div>)}</section>}
      {panos.length > 0 && <section class="m-entry__sec"><h2 class="m-h3"><Icon name="panorama" size={18} />{t('m.e.panorama')}</h2><Panorama360 hotspots={getState().futureHotspots || []} /></section>}
      {audios.length > 0 && <section class="m-entry__sec"><h2 class="m-h3"><Icon name="volume" size={18} />{t('m.e.recording')}</h2>{audios.map((m, k) => <AudioGuide key={k} src={m.src} text={L(m.caption)} title={L(m.caption)} />)}</section>}
      {poi && <section class="m-entry__sec"><h2 class="m-h3"><Icon name="mapPin" size={18} />{t('m.e.place')}</h2>
        <Card variant="mint" class="m-placecard"><CardBody><Media ill={poi.ill} src={poi.src} ratio="1/1" shape="circle" class="m-placecard__img" alt="" /><span><b>{L(poi.name)}</b><small>{fmtDistance(sel.distanceTo(poi))}{poi.accessible ? ' · ♿' : ''}</small></span>
          <span class="m-placecard__btns"><IconButton icon="info" variant="mint" label={L(poi.name)} onClick={() => app.openPoi(poi.id)} /><IconButton icon="map" variant="round" label={t('m.showOnMap')} onClick={() => app.showOnMap(poi.id)} /></span></CardBody></Card></section>}
      <div class="m-btnrow"><Button variant="secondary" icon="share" onClick={() => setShare(true)}>{t('c.share')}</Button></div>
      {related.length > 0 && <section class="m-entry__sec"><SectionHead title={t('m.e.related')} /><div class="m-hscroll">{related.map((x) => <EntryCard key={x.id} entry={x} onClick={() => app.openEntry(x.id)} />)}</div></section>}
    </article>}
    {lb != null && <Lightbox items={lbItems} index={lb} onClose={() => setLb(null)} />}
    {share && <ShareSheet id={id} title={L(e.title)} onClose={() => setShare(false)} />}
  </Screen>);
}

export function GalleryScreen() {
  const { t, L, client } = useClient(); const s = getState(); const [f, setF] = useState('all'); const [lb, setLb] = useState(null); const loading = useSlowLoad('gal'); const layout = client.layout || 'grid';
  const tags = [...new Set(s.gallery.flatMap((g) => g.tags || []))].slice(0, 5);
  const list = s.gallery.filter((g) => f === 'all' || (g.tags || []).includes(f));
  const items = list.map((g) => ({ ill: g.ill, tone: g.year && g.year < 1990 ? 'archival' : 'duotone', title: L(g.title), author: g.author, year: g.year, description: L(g.description) }));
  return (<Screen title={t('m.gal.photos')} crumbs={[t('m.tab.history'), t('m.gal.photos')]} actions={<LayoutToggle />} below={tags.length > 0 && <Chips scroll value={f} onChange={setF} class="m-filters" options={[{ id: 'all', label: t('c.all') }, ...tags.map((x) => ({ id: x, label: x }))]} />}>
    {loading ? <Skeleton lines={3} /> : list.length === 0 ? <Empty icon="image" title={t('c.empty')} /> : layout === 'grid'
      ? <div class="m-masonry" key={f}>{items.map((x, k) => <button key={k} type="button" class="m-masonry__it" onClick={() => setLb(k)} aria-label={x.title}><Media ill={x.ill} src={x.src} tone={x.tone} ratio={['3/4', '1/1', '4/3', '1/1', '3/4'][k % 5]} shape="rounded" alt={x.title} /></button>)}</div>
      : <div class="m-list" key={f}>{items.map((x, k) => <button key={k} type="button" class="m-erow" onClick={() => setLb(k)}><Media ill={x.ill} src={x.src} tone={x.tone} ratio="1/1" shape="card" class="m-erow__img" alt="" /><span class="m-erow__txt"><b>{x.title}</b><span>{[x.year, x.author].filter(Boolean).join(' · ')}</span></span></button>)}</div>}
    {lb != null && <Lightbox items={items} index={lb} onClose={() => setLb(null)} />}
  </Screen>);
}

export function VideosScreen() {
  const app = useApp(); const { t, L } = useClient(); const s = getState(); const [f, setF] = useState('all'); const loading = useSlowLoad('vid');
  const list = s.videos.filter((v) => f === 'all' || v.kind === f);
  return (<Screen title={t('m.gal.videos')} crumbs={[t('m.tab.history'), t('m.gal.videos')]} below={<Chips scroll value={f} onChange={setF} class="m-filters" options={[{ id: 'all', label: t('c.all') }, { id: 'studio', label: t('m.v.studio') }, { id: 'archive', label: t('m.v.archive') }, { id: 'live', label: t('m.v.live') }]} />}>
    {s.live.onAir && <Card variant="deep" class="m-live" onClick={() => app.push('live')}><CardBody><Tag tone="live">{t('c.live')}</Tag><h2>{L(s.live.title)}</h2><span class="m-live__go"><Icon name="play" size={16} />{t('m.home.watch')}</span></CardBody></Card>}
    {loading ? <Skeleton lines={4} /> : list.length === 0 ? <Empty icon="video" title={t('c.empty')} /> : <div class="m-stack" key={f}>{list.map((v) => (
      <Card key={v.id} class="m-vcard" onClick={() => (v.kind === 'live' ? app.push('live') : app.push('video', { id: v.id }))}>
        <Media ill={v.ill} src={v.src} tone={v.kind === 'archive' ? 'archival' : 'duotone'} ratio={s.env.network === 'slow' ? '21/9' : '16/9'} shape="plain" alt=""><span class="m-vcard__play"><Icon name="play" size={22} /></span><span class="m-vcard__dur">{v.kind === 'live' ? t('c.live') : fmtDuration(v.durationSec)}</span></Media>
        <CardBody>{v.year && <small class="m-kicker">{v.year}</small>}<b>{L(v.title)}</b></CardBody></Card>))}</div>}
  </Screen>);
}

export function VideoScreen({ id }) {
  const { t, L } = useClient(); const v = getState().videos.find((x) => x.id === id); const loading = useSlowLoad(id); const { env } = useEnv();
  if (!v) return <Screen title="—"><Empty title={t('c.empty')} /></Screen>;
  return (<Screen title={L(v.title)} crumbs={[t('m.gal.videos'), L(v.title)]} hideTitle>
    {env.network === 'offline' ? <NeedsNet /> : loading ? <Skeleton lines={4} /> : <article class="m-entry">
      <VideoSim video={v} /><div class="m-tagrow"><Tag>{t(v.kind === 'archive' ? 'm.v.archive' : 'm.v.studio')}</Tag>{v.year && <Tag>{v.year}</Tag>}<Tag icon="captions">{t('c.captions')}</Tag></div>
      <h1 class="m-entry__title">{L(v.title)}</h1><p>{L(v.description)}</p>
      {(v.captions || []).length > 0 && <details class="m-transcript"><summary>{t('m.v.transcript')}</summary><ol>{v.captions.map((c, k) => <li key={k}><time>{fmtDuration(c.t)}</time>{L(c.text)}</li>)}</ol></details>}
    </article>}
  </Screen>);
}

export function LiveScreen() {
  const { t, L } = useClient(); const s = getState(); const { env } = useEnv(); const v = s.videos.find((x) => x.kind === 'live');
  return (<Screen title={t('m.live.title')} crumbs={[t('m.d.videos'), t('m.live.title')]}>
    {env.network === 'offline' ? <NeedsNet /> : s.live.onAir ? <article class="m-entry">
      <VideoSim live autoplay video={v} title={L(s.live.title)} ill={v?.ill || 'stage'} />
      <div class="m-tagrow"><Tag tone="live">{t('c.live')}</Tag><Tag icon="people">{t('m.live.viewers', { n: s.live.viewers })}</Tag></div>
      <h1 class="m-entry__title">{L(s.live.title)}</h1>
      <h2 class="m-h3"><Icon name="captions" size={18} />{t('m.live.captions')}</h2><LiveCaptions lines={4} class="m-captions" />
    </article> : <Empty icon="tv" title={t('m.live.off')} text={t('m.live.offText')} />}
  </Screen>);
}

export function AboutSiteScreen() {
  const app = useApp(); const { t, L } = useClient(); const s = getState();
  return (<Screen title={t('m.about.title')} crumbs={[t('m.tab.home'), t('m.about.title')]}>
    <article class="m-entry"><h1 class="m-entry__title">{t('m.home.welcome')}</h1><p class="m-entry__lead">{L(s.site.tagline)}</p>
      <Media ill="hall-exterior" ratio="4/3" shape="arc-tr" alt={L(s.site.name)} class="m-entry__hero" />
      <Rich text={L(s.site.about)} class="m-entry__body" />
      <div class="m-btnrow"><Button icon="info" onClick={() => app.push('info')}>{t('m.home.practical')}</Button><Button variant="secondary" icon="map" onClick={() => app.go('map')}>{t('m.tab.map')}</Button></div></article>
  </Screen>);
}
