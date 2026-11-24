// Skaner: kody QR (symulowany podgląd kamery), nadajniki BLE (radar), obiekty AR (+ schowek wspomnień).
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient, useEnv } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDateTime, fmtDistance } from '../../kernel/util.js';
import { Button, Empty, Icon, IconButton, Input, Media, Notice, QR, Tabs, Tag } from '../../ui/components.jsx';
import { ARView } from '../../ui/media.jsx';
import { useApp } from './ctx.js';
import { Screen, SectionHead } from './ui.jsx';
import { CameraScanner, cameraSupported } from './camera.jsx';

strings({
  'm.scan.title': ['Skaner', 'Scanner'], 'm.scan.qr': ['Kod QR', 'QR code'], 'm.scan.ble': ['Beacony BLE', 'BLE beacons'], 'm.scan.ar': ['AR', 'AR'],
  'm.scan.aim': ['Skieruj aparat na kod QR', 'Point the camera at a QR code'], 'm.scan.found': ['Wykryto kod', 'Code detected'], 'm.scan.resolve': ['Rozpoznaj kod', 'Recognise code'],
  'm.scan.manual': ['Wpisz kod ręcznie', 'Enter code manually'], 'm.scan.manualPh': ['np. FPZ-Q-101', 'e.g. FPZ-Q-101'], 'm.scan.check': ['Sprawdź', 'Check'],
  'm.scan.sim': ['Wersja testowa: obraz z kamery jest symulowany – kod „przed kamerą” wybierasz w panelu „Otoczenie telefonu” obok telefonu.', 'Test version: the camera image is simulated – choose the code “in front of the camera” in the “Phone surroundings” panel next to the phone.'],
  'm.scan.history': ['Historia skanów', 'Scan history'], 'm.scan.clear': ['Wyczyść', 'Clear'], 'm.scan.err': ['Nie udało się rozpoznać kodu', 'Could not recognise the code'],
  'm.scan.t.poi': ['Miejsce', 'Place'], 'm.scan.t.entry': ['Wpis', 'Entry'], 'm.scan.t.mission': ['Misja gry', 'Game mission'], 'm.scan.t.coupon': ['Kupon', 'Coupon'], 'm.scan.t.ticket': ['Bilet', 'Ticket'], 'm.scan.t.event': ['Wydarzenie', 'Event'], 'm.scan.t.venue': ['Obiekt', 'Venue'],
  'm.scan.mission': ['Kod należy do gry terenowej – otwieram grę.', 'This code belongs to the field game – opening the game.'],
  'm.ble.lead': ['Aplikacja nasłuchuje nadajników Bluetooth Low Energy. Zasięg każdego beaconu (1–70 m) ustawia się w CMS.', 'The app listens for Bluetooth Low Energy beacons. Each beacon’s range (1–70 m) is set in the CMS.'],
  'm.ble.in': ['w zasięgu', 'in range'], 'm.ble.out': ['poza zasięgiem', 'out of range'], 'm.ble.range': ['zasięg {m} m', 'range {m} m'], 'm.ble.none': ['Brak nadajników w pobliżu', 'No beacons nearby'], 'm.ble.noneText': ['Przejdź na teren Fabryki – pozycję zmienisz w panelu otoczenia.', 'Walk onto the Factory grounds – change your position in the surroundings panel.'],
  'm.ble.open': ['Otwórz', 'Open'], 'm.ble.radar': ['Radar nadajników', 'Beacon radar'], 'm.ble.sim': ['Sygnał Bluetooth jest symulowany na podstawie pozycji z panelu otoczenia.', 'The Bluetooth signal is simulated from the position in the surroundings panel.'],
  'm.ar.lead': ['Punkty rozszerzonej rzeczywistości w miejscu, w którym stoisz.', 'Augmented reality points where you are standing.'], 'm.ar.none': ['Brak punktów AR w tym miejscu', 'No AR points here'], 'm.ar.noneText': ['Podejdź do hali lub stanowiska oznaczonego znakiem AR.', 'Walk up to a hall or station marked with the AR sign.'],
  'm.ar.capture': ['Zapisz zdjęcie', 'Save photo'], 'm.ar.saved': ['Zapisano w schowku wspomnień', 'Saved to your memories'], 'm.ar.close': ['Zamknij widok AR', 'Close AR view'], 'm.ar.entry': ['Przejdź do wpisu', 'Open entry'],
  'm.ar.sim': ['Obraz z kamery jest symulowany ilustracją.', 'The camera image is simulated with an illustration.'], 'm.mem.title': ['Schowek wspomnień', 'Memories'], 'm.mem.empty': ['Zdjęcia z widoku AR pojawią się tutaj.', 'Photos from the AR view will appear here.'],
  'm.mem.remove': ['Usuń', 'Remove'], 'm.scan.cam': ['Kamera', 'Camera'], 'm.scan.simMode': ['Symulacja', 'Simulation'], 'm.scan.mode': ['Źródło obrazu', 'Image source'],
  'm.scan.camNote': ['Zeskanuj kod QR z tablicy, biletu albo ekranu kiosku. Kod rozpoznaje się automatycznie.', 'Scan a QR code on a sign, ticket or kiosk screen. It is recognised automatically.'], 'm.scan.toSim': ['Przełącz na symulację', 'Switch to simulation'],
});

