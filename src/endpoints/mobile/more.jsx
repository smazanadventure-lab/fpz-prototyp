// Ekrany z menu: ustawienia (offline, RODO), dostępność, kupony, quizy, powiadomienia, wyszukiwarka, media społecznościowe, informacje, o aplikacji.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient, useEnv, stepFontScale } from '../../kernel/client.jsx';
import { strings, languages } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDate, fmtDateTime, fmtDay, fmtTime, matches, ago } from '../../kernel/util.js';
import { Button, Card, CardBody, Empty, Icon, IconButton, Logo, Media, Modal, Notice, PjmCall, Progress, QR, SearchInput, Switch, Tag } from '../../ui/components.jsx';
import { stopSpeaking } from '../../ui/speech.js';
import { useApp, APP_VERSION } from './ctx.js';
import { Screen, SectionHead, PoiRow, EntryCard } from './ui.jsx';

strings({
  's.lang': ['Język aplikacji', 'App language'], 's.a11y': ['Dostępność', 'Accessibility'], 's.notif': ['Powiadomienia', 'Notifications'], 's.notif.push': ['Powiadomienia push (wydarzenia, transmisje, gra)', 'Push notifications (events, live, game)'],
  's.beacon': ['Automatyczne treści przy beaconach', 'Automatic content at beacons'], 's.beacon.card': ['Pokazuj kartę po wejściu w zasięg nadajnika', 'Show a card when entering beacon range'], 's.beacon.audio': ['Automatycznie odtwarzaj audioprzewodnik przy beaconie', 'Auto-play the audio guide at beacons'],
  's.audioQueue': ['Po zakończeniu odtwarzaj następny punkt', 'Play the next stop automatically'],
  's.offline': ['Tryb offline', 'Offline mode'], 's.offline.lead': ['Pobierz pakiet treści o terenie Fabryki, aby korzystać z nich bez zasięgu. Mapa i gra terenowa działają offline zawsze – postępy gry zsynchronizują się po odzyskaniu połączenia.', 'Download the content pack about the Factory site to use it without signal. The map and the field game always work offline – game progress syncs when you are back online.'],
  's.offline.pack': ['Pakiet: {n} wpisów · ok. {mb} MB', 'Pack: {n} entries · approx. {mb} MB'], 's.offline.download': ['Pobierz pakiet offline', 'Download offline pack'], 's.offline.downloading': ['Pobieranie… {p}%', 'Downloading… {p}%'],
  's.offline.ready': ['Pakiet pobrany {date}', 'Pack downloaded {date}'], 's.offline.remove': ['Usuń pakiet', 'Remove pack'], 's.offline.update': ['Aktualizuj', 'Update'], 's.offline.noNet': ['Pobranie pakietu wymaga połączenia z internetem.', 'Downloading the pack requires an internet connection.'],
  's.offline.done': ['Pakiet offline pobrany', 'Offline pack downloaded'], 's.offline.removed': ['Usunięto pakiet offline', 'Offline pack removed'],
  's.privacy': ['Prywatność i zgody (RODO)', 'Privacy & consents (GDPR)'], 's.privacy.text': ['Aplikacja nie wymaga rejestracji – konto zakładasz tylko przy zakupie biletów. Postępy gry, ulubione miejsca, ścieżki i historia skanów są zapisane wyłącznie w tym telefonie. Lokalizacja i Bluetooth służą tylko do pokazywania treści w pobliżu i nie są przesyłane.', 'The app needs no registration – an account is only needed to buy tickets. Game progress, favourites, routes and scan history are stored on this phone only. Location and Bluetooth are only used to show nearby content and are not sent anywhere.'],
  's.privacy.stats': ['Anonimowe statystyki użycia (pomagają rozwijać aplikację)', 'Anonymous usage statistics (help us improve the app)'], 's.privacy.delete': ['Usuń dane lokalne', 'Delete local data'],
  's.privacy.confirm': ['Usunąć postępy gry, kupony, ulubione miejsca, ścieżki, historię skanów i schowek wspomnień z tego telefonu?', 'Delete game progress, coupons, favourites, routes, scan history and memories from this phone?'], 's.privacy.deleted': ['Dane lokalne zostały usunięte', 'Local data deleted'],
  's.testLead': ['Ustaw pozycję (GPS lub symulowaną), stan sieci i kod QR przed aparatem – do testów poza Fabryką.', 'Set your position (GPS or simulated), network and the QR code in front of the camera – for testing away from the Factory.'], 's.testOpen': ['Otwórz tryb testowy', 'Open test mode'], 's.simulator': ['symulator', 'simulator'],
  's.server': ['Serwer: {st} · zmiany w kolejce: {n}', 'Server: {st} · queued changes: {n}'], 's.srv.online': ['połączono', 'connected'], 's.srv.offline': ['brak połączenia', 'offline'], 's.srv.connecting': ['łączenie…', 'connecting…'],
  's.tutorial': ['Pokaż samouczek ponownie', 'Show the tutorial again'], 's.version': ['Wersja aplikacji', 'App version'], 's.textSize': ['Wielkość tekstu: {p}%', 'Text size: {p}%'],
  'a.lead': ['Aplikację można dopasować do swoich potrzeb. Ustawienia działają na wszystkich ekranach.', 'Adjust the app to your needs. Settings apply on every screen.'], 'a.pjm.lead': ['Połącz się wideo z tłumaczem polskiego języka migowego – pomoże w kontakcie z obsługą.', 'Video call a Polish Sign Language interpreter to help you talk to the staff.'],
  'a.pjm.call': ['Połącz z tłumaczem PJM', 'Call a PJM interpreter'], 'a.lector.note': ['Po włączeniu dotknij dowolny tekst lub przycisk, aby go odsłuchać.', 'When on, tap any text or button to hear it.'],
  'k.title': ['Kupony', 'Coupons'], 'k.lead': ['Rabaty u najemców Fabryki. Część kuponów odblokujesz w grze terenowej.', 'Discounts from the Factory’s tenants. Some coupons are unlocked in the field game.'], 'k.claim': ['Odbierz kupon', 'Claim coupon'], 'k.show': ['Pokaż kod', 'Show code'],
  'k.st.available': ['dostępny', 'available'], 'k.st.locked': ['do odblokowania', 'locked'], 'k.st.claimed': ['odebrany', 'claimed'], 'k.st.used': ['wykorzystany', 'used'], 'k.validUntil': ['Ważny do {date}', 'Valid until {date}'],
  'k.code.lead': ['Pokaż kod przy kasie – obsługa zeskanuje go na stanowisku bileterskim.', 'Show this code at the till – staff will scan it.'], 'k.playGame': ['Przejdź do gry', 'Go to the game'], 'k.claimed': ['Kupon odebrany', 'Coupon claimed'], 'k.usedAt': ['Wykorzystany {date}', 'Used {date}'],
  'q.title': ['Quizy', 'Quizzes'], 'q.lead': ['Sprawdź swoją wiedzę o Fabryce i Dąbrowie. Pierwsze podejście daje punkty w grze.', 'Test what you know about the Factory and Dąbrowa. Your first attempt earns game points.'], 'q.questions': ['{n} pytań', '{n} questions'],
  'q.result': ['Wynik: {score}/{total}', 'Score: {score}/{total}'], 'q.start': ['Rozpocznij', 'Start'], 'q.again': ['Zagraj ponownie', 'Play again'], 'q.q': ['Pytanie {n} z {of}', 'Question {n} of {of}'], 'q.check': ['Sprawdź', 'Check'], 'q.next': ['Następne pytanie', 'Next question'],
  'q.finish': ['Zakończ quiz', 'Finish quiz'], 'q.correct': ['Dobrze!', 'Correct!'], 'q.wrong': ['Niestety nie.', 'Not quite.'], 'q.points': ['+{p} pkt w grze', '+{p} game points'], 'q.noPoints': ['Punkty przyznawane są tylko za pierwsze podejście.', 'Points are only awarded for the first attempt.'], 'q.back': ['Wróć do listy', 'Back to list'],
  'n.title': ['Powiadomienia', 'Notifications'], 'n.empty': ['Brak powiadomień', 'No notifications'], 'n.off': ['Powiadomienia są wyłączone w ustawieniach.', 'Notifications are turned off in Settings.'],
  'sr.title': ['Wyszukiwarka', 'Search'], 'sr.ph': ['Szukaj wpisów, miejsc, wydarzeń', 'Search entries, places, events'], 'sr.entries': ['Wpisy', 'Entries'], 'sr.places': ['Miejsca', 'Places'], 'sr.events': ['Wydarzenia', 'Events'], 'sr.none': ['Nic nie znaleziono', 'Nothing found'], 'sr.hint': ['Wpisz co najmniej 2 znaki.', 'Type at least 2 characters.'],
  'so.title': ['Media społecznościowe', 'Social media'], 'so.lead': ['Śledź Fabrykę Pełną Życia i organizacje działające na jej terenie.', 'Follow the Factory and the organisations based here.'], 'so.orgs': ['Organizacje i najemcy', 'Organisations & tenants'], 'so.open': ['Otwieram {name} (w wersji testowej – symulacja)', 'Opening {name} (simulated in the test version)'],
  'i.title': ['Informacje praktyczne', 'Visitor information'], 'i.hours': ['Godziny otwarcia', 'Opening hours'], 'i.address': ['Adres', 'Address'], 'i.contact': ['Kontakt', 'Contact'], 'i.entrances': ['Wejścia', 'Entrances'], 'i.access': ['Dostępność', 'Accessibility'],
  'i.accessText': ['Większość hal i alejek jest dostępna dla osób poruszających się na wózku. Przy kioskach działa pętla indukcyjna, a w aplikacji – lektor, wysoki kontrast i tłumacz PJM.', 'Most halls and paths are wheelchair accessible. Kiosks have induction loops, and the app offers read-aloud, high contrast and a PJM interpreter.'],
  'i.weather': ['Pogoda na miejscu', 'Weather on site'], 'ab.title': ['O aplikacji', 'About the app'], 'ab.text': ['Wirtualny przewodnik po Fabryce Pełnej Życia – treści o historii i przyrodzie, mapa, audioprzewodnik, skaner QR/BLE/AR, gra terenowa oraz system rezerwacji.', 'A virtual guide to the Factory Full of Life – history and nature content, a map, an audio guide, a QR/BLE/AR scanner, a field game and bookings.'],
  'ab.test': ['Wersja testowa prototypu – logowanie, płatności, kamera, Bluetooth, GPS i połączenia wideo są symulowane.', 'Prototype test version – sign-in, payments, camera, Bluetooth, GPS and video calls are simulated.'], 'ab.sources': ['Źródła informacji', 'Sources'], 'ab.platform': ['Platforma: {p}', 'Platform: {p}'],
});

