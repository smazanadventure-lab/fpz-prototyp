// Strona główna.
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { fmtDate, paragraphs, stripMarks } from '../../kernel/util.js';
import { Icon, Button, Card, CardBody, CornerLink, Tag, Media, PatternBand, Rich, QR } from '../../ui/components.jsx';
import { useNav, enc } from './nav.js';
import { Section, EntryCard, EventCard, IdeaCard, VenueCard } from './bits.jsx';
import { NewsList } from './community.jsx';

const heroLead = (txt) => { const ss = txt.split(/(?<=[.!?])\s+/); return ss.slice(0, 2).join(' '); };

export function HomePage() {
  const s = useStore(); const { t, L, lang } = useClient(); const { go } = useNav(); const site = s.site;
  const featured = sel.entries({ channel: 'web', featured: true }).slice(0, 5);
  const events = sel.events().slice(0, 4);
  const ideas = sel.ideas().slice(0, 3);
  const partners = s.venues.filter((v) => v.active !== false && ['tenant', 'gastro', 'attraction'].includes(v.category)).slice(0, 8);
  const about = paragraphs(L(site.about));
  const [lead, ...rest] = featured;
  return (<>
    <section class="w-hero" aria-labelledby="w-hero-h">
      <PatternBand class="w-hero__band" scale={1.1} />
      <div class="w-wrap w-hero__in">
        <div class="w-hero__card">
          <span class="w-kicker">{L(site.tagline)}</span>
          <h1 id="w-hero-h" tabIndex={-1}>{t('w.home.hello')}</h1>
          <p class="w-hero__lead">{heroLead(about[0]?.map((x) => x.text).join('') || '')}</p>
          <div class="w-row">
            <Button icon="route" onClick={() => go('mapa/zaplanuj')}>{t('w.plan.title')}</Button>
            <Button variant="secondary" icon="ticket" onClick={() => go('wydarzenia')}>{t('w.home.tickets')}</Button>
          </div>
        </div>
        <ul class="w-hero__quick" aria-label={t('w.home.quick')}>
          {[['historia', 'history', 'w.nav.history', 'w.home.q.history'], ['mapa', 'map', 'w.nav.map', 'w.home.q.map'], ['gra', 'game', 'w.nav.game', 'w.home.q.game'], ['informacje', 'info', 'w.nav.info', 'w.home.q.info']].map(([p, ic, k, d]) => (
            <li key={p}><button type="button" onClick={() => go(p)}><span class="w-hero__qi"><Icon name={ic} size={22} /></span><b>{t(k)}</b><span>{t(d)}</span></button></li>))}
        </ul>
      </div>
    </section>

    {s.live.onAir && <div class="w-wrap"><div class="w-livebn" role="status">
      <Tag tone="live">{t('c.live')}</Tag><b>{L(s.live.title)}</b><span class="w-small">{t('w.live.viewers', { n: s.live.viewers || 0 })}</span>
      <Button size="sm" icon="play" onClick={() => go('transmisje')}>{t('w.live.watch')}</Button>
    </div></div>}

    <Section id="w-feat" kicker={t('w.nav.history')} title={t('w.home.featured')} more={t('w.home.allHistory')} onMore={() => go('historia')}>
      {lead ? <div class="w-feat">
        <EntryCard e={lead} size="lg" />
        <div class="w-feat__side">{rest.slice(0, 4).map((e) => <EntryCard key={e.id} e={e} size="sm" />)}</div>
      </div> : <p>{t('c.empty')}</p>}
    </Section>

    <Section id="w-ev" tone="mint" kicker={t('w.nav.events')} title={t('w.home.events')} more={t('w.home.allEvents')} onMore={() => go('wydarzenia')}>
      <div class="w-grid w-grid--2">{events.map((e) => <EventCard key={e.id} ev={e} />)}</div>
    </Section>

    <Section id="w-plan">
      <div class="w-split">
        <Card variant="deep" class="w-plancta">
          <CardBody>
            <span class="w-kicker w-kicker--on">{t('w.plan.kicker')}</span>
            <h2>{t('w.plan.title')}</h2>
            <p>{t('w.plan.teaser')}</p>
            <div class="w-row"><Button variant="mint" icon="route" onClick={() => go('mapa/zaplanuj')}>{t('w.plan.start')}</Button><Button variant="secondary" icon="map" onClick={() => go('mapa')}>{t('w.nav.map')}</Button></div>
          </CardBody>
        </Card>
        <Card class="w-appcta">
          <CardBody>
            <span class="w-kicker">{t('w.app.kicker')}</span>
            <h2>{t('w.app.title')}</h2>
            <div class="w-appcta__row">
              <div><p>{t('w.app.text')}</p><p class="w-small"><Icon name="game" size={15} /> {t('w.app.game')}</p>
                <div class="w-row"><Button size="sm" variant="secondary" icon="game" onClick={() => go('gra')}>{t('w.app.gameLink')}</Button></div></div>
              <span class="w-qrbox"><QR value="https://app.fpz.example/pobierz" size={112} /><span class="w-small">{t('w.app.scan')}</span></span>
            </div>
          </CardBody>
        </Card>
      </div>
    </Section>

    <Section id="w-news" kicker={t('w.nav.community')} title={t('w.home.news')} more={t('w.home.allNews')} onMore={() => go('spolecznosc')}>
      <NewsList limit={3} />
    </Section>

    <Section id="w-ideas" tone="mint" kicker={t('w.ideas.kicker')} title={t('w.home.ideas')} more={t('w.home.allIdeas')} onMore={() => go('spolecznosc/pomysly')}>
      {ideas.length ? <div class="w-grid w-grid--3">{ideas.map((i, k) => <IdeaCard key={i.id} idea={i} rank={k + 1} />)}</div> : <p>{t('c.empty')}</p>}
    </Section>

    <Section id="w-partners" kicker={t('w.home.partnersK')} title={t('w.home.partners')} more={t('w.home.allPartners')} onMore={() => go('informacje/najemcy')}>
      <ul class="w-tiles">{partners.map((v) => <li key={v.id}><button type="button" class="w-tile" onClick={() => go(`wydarzenia/venue/${enc(v.id)}`)}>
        <Media ill={v.ill} src={v.src} ratio="1/1" shape="circle" alt="" /><b>{L(v.name)}</b><span>{t('w.vcat.' + v.category)}</span></button></li>)}</ul>
    </Section>
  </>);
}