const TYPE_ICON = { poi: 'mapPin', entry: 'book', mission: 'game', coupon: 'coupon', ticket: 'ticket', event: 'calendar', venue: 'store', video: 'video' };

/** Nawigacja po rozpoznanym kodzie – wspólna dla skanera i powiadomień. */
export function useTargetNav() {
  const app = useApp(); const { t, toast } = useClient();
  return (target) => {
    const { type, id } = target;
    if (type === 'poi') app.openPoi(id);
    else if (type === 'entry') app.openEntry(id);
    else if (type === 'mission') { toast(t('m.scan.mission'), 'info'); app.go('game'); }
    else if (type === 'coupon') app.openCoupons(id);
    else if (type === 'ticket') app.openReservation({ view: 'tickets' });
    else if (type === 'event') app.openReservation({ view: 'event', id });
    else if (type === 'venue') app.openReservation({ view: 'venue', id });
    else if (type === 'video') app.push('video', { id });
  };
}
const itemLabel = (L, res) => { const it = res.item; if (!it) return ''; return L(it.title || it.name || it.productName) || it.code || ''; };

export function ScanScreen({ mode = 'qr', active }) {
  const { t } = useClient(); const [tab, setTab] = useState(mode); const ref = useRef(null);
  useEffect(() => { const sc = ref.current?.closest('.m-scroll'); if (sc) sc.scrollTop = 0; }, [tab]);
  return (<Screen title={t('m.scan.title')} crumbs={[t('m.tab.home'), t('m.scan.title')]} class="m-scanscr"
    below={<Tabs variant="pill" value={tab} onChange={setTab} class="m-scantabs" tabs={[{ id: 'qr', label: t('m.scan.qr'), icon: 'qr' }, { id: 'ble', label: t('m.scan.ble'), icon: 'bluetooth' }, { id: 'ar', label: t('m.scan.ar'), icon: 'ar' }]} />}>
    <div ref={ref}>{tab === 'qr' && <QrPanel active={active} />}{tab === 'ble' && <BlePanel />}{tab === 'ar' && <ArPanel />}</div>
  </Screen>);
}