function Row({ icon, title, children }) { return <section class="m-setsec"><h2 class="m-h3">{icon && <Icon name={icon} size={18} />}{title}</h2>{children}</section>; }

function A11yControls({ withPjm }) {
  const { client, set, t } = useClient(); const [pjm, setPjm] = useState(false);
  return (<div class="m-setlist">
    <Switch label={t('c.contrast')} checked={client.contrast === 'high'} onChange={(e) => set({ contrast: e.currentTarget.checked ? 'high' : 'normal' })} />
    <Switch label={t('c.night')} checked={client.theme === 'night'} onChange={(e) => set({ theme: e.currentTarget.checked ? 'night' : 'light' })} />
    <Switch label={t('c.lector')} checked={!!client.lector} onChange={(e) => { if (!e.currentTarget.checked) stopSpeaking(); set({ lector: e.currentTarget.checked }); }} />
    {client.lector && <small class="m-muted">{t('a.lector.note')}</small>}
    <div class="m-fsrow"><span>{t('s.textSize', { p: Math.round((client.fs || 1) * 100) })}</span><IconButton text="A↓" variant="mint" label={t('c.textSmaller')} onClick={() => set({ fs: stepFontScale(client.fs || 1, -1) })} /><IconButton text="A↑" variant="mint" label={t('c.textBigger')} onClick={() => set({ fs: stepFontScale(client.fs || 1, 1) })} /></div>
    {withPjm && <><p class="m-muted">{t('a.pjm.lead')}</p><Button icon="hand" onClick={() => setPjm(true)}>{t('a.pjm.call')}</Button><PjmCall open={pjm} onClose={() => setPjm(false)} where="Aplikacja mobilna" /></>}
  </div>);
}

