import { snap, boot, top, envSelect, envBtn } from './mobile-lib.mjs';
export default async (page) => {
  await boot(page);
  // skaner QR – kod przed kamerą
  await page.click('.m-shortcut >> nth=0'); await snap(page, 'mobile-20-scan');
  const qrSel = page.locator('.sh-env select').nth(1);
  const opts = await qrSel.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  await qrSel.selectOption(opts[0]); await page.waitForTimeout(300); await snap(page, 'mobile-21-scan-code');
  await page.waitForTimeout(1200); await snap(page, 'mobile-22-scan-result');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await top(page).locator('#m-manual-code').fill('XYZ-NIEMA'); await top(page).locator('.m-manual button[type=submit]').click(); await snap(page, 'mobile-23-scan-error');
  // BLE
  await top(page).locator('.fpz-tab', { hasText: 'Beacony' }).click(); await snap(page, 'mobile-24-ble');
  await top(page).locator('.fpz-tab', { hasText: 'AR' }).click(); await snap(page, 'mobile-25-ar');
  const arBtn = top(page).locator('.m-blelist .fpz-btn').first();
  if (await arBtn.count()) { await arBtn.click(); await snap(page, 'mobile-26-arview'); await top(page).locator('.fpz-btn', { hasText: 'Zapisz zdjęcie' }).click(); await snap(page, 'mobile-27-arsaved'); }
};
