// Społeczność: aktualności, pomysły mieszkańców (głosowanie), organizacje, historie mieszkańców, media społecznościowe.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { fmtDate, paragraphs } from '../../kernel/util.js';
import { Icon, Button, Card, CardBody, CornerLink, Tag, Media, Rich, Chips, Tabs, Empty, Notice, Modal, QR } from '../../ui/components.jsx';
import { useNav } from './nav.js';
import { PageHead, Section, IdeaCard, VenueCard, EntryCard } from './bits.jsx';

export function NewsList({ limit }) {
  const { t, L, lang } = useClient(); useStore(); const [open, setOpen] = useState(null);
  const list = sel.news().slice(0, limit || 99); const n = open && sel.news().find((x) => x.id === open);
  if (!list.length) return <Empty icon="news" title={t('c.empty')} />;
  return (<>
    <ul class="w-grid w-grid--3">{list.map((x, i) => <li key={x.id}><Card as="article" class="w-news">
      <Media ill={x.ill} src={x.src} ratio="16/9" shape={i % 3 === 0 ? 'arc-tr' : 'plain'} alt="" />
      <CardBody>
        <time class="w-kicker" dateTime={x.date}>{fmtDate(x.date, lang)}</time>
        <h3>{L(x.title)}</h3>
        <p class="w-small w-clamp">{paragraphs(L(x.body))[0]?.map((s) => s.text).join('')}</p>
        <CornerLink onClick={() => setOpen(x.id)}>{t('c.readMore')}<span class="w-sr">: {L(x.title)}</span></CornerLink>
      </CardBody>
    </Card></li>)}</ul>
    {n && <Modal open onClose={() => setOpen(null)} size="lg" title={L(n.title)} closeLabel={t('c.close')}>
      <div class="w-stack"><Media ill={n.ill} src={n.src} ratio="21/9" shape="arc-tr" alt="" /><time class="w-kicker" dateTime={n.date}>{fmtDate(n.date, lang)}</time><Rich text={L(n.body)} /></div>
    </Modal>}
  </>);
}

export function Ideas() {
  const s = useStore(); const { t, L } = useClient(); const [cat, setCat] = useState('all');
  const list = sel.ideas({ categoryId: cat === 'all' ? undefined : cat }); const pending = s.ideas.filter((i) => i.status === 'pending').length;
  return (<>
    <div class="w-ideahead">
      <Notice icon="sparkles">{t('w.ideas.how')}</Notice>
      {pending > 0 && <p class="w-small">{t('w.ideas.pending', { n: pending })}</p>}
    </div>
    <Chips class="w-mb" options={[{ id: 'all', label: t('c.all') }, ...s.ideaCategories.map((c) => ({ id: c.id, label: `${L(c.name)} · ${sel.ideas({ categoryId: c.id }).length}` }))]} value={cat} onChange={setCat} />
    {list.length ? <ul class="w-grid w-grid--3">{list.map((i, k) => <li key={i.id}><IdeaCard idea={i} rank={cat === 'all' ? k + 1 : null} /></li>)}</ul> : <Empty icon="sparkles" title={t('w.ideas.none')} />}
  </>);
}

const TABS = [['', 'w.c.news', 'news'], ['pomysly', 'w.c.ideas', 'sparkles'], ['organizacje', 'w.c.orgs', 'building'], ['historie', 'w.c.stories', 'people']];

export function CommunityPage({ r }) {
  const s = useStore(); const { t, L } = useClient(); const { go } = useNav(); const tab = TABS.some((x) => x[0] === r.a) ? r.a || '' : '';
  const orgs = s.venues.filter((v) => v.active !== false && ['institution', 'culture'].includes(v.category));
  const stories = sel.entries({ channel: 'web', categoryId: 'spolecznosc' });
  const cur = TABS.find((x) => x[0] === tab);
  return (<>
    <PageHead icon="community" title={t('w.nav.community')} lead={t('w.c.lead')} crumbs={tab ? [{ label: t('w.nav.community'), path: 'spolecznosc' }, { label: t(cur[1]) }] : [{ label: t('w.nav.community') }]}>
      <Tabs variant="pill" class="w-htabs" tabs={TABS.map(([id, k, ic]) => ({ id, label: t(k), icon: ic }))} value={tab} onChange={(id) => go(id ? `spolecznosc/${id}` : 'spolecznosc')} />
    </PageHead>
    {tab === '' && <Section id="w-cn" title={t('w.c.news')}><NewsList /></Section>}
    {tab === 'pomysly' && <Section id="w-ci" title={t('w.c.ideas')} kicker={t('w.ideas.kicker')}><Ideas /></Section>}
    {tab === 'organizacje' && <Section id="w-co" title={t('w.c.orgs')}>
      <p class="w-lead w-mb">{t('w.c.orgsLead')}</p>
      {orgs.length ? <ul class="w-grid w-grid--3">{orgs.map((v) => <li key={v.id}><VenueCard v={v} contacts /></li>)}</ul> : <Empty title={t('c.empty')} />}
    </Section>}
    {tab === 'historie' && <Section id="w-cs" title={t('w.c.stories')}>
      {stories.length ? <ul class="w-grid w-grid--3">{stories.map((e) => <li key={e.id}><EntryCard e={e} /></li>)}</ul> : <Empty title={t('c.empty')} />}
    </Section>}
    {tab === '' && <Section id="w-ci2" tone="mint" title={t('w.home.ideas')} more={t('w.home.allIdeas')} onMore={() => go('spolecznosc/pomysly')}>
      <ul class="w-grid w-grid--3">{sel.ideas().slice(0, 3).map((i, k) => <li key={i.id}><IdeaCard idea={i} rank={k + 1} /></li>)}</ul>
    </Section>}
    <Section id="w-soc" title={t('w.c.social')}>
      <div class="w-social-grid">
        <ul class="w-socials">{(s.site.social || []).map((x) => <li key={x.url}><a class="w-socbtn" href={x.url} target="_blank" rel="noopener noreferrer">
          <span class="w-socbtn__ic"><Icon name={{ youtube: 'video', instagram: 'camera', facebook: 'community', linkedin: 'building', tiktok: 'music' }[x.kind] || 'external'} size={22} /></span>
          <span><b>{x.kind[0].toUpperCase() + x.kind.slice(1)}</b><span class="w-small">{x.label}</span></span><Icon name="external" size={16} /><span class="w-sr">({t('w.newWin')})</span></a></li>)}</ul>
        <Card variant="mint"><CardBody><h3>{t('w.c.orgsSoc')}</h3><p class="w-small">{t('w.c.orgsSocT')}</p>
          <ul class="w-linklist">{orgs.filter((v) => v.contact?.www).slice(0, 6).map((v) => <li key={v.id}><a href={v.contact.www} target="_blank" rel="noopener noreferrer">{L(v.name)} <Icon name="external" size={13} /></a></li>)}</ul></CardBody></Card>
      </div>
    </Section>
  </>);
}