export function A11yScreen() {
  const { t } = useClient();
  return <Screen title={t('s.a11y')} crumbs={[t('m.settings'), t('s.a11y')]}><p class="m-muted">{t('a.lead')}</p><A11yControls withPjm /></Screen>;
}

export function SettingsScreen({ focus }) {
  const app = useApp(); const { client, set, t, api, toast, lang } = useClient(); const { env } = useEnv(); const s = getState(); const [dl, setDl] = useState(null); const [confirm, setConfirm] = useState(false); const offRef = useRef(null);
  const ids = s.settings.offlineEntryIds || []; const mb = (ids.length * 1.7 + 6.4).toFixed(1);
  useEffect(() => { if (focus === 'offline') setTimeout(() => offRef.current?.scrollIntoView({ block: 'start' }), 50); }, [focus]);
  useEffect(() => {
    if (dl == null) return; if (getState().env.network === 'offline') { setDl(null); toast(t('s.offline.noNet'), 'error'); return; }
    if (dl >= 100) { set({ offlinePack: true, offlinePackAt: new Date().toISOString() }); setDl(null); toast(t('s.offline.done'), 'ok'); return; }
    const tm = setTimeout(() => setDl((p) => Math.min(100, p + (getState().env.network === 'slow' ? 4 : 12))), 180); return () => clearTimeout(tm);
  }, [dl]);
  const wipe = () => { api.game.reset(); for (const f of [...s.player.favorites]) api.visit.toggleFavorite(f); for (const r of [...s.player.customRoutes]) api.visit.deleteRoute(r.id); set({ scans: [], memories: [], pushReadAt: null }); setConfirm(false); toast(t('s.privacy.deleted'), 'ok'); };
  return (<Screen title={t('m.settings')} crumbs={[t('m.tab.home'), t('m.settings')]}>
    <Row icon="languages" title={t('s.lang')}><div class="m-langlist m-langlist--compact" role="radiogroup">{languages().map((l) => <button key={l.code} type="button" role="radio" aria-checked={client.lang === l.code} class={clsx('m-langbtn', client.lang === l.code && 'is-active')} onClick={() => set({ lang: l.code })}><span>{l.name}</span><b>{l.code.toUpperCase()}</b></button>)}</div></Row>
    <Row icon="accessibility" title={t('s.a11y')}><A11yControls /></Row>
    <Row icon="bell" title={t('s.notif')}><div class="m-setlist"><Switch label={t('s.notif.push')} checked={client.notif !== false} onChange={(e) => set({ notif: e.currentTarget.checked })} /></div></Row>
    <Row icon="beacon" title={t('s.beacon')}><div class="m-setlist">
      <Switch label={t('s.beacon.card')} checked={client.autoBeacon !== false} onChange={(e) => set({ autoBeacon: e.currentTarget.checked })} />
      <Switch label={t('s.beacon.audio')} checked={!!client.audioAuto} onChange={(e) => set({ audioAuto: e.currentTarget.checked })} />
      <Switch label={t('s.audioQueue')} checked={client.audioQueue !== false} onChange={(e) => set({ audioQueue: e.currentTarget.checked })} /></div></Row>
    <div ref={offRef}><Row icon="download" title={t('s.offline')}>
      <p class="m-muted">{t('s.offline.lead')}</p>
      <Card variant="mint" class="m-offcard"><CardBody><b>{t('s.offline.pack', { n: ids.length, mb })}</b>
        {dl != null ? <><Progress value={dl} label={t('s.offline.downloading', { p: dl })} /><small role="status">{t('s.offline.downloading', { p: dl })}</small></>
          : client.offlinePack ? <><Tag tone="green" icon="circleCheck">{t('s.offline.ready', { date: fmtDateTime(client.offlinePackAt, lang) })}</Tag><div class="m-btnrow"><Button size="sm" variant="secondary" icon="refresh" disabled={env.network === 'offline'} onClick={() => setDl(0)}>{t('s.offline.update')}</Button><Button size="sm" variant="ghost" icon="trash" onClick={() => { set({ offlinePack: false }); toast(t('s.offline.removed'), 'info'); }}>{t('s.offline.remove')}</Button></div></>
            : <Button icon="download" disabled={env.network === 'offline'} onClick={() => setDl(0)}>{t('s.offline.download')}</Button>}
        {env.network === 'offline' && dl == null && !client.offlinePack && <small>{t('s.offline.noNet')}</small>}</CardBody></Card>
    </Row></div>
    <Row icon="shield" title={t('s.privacy')}><p class="m-muted">{t('s.privacy.text')}</p><div class="m-setlist"><Switch label={t('s.privacy.stats')} checked={client.stats !== false} onChange={(e) => set({ stats: e.currentTarget.checked })} /></div>
      <Button variant="secondary" icon="trash" onClick={() => setConfirm(true)}>{t('s.privacy.delete')}</Button></Row>
    <Row icon="help" title={t('m.d.tutorial')}><Button variant="secondary" icon="play" onClick={app.showTutorial}>{t('s.tutorial')}</Button></Row>
    <Row icon="flag" title={t('tm.title')}><p class="m-muted">{t('s.testLead')}</p><Button variant="secondary" icon="flag" onClick={app.openTestMode}>{t('s.testOpen')}</Button></Row>
    <Row icon="smartphone" title={t('s.version')}><p class="m-muted">{APP_VERSION} · {app.platform === 'android' ? 'Android' : 'iOS'}{app.standalone ? '' : ' · ' + t('s.simulator')}</p>
      {s.net?.mode === 'remote' && <p class="m-netline" role="status"><Icon name={s.net.status === 'online' ? 'wifi' : 'wifiOff'} size={15} />{t('s.server', { st: t('s.srv.' + (s.net.status || 'connecting')), n: s.net.pending || 0 })}</p>}</Row>
    {confirm && <Modal open size="sm" onClose={() => setConfirm(false)} title={t('s.privacy.delete')} closeLabel={t('c.close')} footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>{t('c.cancel')}</Button><Button variant="danger" icon="trash" onClick={wipe}>{t('s.privacy.delete')}</Button></>}><p>{t('s.privacy.confirm')}</p></Modal>}
  </Screen>);
}

