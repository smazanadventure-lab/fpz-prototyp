// CMS – pulpit: liczniki, ruch 30 dni, najczęściej czytane wpisy, ostatnie zdarzenia.
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { sum, fmtMoney, fmtDate, ago } from '../../kernel/util.js';
import { Icon, LineChart, Empty } from '../../ui/components.jsx';
import { useCms, Head, StatusTag, DataTable } from './kit.jsx';

const SERIES1 = [['app', 'Aplikacja', 'var(--c-accent)'], ['web', 'Strona WWW', 'var(--c-info)'], ['kiosk', 'Kioski', 'var(--c-green)']];
const SERIES2 = [['qr', 'Skany QR', 'var(--c-accent)'], ['ble', 'Wykrycia BLE', 'var(--c-info)'], ['ar', 'Sesje AR', 'var(--c-warn)']];

function Tile({ icon, label, value, sub, onClick, tone }) {
  const T = onClick ? 'button' : 'div';
  return <T type={onClick ? 'button' : undefined} class={`c-tile${tone ? ' c-tile--' + tone : ''}`} onClick={onClick}><span class="c-tile__ic"><Icon name={icon} size={20} /></span><span class="c-tile__txt"><small>{label}</small><b>{value}</b>{sub && <em>{sub}</em>}</span></T>;
}
function Chart({ title, series, daily }) {
  const labels = daily.map((d) => d.date.slice(8, 10) + '.' + d.date.slice(5, 7));
  return (<section class="c-panel"><h3>{title}</h3>
    <div class="c-legend">{series.map(([k, n, c]) => <span key={k}><i style={{ background: c }} />{n}: <b>{sum(daily, (d) => d[k]).toLocaleString('pl-PL')}</b></span>)}</div>
    <LineChart series={series.map(([k, n, c]) => ({ name: n, color: c, values: daily.map((d) => d[k] || 0) }))} labels={labels} labelEvery={5} height={150} /></section>);
}

export default function Dashboard() {
  const s = useStore(); const { go, can } = useCms();
  const st = (k) => s.entries.filter((e) => e.status === k).length;
  const paid = s.orders.filter((o) => o.status === 'paid');
  const top = s.entries.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
  const daily = s.stats.daily;
  return (<div class="c-page">
    <Head title="Pulpit" sub={`Stan systemu na ${fmtDate(new Date().toISOString(), 'pl')} · wspólne dane aplikacji, strony WWW, kiosków i systemu rezerwacji`} />
    <div class="c-tiles">
      <Tile icon="file" label="Wpisy opublikowane" value={st('published')} sub={`szkice ${st('draft')} · archiwum ${st('archived')}`} onClick={() => go('content', 'entries')} />
      <Tile icon="clock" label="Do akceptacji" value={st('review')} sub="wpisy czekające na publikację" tone={st('review') ? 'warn' : ''} onClick={() => go('content', 'entries')} />
      <Tile icon="community" label="Pomysły do moderacji" value={s.ideas.filter((i) => i.status === 'pending').length} sub="zgłoszenia społeczności" tone={s.ideas.some((i) => i.status === 'pending') ? 'warn' : ''} onClick={can('ugc.moderate') ? () => go('community') : undefined} />
      <Tile icon="message" label="Nowe zapytania" value={s.inquiries.filter((i) => i.status === 'new').length} sub="o termin w obiektach" tone={s.inquiries.some((i) => i.status === 'new') ? 'warn' : ''} onClick={can('inquiries') ? () => go('offer', 'inquiries') : undefined} />
      <Tile icon="receipt" label="Zamówienia" value={s.orders.length} sub={`opłacone ${paid.length} · ${fmtMoney(sum(paid, (o) => o.total))}`} onClick={can('orders.view') ? () => go('offer', 'orders') : undefined} />
      <Tile icon="ticket" label="Bilety" value={s.tickets.length} sub={`wykorzystane ${s.tickets.filter((t) => t.status === 'used').length} · zwrócone ${s.tickets.filter((t) => t.status === 'refunded').length}`} />
      <Tile icon="qr" label="Wyzwalacze" value={s.triggers.length} sub={`QR ${s.triggers.filter((t) => t.kind === 'qr').length} · BLE ${s.triggers.filter((t) => t.kind === 'ble').length} · AR ${s.triggers.filter((t) => t.kind === 'ar').length}`} onClick={can('triggers') ? () => go('triggers') : undefined} />
      <Tile icon="game" label="Misje zaliczone" value={s.gameStats.missionsDone.toLocaleString('pl-PL')} sub={`graczy zsynchronizowanych ${s.gameStats.playersSynced}`} />
    </div>
    <div class="c-grid2">
      <Chart title="Ruch – ostatnie 30 dni (sesje)" series={SERIES1} daily={daily} />
      <Chart title="Wyzwalacze – ostatnie 30 dni" series={SERIES2} daily={daily} />
    </div>
    <div class="c-grid2">
      <section class="c-panel"><h3>Najczęściej czytane wpisy</h3>
        <DataTable rows={top} cols={[
          { k: 'title', label: 'Wpis', render: (e) => <button type="button" class="c-link" onClick={() => go('content', 'entries', e.id)}>{e.title.pl}</button> },
          { k: 'status', label: 'Status', render: (e) => <StatusTag status={e.status} /> },
          { k: 'views', label: 'Odsłony', align: 'right', render: (e) => <b>{(e.views || 0).toLocaleString('pl-PL')}</b> }]} initial={{ k: 'views', dir: -1 }} />
      </section>
      <section class="c-panel"><h3>Ostatnie zdarzenia</h3>
        {s.audit.length ? <ul class="c-feed">{s.audit.slice(0, 10).map((a, i) => <li key={i}><Icon name="activity" size={14} /><span><b>{a.action}</b>{a.target && <> – {a.target}</>}<small>{sel.staff(a.staffId)?.name || a.client || 'system'} · {ago(a.at, 'pl')}</small></span></li>)}</ul> : <Empty title="Brak zdarzeń" />}
        {can('settings') && <button type="button" class="c-link c-small" onClick={() => go('settings', 'audit')}>Pełny dziennik zdarzeń →</button>}
      </section>
    </div>
  </div>);
}
