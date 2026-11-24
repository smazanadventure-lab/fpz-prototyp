// CMS – oferta i rezerwacje: obiekty, wydarzenia, bilety/strefy/pakiety, zamówienia (zwroty), zapytania o termin, klienci (RODO).
import { useState, useEffect } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { deepClone, matches, localIso, addDays, fmtMoney, fmtDateTime, sum, clsx } from '../../kernel/util.js';
import { Icon, Button, IconButton, Modal, Input, Textarea, Select, Switch, SearchInput, Tag, Notice, Field } from '../../ui/components.jsx';
import { useCms, useRun, DataTable, Crud, FieldBox, Seg, Head, When, poiOpts, denyText } from './kit.jsx';

const L0 = () => ({ pl: '', en: '' });
export const VENUE_CATS = [{ id: 'gastro', label: 'Gastronomia' }, { id: 'attraction', label: 'Atrakcja' }, { id: 'institution', label: 'Instytucja' }, { id: 'tenant', label: 'Najemca' }, { id: 'culture', label: 'Kultura' }];
export const EVENT_CATS = ['koncert', 'warsztaty', 'wystawa', 'targi', 'spotkanie', 'sport', 'dzieci', 'film'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
const PKIND = { ticket: 'Bilet na wydarzenie', zone: 'Bilet do strefy', package: 'Pakiet' };
const OSTAT = { pending: ['Oczekuje na płatność', 'warn'], paid: ['Opłacone', 'green'], cancelled: ['Anulowane', 'neutral'], refunded: ['Zwrócone', 'info'] };
const TSTAT = { valid: ['ważny', 'green'], used: ['wykorzystany', 'neutral'], refunded: ['zwrócony', 'info'] };
const QSTAT = { new: ['Nowe', 'warn'], answered: ['Odpowiedziano', 'info'], confirmed: ['Termin potwierdzony', 'green'], rejected: ['Termin niedostępny', 'danger'] };
const CH = { mobile: 'Aplikacja', web: 'WWW', kiosk: 'Kiosk' };
export const mask = (str, keep = 1) => String(str || '').split(' ').map((w) => (w.length <= keep ? w : w.slice(0, keep) + '•'.repeat(Math.min(6, w.length - keep)))).join(' ');
export const maskEmail = (e) => { const [u, d] = String(e || '').split('@'); return d ? `${u[0]}•••@${d}` : '—'; };
const maskPhone = (p) => (p ? String(p).replace(/\d(?=(?:\D*\d){3})/g, '•') : '—');

export function Venues({ openId }) {
  return (<div class="c-page"><Head title="Obiekty" sub="Baza atrakcji, instytucji i najemców – prezentowana w systemie rezerwacji (aplikacja i WWW)" />
    <Crud col="venues" title="Obiekty" noun="obiekt" perm="offer.edit" openId={openId} search={(v) => [v.name.pl, v.name.en, (v.tags || []).join(' ')]}
      blank={() => ({ name: L0(), category: 'attraction', description: L0(), poiId: null, contact: { phone: '', email: '', www: '', address: '' }, hours: L0(), acceptsInquiries: true, ill: 'hall-interior', tags: [], sample: true, active: true })}
      cols={[{ k: 'name', label: 'Obiekt', render: (v) => <span class="c-ttl"><b>{v.name.pl}</b><small>{v.contact?.email}</small></span> }, { k: 'category', label: 'Kategoria', render: (v) => VENUE_CATS.find((c) => c.id === v.category)?.label || v.category },
        { k: 'poiId', label: 'Miejsce', sort: (v) => sel.poi(v.poiId)?.name.pl, render: (v) => sel.poi(v.poiId)?.name.pl || '—' }, { k: 'acceptsInquiries', label: 'Zapytania', render: (v) => (v.acceptsInquiries ? <Tag tone="green">przyjmuje</Tag> : <Tag>nie</Tag>) },
        { k: 'sample', label: 'Dane', render: (v) => (v.sample ? <Tag tone="info">demo</Tag> : '') }, { k: 'active', label: 'Widoczny', render: (v) => (v.active === false ? 'nie' : 'tak') }]}
      fields={[{ k: 'name', label: 'Nazwa', type: 'L' }, { k: 'category', label: 'Kategoria obiektu', type: 'select', empty: false, opts: VENUE_CATS }, { k: 'poiId', label: 'Miejsce na mapie', type: 'select', opts: poiOpts },
        { k: 'description', label: 'Opis', type: 'Ltext', rows: 3 }, { k: 'ill', label: 'Zdjęcie / ilustracja', type: 'image', srcKey: 'src' }, { k: 'hours', label: 'Godziny otwarcia', type: 'L' },
        { section: 'Kontakt' }, { k: 'contact.phone', label: 'Telefon' }, { k: 'contact.email', label: 'E-mail' }, { k: 'contact.www', label: 'Strona WWW' }, { k: 'contact.address', label: 'Adres' },
        { k: 'acceptsInquiries', label: 'Przyjmuje zapytania o termin', type: 'switch' }, { k: 'active', label: 'Widoczny w ofercie', type: 'switch' }, { k: 'sample', label: 'Podmiot przykładowy (dane demo)', type: 'switch' }, { k: 'tags', label: 'Tagi', type: 'tags' }]} />
  </div>);
}

export function Events({ openId }) {
  const s = useStore();
  return (<div class="c-page"><Head title="Wydarzenia" sub="Kalendarz wydarzeń – sprzedaż biletów, pojemność, transmisje" />
    <Crud col="events" title="Wydarzenia" noun="wydarzenie" perm="offer.edit" openId={openId} modalSize="xl" stayOpen search={(e) => [e.title.pl, e.category]}
      blank={() => { const d = addDays(new Date(), 7); d.setHours(18, 0, 0, 0); return { title: L0(), description: L0(), start: localIso(d), durationMin: 120, poiId: 'hala-zabkowice', venueId: null, category: 'koncert', ill: 'stage', ticketed: true, capacity: 200, live: false, active: true }; }}
      beforeSave={(d) => ({ ...d, end: d.start ? localIso(new Date(new Date(d.start).getTime() + (d.durationMin || 90) * 60000)) : d.end })}
      cols={[{ k: 'title', label: 'Wydarzenie', render: (e) => <span class="c-ttl"><b>{e.title.pl}</b><small>{sel.poi(e.poiId)?.name.pl}</small></span> }, { k: 'start', label: 'Termin', render: (e) => <When iso={e.start} /> },
        { k: 'category', label: 'Kategoria' }, { k: 'ticketed', label: 'Bilety', render: (e) => (e.ticketed ? <Tag tone="green" icon="ticket">tak</Tag> : <Tag>wstęp wolny</Tag>) },
        { k: 'sold', label: 'Sprzedane / pojemność', align: 'right', render: (e) => <span class="c-nowrap"><b>{e.sold || 0}</b> / {e.capacity || 0}</span> },
        { k: 'rem', label: 'Pozostało', align: 'right', sort: (e) => sel.remaining(e.id), render: (e) => { const r = sel.remaining(e.id); return <Tag tone={r === 0 ? 'danger' : r < 20 ? 'warn' : 'neutral'}>{r}</Tag>; } },
        { k: 'active', label: 'Status', render: (e) => (e.active === false ? <Tag>ukryte</Tag> : e.end < localIso(new Date()) ? <Tag>minione</Tag> : e.live ? <Tag tone="live">transmisja</Tag> : <Tag tone="green">w ofercie</Tag>) }]}
      fields={[{ k: 'title', label: 'Tytuł', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext', rows: 3 }, { k: 'start', label: 'Początek', type: 'datetime' }, { k: 'durationMin', label: 'Czas trwania (min)', type: 'number', min: 10 },
        { k: 'poiId', label: 'Miejsce', type: 'select', opts: poiOpts }, { k: 'venueId', label: 'Organizator (obiekt)', type: 'select', opts: () => s.venues.map((v) => ({ id: v.id, label: v.name.pl })) },
        { k: 'category', label: 'Kategoria', type: 'select', empty: false, opts: EVENT_CATS }, { k: 'capacity', label: 'Pojemność (miejsca)', type: 'number', min: 0 }, { k: 'ill', label: 'Ilustracja', type: 'image' },
        { k: 'ticketed', label: 'Wydarzenie biletowane', type: 'switch' }, { k: 'live', label: 'Transmisja na żywo', type: 'switch' }, { k: 'active', label: 'Widoczne w ofercie', type: 'switch' }]}
      extra={(d) => <EventTickets ev={d} />} />
  </div>);
}
function EventTickets({ ev }) {
  const s = useStore(); const { api } = useClient(); const { can, go } = useCms(); const run = useRun();
  const [n, setN] = useState({ name: 'Bilet normalny', price: 30, max: 10 });
  if (!ev.id) return <Notice tone="info" icon="ticket">Zapisz wydarzenie, aby dodać do niego bilety.</Notice>;
  const ps = s.products.filter((p) => p.eventId === ev.id);
  const add = () => { const r = api.cms.save('products', { kind: 'ticket', name: { pl: n.name, en: n.name }, description: L0(), price: +n.price || 0, eventId: ev.id, venueId: ev.venueId || null, refundableHours: 24, maxPerOrder: +n.max || 10, includes: null, active: true }); run(r, `Dodano bilet „${n.name}” – w sprzedaży od razu`); };
  return (<section class="c-subpanel"><h4 class="c-form__sec">Bilety do wydarzenia ({ps.length}) · sprzedane {sel.event(ev.id)?.sold || 0} z {ev.capacity}</h4>
    {ps.length ? <ul class="c-links">{ps.map((p) => <li key={p.id}><Icon name="ticket" size={14} /> <b>{p.name.pl}</b> – {fmtMoney(p.price)} · limit {p.maxPerOrder}/zam. · zwrot do {p.refundableHours} h przed {p.active === false && <Tag>nieaktywny</Tag>} <button type="button" class="c-link c-small" onClick={() => go('offer', 'products', p.id)}>edytuj</button></li>)}</ul> : <p class="c-small c-muted">Brak biletów – wydarzenie nie pojawi się w sprzedaży.</p>}
    <div class="c-row c-row--end"><FieldBox label="Nazwa biletu"><Input value={n.name} onInput={(e) => setN({ ...n, name: e.currentTarget.value })} /></FieldBox><FieldBox label="Cena (zł)"><Input type="number" min="0" value={n.price} data-testid="ticket-price" onInput={(e) => setN({ ...n, price: e.currentTarget.value })} /></FieldBox><FieldBox label="Maks. na zamówienie"><Input type="number" min="1" value={n.max} onInput={(e) => setN({ ...n, max: e.currentTarget.value })} /></FieldBox>
      <Button size="sm" icon="plus" disabled={!can('offer.edit') || !n.name} onClick={add}>Dodaj bilet</Button></div>
  </section>);
}

export function Products({ openId }) {
  const s = useStore();
  return (<div class="c-page"><Head title="Bilety, strefy i pakiety" sub="Produkty systemu rezerwacji – ceny brutto, limity, regulamin zwrotu, zawartość pakietów" />
    <Crud col="products" title="Produkty" noun="produkt" perm="offer.edit" openId={openId} search={(p) => [p.name.pl, PKIND[p.kind]]}
      blank={() => ({ kind: 'zone', name: L0(), description: L0(), price: 20, eventId: null, venueId: null, refundableHours: 24, maxPerOrder: 10, includes: null, active: true })}
      cols={[{ k: 'name', label: 'Produkt', render: (p) => <span class="c-ttl"><b>{p.name.pl}</b><small>{p.eventId ? sel.event(p.eventId)?.title.pl : p.kind === 'package' ? (p.includes || []).map((x) => sel.product(x)?.name.pl).join(' + ') : ''}</small></span> },
        { k: 'kind', label: 'Rodzaj', sort: (p) => PKIND[p.kind], render: (p) => <Tag tone={p.kind === 'package' ? 'info' : p.kind === 'zone' ? 'green' : 'neutral'}>{PKIND[p.kind]}</Tag> },
        { k: 'price', label: 'Cena', align: 'right', render: (p) => <b class="c-nowrap">{fmtMoney(p.price)}</b> }, { k: 'maxPerOrder', label: 'Limit', align: 'right' }, { k: 'refundableHours', label: 'Zwrot do', align: 'right', render: (p) => `${p.refundableHours ?? 24} h` },
        { k: 'sold', label: 'Sprzedano', align: 'right', sort: (p) => s.tickets.filter((t) => t.productId === p.id).length, render: (p) => s.tickets.filter((t) => t.productId === p.id).length }, { k: 'active', label: 'Aktywny', render: (p) => (p.active === false ? 'nie' : 'tak') }]}
      fields={(d) => [{ k: 'kind', label: 'Rodzaj', type: 'select', empty: false, opts: Object.entries(PKIND).map(([id, label]) => ({ id, label })) }, { k: 'price', label: 'Cena brutto (zł)', type: 'number', min: 0, step: 0.5 },
        { k: 'name', label: 'Nazwa', type: 'L' }, { k: 'description', label: 'Opis', type: 'Ltext', rows: 2 },
        ...(d.kind === 'ticket' ? [{ k: 'eventId', label: 'Wydarzenie', type: 'select', opts: () => s.events.map((e) => ({ id: e.id, label: `${e.title.pl} (${e.start.slice(0, 10)})` })) }] : []),
        { k: 'venueId', label: 'Obiekt', type: 'select', opts: () => s.venues.map((v) => ({ id: v.id, label: v.name.pl })) }, { k: 'maxPerOrder', label: 'Maks. sztuk w zamówieniu', type: 'number', min: 1 }, { k: 'refundableHours', label: 'Zwrot możliwy do (godz. przed wydarzeniem)', type: 'number', min: 0 },
        ...(d.kind === 'package' ? [{ k: 'includes', label: 'Zawartość pakietu', type: 'checks', opts: () => s.products.filter((p) => p.kind !== 'package' && p.id !== d.id).map((p) => ({ id: p.id, label: `${p.name.pl} (${fmtMoney(p.price)})` })), hint: 'Przy zakupie pakietu wystawiany jest osobny bilet na każdą pozycję.' }] : []),
        { k: 'active', label: 'W sprzedaży', type: 'switch' }]} />
  </div>);
}

export function Orders() {
  const s = useStore(); const { api, staff } = useClient(); const { can, ask } = useCms(); const run = useRun();
  const [st, setSt] = useState(''); const [q, setQ] = useState(''); const [cur, setCur] = useState(null);
  const rows = s.orders.filter((o) => (!st || o.status === st) && matches(q, o.no, sel.user(o.userId)?.email, sel.user(o.userId)?.name));
  const o = cur && sel.order(cur); const tickets = o ? sel.ticketsOfOrder(o.id) : []; const info = o ? sel.refundInfo(o) : null;
  const refund = () => ask({ title: 'Zwrot zamówienia przez obsługę', icon: 'refresh', ok: 'Zleć zwrot', text: <>Zamówienie {o.no} ({fmtMoney(o.total)}) zostanie zwrócone, a niewykorzystane bilety unieważnione.{!info.ok && <Notice tone="warn">Klient nie mógłby zwrócić samodzielnie: {info.reason.pl} Obsługa może wykonać zwrot wyjątkowo.</Notice>}</>, onOk: () => run(api.booking.refund(o.id, { force: true }), `Zlecono zwrot ${fmtMoney(o.total)} – klient otrzyma e-mail`) });
  return (<div class="c-page"><Head title="Zamówienia" sub="Zamówienia z aplikacji i strony WWW – płatności (sandbox operatora), bilety, zwroty" />
    <div class="c-toolbar"><Seg value={st} onChange={setSt} options={[{ id: '', label: 'Wszystkie', badge: s.orders.length }, ...Object.entries(OSTAT).map(([id, [l]]) => ({ id, label: l, badge: s.orders.filter((x) => x.status === id).length }))]} /><SearchInput value={q} onInput={setQ} placeholder="Nr zamówienia, klient" /><span class="c-grow" /><span class="c-count">Suma opłaconych: <b>{fmtMoney(sum(s.orders.filter((x) => x.status === 'paid'), (x) => x.total))}</b></span></div>
    <DataTable rows={rows} onRow={(x) => setCur(x.id)} initial={{ k: 'createdAt', dir: -1 }} empty="Brak zamówień" cols={[
      { k: 'no', label: 'Numer', render: (x) => <b class="c-nowrap">{x.no}</b> }, { k: 'createdAt', label: 'Data', render: (x) => <When iso={x.createdAt} /> },
      { k: 'user', label: 'Klient', sort: (x) => sel.user(x.userId)?.name, render: (x) => <span class="c-small">{mask(sel.user(x.userId)?.name) || '(konto usunięte)'}</span> },
      { k: 'channel', label: 'Kanał', render: (x) => CH[x.channel] || x.channel }, { k: 'items', label: 'Pozycje', sort: (x) => x.items.length, render: (x) => <span class="c-small">{x.items.map((i) => `${i.qty}× ${i.name.pl}`).join(', ')}</span> },
      { k: 'total', label: 'Kwota', align: 'right', render: (x) => <b class="c-nowrap">{fmtMoney(x.total)}</b> }, { k: 'status', label: 'Status', render: (x) => <Tag tone={OSTAT[x.status]?.[1]}>{OSTAT[x.status]?.[0] || x.status}</Tag> }]} />
    <Modal open={!!o} onClose={() => setCur(null)} size="lg" title={o && `Zamówienie ${o.no}`}
      footer={o && <><span class="c-grow" /><Button variant="secondary" size="sm" onClick={() => setCur(null)}>Zamknij</Button>{o.status === 'paid' && <Button variant="danger" size="sm" icon="refresh" disabled={!can('orders.refund')} title={can('orders.refund') ? undefined : denyText('orders.refund', staff)} onClick={refund}>Zwrot przez obsługę</Button>}</>}>
      {o && <div>
        <dl class="c-dl c-dl--row"><dt>Status</dt><dd><Tag tone={OSTAT[o.status]?.[1]}>{OSTAT[o.status]?.[0]}</Tag>{o.refundedAt && <span class="c-small"> {fmtDateTime(o.refundedAt, 'pl')}</span>}</dd><dt>Klient</dt><dd>{mask(sel.user(o.userId)?.name)} · {maskEmail(sel.user(o.userId)?.email)}</dd><dt>Kanał</dt><dd>{CH[o.channel] || o.channel} · {fmtDateTime(o.createdAt, 'pl')}</dd>
          <dt>Płatność</dt><dd>{o.payment ? `${o.payment.operator} · ${o.payment.method} · ${o.payment.txId}${o.payment.sca ? ' · SCA ✓' : ''}${o.payment.failed ? ' · odrzucona' : ''}` : '—'}</dd><dt>Kwota</dt><dd><b>{fmtMoney(o.total)}</b></dd></dl>
        <h4 class="c-form__sec">Pozycje</h4><ul class="c-links">{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name.pl} – {fmtMoney(i.unitPrice)}{i.eventId && <span class="c-small c-muted"> · {sel.event(i.eventId)?.title.pl}</span>}</li>)}</ul>
        <h4 class="c-form__sec">Bilety ({tickets.length})</h4>
        {tickets.length ? <table class="c-table c-table--mini"><thead><tr><th>Kod</th><th>Produkt</th><th>Stan walidacji</th></tr></thead><tbody>{tickets.map((t) => <tr key={t.id}><td><code>{t.code}</code></td><td>{t.productName.pl}</td><td><Tag tone={TSTAT[t.status]?.[1]}>{TSTAT[t.status]?.[0]}</Tag>{t.usedAt && <span class="c-small"> {fmtDateTime(t.usedAt, 'pl')} · {t.gate}</span>}</td></tr>)}</tbody></table> : <p class="c-muted c-small">Bilety zostaną wystawione po opłaceniu.</p>}
        {o.status === 'paid' && <Notice tone={info.ok ? 'info' : 'warn'}>Zwrot samodzielny przez klienta: {info.ok ? 'możliwy' : 'niemożliwy'} – {info.reason.pl}</Notice>}
      </div>}
    </Modal>
  </div>);
}

