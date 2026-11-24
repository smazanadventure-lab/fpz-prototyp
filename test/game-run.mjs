// Test E2E modułu gry: node test/game-run.mjs  (najpierw node test/game-build.mjs). Zrzuty: shots/game-*.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const root = '/home/claude/work/app';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 760, height: 780 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 300)); });
await page.goto(pathToFileURL(path.join(root, 'dist/game-harness.html')).href);
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForSelector('.ep-game');
const phone = page.locator('#phone');
const shot = async (n) => { await page.waitForTimeout(350); await phone.screenshot({ path: path.join(root, 'shots', `game-${n}.png`) }); console.log('zrzut', n); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const env = (patch) => ev((p) => window.__fpz.makeApi('sim').env.set(p), patch);
const moveTo = (id) => ev((p) => window.__fpz.makeApi('sim').env.moveTo(p), id);
const title = (id) => ev((i) => window.__fpz.sel.mission(i).title[window.__fpz.getState().clients.mobile.lang || 'pl'], id);
const done = (id) => ev((i) => !!window.__fpz.getState().player.done[i], id);
const check = async (cond, msg) => { if (!cond) { errors.push('ASERCJA: ' + msg); console.log('✗', msg); } else console.log('✓', msg); };
const scrollEl = '.g-scroll';
const scrollTo = async (sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); };
const home = async () => { while (await page.locator('.g-back').count()) { await page.locator('.g-back').click(); await page.waitForTimeout(80); } };
const clickText = async (sel, text) => { await page.locator(sel, { hasText: text }).first().click(); await page.waitForTimeout(120); };
const openRoute = async (r) => { await home(); await page.locator(`.g-rcard--${r}`).click(); await page.waitForTimeout(150); };
const openMission = async (r, id) => { await openRoute(r); await clickText('.g-mrow', await title(id)); };
const answerQuiz = async () => {
  for (let i = 0; i < 20; i++) {
    if (!(await page.locator('.g-quiz').count())) break;
    const skip = page.locator('.g-quiz .fpz-btn', { hasText: /Pomiń|Skip/ });
    await page.locator('.g-quiz .g-ans').first().click(); await page.waitForTimeout(100);
    if (i === 0) await shot('quiz');
    await page.locator('.g-quiz .fpz-btn').last().click(); await page.waitForTimeout(120);
  }
};

// 1. profil
await shot('01-profile');
await page.fill('.g-form input', 'Tester FPŻ');
await clickText('.g-seg__opt', 'Młodzież');
await clickText('.g-seg__opt', 'Trudny');
await page.locator('.g-form button[type=submit]').click(); await page.waitForTimeout(200);
await check(await ev(() => window.__fpz.getState().player.profile.difficulty === 'hard' && window.__fpz.getState().player.nick === 'Tester FPŻ'), 'profil zapisany przez api.game.setProfile');
await shot('02-home');

// 2. trasa przyrodnicza: opcje
await openRoute('nature');
await clickText('.g-seg__opt', 'Rowerem'); await clickText('.g-len', 'Krótka');
await shot('03-nature-route');
await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 900)); await shot('03b-nature-missions');
await page.locator('.g-progline + .fpz-btn').click(); await page.waitForTimeout(200); // start → pierwsza misja (QR)
await check(await ev(() => window.__fpz.getState().player.activeRoute?.routeId === 'nature' && window.__fpz.getState().player.activeRoute.length === 's' && window.__fpz.getState().player.activeRoute.mode === 'bike'), 'startRoute z opcjami');
// QR – bez kodu → podpowiedź
await clickText('.g-cond .fpz-btn', /Zeskanuj|Scan/);
await check(await page.locator('.g-missing').count() > 0, 'NOT_IN_RANGE → podpowiedź');
await shot('04-mission-qr-missing');
const qr = await ev(() => window.__fpz.sel.missionCheck(window.__fpz.sel.mission('n-start')).trigger.code);
await moveTo('hala-zielona'); await env({ qrInView: qr });
await clickText('.g-cond .fpz-btn', /Zeskanuj|Scan/);
await check(await done('n-start'), 'misja QR zaliczona');
await shot('05-mission-done');
await env({ qrInView: null });

// AR
const poiOf = (id) => ev((i) => window.__fpz.sel.mission(i).poiId, id);
await moveTo(await poiOf('n-fabryczna-laka')); await openMission('nature', 'n-fabryczna-laka');
await clickText('.g-cond .fpz-btn', /AR/); await shot('06-mission-ar');
await page.locator('.g-ar button').last().click(); await page.waitForTimeout(150);
await check(await done('n-fabryczna-laka'), 'misja AR zaliczona migawką');

