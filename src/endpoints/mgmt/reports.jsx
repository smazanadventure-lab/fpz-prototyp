// Raporty i statystyki techniczne: wykorzystanie stanowisk, ruch, temperatury, czas pracy, eksport.
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { download, dayStr } from '../../kernel/util.js';
import { Icon, Button, Stat, BarChart, LineChart } from '../../ui/components.jsx';
import { Head, Panel, KINDS, POWER, zoneName, csv } from './common.jsx';
import { monthAvailability } from './incidents.jsx';

export function Reports() {
  const s = getState(); const { toast } = useClient();
  const kiosks = s.devices.filter((d) => d.kind === 'kiosk');
  const daily = s.stats.daily.slice(-30);
  const av = sel.availability(); const mav = monthAvailability();
  const touches = kiosks.reduce((a, d) => a + (d.touchesToday || 0), 0);
  const avgT = s.devices.filter((d) => d.power === 'on'); const tAvg = avgT.length ? avgT.reduce((a, d) => a + d.tempC, 0) / avgT.length : 0;
  const tech = () => ({ generatedAt: new Date().toISOString(), availability: { now: av, month: { percent: +mav.pct.toFixed(4), target: 99.7, downtimeH: +mav.downH.toFixed(2) } },
    devices: s.devices.map((d) => ({ id: d.id, name: d.name, kind: d.kind, zone: zoneName(d.zone), power: d.power, schedule: d.schedule, tempC: +d.tempC.toFixed(1), cpu: d.cpu, uptimeH: +d.uptimeH.toFixed(2), ip: d.ip, appVersion: d.appVersion, touchesToday: d.touchesToday || 0, lastSeen: d.lastSeen })),
    incidents: s.incidents, daily });
  const exportJson = () => { download(`raport-techniczny-${dayStr()}.json`, JSON.stringify(tech(), null, 2), 'application/json'); toast('Pobrano raport JSON'); };
  const exportCsv = () => { download(`urzadzenia-${dayStr()}.csv`, csv([['ID', 'Nazwa', 'Rodzaj', 'Strefa', 'Stan', 'Tryb', 'Temp. [°C]', 'CPU [%]', 'Czas pracy [h]', 'IP', 'Wersja', 'Dotknięcia dziś'], ...s.devices.map((d) => [d.id, d.name, KINDS[d.kind]?.label, zoneName(d.zone), POWER[d.power]?.label, d.schedule, d.tempC.toFixed(1), d.cpu, d.uptimeH.toFixed(1), d.ip, d.appVersion, d.touchesToday || 0])]), 'text/csv;charset=utf-8'); toast('Pobrano raport CSV'); };
  return (<div>
    <Head title="Raporty i statystyki" sub="Statystyki wykorzystania stanowisk i raporty techniczne" icon="chart">
      <Button variant="secondary" icon="download" onClick={exportCsv} data-testid="x-rep-csv">Urządzenia CSV</Button>
      <Button icon="download" onClick={exportJson} data-testid="x-rep-json">Raport techniczny JSON</Button>
    </Head>
    <div class="x-stats">
      <Stat icon="hand" label="Dotknięcia kiosków dziś" value={touches} sub={`${kiosks.length} kiosków`} />
      <Stat icon="people" label="Sesje kiosków (30 dni)" value={daily.reduce((a, d) => a + d.kiosk, 0).toLocaleString('pl-PL')} />
      <Stat icon="thermometer" label="Śr. temperatura" value={`${tAvg.toFixed(1)}°C`} sub="urządzenia pracujące" />
      <Stat icon="shield" label="Dostępność (miesiąc)" value={`${mav.pct.toFixed(2).replace('.', ',')}%`} sub="próg 99,7%" />
    </div>
    <div class="x-grid2">
      <Panel title="Wykorzystanie stanowisk – dotknięcia dziś" icon="monitor">
        <BarChart data={kiosks.map((d) => ({ label: d.id.replace('TZ.', ''), value: d.touchesToday || 0 }))} height={140} />
        <ul class="x-legendlist">{kiosks.map((d) => <li key={d.id}><span>{d.id}</span><span class="x-grow">{d.name}</span><b>{d.touchesToday || 0}</b></li>)}</ul>
      </Panel>
      <Panel title="Ruch dzienny – 30 dni" icon="activity">
        <LineChart series={[{ name: 'Kioski', values: daily.map((d) => d.kiosk), color: 'var(--c-accent)' }, { name: 'Strona WWW', values: daily.map((d) => d.web), color: 'var(--c-green)' }, { name: 'Aplikacja', values: daily.map((d) => d.app), color: 'var(--c-info)' }]} labels={daily.map((d) => d.date.slice(8, 10) + '.' + d.date.slice(5, 7))} labelEvery={5} height={150} />
        <div class="x-legend"><span class="x-lg x-lg--accent">Kioski</span><span class="x-lg x-lg--green">Strona WWW</span><span class="x-lg x-lg--info">Aplikacja</span></div>
      </Panel>
      <Panel title="Temperatura i obciążenie" icon="thermometer" pad={false}>
        <table class="x-table x-table--dense"><thead><tr><th>Urządzenie</th><th>Temp.</th><th>CPU</th><th>Czas pracy</th></tr></thead><tbody>{s.devices.map((d) => (
          <tr key={d.id}><td><Icon name={KINDS[d.kind]?.icon} size={14} /> {d.id}</td>
            <td><span class="x-meter"><i style={{ width: `${Math.min(100, ((d.tempC - 30) / 35) * 100)}%` }} class={d.tempC > 55 ? 'is-bad' : ''} /></span>{Math.round(d.tempC)}°C</td>
            <td><span class="x-meter"><i style={{ width: `${d.cpu}%` }} class={d.cpu > 80 ? 'is-bad' : ''} /></span>{d.cpu}%</td>
            <td>{d.power === 'on' ? `${d.uptimeH.toFixed(1)} h` : '—'}</td></tr>))}</tbody></table>
      </Panel>
      <Panel title="Skanowania i bilety – 30 dni" icon="qr">
        <BarChart data={daily.map((d) => ({ label: d.date.slice(8, 10), value: d.qr + d.ble + d.ar }))} height={120} labelEvery={5} color="var(--c-green)" />
        <p class="x-muted x-small">Wyzwalacze QR / BLE / AR łącznie. Sprzedane bilety (30 dni): <b>{daily.reduce((a, d) => a + d.tickets, 0)}</b>; walidacje w tej sesji: <b>{s.stats.validations.length}</b>.</p>
      </Panel>
    </div>
  </div>);
}