function QrPanel({ active }) {
  const { t, L, api, client, set, lang, toast } = useClient(); const { env, setEnv } = useEnv(); const nav = useTargetNav(); const app = useApp();
  const canCam = cameraSupported(); const camMode = canCam && (client.scanMode || (app.standalone ? 'camera' : 'sim')) === 'camera';
  const [manual, setManual] = useState(''); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false); const lastAuto = useRef(null);
  const seenTimer = useRef(null);
  const resolve = (code, fromCamera) => {
    setErr(null); const res = api.triggers.resolve(code, 'qr');
    if (!res.ok) { setErr({ code, error: res.error, message: L(res.message) }); toast(L(res.message), 'error'); return; }
    // Kod odczytany prawdziwym aparatem albo wpisany ręcznie: zapamiętaj go na 3 minuty jako „widziany” – gra terenowa zalicza wtedy krok „zeskanuj kod QR”
    // (w symulatorze tę rolę pełni lista „Kod QR przed kamerą”).
    if (fromCamera && res.trigger) { const seen = res.trigger.code; setEnv({ qrInView: seen }); clearTimeout(seenTimer.current); seenTimer.current = setTimeout(() => { if (getState().env.qrInView === seen) setEnv({ qrInView: null }); }, 180000); }
    const rec = { code, at: new Date().toISOString(), type: res.target.type, id: res.target.id, label: itemLabel(L, res) };
    set({ scans: [rec, ...(client.scans || []).filter((x) => x.code !== code)].slice(0, 12) });
    nav(res.target);
  };
  useEffect(() => {
    if (camMode) return;
    const c = env.qrInView; if (!c) { lastAuto.current = null; setBusy(false); return; }
    if (lastAuto.current === c) return; lastAuto.current = c; setBusy(true);
    const tm = setTimeout(() => { setBusy(false); resolve(c); }, 1100); return () => clearTimeout(tm);
  }, [env.qrInView, camMode]);
  const manualForm = (<form class="m-manual" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) resolve(manual.trim(), true); }}>
      <label class="fpz-field__label" for="m-manual-code">{t('m.scan.manual')}</label>
      <div class="m-manual__row"><Input id="m-manual-code" pill value={manual} placeholder={t('m.scan.manualPh')} onInput={(e) => setManual(e.currentTarget.value)} autocomplete="off" /><Button type="submit" variant="mint">{t('m.scan.check')}</Button></div>
    </form>);
  const historyList = ((client.scans || []).length > 0 && <><SectionHead title={t('m.scan.history')} action={t('m.scan.clear')} onAction={() => set({ scans: [] })} />
      <ul class="m-scanlist">{client.scans.map((x) => <li key={x.code + x.at}><button type="button" onClick={() => nav({ type: x.type, id: x.id })}><span class="m-scanlist__ico"><Icon name={TYPE_ICON[x.type] || 'qr'} size={18} /></span><span><b>{x.label || x.code}</b><small>{t('m.scan.t.' + x.type)} · {x.code} · {fmtDateTime(x.at, lang)}</small></span><Icon name="arrowRight" size={16} /></button></li>)}</ul></>);
  const modeSwitch = <div class="m-seg" role="group" aria-label={t('m.scan.mode')}><button type="button" class={clsx(camMode && 'is-on')} aria-pressed={camMode} disabled={!canCam} onClick={() => set({ scanMode: 'camera' })}><Icon name="camera" size={15} /> {t('m.scan.cam')}</button><button type="button" class={clsx(!camMode && 'is-on')} aria-pressed={!camMode} onClick={() => set({ scanMode: 'sim' })}><Icon name="qr" size={15} /> {t('m.scan.simMode')}</button></div>;
  if (camMode) return (<div class="m-stack">{modeSwitch}
    <CameraScanner active={active !== false} onCode={(c) => resolve(c, true)} />
    <p class="m-muted">{t('m.scan.camNote')}</p>
    {err && <Notice tone="danger"><b>{t('m.scan.err')}</b> – {err.message} <code>({err.error}: {err.code})</code></Notice>}
    {manualForm}{historyList}</div>);
  return (<div class="m-stack">{modeSwitch}
    <div class={clsx('m-cam', env.qrInView && 'has-code')} aria-label={t('m.scan.aim')} role="img">
      <div class="m-cam__bg" /><span class="m-cam__corners" /><span class="m-cam__line" />
      {env.qrInView ? <div class="m-cam__code"><QR value={env.qrInView} size={120} /></div> : <p class="m-cam__hint">{t('m.scan.aim')}</p>}
      {env.qrInView && <div class="m-cam__found" role="status"><Tag tone="green" icon="check">{t('m.scan.found')}</Tag><code>{env.qrInView}</code>{busy && <span class="m-dotsload" />}</div>}
    </div>
    {env.qrInView && <Button block icon="scan" onClick={() => resolve(env.qrInView)}>{t('m.scan.resolve')}</Button>}
    <Notice tone="info">{t('m.scan.sim')}</Notice>
    {err && <Notice tone="danger"><b>{t('m.scan.err')}</b> – {err.message} <code>({err.error}: {err.code})</code></Notice>}
    {manualForm}
    {historyList}
  </div>);
}

/** Pozycja kropki na radarze: kąt z identyfikatora, promień z odległości (skala log do 70 m+). */
const radarXY = (b) => { let h = 0; for (const ch of b.trigger.id) h = (h * 31 + ch.charCodeAt(0)) % 360; const r = Math.min(1, Math.log10(1 + b.distanceM) / Math.log10(1 + 140)); const a = (h * Math.PI) / 180; return [50 + Math.cos(a) * r * 46, 50 + Math.sin(a) * r * 46]; };

function BlePanel() {
  const { t, L } = useClient(); useEnv(); const app = useApp(); const list = sel.nearbyBeacons(150);
  return (<div class="m-stack">
    <p class="m-muted">{t('m.ble.lead')}</p>
    <div class="m-radar" role="img" aria-label={t('m.ble.radar')}>
      <svg viewBox="0 0 100 100">{[46, 34, 22, 10].map((r) => <circle key={r} cx="50" cy="50" r={r} class="m-radar__ring" />)}
        <line x1="50" y1="4" x2="50" y2="96" class="m-radar__ring" /><line x1="4" y1="50" x2="96" y2="50" class="m-radar__ring" />
        <g class="m-radar__sweep"><path d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z" /></g>
        {list.map((b) => { const [x, y] = radarXY(b); return <g key={b.trigger.id} class={clsx('m-radar__dot', b.inRange && 'is-in')}><circle cx={x} cy={y} r={b.inRange ? 3.2 : 2.2} /></g>; })}
        <circle cx="50" cy="50" r="2.6" class="m-radar__me" /></svg>
      <span class="m-radar__lbl m-radar__lbl--1">10 m</span><span class="m-radar__lbl m-radar__lbl--2">70 m</span>
    </div>
    <small class="m-muted">{t('m.ble.sim')}</small>
    {list.length === 0 ? <Empty icon="bluetooth" title={t('m.ble.none')} text={t('m.ble.noneText')} /> :
      <ul class="m-blelist">{list.slice(0, 12).map((b) => (<li key={b.trigger.id} class={clsx(b.inRange && 'is-in')}>
        <span class="m-blelist__ico"><Icon name="beacon" size={18} /></span>
        <span class="m-blelist__txt"><b>{b.poi ? L(b.poi.name) : b.trigger.label}</b><small>{fmtDistance(b.distanceM)} · {t('m.ble.range', { m: b.trigger.ble?.rangeM || 20 })} · {b.trigger.code}</small>
          <Tag tone={b.inRange ? 'green' : 'neutral'}>{t(b.inRange ? 'm.ble.in' : 'm.ble.out')}</Tag></span>
        {b.inRange && <Button size="sm" onClick={() => (b.trigger.target?.type === 'mission' ? app.go('game') : app.openPoi(b.poi?.id || b.trigger.target.id))}>{t('m.ble.open')}</Button>}
      </li>))}</ul>}
  </div>);
}