export function CouponsScreen({ highlight }) {
  const app = useApp(); const { t, L, api, toast, lang } = useClient(); useEnv(); const s = getState(); const [show, setShow] = useState(null);
  const list = s.coupons.filter((c) => c.active !== false);
  const claim = (c) => { const r = api.game.claimCoupon(c.id); if (!r.ok) { toast(L(r.message), 'error'); return; } toast(t('k.claimed'), 'ok'); setShow(c.id); };
  const cur = show && list.find((c) => c.id === show); const curSt = cur && sel.couponState(cur);
  return (<Screen title={t('k.title')} crumbs={[t('m.tab.home'), t('k.title')]}>
    <p class="m-muted">{t('k.lead')}</p>
    {list.length === 0 ? <Empty icon="coupon" title={t('c.empty')} /> : <div class="m-stack">{list.map((c) => { const st = sel.couponState(c); const v = sel.venue(c.venueId); const mine = s.player.coupons.find((x) => x.couponId === c.id);
      const state = st.used ? 'used' : st.claimed ? 'claimed' : st.available ? 'available' : 'locked';
      return (<Card key={c.id} variant={state === 'available' ? 'mint' : 'plain'} class={clsx('m-coupon', `is-${state}`, highlight === c.id && 'is-hl')}><CardBody>
        <div class="m-coupon__head"><span class="m-coupon__disc">{L(c.discount)}</span><Tag tone={{ available: 'green', claimed: 'deep', used: 'neutral', locked: 'warn' }[state]}>{t('k.st.' + state)}</Tag></div>
        <b>{L(c.title)}</b>{v && <small><Icon name="store" size={13} /> {L(v.name)}</small>}<p>{L(c.description)}</p>
        {state === 'locked' && st.hint && <Notice tone="warn" icon="lock">{L(st.hint)}</Notice>}
        {state === 'used' && mine?.used && <small class="m-muted">{t('k.usedAt', { date: fmtDateTime(mine.used, lang) })}</small>}
        <div class="m-btnrow">{state === 'available' && <Button icon="gift" onClick={() => claim(c)}>{t('k.claim')}</Button>}{state === 'claimed' && <Button icon="qr" onClick={() => setShow(c.id)}>{t('k.show')}</Button>}{state === 'locked' && <Button variant="secondary" icon="game" onClick={() => app.go('game')}>{t('k.playGame')}</Button>}
          {c.validUntil && <small class="m-muted">{t('k.validUntil', { date: fmtDate(c.validUntil, lang) })}</small>}</div>
      </CardBody></Card>); })}</div>}
    {cur && curSt?.claimed && <Modal open variant="sheet" size="sm" onClose={() => setShow(null)} title={L(cur.title)} closeLabel={t('c.close')}>
      <div class="m-share"><span class="m-coupon__disc">{L(cur.discount)}</span><p>{t('k.code.lead')}</p><QR value={'FPZ:K:' + curSt.code} size={190} label={curSt.code} />{curSt.used && <Tag>{t('k.st.used')}</Tag>}</div></Modal>}
  </Screen>);
}

