// Integracja: przejście po wszystkich zakładkach pełnej kompilacji + zrzuty.
export default async (page, { shot, tab, errors }) => {
  // niezależnie od pory dnia: kioski i ekrany wyłączają się nocą wg harmonogramu – test działa w „południe”
  await page.evaluate(() => window.__fpz?.makeApi('sim').env.set({ simTime: '12:00' }));
  for (const id of ['mobile', 'web', 'kiosk', 'signage', 'validator', 'cms', 'mgmt', 'about']) {
    await tab(id); await page.waitForTimeout(1800); await shot('int-' + id);
    console.log(id, 'błędy dotąd:', errors.length);
  }
};
