// Integracja: zależności między końcówkami w pełnej kompilacji.
import { boot, phone } from './mobile-lib.mjs';
export default async (page, { shot, tab, errors }) => {
  const T = (name, ok, extra) => console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? ''));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const paneText = (id) => page.locator(`[data-endpoint="${id}"]`).innerText();
  // zamontuj wszystkie końcówki
  for (const id of ['web', 'kiosk', 'signage', 'validator', 'cms', 'mgmt', 'mobile']) { await tab(id); await page.waitForTimeout(700); }
  await boot(page); await shot('int2-mobile-home');
  T('aplikacja: ekran główny po samouczku', await page.locator('.m-bnav').count() === 1);

  // A. CMS → tytuł wpisu wszędzie
  const info = await ev(() => { const s = window.__fpzMgmt.getState(); const e = s.entries.find((x) => x.featured && x.channels.includes('web') && x.channels.includes('mobile') && x.channels.includes('kiosk')); const api = window.__fpzMgmt.makeApi('cms'); api.staff.login('admin', 'admin'); api.cms.save('entries', { id: e.id, title: { pl: 'ZMIENIONY TYTUŁ Z CMS', en: 'TITLE CHANGED IN CMS' } }); return { id: e.id }; });
  await page.waitForTimeout(500);
  T('A: nowy tytuł w aplikacji', (await paneText('mobile')).includes('ZMIENIONY TYTUŁ Z CMS'));
  await tab('web'); T('A: nowy tytuł na stronie WWW', (await paneText('web')).includes('ZMIENIONY TYTUŁ Z CMS'));
  await tab('kiosk'); await page.waitForTimeout(400); T('A: nowy tytuł w kiosku', (await paneText('kiosk')).toUpperCase().includes('ZMIENIONY TYTUŁ Z CMS'));

  // B. moduł rezerwacji osadzony na stronie i w aplikacji
  await tab('web'); await page.locator('[data-endpoint="web"] nav button, [data-endpoint="web"] nav a', { hasText: 'Wydarzenia i bilety' }).first().click(); await page.waitForTimeout(900);
  T('B: rezerwacje na stronie WWW', await page.locator('[data-endpoint="web"] .ep-res').count() === 1); await shot('int2-web-res');
  await tab('mobile'); await page.waitForTimeout(400); await phone(page).screenshot({ path: 'shots/int2-mobile-before-buy.png' });
  await page.locator('[data-endpoint="mobile"] .fpz-chip', { hasText: 'Wydarzenia' }).first().click(); await page.waitForTimeout(500);
  const buys = page.locator('[data-endpoint="mobile"] button', { hasText: 'Kup bilet' }); console.log('Kup bilet – liczba:', await buys.count(), 'widoczny pierwszy:', await buys.first().isVisible().catch(() => 'brak'));
  const buy = buys.first(); await buy.scrollIntoViewIfNeeded({ timeout: 5000 }); await buy.click(); await page.waitForTimeout(900);
  T('B: rezerwacje w aplikacji', await page.locator('[data-endpoint="mobile"] .ep-res').count() === 1); await phone(page).screenshot({ path: 'shots/int2-mobile-res.png' });

  // C. zakup (API klienta WWW) → bileter → status
  const code = await ev(() => { const { makeApi, getState } = window.__fpzMgmt; const s = getState(); const web = makeApi('web'); web.auth.login('anna.kowalska@example.com', 'demo1234'); const e = s.events.find((x) => x.ticketed && x.end > new Date().toISOString().slice(0, 16)); const p = s.products.find((x) => x.eventId === e.id); web.booking.addToCart(p.id, 1); const o = web.booking.checkout(); const r = web.booking.pay(o.order.id, { method: 'blik' }); return r.tickets[0].code; });
  await tab('validator'); await page.locator('[data-endpoint="validator"] [data-testid=v-login-submit]').first().click(); await page.waitForTimeout(500);
  T('C: nowy bilet widoczny u biletera', (await paneText('validator')).includes(code));
  await page.locator('[data-endpoint="validator"] *', { hasText: code }).last().click(); await page.waitForTimeout(700); await shot('int2-validator');
  T('C: bilet skasowany', await ev((c) => window.__fpzMgmt.getState().tickets.find((t) => t.code === c).status, code) === 'used');
  await tab('web'); await page.waitForTimeout(300);

  // D. zarządzanie ekspozycją → kiosk
  await ev(() => { const a = window.__fpzMgmt.makeApi('mgmt'); a.staff.login('technik', 'technik'); a.devices.power('TZ.T1.1', 'off'); });
  await tab('kiosk'); await page.waitForTimeout(600); await shot('int2-kiosk-off');
  await ev(() => { const a = window.__fpzMgmt.makeApi('mgmt'); a.devices.power('TZ.T1.1', 'on'); a.devices.simulateFault('TZ.T1.1', { title: 'Test awarii' }); }); await page.waitForTimeout(500); await shot('int2-kiosk-fault');
  T('D: awaria → powiadomienia', await ev(() => window.__fpzMgmt.getState().outbox.filter((o) => o.subject.includes('Awaria')).length) >= 1);
  await ev(() => { const { makeApi, getState } = window.__fpzMgmt; const a = makeApi('mgmt'); a.devices.resolveIncident(getState().incidents[0].id, 'ok'); a.devices.setAuto('all'); a.env.set({ simTime: '19:30' }); }); await page.waitForTimeout(700); await shot('int2-kiosk-night');
  T('D: tryb nocny z harmonogramu', await page.locator('[data-endpoint="kiosk"] [data-theme="night"]').count() >= 1);
  await ev(() => window.__fpzMgmt.makeApi('mgmt').env.set({ simTime: null }));

  // E. transmisja i napisy
  await ev(() => { const a = window.__fpzMgmt.makeApi('mgmt'); a.live.start('Koncert testowy'); a.live.caption('Dobry wieczór, zaczynamy koncert.'); a.live.caption('Napisy na żywo działają.'); });
  await tab('signage'); await page.waitForTimeout(900); await shot('int2-signage-captions');
  T('E: napisy na ekranie LCD', (await paneText('signage')).includes('Napisy na żywo działają.'));
  await tab('mgmt'); await page.locator('[data-endpoint="mgmt"] [data-testid=x-login-submit]').first().click().catch(() => {}); await page.waitForTimeout(700); await shot('int2-mgmt');
  await ev(() => window.__fpzMgmt.makeApi('mgmt').live.stop());

  // F. gra w aplikacji
  await tab('mobile'); await page.locator('.m-bnav button').nth(4).click(); await page.waitForTimeout(900);
  T('F: gra terenowa osadzona w aplikacji', await page.locator('[data-endpoint="mobile"] .ep-game').count() === 1); await phone(page).screenshot({ path: 'shots/int2-mobile-game.png' });

  // G. język + H. logotyp
  await ev(() => { const a = window.__fpzMgmt.makeApi('cms'); a.cms.addLanguage({ code: 'de', name: 'Deutsch' }); a.cms.setSetting({ logo: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#125930"/><text x="60" y="26" fill="#fff" font-size="16" text-anchor="middle" font-family="Arial">LOGO TEST</text></svg>') }); });
  await tab('web'); await page.waitForTimeout(500);
  T('G: nowy język na stronie', (await page.locator('[data-endpoint="web"] select').first().innerText()).includes('Deutsch'));
  T('H: wgrany logotyp na stronie', await page.locator('[data-endpoint="web"] .fpz-logo__img').count() >= 1); await shot('int2-web-logo');
  await tab('cms'); await page.locator('[data-endpoint="cms"] [data-testid=c-login-submit]').first().click().catch(() => {}); await page.waitForTimeout(800); await shot('int2-cms');
  console.log('błędy konsoli:', errors.length);
};
