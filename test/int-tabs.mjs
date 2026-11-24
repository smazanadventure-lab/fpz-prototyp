// Integracja: przejście po wszystkich zakładkach pełnej kompilacji + zrzuty.
export default async (page, { shot, tab, errors }) => {
  for (const id of ['mobile', 'web', 'kiosk', 'signage', 'validator', 'cms', 'mgmt', 'about']) {
    await tab(id); await page.waitForTimeout(1800); await shot('int-' + id);
    console.log(id, 'błędy dotąd:', errors.length);
  }
};
