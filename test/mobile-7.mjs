import { snap, boot, top, envBtn } from './mobile-lib.mjs';
export default async (page) => {
  await boot(page);
  await page.click('.m-bnav__item:nth-child(2)'); await snap(page, 'mobile-90-history-full');
  await page.evaluate(() => window.__fpzMobile.push('entry', { id: 'defum-obrabiarki' })); await snap(page, 'mobile-91-entry-full');
  for (const y of [700, 1400, 2100, 2800]) { await page.evaluate((y) => document.querySelector('.m-screen:not([hidden]) .m-scroll').scrollTop = y, y); await snap(page, 'mobile-92-entry-y' + y); }
  await page.evaluate(() => window.__fpzMobile.push('gallery', {})); await page.waitForTimeout(300);
  const th = top(page).locator('.m-masonry__it'); if (await th.count()) { await th.nth(1).click(); await snap(page, 'mobile-93-lightbox2');
    const st = page.locator('.m-lb__stage'); const b = await st.boundingBox(); await page.mouse.move(b.x + b.width * 0.8, b.y + 80); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.2, b.y + 80, { steps: 6 }); await page.mouse.up(); await snap(page, 'mobile-94-lightbox-swiped'); await page.keyboard.press('Escape'); }
  await page.click('.m-bnav__item:nth-child(4)'); await top(page).locator('.m-seg button', { hasText: 'Miasto' }).first().click(); await snap(page, 'mobile-95-city');
  await page.evaluate(() => window.__fpzMobile.set({ lang: 'en', fs: 1.5, contrast: 'high' }));
  await page.click('.m-bnav__item:nth-child(2)'); await snap(page, 'mobile-96-entry-en-hc');
  await page.click('.m-bnav__item:nth-child(1)'); await snap(page, 'mobile-97-home-en-hc');
};
