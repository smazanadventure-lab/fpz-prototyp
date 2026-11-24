import { boot, phone } from './mobile-lib.mjs';
export default async (page, { shot, tab }) => {
  await tab('mobile'); await boot(page);
  await page.locator('[data-endpoint="mobile"] .fpz-chip', { hasText: 'Wydarzenia' }).first().click(); await page.waitForTimeout(500);
  const all = await page.locator('[data-endpoint="mobile"] .sh-phone__screen button').allInnerTexts();
  console.log('Kup bilet:', all.filter((t) => /bilet/i.test(t)).length, '| przyciski:', all.filter(Boolean).slice(0, 40).join(' ; ').slice(0, 700));
  await phone(page).screenshot({ path: 'shots/int-dbg-mobile.png' });
};
