// Tryb testowy w aplikacji (zastępuje panel „Otoczenie telefonu” w wersji samodzielnej / APK):
// pozycja (GPS telefonu albo symulowana), sieć (automatycznie z navigator.onLine albo wymuszona), kod QR „przed kamerą”.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient, useEnv } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDistance } from '../../kernel/util.js';
import { Icon, Modal, Notice, SearchInput, Select, Switch, Tabs, Tag } from '../../ui/components.jsx';

strings({
  'tm.title': ['Tryb testowy', 'Test mode'], 'tm.badge': ['TEST', 'TEST'],
  'tm.lead': ['Wersja pilotażowa: tutaj ustawiasz, gdzie „jesteś”, jaki masz zasięg i jaki kod QR „widzi” aparat – bez wizyty w Fabryce. Ustawienia wpływają na treści w pobliżu, beacony BLE, punkty AR i grę terenową.', 'Pilot version: set where you “are”, your signal and which QR code the camera “sees” – without visiting the Factory. Settings affect nearby content, BLE beacons, AR points and the field game.'],
  'tm.pos': ['Pozycja', 'Position'], 'tm.gps': ['Użyj lokalizacji telefonu (GPS)', 'Use the phone’s location (GPS)'],
  'tm.gps.wait': ['Ustalanie położenia…', 'Locating…'], 'tm.gps.acc': ['GPS aktywny · dokładność ±{m} m', 'GPS active · accuracy ±{m} m'],
  'tm.gps.denied': ['Brak zgody na lokalizację – zezwól w ustawieniach telefonu albo wybierz pozycję z listy.', 'Location permission denied – allow it in phone settings or pick a position from the list.'],
  'tm.gps.none': ['To urządzenie lub przeglądarka nie udostępnia lokalizacji.', 'Location is not available on this device or browser.'], 'tm.gps.err': ['Nie udało się ustalić położenia: {e}', 'Could not get a location: {e}'],
  'tm.now': ['Teraz: {where}', 'Now: {where}'], 'tm.nearest': ['najbliżej: {name} ({d})', 'nearest: {name} ({d})'], 'tm.gpsPos': ['pozycja z GPS', 'GPS position'],
  'tm.pick': ['Wybierz symulowaną pozycję', 'Pick a simulated position'], 'tm.searchPh': ['Szukaj miejsca', 'Search places'],
  'tm.net': ['Sieć', 'Network'], 'tm.net.auto': ['Automatycznie (stan połączenia telefonu)', 'Automatic (phone connection status)'],
  'tm.net.online': ['LTE / Wi‑Fi', 'LTE / Wi‑Fi'], 'tm.net.slow': ['Słaba (HSDPA)', 'Weak (HSDPA)'], 'tm.net.offline': ['Offline', 'Offline'],
  'tm.qr': ['Kod QR przed aparatem (symulacja)', 'QR code in front of the camera (simulated)'], 'tm.qr.none': ['— brak kodu w kadrze —', '— no code in view —'],
  'tm.qr.codes': ['Kody na stanowiskach i tablicach', 'Codes on stations and signs'], 'tm.qr.tickets': ['Bilety', 'Tickets'],
  'tm.qr.note': ['Używane przez skaner w trybie „Symulacja”. W trybie „Kamera” zeskanujesz prawdziwy kod, np. z ekranu kiosku.', 'Used by the scanner in “Simulation” mode. In “Camera” mode you can scan a real code, e.g. from a kiosk screen.'],
});

