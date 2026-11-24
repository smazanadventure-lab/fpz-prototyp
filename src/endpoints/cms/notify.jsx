// CMS – powiadomienia push do aplikacji i dziennik wysyłek (e-mail / SMS / push).
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { Button, Input, Textarea, Select, Field, Tag, Notice, Icon } from '../../ui/components.jsx';
import { useRun, DataTable, Seg, Head, When } from './kit.jsx';

const KINDS = { email: ['E-mail', 'mail', 'info'], sms: ['SMS', 'message', 'warn'], push: ['Push', 'bell', 'green'] };
export default function Notifications() {
  const s = useStore(); const { api } = useClient(); const run = useRun();
  const [f, setF] = useState({ title: '', body: '', to: 'all' }); const [k, setK] = useState('');
  const send = (e) => { e.preventDefault(); if (run(api.cms.sendPush(f), 'Wysłano – powiadomienie pojawiło się w aplikacji')) setF({ title: '', body: '', to: f.to }); };
  const rows = s.outbox.filter((o) => !k || o.kind === k);
  return (<div class="c-page"><Head title="Powiadomienia" sub="Komunikaty push do aplikacji mobilnej oraz dziennik wiadomości wysłanych przez system" />
    <div class="c-grid2 c-grid2--wide">
      <form class="c-panel" onSubmit={send}><h3>Nowe powiadomienie push</h3>
        <Field label="Tytuł"><Input value={f.title} maxLength={60} data-testid="push-title" onInput={(e) => setF({ ...f, title: e.currentTarget.value })} placeholder="np. Dziś koncert w Hali Ząbkowice o 19:00" /></Field>
        <Field label="Treść" hint={`${f.body.length}/180 znaków`}><Textarea rows={3} maxLength={180} value={f.body} onInput={(e) => setF({ ...f, body: e.currentTarget.value })} /></Field>
        <Field label="Odbiorcy"><Select value={f.to} onChange={(e) => setF({ ...f, to: e.currentTarget.value })}><option value="all">Wszyscy użytkownicy aplikacji</option><option value="mobile">Aplikacja mobilna (telefon testowy)</option></Select></Field>
        <div class="c-row"><Button type="submit" icon="send" disabled={!f.title.trim()}>Wyślij teraz</Button></div>
        <Notice tone="info">W prototypie powiadomienie trafia od razu do telefonu w powłoce. W wersji docelowej – usługa push (FCM/APNs) z segmentacją i harmonogramem.</Notice>
      </form>
      <div class="c-panel"><h3>Podgląd</h3>
        <div class="c-pushpv"><span class="c-pushpv__ic"><Icon name="bell" size={16} /></span><span><small>FPŻ · teraz</small><b>{f.title || 'Tytuł powiadomienia'}</b><span>{f.body || 'Treść powiadomienia'}</span></span></div>
      </div>
    </div>
    <h3 class="c-h3">Dziennik wysyłek</h3>
    <Seg value={k} onChange={setK} options={[{ id: '', label: 'Wszystkie', badge: s.outbox.length }, ...Object.entries(KINDS).map(([id, [l, icon]]) => ({ id, label: l, icon, badge: s.outbox.filter((o) => o.kind === id).length }))]} />
    <DataTable rows={rows} initial={{ k: 'at', dir: -1 }} empty="Brak wysłanych wiadomości" cols={[
      { k: 'at', label: 'Czas', render: (o) => <When iso={o.at} /> }, { k: 'kind', label: 'Kanał', render: (o) => <Tag tone={KINDS[o.kind]?.[2]} icon={KINDS[o.kind]?.[1]}>{KINDS[o.kind]?.[0] || o.kind}</Tag> },
      { k: 'to', label: 'Odbiorca', render: (o) => <span class="c-small">{o.to === 'all' ? 'wszyscy' : o.to || '—'}</span> }, { k: 'subject', label: 'Temat', render: (o) => <b class="c-small">{o.subject}</b> }, { k: 'body', label: 'Treść', sort: false, render: (o) => <span class="c-small c-clamp">{o.body}</span> }]} />
  </div>);
}
