export default async (page, { shot, tab }) => {
  await tab('mgmt'); await page.waitForTimeout(500);
  await page.locator('.sh-toolbtn', { hasText: 'Dwa okna' }).click(); await page.waitForTimeout(400);
  await page.locator('.sh-side__bar button', { hasText: 'Kioski' }).click(); await page.waitForTimeout(1200);
  await page.locator('[data-endpoint="mgmt"] button', { hasText: 'technik' }).first().click(); await page.waitForTimeout(800);
  await page.locator('.sh-toolbtn', { hasText: 'API' }).click(); await page.waitForTimeout(300);
  await shot('int4-split');
  await page.locator('.sh-toolbtn', { hasText: 'Dwa okna' }).click(); await page.locator('.sh-toolbtn', { hasText: 'API' }).click();
  await tab('mobile'); await page.waitForTimeout(1500); await shot('int4-mobile-1366');
  await tab('about'); await page.waitForTimeout(600);
  await page.locator('[data-endpoint="about"] .ab-sc__tabs button', { hasText: 'Kioski' }).first().click(); await page.waitForTimeout(600);
  console.log('przejście z „O prototypie” do zakładki:', await page.locator('.sh-tabbtn.is-active').innerText());
};
