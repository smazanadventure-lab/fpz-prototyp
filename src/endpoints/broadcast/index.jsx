// Nadawanie z telefonu (/nadawanie): transmisja na żywo z kamery telefonu na ekrany LCD, do aplikacji, na stronę WWW i do kiosków.
// Obraz płynie WebRTC prosto z telefonu do odbiorców (kernel/rtc.js); stan „na antenie” dla wszystkich końcówek – api.live.start/stop.
// Strona zaplecza (logowanie służb technicznych) – nie trafia do aplikacji dla zwiedzających (build.mjs: FORBIDDEN_IN_APP).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Client, useClient, useNow } from '../../kernel/client.jsx';
import { getState, useStore } from '../../kernel/store.js';
import { sel, makeApi, ROLES } from '../../kernel/api.js';
import { fmtDuration, clsx } from '../../kernel/util.js';
import { newStreamId, newStreamKey, startBroadcast } from '../../kernel/rtc.js';
import { remoteEnabled, apiBase } from '../../kernel/remote.js';
import { Icon, Button, Logo, Field, Input, Notice, Tag, Switch, Select } from '../../ui/components.jsx';
import './broadcast.css';

if (typeof window !== 'undefined') window.__fpzBroadcast = { getState, makeApi };

const SKEY = 'fpz-nadawanie-v1'; // sessionStorage: { streamId, key, title, at } – wznowienie po przypadkowym przeładowaniu
const PERM = 'playlists'; // to samo uprawnienie, którego wymaga „Transmisje i napisy” w zarządzaniu ekspozycją (administrator, służby techniczne)
const QUALITY = { 720: { label: '720p', w: 1280, h: 720, bitrate: 1200000, hint: 'lepszy obraz, ok. 1,2 Mb/s na odbiorcę' }, 480: { label: '480p', w: 854, h: 480, bitrate: 650000, hint: 'słabsza sieć, ok. 0,65 Mb/s na odbiorcę' } };
const RESUME_MS = 30 * 60000;
const saved = () => { try { const v = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); return v && v.streamId && v.key && Date.now() - (v.at || 0) < RESUME_MS ? v : null; } catch { return null; } };
const save = (v) => { try { if (v) sessionStorage.setItem(SKEY, JSON.stringify(v)); else sessionStorage.removeItem(SKEY); } catch { /* tryb prywatny – bez wznawiania */ } };
const stopTracks = (ms) => { try { ms?.getTracks().forEach((t) => t.stop()); } catch { /* nic */ } };
const SRC = { camera: 'kamera telefonu', studio: 'symulacja (bez obrazu z kamery)' };

