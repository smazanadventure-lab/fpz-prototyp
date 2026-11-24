// Głębokie odnośniki: Kup bilet → rezerwacje, Zobacz na mapie, koszyk, offline, lektor.
export default async (page, { shot }) => {
  const w = (n) => page.waitForTimeout(n);
  const web = page.locator('.ep-web');
  await w(500);
  await web.getByRole('button', { name: 'Akceptuję wszystkie' }).click(); await w(200);
  await web.locator('.w-evcard .fpz-btn', { hasText: 'Kup bilet' }).first().click(); await w(600);
  await shot('web-l01-buy-deeplink');
  await web.locator('.w-nav a', { hasText: 'Historia' }).click(); await w(300);
  await web.locator('.w-ecard__title a').first().click(); await w(300);
  await web.getByRole('button', { name: 'Zobacz na mapie' }).click(); await w(500);
  await shot('web-l02-onmap');
  await web.locator('.w-foot .fpz-switch').click(); await w(300);
  await page.evaluate(() => document.querySelector('.ep-web .w-scroll').scrollTop = 0); await w(200);
  await web.getByRole('button', { name: 'Co jest dostępne?' }).click(); await w(200);
  await shot('web-l03-offline');
  await web.locator('.w-nav a', { hasText: 'Historia' }).click(); await w(400); await shot('web-l04-offline-history');
  const seg = page.locator('.sh-browser__bar .sh-seg button');
  await web.getByRole('button', { name: 'Wróć online' }).click(); await w(200);
  await seg.nth(2).click(); await w(300);
  await web.getByRole('button', { name: /Koszyk/ }).click(); await w(600); await shot('web-l05-phone-cart');
  await seg.nth(0).click(); await w(300);
  await web.locator('.w-nav a', { hasText: 'Start' }).click(); await w(300);
  await web.getByRole('button', { name: 'Tłumacz języka migowego' }).first().click(); await w(2200); await shot('web-l06-pjm');
};
