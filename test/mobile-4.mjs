import { snap, boot, top, envSelect } from './mobile-lib.mjs';
export default async (page) => {
  await boot(page);
  await envSelect(page, 0, 'hala-zabkowice');
  await page.waitForTimeout(500); await snap(page, 'mobile-30-near-banner');
  await page.click('.m-shortcut >> nth=0');
  await top(page).locator('.fpz-tab', { hasText: 'AR' }).click(); await snap(page, 'mobile-31-ar');
  await top(page).locator('.m-blelist .fpz-btn').first().click(); await snap(page, 'mobile-32-arview');
  await top(page).locator('.m-btnrow .fpz-btn', { hasText: 'Zapisz zdjęcie' }).click(); await page.waitForTimeout(200);
  await top(page).locator('.fpz-btn', { hasText: 'Zamknij widok AR' }).click(); await snap(page, 'mobile-33-memories');
  // mapa
  await page.click('.m-bnav__item:nth-child(4)'); await snap(page, 'mobile-34-map');
  await top(page).locator('.m-prow').first().click(); await page.waitForTimeout(200);
  await page.locator('.m-poisheet .fpz-btn', { hasText: 'Dodaj do ulubionych' }).click(); await snap(page, 'mobile-35-poi-fav');
  await page.keyboard.press('Escape');
  await top(page).locator('.fpz-chip', { hasText: 'Dostępne' }).click(); await top(page).locator('.m-seg button', { hasText: 'Plan' }).click().catch(() => {});
  await top(page).locator('.m-map__view button', { hasText: 'Plan' }).click(); await snap(page, 'mobile-36-map-plan');
  await top(page).locator('.fpz-tab', { hasText: 'Moje ścieżki' }).click();
  await top(page).locator('.fpz-btn', { hasText: 'Utwórz moją ścieżkę' }).click(); await snap(page, 'mobile-37-rb-form');
  await top(page).locator('.fpz-btn', { hasText: 'Zaproponuj' }).click(); await snap(page, 'mobile-38-rb-edit');
  const sel2 = top(page).locator('.m-manual__row select'); const o = await sel2.locator('option').evaluateAll((x) => x.map((y) => y.value).filter(Boolean));
  await sel2.selectOption(o[0]); await top(page).locator('.fpz-btn', { hasText: 'Dodaj punkt' }).click();
  await sel2.selectOption(o[1]); await top(page).locator('.fpz-btn', { hasText: 'Dodaj punkt' }).click();
  await top(page).locator('[aria-label="W dół"]').first().click(); await snap(page, 'mobile-38b-rb-edit');
  await top(page).locator('.fpz-btn', { hasText: 'Zapisz ścieżkę' }).click(); await page.waitForTimeout(400); await snap(page, 'mobile-39-route-map');
  await page.evaluate(() => document.querySelector('.m-screen:not([hidden]) .m-scroll').scrollTop = 600); await snap(page, 'mobile-40-route-list');
};
