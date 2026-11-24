import { snap, boot, top } from './mobile-lib.mjs';
export default async (page) => {
  await boot(page);
  await page.click('.m-bnav__item:nth-child(2)'); await snap(page, 'mobile-10-history');
  await top(page).locator('.m-cattile').first().click(); await snap(page, 'mobile-11-category');
  await top(page).locator('.m-ecard').first().click(); await snap(page, 'mobile-12-entry');
  await page.evaluate(() => document.querySelector('.m-screen:not([hidden]) .m-scroll').scrollTop = 700); await snap(page, 'mobile-13-entry-scroll');
  await page.evaluate(() => document.querySelector('.m-screen:not([hidden]) .m-scroll').scrollTop = 1600); await snap(page, 'mobile-14-entry-scroll2');
  await page.click('.m-screen:not([hidden]) .m-top__actions [aria-label="Udostępnij"]'); await snap(page, 'mobile-15-share');
  await page.keyboard.press('Escape');
  await page.click('.m-screen:not([hidden]) .m-top__lead'); await page.click('.m-screen:not([hidden]) .m-top__lead');
  await top(page).locator('.m-galtile').first().click(); await snap(page, 'mobile-16-gallery');
  await top(page).locator('.m-masonry__it').first().click(); await snap(page, 'mobile-17-lightbox');
  await page.keyboard.press('Escape'); await page.click('.m-screen:not([hidden]) .m-top__lead');
  await top(page).locator('.m-galtile').nth(1).click(); await snap(page, 'mobile-18-videos');
};