/** Środowisko, w którym nadawanie nie zadziała – komunikat zamiast formularza. */
function envProblem() {
  if (!remoteEnabled()) return { code: 'file', icon: 'server', title: 'Nadawanie wymaga wersji serwerowej', text: 'Ta kopia systemu działa z jednego pliku, bez serwera. Obraz z kamery trafia do ekranów przez serwer, który kojarzy telefon z odbiorcami (WebRTC) – nadawać można tylko z wersji serwerowej, np. https://fpz-prototyp.netlify.app/nadawanie.' };
  if (typeof RTCPeerConnection === 'undefined') return { code: 'webrtc', icon: 'videoOff', title: 'Ta przeglądarka nie obsługuje transmisji', text: 'Brak obsługi WebRTC. Otwórz tę stronę w aktualnej przeglądarce Chrome, Safari, Edge albo Firefox.' };
  if (typeof window !== 'undefined' && window.isSecureContext === false) return { code: 'insecure', icon: 'lock', title: 'Kamera wymaga bezpiecznego połączenia (https)', text: `Przeglądarki udostępniają kamerę tylko stronom otwartym przez https:// (albo na tym samym komputerze – localhost). Adres ${location.origin} jest niezabezpieczony – otwórz stronę nadawania pod adresem zaczynającym się od https://.` };
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return { code: 'nomedia', icon: 'videoOff', title: 'Przeglądarka nie daje dostępu do kamery', text: 'Ta przeglądarka (albo jej tryb, np. widok w innej aplikacji) nie udostępnia kamery stronom internetowym. Otwórz adres w Chrome lub Safari.' };
  return null;
}
/** Błąd getUserMedia → konkretny komunikat po polsku. */
function camError(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return { code: 'denied', title: 'Brak zgody na użycie kamery', text: 'Przeglądarka nie pozwoliła tej stronie korzystać z kamery lub mikrofonu. Dotknij ikony kłódki obok adresu strony, zezwól na „Kamera” i „Mikrofon”, a potem dotknij „Spróbuj ponownie”. iPhone: Ustawienia → Safari → Kamera / Mikrofon → Pytaj lub Zezwalaj.' };
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return { code: 'nocam', title: 'Nie znaleziono kamery', text: 'To urządzenie nie ma dostępnej kamery (albo wybranej kamery już nie ma). Wybierz inną kamerę albo otwórz tę stronę na telefonie.' };
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return { code: 'busy', title: 'Kamera jest zajęta', text: 'Kamery używa teraz inna aplikacja (aparat, wideorozmowa, inna karta przeglądarki). Zamknij ją i dotknij „Spróbuj ponownie”.' };
  return { code: 'other', title: 'Nie udało się uruchomić kamery', text: `Przeglądarka zgłosiła błąd: ${e?.message || n || 'nieznany'}.` };
}
const vCons = ({ facing, deviceId, q }) => ({ ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facing } }), width: { ideal: QUALITY[q].w }, height: { ideal: QUALITY[q].h }, frameRate: { ideal: 30, max: 30 } });
const aCons = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
/** Kamera (i mikrofon): przy braku wybranego urządzenia – drugi raz bez niego. */
async function openMedia(o) {
  try { return await navigator.mediaDevices.getUserMedia({ video: vCons(o), audio: o.mic ? aCons : false }); }
  catch (e) { if (o.deviceId && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) return navigator.mediaDevices.getUserMedia({ video: vCons({ ...o, deviceId: '' }), audio: o.mic ? aCons : false }); throw e; }
}
/** Wysyłka „na pożegnanie” (zamknięcie karty): sendBeacon przeżywa zamknięcie strony, zwykłe zapytanie – nie zawsze. */
const beacon = (path, body) => { try { return navigator.sendBeacon?.(apiBase() + '/api' + path, JSON.stringify(body)); } catch { return false; } };

export default function BroadcastApp() {
  return <Client id="broadcast" base={16} class="ep-bcast"><Root /></Client>;
}

function Root() {
  const { staff } = useClient(); const prob = envProblem();
  if (prob) return <Blocked p={prob} />;
  if (!staff) return <Login />;
  if (!sel.can(staff, PERM)) return <NoPerm />;
  return <Studio />;
}

function Blocked({ p }) {
  return (<div class="b-center" data-problem={p.code}><div class="b-card">
    <div class="b-brand"><Logo compact /><span>Nadawanie z telefonu</span></div>
    <span class="b-bigic"><Icon name={p.icon} size={34} /></span>
    <h1>{p.title}</h1><p data-testid="b-problem">{p.text}</p>
  </div></div>);
}

function Login() {
  const { api, toast } = useClient();
  const [login, setLogin] = useState('technik'); const [pass, setPass] = useState('technik'); const [err, setErr] = useState('');
  const go = () => { const r = api.staff.login(login, pass); if (!r.ok) { setErr(r.message.pl); return; } toast(`Zalogowano: ${r.staff.name}`); };
  const pick = (l) => { setLogin(l); setPass(l); setErr(''); };
  const q = (l, icon, name) => { const on = login === l && pass === l; return <button type="button" class={clsx('b-quick', on && 'is-on')} aria-pressed={on} onClick={() => pick(l)}><Icon name={on ? 'check' : icon} size={16} />{l}<small>{name}</small></button>; };
  return (<div class="b-center"><form class="b-card b-login" onSubmit={(e) => { e.preventDefault(); go(); }}>
    <div class="b-brand"><Logo compact /><span>Nadawanie z telefonu</span></div>
    <h1>Transmisja na żywo z kamery</h1>
    <p class="b-muted">Obraz z tego telefonu pojawi się na ekranach LCD, w aplikacji, na stronie WWW i w kioskach. Zaloguj się kontem służb technicznych.</p>
    <Field label="Login"><Input value={login} onInput={(e) => setLogin(e.currentTarget.value)} autocomplete="username" name="b-login" /></Field>
    <Field label="Hasło" error={err}><Input type="password" value={pass} onInput={(e) => setPass(e.currentTarget.value)} autocomplete="current-password" name="b-pass" /></Field>
    <Button type="submit" size="lg" icon="login" block data-testid="b-login-submit">Zaloguj</Button>
    <p class="b-note"><Icon name="info" size={14} />Makieta logowania – dane konta testowego są wypełnione.</p>
    <div class="b-quicks"><span>Konta testowe:</span>{q('technik', 'wrench', 'Służby techniczne')}{q('admin', 'shield', 'Administrator')}</div>
  </form></div>);
}

