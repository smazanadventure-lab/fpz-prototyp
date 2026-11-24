export default async (page, { shot, tab }) => {
  await page.evaluate(() => localStorage.clear());
  await page.click('.ep-mgmt .x-quick:has-text("technik")'); await page.click('.ep-mgmt [data-testid=x-login-submit]'); await page.waitForTimeout(200);
  await page.evaluate(() => { const { makeApi } = window.__fpzMgmt; makeApi('mgmt').devices.simulateFault('LCD-01', { severity: 'P2' }); const s = window.__fpzMgmt.getState(); s.clients.mgmt.contrast = 'high'; s.clients.mgmt.xSection = 'incidents'; makeApi('mgmt').devices.set('LCD-01', {}); });
  await page.waitForTimeout(300); await shot('mgmt-contrast');
  await tab('validator'); await page.click('[data-testid=v-login-submit]');
  await page.evaluate(() => { const s = window.__fpzMgmt.getState(); s.clients.validator.theme = 'night'; window.__fpzMgmt.makeApi('validator').devices.set('LCD-01', {}); });
  await page.waitForTimeout(300); await shot('validator-night');
};