export function QuizzesScreen() {
  const app = useApp(); const { t, L } = useClient(); const s = getState();
  return (<Screen title={t('q.title')} crumbs={[t('m.tab.home'), t('q.title')]}><p class="m-muted">{t('q.lead')}</p>
    {s.quizzes.length === 0 ? <Empty icon="quiz" title={t('c.empty')} /> : <div class="m-stack">{s.quizzes.map((q) => { const r = s.player.quiz[q.id]; return (
      <Card key={q.id} variant={r ? 'plain' : 'mint'} class="m-quizcard"><CardBody><span class="m-quizcard__ico"><Icon name="quiz" size={22} /></span><span class="m-quizcard__txt"><b>{L(q.title)}</b><small>{t('q.questions', { n: q.questions.length })}{r ? ` · ${t('q.result', { score: Math.max(r.score, r.best || 0), total: r.total })} · ${r.points} ${t('c.points')}` : ''}</small></span>
        <Button size="sm" variant={r ? 'secondary' : 'primary'} onClick={() => app.push('quiz', { id: q.id })}>{r ? t('q.again') : t('q.start')}</Button></CardBody></Card>); })}</div>}
  </Screen>);
}

export function QuizScreen({ id }) {
  const app = useApp(); const { t, L, api, toast } = useClient(); const q = sel.quiz(id); const [i, setI] = useState(0); const [ans, setAns] = useState([]); const [pick, setPick] = useState(null); const [checked, setChecked] = useState(false); const [res, setRes] = useState(null);
  if (!q) return <Screen title="—"><Empty title={t('c.empty')} /></Screen>;
  const qq = q.questions[i]; const last = i === q.questions.length - 1;
  const check = () => { setChecked(true); setAns((a) => { const b = [...a]; b[i] = pick; return b; }); };
  const next = () => { if (last) { const r = api.game.submitQuiz(id, ans); if (!r.ok) { toast(L(r.message), 'error'); return; } setRes(r); } else { setI(i + 1); setPick(null); setChecked(false); } };
  return (<Screen title={L(q.title)} crumbs={[t('q.title'), L(q.title)]}>
    {res ? <div class="m-quizres" role="status"><span class="m-quizres__score">{res.score}/{res.total}</span><h2>{t('q.result', { score: res.score, total: res.total })}</h2><p>{res.first ? t('q.points', { p: res.points }) : t('q.noPoints')}</p>
      <ol class="m-quizres__list">{q.questions.map((x, k) => <li key={x.id} class={res.results[k] ? 'is-ok' : 'is-bad'}><Icon name={res.results[k] ? 'circleCheck' : 'circleX'} size={16} />{L(x.q)}</li>)}</ol>
      <Button block onClick={app.pop}>{t('q.back')}</Button></div>
      : <div class="m-quiz" key={i}><Progress value={i + (checked ? 1 : 0)} max={q.questions.length} label={t('q.q', { n: i + 1, of: q.questions.length })} /><small class="m-kicker">{t('q.q', { n: i + 1, of: q.questions.length })}</small><h2>{L(qq.q)}</h2>
        <div class="m-quiz__answers" role="radiogroup">{qq.answers.map((a, k) => <button key={k} type="button" role="radio" aria-checked={pick === k} disabled={checked} class={clsx('m-quiz__a', pick === k && 'is-picked', checked && k === qq.correct && 'is-ok', checked && pick === k && k !== qq.correct && 'is-bad')} onClick={() => setPick(k)}><span>{'ABCD'[k]}</span>{L(a)}</button>)}</div>
        {checked && <Notice tone={pick === qq.correct ? 'ok' : 'warn'}><b>{t(pick === qq.correct ? 'q.correct' : 'q.wrong')}</b> {L(qq.explain)}</Notice>}
        {!checked ? <Button block disabled={pick == null} onClick={check}>{t('q.check')}</Button> : <Button block iconRight="arrowRight" onClick={next}>{last ? t('q.finish') : t('q.next')}</Button>}</div>}
  </Screen>);
}