function NoPerm() {
  const { staff, api } = useClient();
  return (<div class="b-center"><div class="b-card">
    <div class="b-brand"><Logo compact /><span>Nadawanie z telefonu</span></div>
    <span class="b-bigic"><Icon name="lock" size={34} /></span>
    <h1>Brak uprawnień</h1>
    <p>Konto „{staff.login}” ({ROLES[staff.role]?.name}) nie może prowadzić transmisji. Nadawać mogą służby techniczne i administrator – ci sami, którzy uruchamiają transmisje w „Zarządzaniu ekspozycją”.</p>
    <Button variant="secondary" icon="logout" onClick={() => api.staff.logout()}>Wyloguj</Button>
  </div></div>);
}

/** Ekran nadawcy: przygotowanie → na antenie → zakończono. */
function Studio() {
  const { api, staff, toast } = useClient(); const s = useStore(); const live = s.live; const now = useNow(1000);
  const [resume, setResume] = useState(saved);
  const [title, setTitle] = useState(() => resume?.title || live.title?.pl || '');
  const [facing, setFacing] = useState('environment'); const [deviceId, setDeviceId] = useState(''); const [devices, setDevices] = useState([]);
  const [mic, setMic] = useState(true); const [q, setQ] = useState('720');
  const [phase, setPhase] = useState('setup'); // setup | starting | onair | ended
  const [stream, setStream] = useState(null); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null); const [warns, setWarns] = useState({}); const [ended, setEnded] = useState(null);
  const [pvSize, setPvSize] = useState(null); // [szer, wys] obrazu z podglądu – telefon w pionie czy w poziomie
  const [viewers, setViewers] = useState(0); const [muted, setMuted] = useState(false); const [since, setSince0] = useState(0); const sinceRef = useRef(0); const setSince = (t) => { sinceRef.current = t; setSince0(t); }; const [confirm, setConfirm] = useState(null);
  const streamRef = useRef(null); const bcRef = useRef(null); const idRef = useRef(null); const wakeRef = useRef(null);
  const rep = useRef({ last: 0, t: null, n: 0 }); const optsRef = useRef(null); optsRef.current = { facing, deviceId, q, mic };
  const warn = (k, v) => setWarns((w) => ({ ...w, [k]: v }));
  const setMedia = (ms) => { streamRef.current = ms; setStream(ms); };

  const listDevices = async () => { try { const all = await navigator.mediaDevices.enumerateDevices(); setDevices(all.filter((d) => d.kind === 'videoinput')); } catch { /* bez listy */ } };
  /** Podgląd: prośba o kamerę tylko po dotknięciu przycisku. Stara kamera jest zatrzymywana przed otwarciem nowej (telefony nie otworzą dwóch naraz). */
  const preview = async (o = optsRef.current) => {
    setErr(null); setBusy(true); stopTracks(streamRef.current); setMedia(null);
    try { const ms = await openMedia(o); setMedia(ms); listDevices(); return ms; }
    catch (e) { setErr(camError(e)); return null; }
    finally { setBusy(false); }
  };
  // zmiana ustawień przy włączonym podglądzie (przed transmisją) – podgląd z nowymi ustawieniami
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (phase === 'setup' && streamRef.current) preview(); }, [facing, deviceId, q, mic]);

  /** Na antenie: podmiana samej kamery (przód/tył, ponowne uruchomienie) bez zrywania połączeń z odbiorcami. */
  const swapVideo = async (o) => {
    const cur = streamRef.current; const audio = cur ? cur.getAudioTracks() : []; cur?.getVideoTracks().forEach((t) => t.stop());
    let v = null;
    try { v = (await openMedia({ ...o, mic: false })).getVideoTracks()[0]; }
    catch (e) { toast(camError(e).title, 'error'); try { v = (await openMedia({ ...optsRef.current, mic: false })).getVideoTracks()[0]; o = null; } catch { warn('cam', true); return false; } }
    const next = new MediaStream([v, ...audio]); setMedia(next); watchTrack(v); warn('cam', false);
    try { await bcRef.current?.replaceStream(next); } catch { /* odbiorcy połączą się ponownie */ }
    if (o) { setFacing(o.facing); setDeviceId(o.deviceId || ''); }
    return true;
  };
  const watchTrack = (t) => t?.addEventListener('ended', () => { if (bcRef.current && streamRef.current?.getVideoTracks()[0] === t) warn('cam', true); });

  const report = (n) => { // liczba odbiorców do stanu wspólnego – nie częściej niż co 3 s
    const r = rep.current; r.n = n; if (r.t) return;
    r.t = setTimeout(() => { r.t = null; r.last = Date.now(); const L = getState().live; if (bcRef.current && L.onAir && L.streamId === idRef.current) api.live.viewers(r.n); }, Math.max(0, 3000 - (Date.now() - r.last)));
  };

  const start = async (res) => {
    setErr(null); setPhase('starting');
    let ms = streamRef.current; if (!ms || !ms.getVideoTracks().some((t) => t.readyState === 'live')) ms = await preview();
    if (!ms) { setPhase('setup'); return; }
    const sess = res || { streamId: newStreamId(), key: newStreamKey() };
    let bc = null;
    try {
      bc = await startBroadcast(ms, { streamId: sess.streamId, key: sess.key, maxBitrate: QUALITY[q].bitrate, onViewers: (n) => { setViewers(n); report(n); }, onError: (code) => { if (code === 'NETWORK') warn('net', true); else if (code === 'FORBIDDEN') finish('forbidden'); } });
    } catch (e) { setErr({ code: 'server', title: 'Nie udało się rozpocząć transmisji', text: e?.message || 'Serwer nie przyjął transmisji.' }); setPhase('setup'); return; }
    bcRef.current = bc; idRef.current = sess.streamId;
    const ttl = title.trim() || live.title?.pl || 'Transmisja na żywo';
    const L = getState().live;
    if (!(L.onAir && L.streamId === sess.streamId)) { const r = api.live.start(ttl, { streamId: sess.streamId }); if (r && r.ok === false) { bcRef.current = null; bc.stop(); setErr({ code: 'server', title: 'Nie udało się rozpocząć transmisji', text: r.message?.pl || '' }); setPhase('setup'); return; } }
    const keep = { ...sess, title: ttl, at: Date.now() }; save(keep); setResume(keep); watchTrack(ms.getVideoTracks()[0]);
    ms.getAudioTracks().forEach((t) => { t.enabled = true; }); setMuted(false);
    setViewers(0); setWarns({}); setSince(Date.now()); setEnded(null); setPhase('onair');
    toast(res ? 'Transmisja wznowiona' : 'Transmisja rozpoczęta');
  };
  /** Koniec transmisji. why: 'user' (przycisk) | 'panel' (zakończona w zarządzaniu ekspozycją) | 'forbidden' | 'closed' (strona była zamknięta). */
  const finish = (why) => {
    const bc = bcRef.current; if (!bc) return; bcRef.current = null; clearTimeout(rep.current.t); rep.current.t = null;
    const L = getState().live; if (why === 'user' && L.onAir && L.streamId === idRef.current) api.live.stop();
    stopTracks(streamRef.current); setMedia(null); if (why !== 'closed') { save(null); setResume(null); }
    setEnded({ why, dur: (Date.now() - sinceRef.current) / 1000, at: Date.now() }); setPhase('ended'); setConfirm(null);
    bc.stop().catch?.(() => {});
  };

  // zakończenie z panelu (live.onAir = false albo inna transmisja) – zatrzymujemy kamerę; chwila zwłoki na spóźnioną synchronizację
  useEffect(() => {
    if (phase !== 'onair' || (live.onAir && live.streamId === idRef.current)) return undefined;
    const t = setTimeout(() => { const L = getState().live; if (bcRef.current && !(L.onAir && L.streamId === idRef.current)) finish('panel'); }, 1500);
    return () => clearTimeout(t);
  }, [phase, live.onAir, live.streamId]);

  // na antenie: blokada wygaszania ekranu, ostrzeżenie po powrocie z tła, kamera wstrzymana przez system → ponowne uruchomienie
  useEffect(() => {
    if (phase !== 'onair') return undefined;
    let hiddenAt = 0;
    const lock = async () => { try { if (navigator.wakeLock && document.visibilityState === 'visible') { wakeRef.current = await navigator.wakeLock.request('screen'); } } catch { /* bez blokady wygaszania */ } };
    const vis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt) warn('bg', Math.max(1, Math.round((Date.now() - hiddenAt) / 1000))); hiddenAt = 0; lock();
      const v = streamRef.current?.getVideoTracks()[0]; if (bcRef.current && (!v || v.readyState === 'ended')) swapVideo(optsRef.current);
    };
    lock(); document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); try { wakeRef.current?.release?.(); } catch { /* nic */ } wakeRef.current = null; };
  }, [phase]);

  // zamknięcie karty: zamknięcie transmisji na serwerze i live.stop (sendBeacon). Strona przywrócona z pamięci (bfcache) – transmisja już nie trwa.
  useEffect(() => {
    const bye = () => {
      const sv = saved(); const L = getState().live; if (!bcRef.current || !sv) return;
      beacon('/live/close', { stream: sv.streamId, key: sv.key });
      if (L.onAir && L.streamId === sv.streamId) beacon('/rpc', { deviceId: getState().deviceId, role: 'full', ops: [{ op: 'live.stop', args: [], nonce: 'bye-' + sv.streamId + '-' + Date.now(), clientId: 'broadcast', client: { staffId: staff?.id || null } }] });
    };
    const back = (e) => { if (e.persisted && bcRef.current) finish('closed'); };
    window.addEventListener('pagehide', bye); window.addEventListener('pageshow', back);
    return () => { window.removeEventListener('pagehide', bye); window.removeEventListener('pageshow', back); };
  }, []);
  // wyjście z ekranu (np. wylogowanie) – bez osieroconej kamery
  useEffect(() => () => { if (bcRef.current) finish('user'); stopTracks(streamRef.current); }, []);

  const toggleMic = () => { const n = !muted; streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !n; }); setMuted(n); };
  const flip = () => swapVideo({ ...optsRef.current, facing: facing === 'user' ? 'environment' : 'user', deviceId: '' });
  const vt = stream?.getVideoTracks()[0]; const set = vt?.getSettings ? vt.getSettings() : {};
  const mirror = (set.facingMode || (deviceId ? '' : facing)) === 'user';
  const res = set.width ? `${set.width}×${set.height}` : null;
  const hasAudio = !!stream?.getAudioTracks().length;
  // obraz wychodzący w pionie (rozmiar z podglądu; zanim znany – z ustawień ścieżki) → na ekranach poziomych będzie wąski
  const portrait = !!stream && (pvSize ? pvSize[1] > pvSize[0] : !!set.width && set.width < set.height);
  const onSize = (w, h) => setPvSize((a) => (a && a[0] === w && a[1] === h ? a : [w, h]));
  const orient = <p class="b-orient" data-testid="b-orient"><Icon name="rotate" size={15} />Trzymaj telefon poziomo – obraz wypełni ekrany.</p>;
  const portraitNote = portrait && <div class="b-portrait" role="status" data-testid="b-portrait"><Icon name="smartphone" size={16} /><span>Nadajesz w pionie – na ekranach obraz będzie wąski.</span></div>;

  if (phase === 'onair') {
    const el = (now.getTime() - since) / 1000;
    return (<div class="b-air" data-testid="b-onair">
      <Preview stream={stream} mirror={mirror} onSize={onSize} />
      <header class="b-air__top">
        <span class="b-onair" role="status"><i />NA ŻYWO</span>
        <span class="b-pill b-pill--time" data-testid="b-elapsed"><Icon name="clock" size={15} />{fmtDuration(el)}</span>
        <span class="b-pill" data-testid="b-viewers" aria-label={`Połączeni odbiorcy: ${viewers}`}><Icon name="eye" size={15} />{viewers}<small> / 6</small></span>
      </header>
      <div class="b-air__title"><b>{live.title?.pl || title}</b>{res && <small>{res}{muted ? ' · mikrofon wyciszony' : !hasAudio ? ' · bez dźwięku' : ''}</small>}</div>
      <div class="b-air__warns" aria-live="assertive">
        {portraitNote || <div class="b-air__orient">{orient}</div>}
        {warns.net && <Warn icon="wifiOff" onClose={() => warn('net', false)} testid="b-warn-net">Słabe połączenie z serwerem – nowi odbiorcy mogą nie dołączyć, a połączeni mogą stracić obraz. Sprawdź Wi-Fi; połączenie wznowi się samo.</Warn>}
        {warns.bg && <Warn icon="alert" onClose={() => warn('bg', false)} testid="b-warn-bg">Strona nadawania była w tle ({warns.bg} s). Telefon wstrzymuje wtedy kamerę – odbiorcy widzieli zatrzymany obraz. Nie przełączaj aplikacji podczas transmisji.</Warn>}
        {warns.cam && <Warn icon="videoOff" testid="b-warn-cam">Kamera przestała nadawać obraz.<button type="button" class="b-link" onClick={() => swapVideo(optsRef.current)}>Uruchom kamerę ponownie</button></Warn>}
      </div>
      <nav class="b-air__bar" aria-label="Sterowanie transmisją">
        <button type="button" class="b-round" onClick={flip} aria-label="Przełącz kamerę (przód / tył)" data-testid="b-flip"><Icon name="refresh" size={24} /><span>Kamera</span></button>
        <button type="button" class={clsx('b-round', muted && 'is-off')} onClick={toggleMic} disabled={!hasAudio} aria-pressed={muted} aria-label={muted ? 'Włącz mikrofon' : 'Wycisz mikrofon'} data-testid="b-mic"><Icon name={muted ? 'mute' : 'mic'} size={24} /><span>{!hasAudio ? 'Bez mikr.' : muted ? 'Wyciszony' : 'Mikrofon'}</span></button>
        <button type="button" class="b-round b-round--stop" onClick={() => setConfirm('end')} data-testid="b-stop"><Icon name="stop" size={24} /><span>Zakończ</span></button>
      </nav>
      {confirm === 'end' && <Confirm title="Zakończyć transmisję?" text="Ekrany, aplikacja i strona WWW wrócą do zwykłego programu. Napisy na żywo zostaną w historii panelu." yes="Zakończ transmisję" onYes={() => { finish('user'); toast('Transmisja zakończona', 'info'); }} onNo={() => setConfirm(null)} />}
    </div>);
  }

  if (phase === 'ended' && ended) {
    const msg = { panel: 'Transmisję zakończono z panelu', user: 'Transmisja zakończona', forbidden: 'Serwer przerwał transmisję', closed: 'Transmisja została przerwana' }[ended.why];
    const sub = { panel: 'Operator zakończył ją w „Zarządzaniu ekspozycją” (Transmisje i napisy). Kamera i mikrofon tego telefonu są wyłączone.', user: 'Kamera i mikrofon są wyłączone. Ekrany wróciły do zwykłego programu.', forbidden: 'Tę transmisję przejął inny nadawca. Kamera i mikrofon są wyłączone.', closed: 'Strona nadawania była zamknięta. Możesz wznowić transmisję.' }[ended.why];
    return (<div class="b-center"><div class="b-card" data-testid="b-ended" data-why={ended.why}>
      <span class="b-bigic"><Icon name={ended.why === 'user' ? 'circleCheck' : 'alert'} size={34} /></span>
      <h1 data-testid="b-ended-msg">{msg}</h1><p>{sub}</p>
      <p class="b-muted">Czas trwania: <b>{fmtDuration(ended.dur)}</b></p>
      <Button size="lg" icon="video" block onClick={() => { setEnded(null); setPhase('setup'); }} data-testid="b-again">Przygotuj nową transmisję</Button>
    </div></div>);
  }

  // przygotowanie
  const mine = resume && live.onAir && live.streamId === resume.streamId; // nasza transmisja nadal „na antenie” (np. po przeładowaniu)
  const other = live.onAir && !mine;
  const canResume = resume && (!live.onAir || mine);
  const starting = phase === 'starting';
  const camList = devices.filter((d) => d.deviceId);
  return (<div class="b-setup">
    <header class="b-top">
      <div class="b-brand"><Logo compact /><span>Nadawanie z telefonu</span></div>
      <span class="b-top__user" title={ROLES[staff.role]?.name}>{staff.name.split(' – ')[0]}</span>
      <button type="button" class="b-iconbtn" aria-label="Wyloguj" title="Wyloguj" onClick={() => { stopTracks(streamRef.current); setMedia(null); api.staff.logout(); }}><Icon name="logout" size={18} /></button>
    </header>
    <div class="b-setup__grid">
      <div class="b-setup__pv">
        <div class="b-pv">
          {stream ? <Preview stream={stream} mirror={mirror} onSize={onSize} />
            : <div class="b-pv__off"><Icon name="camera" size={34} /><span>{busy ? 'Uruchamianie kamery…' : 'Podgląd kamery jest wyłączony'}</span>
              {!busy && <Button variant="mint" icon="camera" onClick={() => preview()} data-testid="b-preview">Włącz podgląd kamery</Button>}</div>}
          {stream && <span class="b-pv__tag">Podgląd{res ? ` · ${res}` : ''}{mirror ? ' · lustro' : ''}</span>}
        </div>
        <div class="b-setup__orient">{orient}{portraitNote}</div>
      </div>
      <div class="b-setup__form">
        {err && <div class="b-err" role="alert" data-testid="b-error" data-code={err.code}><Icon name="circleAlert" size={20} /><div><b>{err.title}</b><p>{err.text}</p>{err.code !== 'server' && <Button size="sm" variant="secondary" icon="refresh" onClick={() => preview()}>Spróbuj ponownie</Button>}</div></div>}
        {other && <div class="b-onairnote" data-testid="b-already" data-source={live.source || ''}>
          <Tag tone="live">Na żywo</Tag>
          <p>Trwa już transmisja „<b>{live.title?.pl}</b>” – źródło: <b>{SRC[live.source] || (live.streamId ? SRC.camera : SRC.studio)}</b>{live.source === 'camera' ? ' (inny telefon)' : ''}. Zakończ ją, zanim rozpoczniesz nową.</p>
          <Button variant="danger" size="sm" icon="stop" onClick={() => setConfirm('other')} data-testid="b-end-other">Zakończ bieżącą transmisję</Button>
        </div>}
        {canResume && <div class="b-resume" data-testid="b-resume-card"><Icon name="history2" size={20} /><p>{mine ? 'Transmisja z tego telefonu nadal jest na antenie, ale obraz został przerwany (np. po przeładowaniu strony).' : 'Transmisja z tego telefonu została przerwana (np. przez przeładowanie strony).'} „<b>{resume.title}</b>”</p>
          <Button icon="play" onClick={() => start(resume)} disabled={starting} data-testid="b-resume">Wznów transmisję</Button></div>}
        <Field label="Tytuł transmisji"><Input value={title} onInput={(e) => setTitle(e.currentTarget.value)} maxLength={90} data-testid="b-title" /></Field>
        <div class="fpz-field"><span class="fpz-field__label">Kamera</span>
          <div class="b-seg" role="group" aria-label="Kamera">
            <button type="button" class={!deviceId && facing === 'environment' ? 'is-on' : ''} aria-pressed={!deviceId && facing === 'environment'} onClick={() => { setDeviceId(''); setFacing('environment'); }}><Icon name="camera" size={16} />Tylna</button>
            <button type="button" class={!deviceId && facing === 'user' ? 'is-on' : ''} aria-pressed={!deviceId && facing === 'user'} onClick={() => { setDeviceId(''); setFacing('user'); }}><Icon name="smile" size={16} />Przednia</button>
          </div>
          {camList.length > 1 && <Select value={deviceId} onChange={(e) => setDeviceId(e.currentTarget.value)} aria-label="Wybór kamery" class="b-devsel" data-testid="b-device">
            <option value="">Według przełącznika (tylna / przednia)</option>
            {camList.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${i + 1}`}</option>)}</Select>}
          {!camList.length && <span class="fpz-field__hint">Lista kamer pojawi się po włączeniu podglądu.</span>}
        </div>
        <div class="b-row2">
          <div class="fpz-field"><span class="fpz-field__label">Jakość</span>
            <div class="b-seg" role="group" aria-label="Jakość obrazu">{Object.entries(QUALITY).sort((a, b) => b[0] - a[0]).map(([k, v]) => <button key={k} type="button" class={q === k ? 'is-on' : ''} aria-pressed={q === k} onClick={() => setQ(k)}>{v.label}</button>)}</div>
            <span class="fpz-field__hint">{QUALITY[q].hint}</span></div>
          <div class="fpz-field"><span class="fpz-field__label">Dźwięk</span><Switch label={mic ? 'Mikrofon włączony' : 'Bez dźwięku'} checked={mic} onChange={(e) => setMic(e.currentTarget.checked)} data-testid="b-micset" /></div>
        </div>
        <div class="b-go">
          <Button size="lg" icon="video" block disabled={starting || busy || other} onClick={() => start(null)} data-testid="b-start">{starting ? 'Łączenie…' : 'Rozpocznij transmisję'}</Button>
          {other && <span class="b-go__why">Najpierw zakończ bieżącą transmisję.</span>}
        </div>
        <p class="b-hint"><Icon name="info" size={15} /><span>Najlepiej działa, gdy telefon i ekrany są w <b>tej samej sieci Wi-Fi</b>. Obraz odbiera naraz <b>do 6 urządzeń</b> (ekrany, telefony, komputery) – kolejne zobaczą komunikat o komplecie. Transmisja <b>nie jest nagrywana</b>. Podłącz ładowarkę i nie przełączaj aplikacji – w tle telefon wstrzymuje kamerę.</span></p>
      </div>
    </div>
    {confirm === 'other' && <Confirm title="Zakończyć bieżącą transmisję?" text={`„${live.title?.pl}” (${SRC[live.source] || 'transmisja'}) zniknie z ekranów, aplikacji i strony WWW${live.source === 'camera' ? ', a telefon, który ją nadaje, wyłączy kamerę' : ''}.`} yes="Zakończ" onYes={() => { api.live.stop(); setConfirm(null); toast('Zakończono bieżącą transmisję', 'info'); }} onNo={() => setConfirm(null)} />}
  </div>);
}

/** Obraz z kamery (bez dźwięku – tylko podgląd nadawcy); przednia kamera w lustrzanym odbiciu, jak w aparacie. */
function Preview({ stream, mirror, onSize }) {
  const ref = useRef(null); const sz = useRef(onSize); sz.current = onSize;
  useEffect(() => { const el = ref.current; if (!el) return; if (el.srcObject !== stream) el.srcObject = stream || null; if (stream) el.play?.()?.catch?.(() => {}); }, [stream]);
  // rozmiar obrazu (zmienia się po obróceniu telefonu – zdarzenie resize)
  useEffect(() => { const el = ref.current; if (!el) return undefined; const f = () => { if (el.videoWidth) sz.current?.(el.videoWidth, el.videoHeight); }; f(); el.addEventListener('resize', f); el.addEventListener('loadedmetadata', f); return () => { el.removeEventListener('resize', f); el.removeEventListener('loadedmetadata', f); }; }, []);
  return <video ref={ref} class={clsx('b-video', mirror && 'is-mirror')} muted autoplay playsInline aria-label="Podgląd kamery" data-testid="b-video" />;
}
function Warn({ icon, children, onClose, testid }) {
  return <div class="b-warn" role="alert" data-testid={testid}><Icon name={icon} size={18} /><span>{children}</span>{onClose && <button type="button" class="b-warn__x" aria-label="Zamknij ostrzeżenie" onClick={onClose}><Icon name="close" size={16} /></button>}</div>;
}
function Confirm({ title, text, yes, onYes, onNo }) {
  return (<div class="b-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onNo(); }}>
    <div class="b-sheet__box"><h2>{title}</h2><p>{text}</p>
      <div class="b-sheet__act"><Button variant="secondary" onClick={onNo} data-testid="b-confirm-no">Anuluj</Button><Button variant="danger" icon="stop" onClick={onYes} data-testid="b-confirm-yes">{yes}</Button></div></div>
  </div>);
}