export function Inquiries({ openId }) {
  const s = useStore(); const { api } = useClient(); const { can } = useCms(); const run = useRun();
  const [st, setSt] = useState('new'); const [cur, setCur] = useState(null); const [form, setForm] = useState({ status: 'answered', reply: '' });
  const rows = s.inquiries.filter((q) => !st || q.status === st);
  const open = (q) => { setCur(q.id); setForm({ status: q.status === 'new' ? 'confirmed' : q.status, reply: q.reply || `Dzień dobry,\n\ndziękujemy za zapytanie. ` }); };
  const q = cur && s.inquiries.find((x) => x.id === cur);
  const send = () => { if (!form.reply.trim()) return run({ ok: false, message: { pl: 'Wpisz treść odpowiedzi.' } }); if (run(api.cms.replyInquiry(q.id, form), 'Wysłano odpowiedź – klient widzi ją od razu w „Moje zapytania”')) setCur(null); };
  return (<div class="c-page"><Head title="Zapytania o termin" sub="Zapytania klientów do obiektów z bazy – odpowiedź trafia na konto klienta i e-mailem" />
    <Seg value={st} onChange={setSt} options={[{ id: '', label: 'Wszystkie', badge: s.inquiries.length }, ...Object.entries(QSTAT).map(([id, [l]]) => ({ id, label: l, badge: s.inquiries.filter((x) => x.status === id).length }))]} />
    <DataTable rows={rows} onRow={open} initial={{ k: 'createdAt', dir: -1 }} empty="Brak zapytań w tym stanie" cols={[
      { k: 'createdAt', label: 'Wpłynęło', render: (x) => <When iso={x.createdAt} /> }, { k: 'venueId', label: 'Obiekt', sort: (x) => sel.venue(x.venueId)?.name.pl, render: (x) => <b>{sel.venue(x.venueId)?.name.pl}</b> },
      { k: 'user', label: 'Klient', sort: false, render: (x) => mask(sel.user(x.userId)?.name) }, { k: 'date', label: 'Termin', render: (x) => <When iso={x.date} /> }, { k: 'people', label: 'Osób', align: 'right' },
      { k: 'message', label: 'Wiadomość', sort: false, render: (x) => <span class="c-small c-clamp">{x.message}</span> }, { k: 'status', label: 'Status', render: (x) => <Tag tone={QSTAT[x.status]?.[1]}>{QSTAT[x.status]?.[0]}</Tag> },
      { k: '_a', label: '', sort: false, render: (x) => <Button size="sm" variant={x.status === 'new' ? 'primary' : 'secondary'} icon="message" onClick={() => open(x)}>{x.status === 'new' ? 'Odpowiedz' : 'Szczegóły'}</Button> }]} />
    <Modal open={!!q} onClose={() => setCur(null)} size="lg" title={q && `Zapytanie – ${sel.venue(q.venueId)?.name.pl}`}
      footer={<><span class="c-grow" /><Button variant="secondary" size="sm" onClick={() => setCur(null)}>Anuluj</Button><Button size="sm" icon="send" disabled={!can('inquiries')} onClick={send}>Wyślij odpowiedź</Button></>}>
      {q && <div>
        <dl class="c-dl c-dl--row"><dt>Klient</dt><dd>{mask(sel.user(q.userId)?.name)} · {maskEmail(sel.user(q.userId)?.email)}</dd><dt>Termin</dt><dd>{fmtDateTime(q.date, 'pl')} · {q.people} os.</dd><dt>Kanał</dt><dd>{CH[q.channel] || q.channel}</dd></dl>
        <blockquote class="c-quote">{q.message || '(bez wiadomości)'}</blockquote>
        <Field label="Decyzja"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.currentTarget.value })}>{['confirmed', 'answered', 'rejected'].map((k) => <option key={k} value={k}>{QSTAT[k][0]}</option>)}</Select></Field>
        <Field label="Odpowiedź dla klienta"><Textarea rows={5} value={form.reply} data-testid="inq-reply" onInput={(e) => setForm({ ...form, reply: e.currentTarget.value })} /></Field>
        {q.repliedAt && <p class="c-small c-muted">Poprzednia odpowiedź: {fmtDateTime(q.repliedAt, 'pl')}</p>}
      </div>}
    </Modal>
  </div>);
}