export function NotificationsScreen() {
  const { t, client, set, lang } = useClient(); const list = sel.pushFor('mobile');
  useEffect(() => { set({ pushReadAt: new Date().toISOString() }); }, [list.length]);
  return (<Screen title={t('n.title')} crumbs={[t('m.tab.home'), t('n.title')]}>
    {client.notif === false && <Notice tone="warn">{t('n.off')}</Notice>}
    {list.length === 0 ? <Empty icon="bell" title={t('n.empty')} /> : <ul class="m-notifs">{list.map((n) => <li key={n.id}><span class="m-notifs__ico"><Icon name="bell" size={18} /></span><span><b>{n.subject}</b>{n.body && <p>{n.body}</p>}<small>{fmtDateTime(n.at, lang)}</small></span></li>)}</ul>}
  </Screen>);
}

export function SearchScreen() {
  const app = useApp(); const { t, L, lang } = useClient(); const [q, setQ] = useState(''); const ok = q.trim().length >= 2;
  const entries = ok ? sel.entries({ q, channel: 'mobile' }) : []; const places = ok ? sel.pois({ q }) : []; const events = ok ? sel.events().filter((e) => matches(q, e.title.pl, e.title.en, e.description?.pl, e.description?.en)) : [];
  return (<Screen title={t('sr.title')} crumbs={[t('m.tab.home'), t('sr.title')]} below={<SearchInput value={q} onInput={setQ} placeholder={t('sr.ph')} autoFocus />}>
    {!ok ? <p class="m-muted">{t('sr.hint')}</p> : entries.length + places.length + events.length === 0 ? <Empty icon="search" title={t('sr.none')} /> : <div class="m-stack">
      {entries.length > 0 && <><SectionHead title={`${t('sr.entries')} (${entries.length})`} /><div class="m-list">{entries.slice(0, 8).map((e) => <EntryCard key={e.id} entry={e} layout="list" onClick={() => app.openEntry(e.id)} />)}</div></>}
      {places.length > 0 && <><SectionHead title={`${t('sr.places')} (${places.length})`} /><ul class="m-list">{places.slice(0, 8).map((p) => <li key={p.id}><PoiRow poi={p} onClick={() => app.openPoi(p.id)} /></li>)}</ul></>}
      {events.length > 0 && <><SectionHead title={`${t('sr.events')} (${events.length})`} /><ul class="m-list">{events.slice(0, 6).map((e) => <li key={e.id}><button type="button" class="m-linkrow" onClick={() => app.openReservation({ view: 'event', id: e.id })}><Icon name="calendar" size={16} /><span>{L(e.title)}<small> · {fmtDay(e.start, lang)} {fmtTime(e.start, lang)}</small></span><Icon name="arrowRight" size={16} /></button></li>)}</ul></>}
    </div>}
  </Screen>);
}

