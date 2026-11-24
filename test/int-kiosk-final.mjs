export default async (page, { shot, tab }) => {
  await page.evaluate(() => (window.__fpzMgmt || window.__fpzKiosk)?.makeApi?.('mgmt').env.set({ simTime: '12:00' })).catch(() => {});
  await tab('kiosk'); await page.waitForTimeout(1500); await shot('int5-kiosk-scene');
  await page.locator('[data-endpoint="kiosk"] button', { hasText: 'Sam ekran' }).first().click(); await page.waitForTimeout(700);
  await page.locator('[data-endpoint="kiosk"] .ep-kiosk button', { hasText: 'Nawigacja' }).first().click(); await page.waitForTimeout(1600);
  await shot('int5-kiosk-map');
};
