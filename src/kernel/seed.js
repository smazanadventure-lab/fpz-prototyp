// Stan początkowy „bazy danych”: treści przykładowe (src/content) + dane systemowe (urządzenia, konta, wyzwalacze QR/BLE/AR).
import * as C from '../content/index.js';
import { addDays, localIso, deepClone, dayStr, pad2 } from './util.js';

const L = (pl, en) => ({ pl, en });
export const KIOSKS = [
  { id: 'TZ.T1.1', poiId: 'hala-zielona', variant: 'info', name: 'Hala Zielona' },
  { id: 'TZ.T1.2', poiId: 'pasaz-reden', variant: 'info', name: 'Pasaż Reden' },
  { id: 'TZ.T1.3', poiId: 'fabryka-wczoraj-i-dzis', variant: 'info', name: 'Fabryka wczoraj i dziś' },
  { id: 'TZ.T1.4', poiId: 'hala-tworzen', variant: 'info', name: 'Hala Tworzeń' },
  { id: 'TZ.T1.5', poiId: 'hala-zabkowice', variant: 'sound', name: 'Hala Ząbkowice – Dźwięki miasta' },
];

/** Wersja układu danych – po zmianie serwer pilotażowy zakłada dane od nowa. */
export const SEED_SCHEMA = 3;
/** Dane zaplecza – nie trafiają do aplikacji dla zwiedzających (kompilacja z globalThis.FPZ_APP_ONLY) i serwer ich jej nie wysyła. */
export const BACKOFFICE_KEYS = ['staff', 'audit', 'devices', 'zones', 'playlists', 'schedules', 'incidents', 'alertRules', 'stats', 'apiLog', 'players'];
export const defaultPlayer = () => ({ nick: 'Odkrywca', profile: { age: 'adult', difficulty: 'medium', mode: 'standard' }, activeRoute: null, done: {}, quiz: {}, rewards: [], coupons: [], favorites: [], customRoutes: [], pending: [], ideaBonus: 0 });

