// Elementy wspólne podstron strony WWW.
import { useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { fmtDay, fmtTime, fmtDate, fmtMoney, clsx } from '../../kernel/util.js';
import { Icon, Button, Card, CardBody, CornerLink, Tag, Media, Modal, IconButton, PatternBand, QR } from '../../ui/components.jsx';
import { useNav, enc, offlineOk } from './nav.js';

/** Nagłówek podstrony: pas wzoru, okruszki, H1 i lead. */
export function PageHead({ title, lead, crumbs = [], icon, children, band = true }) {
  const { t } = useClient(); const { go } = useNav();
  return (
    <header class={clsx('w-phead', band && 'w-phead--band')}>
      {band && <PatternBand class="w-phead__band" scale={0.8} />}
      <div class="w-wrap w-phead__in">
        <nav class="w-crumbs" aria-label={t('w.crumbs')}>
          <ol>
            <li><a href="#" onClick={(e) => { e.preventDefault(); go(''); }}>{t('w.nav.home')}</a></li>
            {crumbs.map((c, i) => <li key={i}>{c.path != null ? <a href="#" onClick={(e) => { e.preventDefault(); go(c.path); }}>{c.label}</a> : <span aria-current="page">{c.label}</span>}</li>)}
          </ol>
        </nav>
        <div class="w-phead__row">
          {icon && <span class="w-phead__icon" aria-hidden="true"><Icon name={icon} size={26} /></span>}
          <div class="w-phead__txt"><h1 tabIndex={-1}>{title}</h1>{lead && <p class="w-phead__lead">{lead}</p>}</div>
        </div>
        {children}
      </div>
    </header>
  );
}

/** Sekcja z nagłówkiem H2 i opcjonalnym odnośnikiem „Zobacz wszystkie”. */
export function Section({ id, title, kicker, more, onMore, children, class: cls, tone }) {
  return (
    <section class={clsx('w-sec', tone && `w-sec--${tone}`, cls)} aria-labelledby={id ? id + '-h' : undefined}>
      <div class="w-wrap">
        {(title || more) && <div class="w-sec__head">
          <div>{kicker && <span class="w-kicker">{kicker}</span>}{title && <h2 id={id ? id + '-h' : undefined}>{title}</h2>}</div>
          {more && <Button variant="secondary" size="sm" iconRight="arrowRight" onClick={onMore}>{more}</Button>}
        </div>}
        {children}
      </div>
    </section>
  );
}

export const entryImage = (e) => (e.media || []).find((m) => m.ill)?.ill || 'factory-archival';
const toneFor = (e) => (e.year && e.year < 1990 ? 'archival' : 'duotone');

/** Karta wpisu (artykułu). */
export function EntryCard({ e, variant = 'plain', size = 'md' }) {
  const { L, t, lang } = useClient(); const { go } = useNav(); const era = e.eraId && getState().eras.find((x) => x.id === e.eraId);
  const kinds = [...new Set((e.media || []).map((m) => m.type))]; const off = !offlineOk('entry', e.id);
  const open = () => go(`historia/wpis/${enc(e.id)}`);
  return (
    <Card variant={variant} class={clsx('w-ecard', `w-ecard--${size}`, off && 'is-off')} as="article">
      <Media ill={entryImage(e)} tone={toneFor(e)} ratio={size === 'lg' ? '16/9' : '3/2'} shape="plain" alt={L((e.media || [])[0]?.caption) || L(e.title)}>
        {e.year && <span class="w-ecard__year">{e.year}</span>}
      </Media>
      <CardBody>
        <div class="w-meta">{era && <span>{L(era.name)}</span>}{sel.category(e.categoryId) && <span>{L(sel.category(e.categoryId).name)}</span>}</div>
        <h3 class="w-ecard__title"><a href="#" onClick={(ev) => { ev.preventDefault(); open(); }}>{L(e.title)}</a></h3>
        {size !== 'sm' && <p class="w-ecard__lead">{L(e.lead)}</p>}
        <div class="w-ecard__foot">
          <span class="w-ecard__kinds" aria-label={t('w.mediaKinds')}>
            {kinds.includes('video') && <Icon name="video" size={16} title={t('w.kind.video')} />}{(kinds.includes('audio') || e.audioGuide) && <Icon name="headphones" size={16} title={t('w.kind.audio')} />}
            {kinds.includes('model3d') && <Icon name="cube" size={16} title={t('w.kind.model')} />}{kinds.includes('panorama') && <Icon name="panorama" size={16} title={t('w.kind.pano')} />}
            {off && <Tag tone="warn" icon="wifiOff">{t('w.off.na')}</Tag>}
          </span>
          <CornerLink onClick={open}>{t('c.readMore')}</CornerLink>
        </div>
      </CardBody>
    </Card>
  );
}

/** Karta wydarzenia z „Kup bilet”. */
export function EventCard({ ev, compact }) {
  const { L, t, lang } = useClient(); const { go } = useNav(); const left = sel.remaining(ev.id); const prods = sel.productsFor(ev.id); const minP = prods.length ? Math.min(...prods.map((p) => p.price)) : null;
  const poi = ev.poiId && sel.poi(ev.poiId);
  return (
    <Card class={clsx('w-evcard', compact && 'w-evcard--compact')} as="article">
      <div class="w-evcard__date" aria-hidden="true"><b>{new Date(ev.start).getDate()}</b><span>{fmtDate(ev.start, lang, { month: 'short' })}</span></div>
      <div class="w-evcard__body">
        <div class="w-meta"><span>{fmtDay(ev.start, lang)}, {fmtTime(ev.start, lang)}</span>{poi && <span>{L(poi.name)}</span>}{ev.live && <Tag tone="info" icon="tv">{t('w.ev.stream')}</Tag>}</div>
        <h3>{L(ev.title)}</h3>
        {!compact && <p class="w-evcard__desc">{L(ev.description)}</p>}
        <div class="w-evcard__act">
          {ev.ticketed ? (left > 0 ? <Button size="sm" icon="ticket" onClick={() => go(`wydarzenia/event/${enc(ev.id)}`)}>{t('c.buyTicket')}{minP != null ? ` · ${fmtMoney(minP, lang)}` : ''}</Button> : <Tag tone="danger">{t('c.soldOut')}</Tag>) : <Tag tone="green">{t('c.free')}</Tag>}
          <Button size="sm" variant="secondary" onClick={() => go(`wydarzenia/event/${enc(ev.id)}`)}>{t('c.more')}</Button>
        </div>
      </div>
    </Card>
  );
}

/** Karta obiektu/najemcy. */
export function VenueCard({ v, contacts }) {
  const { L, t } = useClient(); const { go } = useNav();
  return (
    <Card class="w-vcard" as="article">
      <Media ill={v.ill} src={v.src} ratio="16/9" shape="plain" alt={L(v.name)} />
      <CardBody>
        <span class="w-kicker">{t('w.vcat.' + v.category)}</span>
        <h3>{L(v.name)}</h3>
        {!contacts && <p class="w-small">{L(v.description)}</p>}
        {contacts && <ul class="w-contacts">
          {v.hours && <li><Icon name="clock" size={15} />{L(v.hours)}</li>}
          {v.contact?.phone && <li><Icon name="phone" size={15} /><a href={`tel:${v.contact.phone.replace(/\s/g, '')}`}>{v.contact.phone}</a></li>}
          {v.contact?.email && <li><Icon name="mail" size={15} /><a href={`mailto:${v.contact.email}`}>{v.contact.email}</a></li>}
          {v.contact?.address && <li><Icon name="mapPin" size={15} />{v.contact.address}</li>}
        </ul>}
        <div class="w-row">
          <Button size="sm" variant={v.acceptsInquiries ? 'primary' : 'secondary'} icon={v.acceptsInquiries ? 'calendar' : 'info'} onClick={() => go(`wydarzenia/venue/${enc(v.id)}`)}>{v.acceptsInquiries ? t('w.venue.ask') : t('c.more')}</Button>
          {v.sample && <Tag>{t('c.sample')}</Tag>}
        </div>
      </CardBody>
    </Card>
  );
}

/** Karta pomysłu mieszkańca z głosowaniem. */
export function IdeaCard({ idea, rank }) {
  const { L, t, api, client, toast } = useClient(); const cat = getState().ideaCategories.find((c) => c.id === idea.categoryId); const poi = idea.poiId && sel.poi(idea.poiId);
  const voted = (client.voted || []).includes(idea.id);
  const vote = () => { const r = api.game.voteIdea(idea.id); if (r.ok) toast(t('w.idea.thanks'), 'ok'); else toast(L(r.message), 'error'); };
  return (
    <Card variant="mint" class="w-idea" as="article">
      <CardBody>
        <div class="w-meta">{rank && <span class="w-idea__rank">#{rank}</span>}{cat && <Tag tone="green">{L(cat.name)}</Tag>}{poi && <span><Icon name="mapPin" size={13} /> {L(poi.name)}</span>}</div>
        <p class="w-idea__text">„{L(idea.text)}”</p>
        <div class="w-idea__foot">
          <span class="w-small">— {idea.nick}</span>
          <button type="button" class={clsx('w-vote', voted && 'is-voted')} onClick={vote} disabled={voted} aria-pressed={voted} aria-label={`${voted ? t('w.idea.voted') : t('w.idea.vote')} – ${t('w.idea.votes', { n: idea.votes })}`}>
            <Icon name="thumbsUp" size={16} /><b>{idea.votes}</b><span>{voted ? t('w.idea.voted') : t('w.idea.vote')}</span>
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Galeria z powiększeniem: items [{ill, title, caption, credit, tone}] – miniatury + lightbox (strzałki, Esc). */
export function Gallery({ items, cols }) {
  const { t } = useClient(); const [i, setI] = useState(null);
  return (<>
    <ul class={clsx('w-gallery', cols && `w-gallery--${cols}`)}>
      {items.map((it, k) => (
        <li key={k}><button type="button" class="w-gallery__item" onClick={() => setI(k)} aria-label={`${t('w.gal.open')}: ${it.title}`}>
          <Media ill={it.ill} src={it.src} tone={it.tone} ratio="4/3" shape={k % 5 === 0 ? 'arc-tr' : 'rounded'} alt={it.title} />
          <span class="w-gallery__cap">{it.title}</span>
        </button></li>))}
    </ul>
    {i != null && <Lightbox items={items} index={i} onIndex={setI} onClose={() => setI(null)} />}
  </>);
}
export function Lightbox({ items, index, onIndex, onClose }) {
  const { t } = useClient(); const it = items[index]; const n = items.length;
  const step = (d) => onIndex((index + d + n) % n);
  useEffect(() => { const k = (e) => { if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [index]);
  useEffect(() => { const id = setTimeout(() => document.querySelector('.w-lightbox .w-lb__nav--next, .w-lightbox .fpz-modal__head button')?.focus(), 60); return () => clearTimeout(id); }, []);
  return (
    <Modal open onClose={onClose} size="xl" title={`${it.title}`} class="w-lightbox" closeLabel={t('c.close')}>
      <div class="w-lb">
        <div class="w-lb__stage">
          <Media ill={it.ill} src={it.src} tone={it.tone} ratio="16/9" shape="rounded" alt={it.alt || it.title} />
          {n > 1 && <><IconButton class="w-lb__nav w-lb__nav--prev" icon="arrowLeft" label={t('w.gal.prev')} onClick={() => step(-1)} />
            <IconButton class="w-lb__nav w-lb__nav--next" icon="arrowRight" label={t('w.gal.next')} onClick={() => step(1)} /></>}
        </div>
        <div class="w-lb__cap" aria-live="polite">
          <span class="w-lb__count">{index + 1} / {n}</span>
          <div>{it.caption && <p>{it.caption}</p>}{it.credit && <p class="w-small">{t('w.gal.credit')}: {it.credit}</p>}</div>
        </div>
        <p class="w-small w-lb__hint">{t('w.gal.keys')}</p>
      </div>
    </Modal>
  );
}

/** Siatka „Pobierz aplikację”/QR. */
export function AppQr({ value = 'https://app.fpz.example/pobierz', size = 112, label }) {
  return <span class="w-qrbox"><span class="w-qr"><QR value={value} size={size} /></span>{label && <span class="w-small">{label}</span>}</span>;
}
