import { snap, boot, top, envBtn } from './mobile-lib.mjs';
export default async (page) => {
  await boot(page);
  await snap(page, 'mobile-70-home-full');
  await page.evaluate(() => document.querySelector('.m-screen:not([hidden]) .m-scroll').scrollTop = 900); await snap(page, 'mobile-71-home-full2');
  await page.evaluate(() => { window.__fpzMobile.testApi.cms.sendPush({ title: 'Koncert dziś o 19:00', body: 'Zapraszamy do Hali Tworzeń – bilety w aplikacji.' }); window.__fpzMobile.testApi.live.start(); });
  await page.waitForTimeout(400); await snap(page, 'mobile-72-push');
  await page.locator('.m-banner__txt').first().click(); await snap(page, 'mobile-73-notifs');
  await page.click('.m-bnav__item:nth-child(1)'); await page.evaluate(() => document.querySelector('.m-screen:not([hidden]) .m-scroll').scrollTop = 0);
  await top(page).locator('.m-live').click(); await page.evaluate(() => { const a = window.__fpzMobile.testApi; a.live.caption('Dzień dobry, witamy na scenie.'); a.live.caption('Za chwilę pierwszy utwór.'); }); await snap(page, 'mobile-74-live');
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-bnav__item:nth-child(1)'); await top(page).locator('.fpz-chip', { hasText: 'Wydarzenia' }).click(); await snap(page, 'mobile-74b-events');
  await top(page).locator('.m-evcard .fpz-btn', { hasText: 'Kup bilet' }).first().click(); await page.waitForTimeout(500); await snap(page, 'mobile-75-reservation');
  await page.click('.m-bnav__item:nth-child(5)'); await page.waitForTimeout(500); await snap(page, 'mobile-76-game');
  await page.click('.m-bnav__item:nth-child(3)'); await snap(page, 'mobile-77-community');
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-bnav__item:nth-child(1)'); await top(page).locator('.fpz-chip', { hasText: 'Wszystko' }).click(); await page.click('.m-shortcut >> nth=1'); await snap(page, 'mobile-78-audio');
  await top(page).locator('.fpz-btn', { hasText: 'Odtwórz wszystko' }).click(); await page.waitForTimeout(600); await snap(page, 'mobile-79-audio-playing');
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-shortcut >> nth=2'); await snap(page, 'mobile-80-coupons');
  const claim = top(page).locator('.fpz-btn', { hasText: 'Odbierz kupon' }).first();
  if (await claim.count()) { await claim.click(); await snap(page, 'mobile-81-coupon-code'); await page.keyboard.press('Escape'); await snap(page, 'mobile-82-coupons-after'); }
  // android
  await page.locator('.sh-env .sh-seg button', { hasText: 'Android' }).click(); await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-bnav__item:nth-child(1)'); await snap(page, 'mobile-83-android');
  await page.click('.m-screen:not([hidden]) .m-top__lead'); await snap(page, 'mobile-84-android-drawer'); await page.keyboard.press('Escape');
  await page.click('.m-bnav__item:nth-child(2)'); await top(page).locator('.m-cattile').first().click(); await snap(page, 'mobile-85-android-cat');
};
