export default async (page, { shot }) => {
  await page.evaluate(() => localStorage.clear());
  await page.click('.ep-mgmt .x-quick:has-text("admin")'); await page.click('.ep-mgmt [data-testid=x-login-submit]'); await page.waitForTimeout(300);
  await window_fault(page);
  await shot('mgmt-narrow-dash');
  await page.click('.ep-mgmt .x-top__menu'); await page.waitForTimeout(300); await shot('mgmt-narrow-nav');
  await page.click('.ep-mgmt .x-nav__it:has-text("Urządzenia")'); await page.waitForTimeout(300); await shot('mgmt-narrow-devices');
  await page.click('.ep-mgmt .x-top__menu'); await page.click('.ep-mgmt .x-nav__it:has-text("Awarie")'); await page.waitForTimeout(300); await shot('mgmt-narrow-incidents');
  await page.click('.ep-mgmt .x-top__menu'); await page.click('.ep-mgmt .x-nav__it:has-text("Treści")'); await page.waitForTimeout(300); await shot('mgmt-narrow-playlists');
  await page.click('.ep-mgmt .x-top__menu'); await page.click('.ep-mgmt .x-nav__it:has-text("Harmonogramy")'); await page.waitForTimeout(300); await shot('mgmt-narrow-schedules');
  // tryb nocny + kontrast
  await page.evaluate(() => { const s = window.__fpzMgmt.getState(); s.clients.mgmt.theme = 'night'; });
  await page.click('.ep-mgmt .x-top__menu'); await page.click('.ep-mgmt .x-nav__it:has-text("Pulpit")'); await page.waitForTimeout(300); await shot('mgmt-narrow-night');
};
async function window_fault(page) { await page.evaluate(() => window.__fpzMgmt.makeApi('mgmt').devices.simulateFault('TZ.T1.3', { severity: 'P1' })); await page.waitForTimeout(100); }