// BLE + quiz
await moveTo('hala-zielona'); await openMission('nature', 'n-retencja');
await shot('07-mission-ble-far');
await moveTo(await poiOf('n-retencja')); await page.waitForTimeout(100);
await scrollTo('.g-cond'); await shot('07b-mission-ble-in');
await clickText('.g-cond .fpz-btn', /sygna|signal|quiz/i);
await answerQuiz();
await check(await done('n-retencja'), 'misja BLE + quiz zaliczona');
const cBtn = page.locator('.g-coupon .fpz-btn'); if (await cBtn.count()) { await cBtn.first().click(); await page.waitForTimeout(100); await check(await ev(() => window.__fpz.getState().player.coupons.length > 0), 'kupon odblokowany i odebrany'); }
await check(await ev(() => Object.keys(window.__fpz.getState().player.quiz).length > 0), 'quiz wysłany (submitQuiz)');
await shot('08-mission-quiz-done');
await page.locator('.g-actions .fpz-btn', { hasText: /Dowiedz|Find out/ }).first().click().catch(() => {});
await page.locator('.g-actions .fpz-btn', { hasText: /Pokaż na mapie/ }).first().click().catch(() => {});
const vb = page.locator('.g-actions .fpz-btn', { hasText: /film/ }); if (await vb.count()) { await vb.first().click(); await shot('08b-video'); await page.keyboard.press('Escape'); }

// GPS offline → zapis lokalny → powrót sieci
await env({ network: 'offline' });
await moveTo(await poiOf('n-park-hallera')); await openMission('nature', 'n-park-hallera');
await clickText('.g-cond .fpz-btn', /obecno|here/i);
await check(await ev(() => window.__fpz.getState().player.pending.includes('n-park-hallera')), 'misja GPS offline w kolejce');
await shot('09-mission-offline');
await home(); await shot('10-home-offline'); await page.locator('.g-linkcard').first().click();
await env({ network: 'online' }); await page.waitForTimeout(300);
await check(await ev(() => window.__fpz.getState().player.pending.length === 0), 'automatyczna synchronizacja po powrocie sieci');
await shot('11-home-synced');

// katalog przyrodniczy
await openRoute('nature'); await page.locator('.g-linkcard').first().click(); await page.waitForTimeout(150);
await clickText('.fpz-chip', 'Pomniki przyrody'); await shot('12-nature-catalog');

// przemysł – warianty i BLE
await openRoute('industry'); await clickText('.fpz-chip', 'Pionierzy'); await shot('13-industry');
await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 1100)); await shot('13b-industry-threads');
await check(await ev(() => (window.__fpz.getState().clients.mobile.gameOpts || {}).industry?.variant === 'pioneers'), 'wariant zapamiętany przed startem');
await moveTo(await poiOf('i-warsztat')); await openMission('industry', 'i-warsztat');
await clickText('.g-variant .fpz-chip', 'Produkt'); await shot('14-industry-mission');
await clickText('.g-cond .fpz-btn', /sygna|signal/i);
await check(await done('i-warsztat'), 'misja BLE (przemysł) zaliczona');

// historia – oś czasu i dzielnice
await openRoute('history'); await page.locator('.g-era').nth(3).click(); await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 700)); await shot('15-history-timeline');
await clickText('.fpz-tab', /Dzielnice|Districts/); await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 700));
await page.locator('.g-dchip', { hasText: 'Śródmieście' }).click(); await page.waitForTimeout(200); await shot('16-history-district');
await page.locator('.fpz-modal .g-mrow', { hasText: await title('h-td01-srodmiescie') }).first().click(); await page.waitForTimeout(150);
const hq = await ev(() => window.__fpz.sel.missionCheck(window.__fpz.sel.mission('h-td01-srodmiescie')).trigger.code);
await moveTo(await poiOf('h-td01-srodmiescie')); await env({ qrInView: hq });
await clickText('.g-cond .fpz-btn', /quiz|Zeskanuj/i); await answerQuiz(); await env({ qrInView: null });
await check(await done('h-td01-srodmiescie'), 'misja historyczna QR + quiz');
await openRoute('history'); await clickText('.fpz-tab', /Dzielnice|Districts/); await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 600)); await shot('17-history-ticks');