export function makeSeed() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const at = (dayOffset, time = '12:00') => { const d = addDays(today, dayOffset); const [h, m] = time.split(':'); d.setHours(+h, +m, 0, 0); return localIso(d); };
  const rnd = (() => { let s = 20261124; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; })();
  const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));

  const pois = deepClone(C.pois).map((p) => ({ ...p, active: true }));
  const fpzPois = pois.filter((p) => p.scope === 'fpz');
  const entries = deepClone(C.entries).map((e, i) => ({ ...e, status: 'published', updatedAt: at(-ri(2, 40), '10:00'), author: i % 3 ? 'redaktor' : 'admin', views: ri(40, 900) }));
  const events = deepClone(C.events).map((e) => { const start = at(e.dayOffset, e.time); const end = localIso(new Date(new Date(start).getTime() + (e.durationMin || 90) * 60000)); return { ...e, start, end, sold: e.ticketed ? ri(5, Math.floor((e.capacity || 100) * 0.6)) : 0, active: true }; });
  const news = deepClone(C.news).map((n) => ({ ...n, date: at(n.dayOffset, '09:00'), status: 'published' }));
  const products = deepClone(C.products).map((p) => ({ ...p, active: true }));
  const coupons = deepClone(C.coupons).map((c) => ({ ...c, validUntil: at(c.validDays || 60), active: true }));
  const gameRoutes = deepClone(C.gameRoutes).map((r) => ({ ...r, active: true, missions: r.missions.map((m) => { const p = pois.find((x) => x.id === m.poiId); return { ...m, radiusM: p?.scope === 'fpz' ? 35 : 180, active: true }; }) }));

  // Wyzwalacze: kody QR, nadajniki BLE (beacony), punkty AR
  const triggers = []; let q = 100, b = 200, a = 300;
  const UUID = 'F0018B9B-7509-4C31-A905-1A27D39C003C';
  for (const p of fpzPois) {
    triggers.push({ id: `qr-${p.id}`, kind: 'qr', code: `FPZ-Q-${++q}`, label: p.name.pl, target: { type: 'poi', id: p.id }, poiId: p.id, active: true, scans: ri(20, 400) });
    triggers.push({ id: `ble-${p.id}`, kind: 'ble', code: `FPZ-B-${++b}`, label: `Beacon – ${p.name.pl}`, target: { type: 'poi', id: p.id }, poiId: p.id, active: true, scans: ri(50, 900), ble: { uuid: UUID, major: 100, minor: b, rangeM: p.kind === 'hall' ? 30 : 12, txPower: -59, battery: ri(55, 100) } });
  }
  for (const r of gameRoutes) for (const m of r.missions) {
    const p = pois.find((x) => x.id === m.poiId);
    if (m.kind === 'qr') triggers.push({ id: `qr-m-${m.id}`, kind: 'qr', code: `FPZ-Q-${++q}`, label: `Gra: ${m.title.pl}`, target: { type: 'mission', id: m.id }, poiId: m.poiId, active: true, scans: ri(5, 120) });
    if (m.kind === 'ble') triggers.push({ id: `ble-m-${m.id}`, kind: 'ble', code: `FPZ-B-${++b}`, label: `Gra: ${m.title.pl}`, target: { type: 'mission', id: m.id }, poiId: m.poiId, active: true, scans: ri(5, 120), ble: { uuid: UUID, major: 200, minor: b, rangeM: p?.scope === 'fpz' ? 15 : 40, txPower: -59, battery: ri(55, 100) } });
    if (m.kind === 'ar') triggers.push({ id: `ar-m-${m.id}`, kind: 'ar', code: `FPZ-A-${++a}`, label: `Gra AR: ${m.title.pl}`, target: { type: 'mission', id: m.id }, poiId: m.poiId, active: true, scans: ri(5, 90), ar: { marker: 'wzorzec na tablicy', scene: p?.kind === 'hall' ? 'hall' : 'plaza', overlay: r.id === 'future' ? 'future' : 'info', modelId: null } });
  }
  for (const e of entries) { const m3 = (e.media || []).find((x) => x.type === 'model3d'); if (m3) triggers.push({ id: `ar-e-${e.id}`, kind: 'ar', code: `FPZ-A-${++a}`, label: `AR: ${e.title.pl}`, target: { type: 'entry', id: e.id }, poiId: e.poiId, active: true, scans: ri(5, 90), ar: { marker: 'wzorzec na eksponacie', scene: 'hall', overlay: 'model', modelId: m3.modelId || 'lathe' } }); }

  // Konta klientów systemu rezerwacji + przykładowe zamówienie
  const users = [{ id: 'u-demo', email: 'anna.kowalska@example.com', name: 'Anna Kowalska', password: 'demo1234', phone: '+48 600 000 000', createdAt: at(-30), consents: { terms: true, marketing: false } }];
  const orders = []; const tickets = [];
  const evT = events.find((e) => e.ticketed && e.dayOffset >= 0); const prT = evT && products.find((p) => p.eventId === evT.id);
  if (prT) {
    orders.push({ id: 'ord-demo1', no: `FPZ/${today.getFullYear()}/000101`, userId: 'u-demo', channel: 'web', createdAt: at(-1, '18:42'), status: 'paid', total: prT.price * 2,
      items: [{ productId: prT.id, name: prT.name, unitPrice: prT.price, qty: 2, eventId: evT.id }], payment: { operator: 'Operator płatności (sandbox)', method: 'blik', txId: 'TX-DEMO-0001', sca: true, at: at(-1, '18:43') } });
    for (let i = 0; i < 2; i++) tickets.push({ id: `tic-demo${i + 1}`, code: `DEMO${i + 1}K7P2X`, orderId: 'ord-demo1', userId: 'u-demo', productId: prT.id, productName: prT.name, eventId: evT.id, validFrom: evT.start, status: 'valid', usedAt: null, gate: null });
    evT.sold += 2;
  }
  const venueQ = C.venues.find((v) => v.acceptsInquiries);
  const inquiries = venueQ ? [{ id: 'inq-demo1', userId: 'u-demo', venueId: venueQ.id, date: at(6, '17:00'), people: 8, message: 'Dzień dobry, czy jest możliwość rezerwacji stolika dla 8 osób?', status: 'new', reply: null, createdAt: at(-1, '11:05'), channel: 'mobile' }] : [];

  // Personel (CMS, system zarządzania, bileter)
  const staff = globalThis.FPZ_APP_ONLY ? [] : [
    { id: 's-admin', login: 'admin', password: 'admin', name: 'Administrator systemu', role: 'admin', email: 'admin@fpz.example', active: true },
    { id: 's-redaktor', login: 'redaktor', password: 'redaktor', name: 'Marta – redakcja treści', role: 'editor', email: 'redakcja@fpz.example', active: true },
    { id: 's-moderator', login: 'moderator', password: 'moderator', name: 'Paweł – moderacja', role: 'moderator', email: 'moderacja@fpz.example', active: true },
    { id: 's-bileter', login: 'bileter', password: 'bileter', name: 'Kasa / bileter', role: 'cashier', email: 'kasa@fpz.example', active: true },
    { id: 's-technik', login: 'technik', password: 'technik', name: 'Tomasz – służby techniczne', role: 'technician', email: 'technik@fpz.example', active: true },
  ];

  // Urządzenia ekspozycji (System Zarządzania Ekspozycją i Infrastrukturą IT)
  const zones = globalThis.FPZ_APP_ONLY ? [] : [
    { id: 'z-zielona', name: 'Hala Zielona' }, { id: 'z-reden', name: 'Pasaż Reden' }, { id: 'z-plac', name: 'Plac – Fabryka wczoraj i dziś' },
    { id: 'z-tworzen', name: 'Hala Tworzeń' }, { id: 'z-zabkowice', name: 'Hala Ząbkowice' }, { id: 'z-zaplecze', name: 'Zaplecze techniczne' },
  ];
  const zoneOf = { 'TZ.T1.1': 'z-zielona', 'TZ.T1.2': 'z-reden', 'TZ.T1.3': 'z-plac', 'TZ.T1.4': 'z-tworzen', 'TZ.T1.5': 'z-zabkowice' };
  const dev = (id, name, kind, zone, extra = {}) => ({ id, name, kind, zone, ip: `10.20.${zones.findIndex((z) => z.id === zone) + 1}.${ri(11, 240)}`, mac: Array.from({ length: 6 }, () => pad2(ri(0, 255).toString(16)).toUpperCase()).join(':'),
    model: { kiosk: 'Monitor dotykowy 55″ + player PC', lcd: 'Monitor LCD 65″ + player sieciowy', projector: 'Projektor laserowy 7000 lm', audio: 'Wzmacniacz strefowy + głośniki', light: 'Sterownik oświetlenia DALI', server: 'Serwer treści', network: 'Przełącznik sieciowy PoE' }[kind],
    power: 'on', schedule: 'auto', night: false, appVersion: '0.9.3-test', playlistId: null, volume: 60, brightness: 80, tempC: ri(38, 52), cpu: ri(6, 30), uptimeH: ri(4, 300), lastSeen: new Date().toISOString(), touchesToday: kind === 'kiosk' ? ri(40, 320) : 0, ...extra });
  const devices = globalThis.FPZ_APP_ONLY ? [] : [
    ...KIOSKS.map((k) => dev(k.id, `Kiosk „${k.name}”`, 'kiosk', zoneOf[k.id], { poiId: k.poiId, variant: k.variant, heightMode: 'child', accessories: k.variant === 'sound' ? ['słuchawka wandaloodporna', 'pętla indukcyjna', 'przyciski zmiany ścieżki'] : ['pętla indukcyjna'] })),
    dev('LCD-01', 'Ekran napisów na żywo – scena', 'lcd', 'z-zabkowice', { playlistId: 'pl-scena' }),
    dev('LCD-02', 'Ekran informacyjny – wejście główne', 'lcd', 'z-reden', { playlistId: 'pl-info' }),
    dev('PRJ-01', 'Projekcja „Fabryka wczoraj i dziś”', 'projector', 'z-plac', { playlistId: 'pl-archiwum' }),
    dev('AUD-01', 'Nagłośnienie strefowe – Hala Ząbkowice', 'audio', 'z-zabkowice', { volume: 45 }),
    dev('LGT-01', 'Oświetlenie ekspozycyjne', 'light', 'z-zabkowice', { brightness: 70 }),
    dev('SRV-01', 'Serwer treści i sterowania', 'server', 'z-zaplecze', { schedule: 'always' }),
    dev('NET-01', 'Przełącznik sieci LAN ekspozycji', 'network', 'z-zaplecze', { schedule: 'always' }),
  ];
  const vid = C.videos;
  const playlists = globalThis.FPZ_APP_ONLY ? [] : [
    { id: 'pl-info', name: 'Informator – pętla dzienna', items: [
      { id: 'pi-1', type: 'events', title: 'Najbliższe wydarzenia', durationSec: 12 }, { id: 'pi-2', type: 'video', title: vid[0]?.title.pl || 'Film', ref: vid[0]?.id, durationSec: 15 },
      { id: 'pi-3', type: 'news', title: 'Aktualności', durationSec: 10 }, { id: 'pi-4', type: 'image', title: 'Plan terenu FPŻ', ref: 'city-panorama', durationSec: 8 },
      { id: 'pi-5', type: 'ticker', title: 'Pasek informacyjny', text: 'Witamy w Fabryce Pełnej Życia · Pobierz aplikację i zagraj w grę terenową · Bilety kupisz w aplikacji i na stronie WWW', durationSec: 0 }] },
    { id: 'pl-scena', name: 'Scena – transmisja i napisy na żywo', items: [{ id: 'ps-1', type: 'captions', title: 'Napisy na żywo (symultaniczny przekaz tekstowy)', durationSec: 0 }, { id: 'ps-2', type: 'events', title: 'Program dnia', durationSec: 10 }] },
    { id: 'pl-archiwum', name: 'Filmy archiwalne – pętla', items: vid.filter((v) => v.kind === 'archive').slice(0, 4).map((v, i) => ({ id: `pa-${i}`, type: 'video', title: v.title.pl, ref: v.id, durationSec: 20 })) },
  ];
  const schedules = globalThis.FPZ_APP_ONLY ? [] : [
    { id: 'sch-open', name: 'Godziny pracy ekspozycji', kind: 'power', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '22:00', targets: ['all'], active: true },
    { id: 'sch-night', name: 'Tryb nocny kiosków zewnętrznych', kind: 'night', days: [0, 1, 2, 3, 4, 5, 6], from: '18:00', to: '06:00', targets: KIOSKS.map((k) => k.id), active: true },
    { id: 'sch-service', name: 'Okno serwisowe (2× w miesiącu)', kind: 'service', days: [2], from: '22:30', to: '23:59', targets: ['SRV-01'], active: false },
  ];
  const incidents = globalThis.FPZ_APP_ONLY ? [] : [
    { id: 'inc-1', deviceId: 'TZ.T1.4', title: 'Brak reakcji nakładki dotykowej', severity: 'P3', status: 'closed', createdAt: at(-6, '09:12'), reactedAt: at(-6, '09:40'), resolvedAt: at(-5, '13:05'), note: 'Wymieniono kontroler nakładki, kalibracja wykonana.', source: 'monitoring' },
    { id: 'inc-2', deviceId: 'LCD-02', title: 'Przekroczona temperatura pracy (58°C)', severity: 'P4', status: 'closed', createdAt: at(-3, '14:30'), reactedAt: at(-3, '15:10'), resolvedAt: at(-2, '10:00'), note: 'Wyczyszczono filtry wentylacji.', source: 'monitoring' },
  ];
  const alertRules = globalThis.FPZ_APP_ONLY ? [] : [
    { id: 'ar-1', name: 'Awaria stanowiska → e-mail do służb technicznych', event: 'fault', channel: 'email', recipient: 'technik@fpz.example', active: true },
    { id: 'ar-2', name: 'Awaria krytyczna (P1/P2) → SMS do dyżurnego', event: 'fault-critical', channel: 'sms', recipient: '+48 600 000 111', active: true },
    { id: 'ar-3', name: 'Urządzenie offline > 5 min → e-mail', event: 'offline', channel: 'email', recipient: 'technik@fpz.example', active: true },
  ];

  // Statystyki (30 dni)
  const daily = globalThis.FPZ_APP_ONLY ? [] : Array.from({ length: 30 }, (_, i) => { const d = addDays(today, i - 29); const wk = [0, 6].includes(d.getDay()) ? 1.7 : 1; return { date: dayStr(d), app: Math.round(ri(90, 160) * wk), web: Math.round(ri(220, 420) * wk), kiosk: Math.round(ri(300, 520) * wk), qr: Math.round(ri(40, 90) * wk), ble: Math.round(ri(60, 140) * wk), ar: Math.round(ri(15, 45) * wk), tickets: Math.round(ri(8, 30) * wk) }; });

  return {
    settings: {
      logo: null, languages: [{ code: 'pl', name: 'Polski', enabled: true }, { code: 'en', name: 'English', enabled: true }], defaultLang: 'pl',
      moderation: true, payments: { operator: 'Operator płatności (sandbox)', methods: ['blik', 'card', 'transfer'] },
      offlineEntryIds: entries.filter((e) => e.poiId && fpzPois.some((p) => p.id === e.poiId)).map((e) => e.id),
    },
    i18n: { overrides: { pl: {}, en: {} } },
    site: deepClone(C.site), sitePlan: deepClone(C.sitePlan), districts: deepClone(C.districts), eras: deepClone(C.eras),
    pois, categories: deepClone(C.categories), entries, news, videos: deepClone(C.videos), gallery: deepClone(C.gallery), media: [],
    venues: deepClone(C.venues).map((v) => ({ ...v, active: true })), events, products, coupons,
    gameRoutes, quizzes: deepClone(C.quizzes), rewards: deepClone(C.rewards).map((r) => ({ ...r, active: true })), ideaCategories: deepClone(C.ideaCategories), futureHotspots: deepClone(C.futureHotspots),
    ideas: deepClone(C.sampleIdeas).map((i, n) => ({ ...i, createdAt: at(-ri(1, 20), '12:00'), device: 'seed', mine: false })),
    triggers,
    users, orders, tickets, inquiries,
    player: defaultPlayer(),
    leaderboard: [{ nick: 'Zagłębiak_77', points: 1180 }, { nick: 'Sztygar', points: 940 }, { nick: 'Rodzina Nowaków', points: 815 }, { nick: 'PogoriaTeam', points: 640 }, { nick: 'klasa 6b', points: 525 }, { nick: 'Reden1796', points: 410 }, { nick: 'Ola i Kuba', points: 260 }],
    gameStats: { missionsDone: ri(900, 1500), byRoute: { nature: ri(200, 400), industry: ri(150, 300), history: ri(250, 450), future: ri(120, 260) }, playersSynced: ri(180, 320) },
    staff, audit: globalThis.FPZ_APP_ONLY ? [] : [{ at: at(-1, '16:20'), staffId: 's-redaktor', action: 'Edycja wpisu', target: entries[0]?.title.pl || '' }, { at: at(-2, '09:05'), staffId: 's-admin', action: 'Publikacja wpisu', target: entries[1]?.title.pl || entries[0]?.title.pl || '' }],
    outbox: [{ id: 'out-1', at: at(-1, '18:43'), kind: 'email', to: 'anna.kowalska@example.com', subject: 'Twoje bilety – Fabryka Pełna Życia', body: 'Dziękujemy za zakup. Bilety z kodami QR znajdziesz w załączniku oraz w aplikacji.' }],
    devices, zones, playlists, schedules, incidents, alertRules,
    live: { onAir: false, title: L('Transmisja z wirtualnego studia', 'Live from the virtual studio'), startedAt: null, captions: [], viewers: 0 },
    pjmCalls: [],
    stats: { daily, scans: { qr: 0, ble: 0, ar: 0 }, validations: [] },
    clients: {},
    env: { position: { lat: C.site.lat, lng: C.site.lng, poiId: null }, network: 'online', qrInView: null, arInView: null, simTime: null, weather: { tempC: 4, kind: 'cloudy', wind: 12 } },
    apiLog: [],
  };
}