export function Customers() {
  const s = useStore(); const { api } = useClient(); const { ask } = useCms(); const run = useRun();
  const [show, setShow] = useState(false); const [q, setQ] = useState('');
  const rows = s.users.filter((u) => matches(q, u.name, u.email));
  const del = (u) => ask({ title: 'Usunąć konto klienta (RODO)?', ok: 'Usuń konto', text: <>Konto <b>{mask(u.name)}</b> zostanie usunięte (prawo do usunięcia danych, art. 17 RODO). Zamówienia pozostaną w ewidencji księgowej bez powiązania z danymi osobowymi.<Notice tone="warn">Operacja nieodwracalna – zostanie odnotowana w dzienniku zdarzeń.</Notice></>, onOk: () => run(api.cms.remove('users', u.id), 'Usunięto konto klienta') });
  return (<div class="c-page"><Head title="Klienci" sub="Konta systemu rezerwacji – dane osobowe zamaskowane domyślnie (zasada minimalizacji)" />
    <div class="c-toolbar"><SearchInput value={q} onInput={setQ} placeholder="Szukaj klienta" /><Switch label="Pokaż pełne dane osobowe" checked={show} onChange={(e) => setShow(e.currentTarget.checked)} /><span class="c-grow" /><span class="c-count">{rows.length} kont</span></div>
    {show && <Notice tone="warn" icon="eye">Wyświetlasz dane osobowe – korzystaj wyłącznie w celu obsługi klienta. W wersji docelowej każdy podgląd jest rejestrowany.</Notice>}
    <DataTable rows={rows} initial={{ k: 'createdAt', dir: -1 }} empty="Brak kont klientów" cols={[
      { k: 'name', label: 'Imię i nazwisko', render: (u) => (show ? u.name : mask(u.name)) }, { k: 'email', label: 'E-mail', render: (u) => (show ? u.email : maskEmail(u.email)) }, { k: 'phone', label: 'Telefon', render: (u) => (show ? u.phone || '—' : maskPhone(u.phone)) },
      { k: 'createdAt', label: 'Konto od', render: (u) => <When iso={u.createdAt} /> }, { k: 'orders', label: 'Zamówienia', align: 'right', sort: (u) => sel.ordersOf(u.id).length, render: (u) => sel.ordersOf(u.id).length },
      { k: 'mk', label: 'Zgoda marketingowa', render: (u) => (u.consents?.marketing ? <Tag tone="green">tak</Tag> : <Tag>nie</Tag>) },
      { k: '_a', label: '', sort: false, align: 'right', render: (u) => <Button size="sm" variant="danger" icon="trash" onClick={() => del(u)}>Usuń konto (RODO)</Button> }]} />
    <Notice tone="info">Dane testowe są fikcyjne (wymóg: dane zanonimizowane/pseudonimizowane). Eksport danych klienta na żądanie (art. 15/20 RODO) – w wersji docelowej.</Notice>
  </div>);
}
