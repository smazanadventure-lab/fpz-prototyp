// Pełny przebieg: logowanie, jeden przycisk, pojedynczy kiosk, symulacja godzin, awaria → SLA, playlisty, harmonogram, transmisja, raport, tablet.
const R = '.ep-mgmt';
const S = (page, fn, ...a) => page.evaluate(fn, ...a);
const st = (page) => S(page, () => { const s = window.__fpzMgmt.getState(); return { dev: Object.fromEntries(s.devices.map((d) => [d.id, { p: d.power, n: d.night, s: d.schedule, pl: d.playlistId }])), inc: s.incidents.map((i) => ({ id: i.id, st: i.status, d: i.deviceId })), out: s.outbox.map((o) => o.kind + ':' + o.subject), live: { on: s.live.onAir, caps: s.live.captions.length }, sch: s.schedules.length, pl: s.playlists.find((p) => p.id === 'pl-info').items.map((i) => i.type), env: s.env.simTime }; });
const nav = async (page, label) => { await page.click(`${R} .x-nav__it:has-text("${label}")`); await page.waitForTimeout(250); };
const check = (cond, msg) => { if (!cond) throw new Error('ASERCJA: ' + msg); console.log('ok –', msg); };
export default async (page, { shot }) => {
  await page.evaluate(() => localStorage.clear());
  check(await page.inputValue(`${R} input[name=x-login]`) === 'technik' && await page.inputValue(`${R} input[name=x-pass]`) === 'technik', 'logowanie: wypełnione technik / technik');
  await shot('login-mgmt');
  await page.click('[data-testid=x-login-acc-admin]'); await page.waitForTimeout(100);
  check(await page.inputValue(`${R} input[name=x-login]`) === 'admin' && !(await page.$(`${R} .x-hero`)), 'szybki wybór wpisuje dane admin (bez logowania)');
  await page.click('[data-testid=x-login-acc-technik]'); await page.click('[data-testid=x-login-submit]'); await page.waitForTimeout(300);
  check(await page.$(`${R} .x-hero`), 'zalogowano – pulpit');
  // jeden przycisk – wyłącz
  await page.click('[data-testid=x-powerall]'); await page.click('[data-testid=x-confirm]'); await page.waitForTimeout(700);
  await shot('mgmt-seq');
  await page.waitForSelector('[data-testid=x-seq-close]', { timeout: 6000 }); await page.click('[data-testid=x-seq-close]');
  let s = await st(page);
  check(['TZ.T1.1', 'LCD-01', 'PRJ-01', 'LGT-01'].every((k) => s.dev[k].p === 'off') && s.dev['SRV-01'].p === 'on', 'cała ekspozycja wyłączona (serwer pracuje)');
  await shot('mgmt-off');
  await page.click('[data-testid=x-powerall]'); await page.click('[data-testid=x-confirm]');
  await page.waitForSelector('[data-testid=x-seq-close]', { timeout: 6000 }); await page.click('[data-testid=x-seq-close]');
  s = await st(page); check(Object.values(s.dev).every((d) => d.p === 'on'), 'cała ekspozycja uruchomiona');
  // pojedynczy kiosk: wyłącz, serwis
  await page.click(`${R} .x-zdev[data-dev="TZ.T1.2"]`); await page.waitForTimeout(250);
  await page.click('[data-testid=x-dev-off]'); s = await st(page); check(s.dev['TZ.T1.2'].p === 'off' && s.dev['TZ.T1.1'].p === 'on', 'wyłączono pojedynczy kiosk, pozostałe działają');
  await page.click('[data-testid=x-dev-service]'); s = await st(page); check(s.dev['TZ.T1.2'].p === 'service', 'kiosk w trybie serwisowym');
  await shot('mgmt-device');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // przywróć harmonogram i symuluj godziny
  await page.click('[data-testid=x-auto-all]');
  await page.click('[data-testid="x-sim-23:30"]'); await page.waitForTimeout(300);
  s = await st(page); check(s.env === '23:30' && s.dev['TZ.T1.1'].p === 'off' && s.dev['TZ.T1.1'].n && s.dev['LCD-01'].p === 'off' && s.dev['SRV-01'].p === 'on' && s.dev['TZ.T1.2'].p === 'service', '23:30 – wyłączenie nocne, tryb nocny, serwis bez zmian');
  await shot('mgmt-night');
  await page.click('[data-testid="x-sim-12:00"]'); await page.waitForTimeout(300);
  s = await st(page); check(s.dev['TZ.T1.1'].p === 'on' && !s.dev['TZ.T1.1'].n && s.dev['LCD-01'].p === 'on', '12:00 – urządzenia pracują w dzień');
  // awaria
  const out0 = s.out.length;
  await page.click(`${R} .x-zdev[data-dev="LCD-02"]`); await page.waitForTimeout(200);
  await page.click('[data-testid=x-dev-fault]'); await page.selectOption(`${R} .fpz-modal--sm select >> nth=1`, 'P2'); await page.click('[data-testid=x-fault-go]'); await page.waitForTimeout(200);
  s = await st(page); check(s.dev['LCD-02'].p === 'fault' && s.inc[0].st === 'open' && s.out.length >= out0 + 2 && s.out.some((o) => o.startsWith('sms:')), 'awaria → zgłoszenie + e-mail i SMS');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await shot('mgmt-fault-map');
  await nav(page, 'Awarie'); await shot('mgmt-incidents');
  await page.click(`${R} [data-testid=x-inc-ack]`); s = await st(page); check(s.inc[0].st === 'in_progress', 'przyjęto zgłoszenie');
  await page.click(`${R} [data-testid=x-inc-close]`); await page.fill('[data-testid=x-inc-note]', 'Wymieniono kabel HDMI.'); await page.click('[data-testid=x-inc-resolve]'); await page.waitForTimeout(200);
  s = await st(page); check(s.inc[0].st === 'closed' && s.dev['LCD-02'].p === 'on', 'zamknięto zgłoszenie – urządzenie wraca do pracy');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=x-inc-csv]')]);
  check(/raport-usterek-.*\.csv/.test(dl.suggestedFilename()), 'raport CSV pobrany: ' + dl.suggestedFilename());
  await page.click('[data-testid=x-bk-test]'); await page.waitForTimeout(1900); check((await page.textContent('[data-testid=x-bk-last]')).includes('OK'), 'test odtworzeniowy');
  check(await S(page, () => window.__fpzMgmt.getState().audit.some((x) => x.action === 'Test odtworzeniowy kopii zapasowej' && x.client === 'mgmt')), 'test odtworzeniowy w dzienniku zdarzeń (api.sys.audit)');
  await page.click('[data-testid=x-inc-new]'); await page.fill('[data-testid=x-rep-title]', 'Test: brak dźwięku'); await page.click('[data-testid=x-rep-save]'); await page.waitForTimeout(300);
  const mi = await S(page, () => { const s = window.__fpzMgmt.getState(); const i = s.incidents[0]; return { t: i.title, src: i.source, p: s.devices.find((d) => d.id === i.deviceId).power, log: s.apiLog.some((l) => l.path === '/api/v1/incidents' && l.method === 'POST') }; });
  check(mi.t === 'Test: brak dźwięku' && mi.src === 'zgłoszenie ręczne' && mi.p !== 'fault' && mi.log, 'ręczne zgłoszenie usterki (api.devices.reportIncident, bez zatrzymania)');
  await shot('mgmt-incidents-closed');
  await nav(page, 'Powiadomienia'); await shot('mgmt-alerts');
  // playlisty
  await nav(page, 'Treści');
  await page.click(`${R} .x-plcard[data-pl="pl-info"]`);
  const before = (await st(page)).pl;
  await page.click(`${R} .x-item[data-item="1"] [data-testid=x-item-up]`);
  await page.selectOption(`${R} .x-additem select`, 'rss'); await page.click('[data-testid=x-item-add]');
  s = await st(page); check(s.pl[0] === before[1] && s.pl[1] === before[0] && s.pl.at(-1) === 'rss', 'playlista: zmiana kolejności i nowa pozycja RSS');
  await page.click(`${R} input[data-assign="PRJ-01"]`); s = await st(page); check(s.dev['PRJ-01'].pl === 'pl-info', 'przypisano playlistę do projekcji');
  await page.waitForTimeout(200); await shot('mgmt-playlists');
  // harmonogram
  await nav(page, 'Harmonogramy');
  const n0 = s.sch;
  await page.click('[data-testid=x-sch-new]'); await page.fill('[data-testid=x-sch-name]', 'Okno serwisowe – aktualizacja'); await page.click(`${R} .fpz-modal button[data-kind=service]`);
  await page.fill('[data-testid=x-sch-from]', '22:00'); await page.fill('[data-testid=x-sch-to]', '23:30');
  await page.click(`${R} .fpz-modal button[data-mode=devices]`); await page.click(`${R} input[data-target="SRV-01"]`);
  await shot('mgmt-schedule-edit');
  await page.click('[data-testid=x-sch-save]'); await page.waitForTimeout(200);
  s = await st(page); check(s.sch === n0 + 1, 'dodano harmonogram');
  await shot('mgmt-schedules');
  // transmisja
  await nav(page, 'Transmisje');
  await page.fill('[data-testid=x-live-title]', 'Koncert w Hali Tworzeń'); await page.click('[data-testid=x-live-start]');
  await page.fill('[data-testid=x-caption-input]', 'Witamy na koncercie!'); await page.press('[data-testid=x-caption-input]', 'Enter');
  await page.click('[data-testid=x-live-sample]'); await page.waitForTimeout(2800);
  s = await st(page); check(s.live.on && s.live.caps >= 3, `transmisja na żywo, napisy: ${s.live.caps}`);
  await shot('mgmt-live');
  await nav(page, 'Raporty'); await page.waitForTimeout(200); await shot('mgmt-reports');
  await page.click(`${R} .x-nav__it:has-text("Użytkownicy")`); await page.waitForTimeout(200); await shot('mgmt-users');
  await nav(page, 'Urządzenia'); await shot('mgmt-devices');
  // tablet
  await nav(page, 'Pulpit');
  await page.click(`${R} .x-seg button:has-text("Tablet")`); await page.waitForTimeout(500); await shot('mgmt-tablet');
  await page.click(`${R} .x-seg button:has-text("Komputer")`); await page.waitForTimeout(200);
};