/** Synchronizacja otoczenia z urządzeniem: GPS (client.useGps) i stan sieci (client.netAuto). Montowana raz w App. */
export function useDeviceEnv(standalone) {
  const { client } = useClient(); const { setEnv, moveTo } = useEnv();
  const [gps, setGps] = useState({ status: 'off', accuracy: null, error: null });
  const useGps = !!client.useGps; const netAuto = client.netAuto ?? !!standalone;
  useEffect(() => {
    if (!useGps) { setGps({ status: 'off', accuracy: null, error: null }); return; }
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGps({ status: 'error', error: 'none' }); return; }
    setGps({ status: 'wait', accuracy: null, error: null });
    const id = navigator.geolocation.watchPosition((p) => { moveTo({ lat: p.coords.latitude, lng: p.coords.longitude }); setGps({ status: 'on', accuracy: Math.round(p.coords.accuracy), error: null }); },
      (e) => setGps({ status: 'error', accuracy: null, error: e.code === 1 ? 'denied' : e.message || 'error' }), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [useGps]);
  useEffect(() => {
    if (!netAuto || typeof window === 'undefined') return;
    const apply = () => { const want = navigator.onLine ? 'online' : 'offline'; if (getState().env.network !== want) setEnv({ network: want }); };
    apply(); window.addEventListener('online', apply); window.addEventListener('offline', apply);
    return () => { window.removeEventListener('online', apply); window.removeEventListener('offline', apply); };
  }, [netAuto]);
  return gps;
}

export function TestModeSheet({ onClose, gps, standalone }) {
  const { t, L, client, set } = useClient(); const { env, setEnv, moveTo } = useEnv(); const s = getState();
  const [scope, setScope] = useState('fpz'); const [q, setQ] = useState('');
  const near = sel.nearestPoi(); const cur = env.position.poiId && sel.poi(env.position.poiId);
  const pois = sel.pois({ scope }).filter((p) => !q || L(p.name).toLowerCase().includes(q.toLowerCase()));
  const qrs = s.triggers.filter((x) => x.kind === 'qr' && x.active !== false); const tickets = s.tickets.filter((x) => x.status === 'valid').slice(0, 8);
  const netAuto = client.netAuto ?? !!standalone;
  const gpsMsg = gps.status === 'wait' ? t('tm.gps.wait') : gps.status === 'on' ? t('tm.gps.acc', { m: gps.accuracy }) : gps.status === 'error' ? (gps.error === 'denied' ? t('tm.gps.denied') : gps.error === 'none' ? t('tm.gps.none') : t('tm.gps.err', { e: gps.error })) : null;
  return (<Modal open variant="sheet" onClose={onClose} title={<span class="m-tm__title"><Icon name="flag" size={18} />{t('tm.title')}</span>} closeLabel={t('c.close')} class="m-tm">
    <p class="m-muted">{t('tm.lead')}</p>
    <section class="m-tm__sec"><h3 class="m-h3"><Icon name="locate" size={18} />{t('tm.pos')}</h3>
      <p class="m-tm__now" role="status"><b>{t('tm.now', { where: cur ? L(cur.name) : client.useGps ? t('tm.gpsPos') : `${env.position.lat.toFixed(4)}, ${env.position.lng.toFixed(4)}` })}</b>{near && <span>{t('tm.nearest', { name: L(near.poi.name), d: fmtDistance(near.distanceM) })}</span>}</p>
      <Switch label={t('tm.gps')} checked={!!client.useGps} onChange={(e) => set({ useGps: e.currentTarget.checked })} />
      {gpsMsg && <Notice tone={gps.status === 'error' ? 'warn' : gps.status === 'on' ? 'ok' : 'info'}>{gpsMsg}</Notice>}
      <div class={clsx('m-tm__pick', client.useGps && 'is-off')}>
        <span class="fpz-field__label">{t('tm.pick')}</span>
        <Tabs variant="pill" value={scope} onChange={setScope} tabs={[{ id: 'fpz', label: t('m.map.fpz') }, { id: 'city', label: t('m.map.city') }]} />
        <SearchInput value={q} onInput={setQ} placeholder={t('tm.searchPh')} />
        <ul class="m-tm__list">{pois.map((p) => <li key={p.id}><button type="button" class={clsx(env.position.poiId === p.id && 'is-on')} aria-pressed={env.position.poiId === p.id} onClick={() => { if (client.useGps) set({ useGps: false }); moveTo(p.id); }}>
          <Icon name={env.position.poiId === p.id ? 'circleCheck' : 'mapPin'} size={16} /><span>{L(p.name)}</span><small>{fmtDistance(sel.distanceTo(p))}</small></button></li>)}</ul>
      </div>
    </section>
    <section class="m-tm__sec"><h3 class="m-h3"><Icon name="signal" size={18} />{t('tm.net')}</h3>
      <Switch label={t('tm.net.auto')} checked={netAuto} onChange={(e) => set({ netAuto: e.currentTarget.checked })} />
      <div class="m-seg" role="group" aria-label={t('tm.net')}>{['online', 'slow', 'offline'].map((n) => <button key={n} type="button" class={clsx(env.network === n && 'is-on')} aria-pressed={env.network === n} onClick={() => { set({ netAuto: false }); setEnv({ network: n }); }}>{t('tm.net.' + n)}</button>)}</div>
    </section>
    <section class="m-tm__sec"><h3 class="m-h3"><Icon name="qr" size={18} />{t('tm.qr')}</h3>
      <Select value={env.qrInView || ''} onChange={(e) => setEnv({ qrInView: e.currentTarget.value || null })} aria-label={t('tm.qr')}>
        <option value="">{t('tm.qr.none')}</option>
        <optgroup label={t('tm.qr.codes')}>{qrs.map((x) => <option key={x.id} value={x.code}>{x.code} · {x.label}</option>)}</optgroup>
        {tickets.length > 0 && <optgroup label={t('tm.qr.tickets')}>{tickets.map((x) => <option key={x.id} value={`FPZ:T:${x.code}`}>{x.code}</option>)}</optgroup>}
      </Select>
      <small class="m-muted">{t('tm.qr.note')}</small>
    </section>
  </Modal>);
}

export function TestBadge({ onClick }) {
  const { t } = useClient();
  return <button type="button" class="m-testbadge" onClick={onClick} aria-label={t('tm.title')}><Icon name="flag" size={12} />{t('tm.badge')}</button>;
}
