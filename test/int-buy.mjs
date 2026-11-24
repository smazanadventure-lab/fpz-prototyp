// Integracja: pełny zakup biletu w aplikacji (interfejs) → walidacja → status w aplikacji i na stronie.
import { boot, phone } from './mobile-lib.mjs';
export default async (page, { shot, tab, errors }) => {
  // niezależnie od pory dnia: kioski i ekrany wyłączają się nocą wg harmonogramu – test działa w „południe”
  await page.evaluate(() => window.__fpz?.makeApi('sim').env.set({ simTime: '12:00' }));
  const T = (name, ok) => console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name);
  const M = page.locator('[data-endpoint="mobile"] .sh-phone__screen'); const snap = (n) => phone(page).screenshot({ path: `shots/${n}.png` });
  await tab('mobile'); await boot(page);
  await M.locator('.fpz-chip', { hasText: 'Wydarzenia' }).first().click(); await page.waitForTimeout(400);
  await M.locator('button', { hasText: 'Kup bilet' }).first().click(); await page.waitForTimeout(900);
  await M.locator('.r-prod').first().getByRole('button', { name: 'Dodaj do koszyka' }).click(); await page.waitForTimeout(300); await snap('int3-1-event');
  await M.locator('.r-cartbar').getByRole('button').click(); await page.waitForTimeout(400); await snap('int3-2-cart');
  await M.getByRole('button', { name: 'Przejdź do kasy' }).click(); await page.waitForTimeout(400);
  await M.getByRole('button', { name: 'Zaloguj', exact: true }).click(); await page.waitForTimeout(500);
  await M.getByText('Akceptuję regulamin sprzedaży').click(); await snap('int3-3-checkout');
  await M.getByRole('button', { name: /Zamawiam i płacę/ }).click(); await page.waitForTimeout(500); await snap('int3-4-gateway');
  await M.getByRole('button', { name: 'Przejdź do potwierdzenia' }).click(); await page.waitForTimeout(1900); await snap('int3-5-sca');
  await M.getByRole('button', { name: 'Zatwierdź płatność testową' }).click(); await page.waitForTimeout(1200); await snap('int3-6-tickets');
  const code = await M.locator('.r-ticket').first().getAttribute('data-code'); T('bilet wydany w aplikacji: ' + code, !!code);
  await page.evaluate((c) => { const a = window.__fpzMgmt?.makeApi || window.__fpzValidator?.makeApi; a('validator').tickets.validate('FPZ:T:' + c, { gate: 'Brama A' }); }, code).catch(async () => { await tab('validator'); await page.waitForTimeout(500); await page.evaluate((c) => window.__fpzValidator.makeApi('validator').tickets.validate('FPZ:T:' + c, { gate: 'Brama A' }), code); await tab('mobile'); });
  await page.waitForTimeout(500);
  T('status „wykorzystany” w aplikacji', /wykorzystany/i.test(await M.locator(`.r-ticket[data-code="${code}"]`).innerText())); await snap('int3-7-used');
  console.log('dziennik API:', await page.evaluate(() => (window.__fpzValidator || window.__fpzMgmt)?.getState().apiLog.slice(0, 6).map((r) => r.client + ' ' + r.method + ' ' + r.path + ' ' + r.status).join(' | ')));
  console.log('błędy konsoli:', errors.length);
};