function ArPanel() {
  const { t, L, client, set, toast } = useClient(); useEnv(); const app = useApp(); const list = sel.arHere(); const [open, setOpen] = useState(null); const [flash, setFlash] = useState(false);
  const tr = open && sel.trigger(open);
  const label = (x) => { const tg = x.target; const it = tg.type === 'entry' ? sel.entry(tg.id) : tg.type === 'mission' ? sel.mission(tg.id) : sel.poi(x.poiId); return L(it?.title || it?.name) || x.label; };
  const capture = () => { setFlash(true); setTimeout(() => setFlash(false), 350); const ar = tr.ar || {}; set({ memories: [{ id: 'mem-' + Date.now(), at: new Date().toISOString(), label: label(tr), scene: ar.scene || 'hall', overlay: ar.overlay || 'info', poiId: tr.poiId }, ...(client.memories || [])].slice(0, 30) }); toast(t('m.ar.saved'), 'ok'); };
  if (tr) { const ar = tr.ar || {}; return (<div class="m-stack">
    <div class={clsx('m-arwrap', flash && 'is-flash')}><ARView scene={ar.scene || 'hall'} overlay={ar.overlay || 'info'} modelId={ar.modelId || 'lathe'} label={label(tr)} onCapture={capture} /></div>
    <small class="m-muted">{t('m.ar.sim')}</small>
    <div class="m-btnrow"><Button icon="camera" onClick={capture}>{t('m.ar.capture')}</Button>{tr.target.type === 'entry' && <Button variant="secondary" icon="book" onClick={() => app.openEntry(tr.target.id)}>{t('m.ar.entry')}</Button>}<Button variant="ghost" icon="close" onClick={() => setOpen(null)}>{t('m.ar.close')}</Button></div>
  </div>); }
  return (<div class="m-stack"><p class="m-muted">{t('m.ar.lead')}</p>
    {list.length === 0 ? <Empty icon="ar" title={t('m.ar.none')} text={t('m.ar.noneText')} /> :
      <ul class="m-blelist">{list.map((x) => <li key={x.id} class="is-in"><span class="m-blelist__ico"><Icon name="ar" size={18} /></span><span class="m-blelist__txt"><b>{label(x)}</b><small>{x.code} · {x.ar?.marker || ''}</small></span><Button size="sm" icon="camera" onClick={() => setOpen(x.id)}>AR</Button></li>)}</ul>}
    <SectionHead title={t('m.mem.title')} action={(client.memories || []).length ? t('m.cat.all') : null} onAction={() => app.push('memories')} />
    <MemoryGrid limit={4} />
  </div>);
}

function MemoryGrid({ limit }) {
  const { t, L, client, set, lang } = useClient(); const list = (client.memories || []).slice(0, limit || 99);
  if (!list.length) return <p class="m-muted">{t('m.mem.empty')}</p>;
  return <div class="m-grid2">{list.map((m) => <figure key={m.id} class="m-mem"><Media ill={m.overlay === 'future' ? 'future-city' : m.scene === 'hall' ? 'hall-interior' : 'hall-exterior'} tone="color" ratio="3/4" shape="card" alt={m.label} /><figcaption><b>{m.label}</b><small>{fmtDateTime(m.at, lang)}</small></figcaption>
    {!limit && <IconButton icon="trash" variant="mint" size="sm" class="m-mem__del" label={t('m.mem.remove')} onClick={() => set({ memories: client.memories.filter((x) => x.id !== m.id) })} />}</figure>)}</div>;
}
export function MemoriesScreen() {
  const { t } = useClient();
  return <Screen title={t('m.mem.title')} crumbs={[t('m.scan.title'), t('m.mem.title')]}><MemoryGrid /></Screen>;
}