// przyszłość – panorama, AR, pomysł
await openMission('future', 'f-panorama');
for (let i = 0; i < 3; i++) { await page.locator('.g-hotchips button').nth(i).click(); await page.waitForTimeout(80); }
await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 650)); await shot('18-future-panorama');
await clickText('.g-cond .fpz-btn', /Zakończ|Finish/);
await check(await done('f-panorama'), 'misja panorama zaliczona');
await moveTo(await poiOf('f-ar-uklad')); await openMission('future', 'f-ar-uklad'); await clickText('.g-cond .fpz-btn', /AR/); await shot('19-future-ar');
await page.locator('.g-ar button').last().click(); await check(await done('f-ar-uklad'), 'misja AR przyszłości');
await openMission('future', 'f-idea');
await page.fill('.g-idea textarea', 'Ławki z panelami słonecznymi i ładowarkami na placu przy Hali Tworzeń.');
await page.locator('.g-idea button[type=submit]').click(); await page.waitForTimeout(200);
await check(await done('f-idea'), 'misja pomysłu zaliczona');
await openRoute('future'); await clickText('.fpz-tab', /Pomysły|Ideas/);
await page.locator('.g-vote').first().click();
const ideaId = await ev(() => window.__fpz.getState().ideas.find((i) => i.mine).id);
await ev((id) => window.__fpz.makeApi('cms').cms.moderateIdea(id, 'approved'), ideaId);
await check(await ev(() => window.__fpz.getState().player.ideaBonus === 30), 'akceptacja pomysłu → +30 pkt');
await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 1500)); await shot('20-future-ideas');

// nagrody
await home(); await page.locator('.g-pts').click(); await page.waitForTimeout(150);
await shot('21-rewards');
await page.locator('.g-reward .fpz-btn--primary').first().click(); await page.waitForTimeout(200);
await shot('22-reward-code');
const code = await ev(() => window.__fpz.getState().player.rewards[0]?.code);
await check(!!code, 'nagroda odebrana (redeemReward)');
await ev((c) => window.__fpz.makeApi('validator').tickets.validate('FPZ:N:' + c), code); await page.waitForTimeout(150);
await check(await ev(() => window.__fpz.getState().player.rewards[0].status === 'collected'), 'status nagrody zmieniony przez bileta');
await shot('23-reward-collected');
await page.keyboard.press('Escape');
await page.locator(scrollEl).evaluate((e) => e.scrollTo(0, 3000)); await shot('24-my-rewards');

// warianty wyglądu
await home();
await ev(() => window.__fpz.update((s) => { s.clients.mobile.lang = 'en'; }));
await shot('30-home-en'); await openMission('nature', 'n-dab-wolnosci'); await shot('31-mission-en');
await ev(() => window.__fpz.update((s) => { s.clients.mobile.lang = 'pl'; }));
await ev(() => window.__fpz.makeApi('mobile').game.setProfile({ mode: 'simple', difficulty: 'easy' }));
await home(); await shot('32-home-simple'); await openMission('nature', 'n-dab-wolnosci'); await shot('33-mission-simple');
await clickText('.g-cond .fpz-btn', /quiz|obecno/i); await moveTo(await poiOf('n-dab-wolnosci')); await clickText('.g-cond .fpz-btn', /quiz/i); await shot('34-quiz-simple');
await ev(() => window.__fpz.makeApi('mobile').game.setProfile({ mode: 'standard' }));
await ev(() => window.__fpz.update((s) => { s.clients.mobile.theme = 'night'; }));
await home(); await shot('35-home-night'); await openRoute('history'); await shot('36-history-night');
await ev(() => window.__fpz.update((s) => { s.clients.mobile.theme = 'light'; s.clients.mobile.contrast = 'high'; }));
await home(); await shot('37-home-contrast'); await openMission('nature', 'n-dab-wolnosci'); await shot('38-mission-contrast');
await ev(() => window.__fpz.update((s) => { s.clients.mobile.contrast = 'normal'; }));
await home(); await page.locator('.g-head .fpz-iconbtn').click(); await shot('39-settings');
await home(); await clickText('.fpz-btn', /Zasady/); await shot('40-rules');

console.log('nav:', JSON.stringify(await ev(() => window.__nav.map((x) => x[0]))));
await browser.close();
if (errors.length) { console.error('BŁĘDY (' + errors.length + '):\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK – bez błędów konsoli');
