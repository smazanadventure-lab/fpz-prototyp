export const phone = (page) => page.locator('.sh-phone__screen');
export async function snap(page, n) { await page.waitForTimeout(400); await phone(page).screenshot({ path: `shots/${n}.png` }); console.log('zrzut', n); }
export async function boot(page) {
  await page.waitForSelector('.m-onb', { timeout: 6000 }); await page.click('.m-onb .fpz-btn');
  await page.click('.m-tut__skip button'); await page.waitForSelector('.m-bnav'); await page.waitForTimeout(300);
}
export const top = (page) => page.locator('.m-screen:not([hidden])');
export async function envSelect(page, idx, value) { const s = page.locator('.sh-env select').nth(idx); await s.selectOption(value); await page.waitForTimeout(200); }
export async function envBtn(page, text) { await page.locator('.sh-env .sh-seg button', { hasText: text }).first().click(); await page.waitForTimeout(200); }