const SOCIAL_ICON = { facebook: 'thumbsUp', instagram: 'camera', youtube: 'video', tiktok: 'music', linkedin: 'idCard' };
export function SocialScreen() {
  const { t, L, toast } = useClient(); const s = getState(); const venues = s.venues.filter((v) => v.active !== false && v.contact?.www).slice(0, 8);
  const open = (name) => toast(t('so.open', { name }), 'info');
  return (<Screen title={t('so.title')} crumbs={[t('m.tab.community'), t('so.title')]}><p class="m-muted">{t('so.lead')}</p>
    <div class="m-social">{(s.site.social || []).map((x) => <button key={x.url} type="button" class="m-social__btn" onClick={() => open(x.label)}><span><Icon name={SOCIAL_ICON[x.kind] || 'share'} size={22} /></span><b>{x.label}</b><Icon name="external" size={14} /></button>)}</div>
    {venues.length > 0 && <><SectionHead title={t('so.orgs')} /><ul class="m-list">{venues.map((v) => <li key={v.id}><button type="button" class="m-linkrow" onClick={() => open(L(v.name))}><Icon name="store" size={16} /><span>{L(v.name)}<small> · {v.contact.www.replace(/^https?:\/\//, '')}</small></span><Icon name="external" size={14} /></button></li>)}</ul></>}
  </Screen>);
}

export function InfoScreen() {
  const app = useApp(); const { t, L } = useClient(); const s = getState(); const site = s.site; const w = s.env.weather;
  return (<Screen title={t('i.title')} crumbs={[t('m.tab.home'), t('i.title')]}>
    <div class="m-stack">
      <Card variant="mint"><CardBody><h2 class="m-h3"><Icon name="clock" size={18} />{t('i.hours')}</h2><p>{L(site.hours)}</p></CardBody></Card>
      <Card><CardBody><h2 class="m-h3"><Icon name="mapPin" size={18} />{t('i.address')}</h2><p>{site.address}</p>
        {(s.sitePlan.entrances || []).length > 0 && <><b>{t('i.entrances')}</b><ul class="m-bullets">{s.sitePlan.entrances.map((e, k) => <li key={k}>{L(e.name)}</li>)}</ul></>}
        <Button size="sm" variant="secondary" icon="map" onClick={() => app.go('map')}>{t('m.tab.map')}</Button></CardBody></Card>
      <Card><CardBody><h2 class="m-h3"><Icon name="phone" size={18} />{t('i.contact')}</h2><p><a href={`tel:${site.contact.phone.replace(/\s/g, '')}`}>{site.contact.phone}</a><br /><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a><br />{site.contact.www}</p></CardBody></Card>
      <Card><CardBody><h2 class="m-h3"><Icon name="accessibility" size={18} />{t('i.access')}</h2><p>{t('i.accessText')}</p><Button size="sm" variant="secondary" onClick={() => app.push('a11y')}>{t('s.a11y')}</Button></CardBody></Card>
      {w && <Card variant="outline"><CardBody><h2 class="m-h3"><Icon name={{ sunny: 'sun', rain: 'cloudRain', snow: 'snow' }[w.kind] || 'cloudSun'} size={18} />{t('i.weather')}</h2><p>{w.tempC}°C · {w.wind} km/h</p></CardBody></Card>}
    </div>
  </Screen>);
}

export function AboutScreen() {
  const app = useApp(); const { t, L } = useClient(); const s = getState();
  return (<Screen title={t('ab.title')} crumbs={[t('m.tab.home'), t('ab.title')]}>
    <div class="m-about"><Logo /><b>{t('m.appName')}</b><small>{t('m.version', { v: APP_VERSION })} · {t('ab.platform', { p: app.platform === 'android' ? 'Android 8+' : 'iOS 13+' })}</small></div>
    <p>{t('ab.text')}</p><Notice tone="info">{t('ab.test')}</Notice>
    {(s.site.sources || []).length > 0 && <><SectionHead title={t('ab.sources')} /><ul class="m-bullets m-sources">{s.site.sources.map((x) => <li key={x.url}>{x.title}</li>)}</ul></>}
  </Screen>);
}
