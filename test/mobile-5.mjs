import { snap, boot, top, envBtn } from './mobile-lib.mjs';
export default async (page) => {
  await boot(page);
  await page.click('.m-shortcut >> nth=2'); await snap(page, 'mobile-50-coupons');
  const claim = top(page).locator('.fpz-btn', { hasText: 'Odbierz kupon' }).first();
  if (await claim.count()) { await claim.click(); await snap(page, 'mobile-51-coupon-code'); await page.keyboard.press('Escape'); }
  // quiz z menu
  await page.click('.m-screen:not([hidden]) .m-top__lead'); await page.click('.m-screen:not([hidden]) .m-top__lead'); await snap(page, 'mobile-52-drawer');
  await page.locator('.m-drawer__item', { hasText: 'Quizy' }).click(); await snap(page, 'mobile-53-quizzes');
  await top(page).locator('.m-quizcard .fpz-btn').first().click();
  for (let i = 0; i < 10; i++) {
    const a = top(page).locator('.m-quiz__a').first(); if (!(await a.count())) break;
    await a.click(); await top(page).locator('.fpz-btn', { hasText: 'Sprawdź' }).click(); if (i === 0) await snap(page, 'mobile-54-quiz');
    await top(page).locator('.m-quiz .fpz-btn').last().click(); await page.waitForTimeout(150);
  }
  await snap(page, 'mobile-55-quiz-result');
  // ustawienia
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-screen:not([hidden]) .m-top__lead'); await page.waitForTimeout(300);
  await page.locator('.m-drawer__item', { hasText: 'Ustawienia' }).click(); await snap(page, 'mobile-56-settings');
  await top(page).locator('.fpz-btn', { hasText: 'Pobierz pakiet' }).click(); await page.waitForTimeout(400);
  await top(page).locator('.m-offcard').scrollIntoViewIfNeeded(); await snap(page, 'mobile-57-offline-dl'); await page.waitForTimeout(2200); await snap(page, 'mobile-58-offline-done');
  await envBtn(page, 'Offline'); await page.click('.m-bnav__item:nth-child(2)'); await snap(page, 'mobile-59-offline-history');
  await top(page).locator('.m-cattile').first().click(); await top(page).locator('.m-ecard').first().click(); await snap(page, 'mobile-60-offline-entry');
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-bnav__item:nth-child(1)'); await top(page).locator('.fpz-chip', { hasText: 'Wydarzenia' }).click(); await top(page).locator('.m-evcard .fpz-btn', { hasText: 'Kup bilet' }).first().click(); await snap(page, 'mobile-61-offline-res');
  await envBtn(page, 'Słaby'); await page.click('.m-bnav__item:nth-child(2)'); await page.click('.m-bnav__item:nth-child(2)'); await page.waitForTimeout(100); await snap(page, 'mobile-62-slow');
  await envBtn(page, 'LTE');
  // EN, kontrast, A↑, noc
  await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-bnav__item:nth-child(1)'); await page.click('.m-screen:not([hidden]) .m-top__lead');
  await page.locator('.m-drawer__lang button', { hasText: 'EN' }).click(); await page.waitForTimeout(200); await snap(page, 'mobile-63-drawer-en');
  await page.locator('.m-drawer .fpz-a11y [aria-label="Larger text"]').click(); await page.locator('.m-drawer .fpz-a11y [aria-label="Larger text"]').click(); await page.locator('.m-drawer .fpz-a11y [aria-label="Larger text"]').click();
  await page.keyboard.press('Escape'); await snap(page, 'mobile-64-en-150');
  await page.click('.m-screen:not([hidden]) .m-top__lead'); await page.locator('.m-drawer .fpz-a11y [aria-label="Night mode"]').click(); await page.keyboard.press('Escape'); await snap(page, 'mobile-65-night');
  await page.click('.m-bnav__item:nth-child(4)'); await snap(page, 'mobile-66-night-map');
  await page.click('.m-screen:not([hidden]) .m-top__lead'); await page.locator('.m-drawer .fpz-a11y [aria-label="High contrast"]').click(); await page.keyboard.press('Escape'); await page.click('.m-bnav__item:nth-child(1)'); await snap(page, 'mobile-67-contrast');
  console.log(await page.evaluate(() => { const out = []; document.querySelectorAll('*').forEach((e) => { if (e.scrollTop > 0) out.push(e.className + ' ' + e.scrollTop); }); return out.join(' | ') + ' navs=' + document.querySelectorAll('.m-bnav').length; }));
};
export const after = 1;
