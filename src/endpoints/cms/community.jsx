// CMS – społeczność i moderacja treści UGC (pomysły mieszkańców), kategorie pomysłów.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { ago, fmtDateTime } from '../../kernel/util.js';
import { Icon, Button, Switch, Tag, Notice, Empty } from '../../ui/components.jsx';
import { useCms, useRun, Crud, Seg, Head } from './kit.jsx';

const ST = { pending: ['Oczekujące', 'warn'], approved: ['Opublikowane', 'green'], rejected: ['Odrzucone', 'danger'] };

export default function Community() {
  const s = useStore(); const { api } = useClient(); const { can } = useCms(); const run = useRun();
  const [st, setSt] = useState('pending'); const ok = can('ugc.moderate');
  const list = s.ideas.filter((i) => i.status === st).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const cat = (id) => s.ideaCategories.find((c) => c.id === id)?.name.pl || '—';
  return (<div class="c-page">
    <Head title="Społeczność i moderacja" sub="Pomysły mieszkańców zgłaszane w grze terenowej (trasa innowacji) i w aplikacji">
      <div class="c-modsw"><Switch label="Moderacja przed publikacją" checked={!!s.settings.moderation} disabled={!can('settings') && !ok} onChange={(e) => run(api.cms.setSetting({ moderation: e.currentTarget.checked }), e.currentTarget.checked ? 'Nowe zgłoszenia czekają na akceptację' : 'Nowe zgłoszenia publikują się od razu')} /></div>
    </Head>
    {!s.settings.moderation && <Notice tone="warn">Moderacja wyłączona – nowe pomysły są publikowane natychmiast (moderator może je później odrzucić).</Notice>}
    <Seg value={st} onChange={setSt} options={Object.entries(ST).map(([id, [l]]) => ({ id, label: l, badge: s.ideas.filter((i) => i.status === id).length }))} />
    {list.length ? <ul class="c-ideas">{list.map((i) => (<li key={i.id} class="c-idea">
      <div class="c-idea__h"><span class="c-user__av" aria-hidden="true">{(i.nick || '?')[0]}</span><span><b>{i.nick}</b><small>{ago(i.createdAt, 'pl')} · {i.device === 'seed' ? 'dane przykładowe' : i.device}{i.mine ? ' · telefon testowy' : ''}</small></span><span class="c-grow" /><Tag tone={ST[i.status][1]}>{ST[i.status][0]}</Tag></div>
      <p class="c-idea__t">{i.text.pl}</p>
      <div class="c-row c-wrap"><Tag icon="tag">{cat(i.categoryId)}</Tag>{i.poiId && <Tag icon="mapPin">{sel.poi(i.poiId)?.name.pl}</Tag>}<Tag icon="thumbsUp">{i.votes} głosów</Tag><span class="c-small c-muted" title={fmtDateTime(i.createdAt, 'pl')} />
        <span class="c-grow" />
        {i.status !== 'approved' && <Button size="sm" icon="check" disabled={!ok} onClick={() => run(api.cms.moderateIdea(i.id, 'approved'), i.mine ? 'Opublikowano – autor otrzymał 30 pkt i powiadomienie' : 'Opublikowano pomysł')}>Akceptuj</Button>}
        {i.status !== 'rejected' && <Button size="sm" variant="secondary" icon="close" disabled={!ok} onClick={() => run(api.cms.moderateIdea(i.id, 'rejected'), 'Odrzucono zgłoszenie')}>Odrzuć</Button>}
      </div></li>))}</ul> : <Empty icon="community" title={st === 'pending' ? 'Brak zgłoszeń czekających na moderację' : 'Brak zgłoszeń'} text="Nowe pomysły pojawiają się tu od razu po wysłaniu z aplikacji." />}
    <h3 class="c-h3">Katalog możliwości – kategorie pomysłów</h3>
    <Crud col="ideaCategories" title="Kategorie pomysłów" noun="kategorię" perm="ugc.moderate" search={(c) => [c.name.pl]} blank={() => ({ name: { pl: '', en: '' } })}
      deleteWarn={(c) => { const n = s.ideas.filter((i) => i.categoryId === c.id).length; return n ? `Kategoria ma ${n} zgłoszeń.` : null; }}
      cols={[{ k: 'name', label: 'Kategoria', render: (c) => <b>{c.name.pl}</b> }, { k: 'en', label: 'EN', sort: (c) => c.name.en, render: (c) => c.name.en }, { k: 'n', label: 'Zgłoszeń', align: 'right', sort: (c) => s.ideas.filter((i) => i.categoryId === c.id).length, render: (c) => s.ideas.filter((i) => i.categoryId === c.id).length }]}
      fields={[{ k: 'name', label: 'Nazwa', type: 'L' }]} modalSize="md" />
  </div>);
}
