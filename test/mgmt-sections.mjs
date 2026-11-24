export default async (page, { shot }) => {
  await page.evaluate(() => localStorage.clear());
  await page.click('.ep-mgmt .x-quick:has-text("admin")'); await page.click('.ep-mgmt [data-testid=x-login-submit]'); await page.waitForTimeout(300);
  for (const [l, n] of [['Powiadomienia', 'alerts'], ['Raporty', 'reports'], ['Użytkownicy', 'users']]) { await page.click(`.ep-mgmt .x-nav__it:has-text("${l}")`); await page.waitForTimeout(300); await shot('mgmt-' + n); }
  await page.click('[data-testid=x-user-new]'); await page.waitForTimeout(200); await shot('mgmt-user-new');
};
