// Test scenariusza CMS: role, workflow publikacji, QR, BLE, misje, wydarzenie z biletem, zwrot, zapytanie, moderacja, język, push, logo, media, eksport.
import zlib from 'node:zlib';

function png(w, h) { // mały PNG (zielone tło + jaśniejszy pasek) generowany w teście
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const band = y > h / 3 && y < (2 * h) / 3; raw[o] = band ? 0x5f : 0x12; raw[o + 1] = band ? 0xb2 : 0x59; raw[o + 2] = band ? 0x87 : 0x30; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export default async (page, { shot, errors }) => {
  const S = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms = 250) => page.waitForTimeout(ms);
  const nav = async (label) => { await page.click(`.c-side__it:has-text("${label}")`); await wait(); };
  const sub = async (label) => { await page.click(`.c-subnav button:has-text("${label}")`); await wait(); };
  const modal = '.fpz-modal';
  const foot = (txt) => page.click(`.fpz-modal__foot button:has-text("${txt}") >> nth=-1`);
  const check = (cond, msg) => { if (!cond) throw new Error('NIE SPEŁNIONO: ' + msg); console.log('✓', msg); };
  const T = 'Wpis testowy CMS ' + Date.now().toString(36);

  // 0. Makieta logowania: pola wypełnione kontem admin/admin; wybór konta wpisuje dane (nie loguje)
  const login = async (name) => { await page.click(`.c-login__acc:has-text("${name}")`); await wait(100); check(!(await page.isVisible('.c-user')), `wybór konta ${name} tylko wpisuje dane`); await page.click('[data-testid=c-login-submit]'); await wait(); };
  check(await page.inputValue('.c-login__form input[name=c-login]') === 'admin' && await page.inputValue('.c-login__form input[type=password]') === 'admin', 'logowanie: wypełnione admin / admin');
  await shot('login-cms');
  await page.click('.c-login__acc:has-text("Redaktor")'); await wait(100);
  check(await page.inputValue('.c-login__form input[name=c-login]') === 'redaktor', 'szybki wybór wpisuje login redaktora');
  await page.click('.c-login__acc:has-text("Administrator")'); await wait(100);
  // 1. Redaktor: nowy wpis → próba publikacji (odmowa) → wysłanie do akceptacji
  await login('Redaktor');
  check(await page.isVisible('.c-user:has-text("Redaktor")'), 'zalogowano jako redaktor');
  await nav('Treści');
  await page.click('button:has-text("Nowy wpis")'); await wait();
  await page.fill('.c-edform .fpz-input >> nth=0', T);
  await page.fill('.c-edform textarea >> nth=0', 'Krótki lead wpisu testowego.');
  await page.fill('.c-edform textarea >> nth=1', 'Pierwszy akapit z **pogrubieniem**.\n\nDrugi akapit.');
  await page.click('.c-wf button:has-text("Opublikuj")'); await wait(400);
  check(await page.isVisible('.fpz-toast--error'), 'redaktor: próba publikacji → komunikat odmowy');
  let e = await S((t) => window.__fpzCms.getState().entries.find((x) => x.title.pl === t), T);
  check(e && e.status === 'draft', 'wpis zapisany jako szkic (status draft)');
  check(await S(() => window.__fpzCms.getState().apiLog.some((l) => l.status === 403)), 'API zwróciło 403 FORBIDDEN');
  await shot('cms-editor-redaktor');
  await page.click('.c-wf button:has-text("Wyślij do akceptacji")'); await wait();
  e = await S((t) => window.__fpzCms.getState().entries.find((x) => x.title.pl === t), T);
  check(e.status === 'review', 'wpis wysłany do akceptacji (review)');
  await page.click('button:has-text("Wyloguj")'); await wait();

  // 2. Administrator: edycja i publikacja
  await login('Administrator');
  await nav('Treści');
  await page.click('.c-seg button:has-text("Do akceptacji")'); await wait();
  await page.click(`.c-table tr:has-text("${T}")`); await wait();
  await page.fill('.c-edform textarea >> nth=0', 'Lead poprawiony przez administratora.');
  await page.click('.c-wf button:has-text("Opublikuj")'); await wait();
  e = await S((t) => window.__fpzCms.getState().entries.find((x) => x.title.pl === t), T);
  check(e.status === 'published' && e.lead.pl.startsWith('Lead poprawiony'), 'administrator: edycja i publikacja wpisu');
  await page.click('.c-panel button:has-text("Generuj kod QR")'); await wait();
  check(await S((id) => window.__fpzCms.getState().triggers.some((t) => t.target?.id === id && t.kind === 'qr'), e.id), 'kod QR wygenerowany z edytora wpisu');
  await shot('cms-editor-admin');

  // 3. Wyzwalacze: nowy QR + pobranie SVG, beacon z zasięgiem
  await nav('Wyzwalacze');
  const nTrig = await S(() => window.__fpzCms.getState().triggers.length);
  await page.click('.c-head button:has-text("Generuj kod QR")'); await wait();
  await page.selectOption(`${modal} select >> nth=0`, 'entry'); await wait(100);
  await page.selectOption(`${modal} select >> nth=1`, e.id);
  await page.fill(`${modal} .c-fld .fpz-input >> nth=0`, 'Tablica testowa przy wejściu');
  await foot('Generuj kod'); await wait();
  const qr = await S(() => window.__fpzCms.getState().triggers.at(-1));
  check(qr.kind === 'qr' && /^FPZ-Q-\d+$/.test(qr.code) && qr.target.id === e.id && (await S(() => window.__fpzCms.getState().triggers.length)) === nTrig + 1, `nowy kod QR ${qr.code} → wpis`);
  await shot('cms-qr');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${modal} button:has-text("Pobierz SVG")`)]);
  check(dl.suggestedFilename() === `${qr.code}.svg`, `pobrano ${dl.suggestedFilename()}`);
  await page.keyboard.press('Escape'); await wait();
  await page.click('.c-head button:has-text("Rejestruj beacon")'); await wait();
  await page.selectOption(`${modal} select >> nth=1`, { index: 1 });
  await page.$eval('[data-testid=ble-range]', (el) => { el.value = '42'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(100); await shot('cms-ble');
  await foot('Zarejestruj'); await wait();
  const ble = await S(() => window.__fpzCms.getState().triggers.at(-1));
  check(ble.kind === 'ble' && ble.ble.rangeM === 42 && ble.target.type === 'poi' && ble.target.id, `beacon ${ble.code} zasięg 42 m`);
  await page.keyboard.press('Escape'); await wait();
  await shot('cms-triggers');

  // 4. Gra: nowa misja + zmiana kolejności
  await nav('Gra terenowa');
  const M = 'Misja testowa ' + Date.now().toString(36);
  await page.click('button:has-text("Nowa misja")'); await wait();
  await page.fill(`${modal} .c-lang input >> nth=0`, M);
  await page.fill(`${modal} .c-lang textarea >> nth=0`, 'Opowieść testowa.');
  await foot('Zapisz misję'); await wait();
  let ms = await S(() => window.__fpzCms.getState().gameRoutes.find((r) => r.id === 'nature').missions.map((m) => m.title.pl));
  check(ms.at(-1) === M, 'dodano misję na końcu trasy');
  await shot('cms-mission');
  await page.keyboard.press('Escape'); await wait();
  await page.click(`button[aria-label="Przesuń wyżej: ${M}"]`); await wait();
  ms = await S(() => window.__fpzCms.getState().gameRoutes.find((r) => r.id === 'nature').missions.map((m) => m.title.pl));
  check(ms.at(-2) === M, 'misja przesunięta w górę');
  await shot('cms-game');

  // 5. Oferta: nowe wydarzenie z biletem, zwrot zamówienia, odpowiedź na zapytanie
  await nav('Oferta'); await sub('Wydarzenia');
  const EV = 'Koncert testowy ' + Date.now().toString(36);
  await page.click('.c-toolbar button:has-text("Dodaj")'); await wait();
  await page.fill(`${modal} .c-lang input >> nth=0`, EV);
  await foot('Zapisz'); await wait();
  await page.fill('[data-testid=ticket-price]', '45');
  await page.click(`${modal} button:has-text("Dodaj bilet")`); await wait();
  const evp = await S((t) => { const s = window.__fpzCms.getState(); const ev = s.events.find((x) => x.title.pl === t); return { ev, p: s.products.filter((p) => p.eventId === ev?.id) }; }, EV);
  check(evp.ev && evp.ev.end && evp.p.length === 1 && evp.p[0].price === 45, 'wydarzenie z biletem 45 zł');
  await shot('cms-event');
  await page.keyboard.press('Escape'); await wait();
  await sub('Zamówienia');
  const paid = await S(() => window.__fpzCms.getState().orders.find((o) => o.status === 'paid'));
  if (paid) {
    await page.click(`.c-table tr:has-text("${paid.no}")`); await wait();
    await foot('Zwrot przez obsługę'); await wait();
    await page.click('.fpz-modal__foot button:has-text("Zleć zwrot")'); await wait();
    const o = await S((id) => window.__fpzCms.getState().orders.find((x) => x.id === id), paid.id);
    check(o.status === 'refunded', `zwrot zamówienia ${o.no}`);
    await shot('cms-order'); await page.keyboard.press('Escape'); await wait();
  } else console.log('– brak opłaconego zamówienia w danych (pominięto zwrot)');
  await sub('Zapytania o termin');
  const inq = await S(() => window.__fpzCms.getState().inquiries.find((q) => q.status === 'new'));
  if (inq) {
    await page.click('.c-table button:has-text("Odpowiedz") >> nth=0'); await wait();
    await page.fill('[data-testid=inq-reply]', 'Dzień dobry, potwierdzamy rezerwację stolika. Zapraszamy!');
    await foot('Wyślij odpowiedź'); await wait();
    const q = await S((id) => window.__fpzCms.getState().inquiries.find((x) => x.id === id), inq.id);
    check(q.status === 'confirmed' && q.reply.includes('potwierdzamy'), 'odpowiedź na zapytanie o termin');
  } else console.log('– brak nowych zapytań (pominięto)');

  // 6. Moderacja pomysłu
  if (!(await S(() => window.__fpzCms.getState().ideas.some((i) => i.status === 'pending')))) await S(() => window.__fpzCms.api.game.submitIdea({ text: 'Pomysł z testu: ławki z ładowarkami solarnymi przy hali.' }));
  await nav('Społeczność');
  const idea = await S(() => window.__fpzCms.getState().ideas.find((i) => i.status === 'pending'));
  await shot('cms-community');
  await page.click(`.c-idea:has-text(${JSON.stringify(idea.text.pl.slice(0, 30))}) button:has-text("Akceptuj")`); await wait();
  check((await S((id) => window.__fpzCms.getState().ideas.find((i) => i.id === id), idea.id)).status === 'approved', 'akceptacja pomysłu');

  // 7. Język + tłumaczenie klucza
  await nav('Tłumaczenia');
  await page.fill('[data-testid=lang-code]', 'de'); await page.fill('[data-testid=lang-name]', 'Deutsch');
  await page.click('button:has-text("Dodaj język")'); await wait();
  await page.fill('input[data-key="c.back"][data-lang="de"]', 'Zurück'); await page.press('input[data-key="c.back"][data-lang="de"]', 'Tab'); await wait();
  const tr = await S(() => { const s = window.__fpzCms.getState(); return { l: s.settings.languages.some((l) => l.code === 'de'), v: s.i18n.overrides.de?.['c.back'] }; });
  check(tr.l && tr.v === 'Zurück', 'dodano język DE i przetłumaczono c.back');
  await shot('cms-i18n');

  // 8. Push
  await nav('Powiadomienia');
  await page.fill('[data-testid=push-title]', 'Dziś koncert w Hali Ząbkowice');
  await page.click('button:has-text("Wyślij teraz")'); await wait();
  const ob = await S(() => window.__fpzCms.getState().outbox[0]);
  check(ob.kind === 'push' && ob.subject === 'Dziś koncert w Hali Ząbkowice', 'wysłano push');

  // 9. Logotyp + biblioteka mediów + eksport
  await nav('Ustawienia');
  await page.setInputFiles('[data-testid=logo-upload]', { name: 'logo-testowe.png', mimeType: 'image/png', buffer: png(160, 48) }); await wait(500);
  check((await S(() => window.__fpzCms.getState().settings.logo || '')).startsWith('data:image/png'), 'wgrano logotyp (dataUrl)');
  await shot('cms-logo');
  await nav('Treści'); await sub('Biblioteka mediów');
  await page.setInputFiles('[data-testid=media-upload]', [{ name: 'zdjecie-hali.png', mimeType: 'image/png', buffer: png(320, 200) }, { name: 'nagranie.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(2048) }]); await wait(500);
  const md = await S(() => window.__fpzCms.getState().media.map((m) => ({ type: m.type, hasData: !!m.dataUrl })));
  check(md.length === 2 && md.some((m) => m.type === 'image' && m.hasData) && md.some((m) => m.type === 'audio' && !m.hasData), 'biblioteka mediów: obraz (dataUrl) + audio (metadane)');
  await shot('cms-media');
  await nav('Ustawienia'); await sub('Kopia danych');
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Eksportuj kopię")')]);
  check(/^fpz-kopia-.*\.json$/.test(bk.suggestedFilename()), `eksport ${bk.suggestedFilename()}`);
  await sub('Użytkownicy i role'); await shot('cms-roles');

  // 10. Moderator – ograniczony dostęp
  await page.click('button:has-text("Wyloguj")'); await wait();
  await login('Moderator');
  await nav('Ustawienia');
  check(await page.isVisible('.c-denied'), 'moderator: brak dostępu do ustawień');
  await nav('Oferta'); await shot('cms-moderator');
  check(errors.length === 0, 'brak błędów w konsoli');
};
