export default async (page) => {
  await page.evaluate(() => window.__fpzKiosk.makeApi('mgmt').env.set({ simTime: '12:00' }));
  await page.click('[data-kiosk="TZ.T1.5"]'); await page.waitForTimeout(500);
  await page.locator('.k-totem').screenshot({ path: 'shots/kiosk-totem-t15.png' });
  await page.click('.k-handset'); await page.waitForTimeout(700);
  await page.locator('.k-totem').screenshot({ path: 'shots/kiosk-totem-t15-off.png' });
  await page.click('[data-kiosk="TZ.T1.1"]'); await page.waitForTimeout(500);
  await page.locator('.k-totem').screenshot({ path: 'shots/kiosk-totem-t11.png' });
};
