import { snap, boot, top } from './mobile-lib.mjs';
export default async (page) => {
  await boot(page);
  await page.click('.m-top__actions [aria-label="Szukaj"]'); await top(page).locator('input[type=search]').fill('huta'); await snap(page, 'mobile-a0-search');
  for (const n of ['info', 'social', 'about', 'a11y', 'memories', 'videos', 'live', 'aboutSite', 'notifications']) { await page.evaluate((n) => window.__fpzMobile.push(n, {}), n); await page.waitForTimeout(150); if (['info', 'social', 'videos', 'a11y'].includes(n)) await snap(page, 'mobile-a1-' + n); }
  await page.evaluate(() => window.__fpzMobile.push('video', { id: 'video-studio-witamy' })); await snap(page, 'mobile-a2-video');
  await page.evaluate(() => window.__fpzMobile.push('quiz', { id: 'nope' }));
  await page.evaluate(() => window.__fpzMobile.push('entry', { id: 'nope' }));
  await page.evaluate(() => window.__fpzMobile.push('category', { id: 'spolecznosc' })); await snap(page, 'mobile-a3-cat-list');
  await page.locator('.m-screen:not([hidden]) [aria-label="Lista"]').click(); await snap(page, 'mobile-a4-cat-list2');
};
