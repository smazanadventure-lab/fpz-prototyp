// Tryby: EN, kontrast, noc, A↑, tablet i telefon (menu, artykuł, kreator).
export default async (page, { shot }) => {
  const w = (n) => page.waitForTimeout(n);
  const web = page.locator('.ep-web');
  const top = async (y = 0) => { await page.evaluate((y) => document.querySelector('.ep-web .w-scroll').scrollTop = y, y); await w(250); };
  await w(500);
  await web.getByRole('button', { name: 'Tylko niezbędne' }).click(); await w(200);
  // EN
  await web.locator('.w-lang select').first().selectOption('en'); await w(300);
  await shot('web-m01-en-home');
  await web.locator('.w-nav a', { hasText: 'History' }).click(); await w(400);
  await web.locator('.w-ecard__title a').nth(2).click(); await w(400); await shot('web-m02-en-article');
  // kontrast
  await web.getByRole('button', { name: 'High contrast' }).first().click(); await w(300); await shot('web-m03-contrast-article');
  await web.locator('.w-nav a', { hasText: 'Home' }).click(); await w(400); await shot('web-m04-contrast-home');
  await web.getByRole('button', { name: 'High contrast' }).first().click(); await w(200);
  // noc + A↑
  await web.getByRole('button', { name: 'Night mode' }).first().click(); await w(200);
  await web.getByRole('button', { name: 'Larger text' }).first().click(); await w(300);
  await shot('web-m05-night-big-home');
  await web.locator('.w-nav a', { hasText: 'Map' }).click(); await w(400); await shot('web-m06-night-map');
  await web.getByRole('button', { name: 'Smaller text' }).first().click(); await w(100);
  await web.getByRole('button', { name: 'Night mode' }).first().click(); await w(100);
  await web.locator('.w-lang select').first().selectOption('pl'); await w(300);
  // tablet
  const seg = page.locator('.sh-browser__bar .sh-seg button');
  await seg.nth(1).click(); await w(400);
  await web.getByRole('button', { name: 'Menu' }).click(); await w(300); await shot('web-m07-tablet-menu');
  await web.locator('.w-drawer__nav a', { hasText: 'Historia' }).click(); await w(400); await shot('web-m08-tablet-history');
  await web.locator('.w-ecard__title a').first().click(); await w(400); await top(500); await shot('web-m09-tablet-article');
  // telefon
  await seg.nth(2).click(); await w(400); await top(0); await shot('web-m10-phone-article');
  await top(1400); await shot('web-m11-phone-article2');
  await web.getByRole('button', { name: 'Menu' }).click(); await w(300); await shot('web-m12-phone-menu');
  await web.locator('.w-drawer__nav a', { hasText: 'Mapa' }).click(); await w(400); await shot('web-m13-phone-map');
  await web.locator('.w-htabs [role=tab]').nth(1).click(); await w(400);
  await web.getByRole('button', { name: 'Zaproponuj ścieżkę' }).click(); await w(400); await top(700); await shot('web-m14-phone-planner');
  await web.getByRole('button', { name: 'Menu' }).click(); await w(300);
  await web.locator('.w-drawer__nav a', { hasText: 'Gra' }).click(); await w(400); await top(600); await shot('web-m15-phone-game');
  await web.getByRole('button', { name: 'Szukaj' }).first().click(); await w(200);
  await page.keyboard.type('pogoria'); await w(400); await shot('web-m16-phone-search');
};
