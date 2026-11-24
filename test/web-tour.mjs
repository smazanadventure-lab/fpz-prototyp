// Przejście przez wszystkie sekcje strony WWW (desktop) + interakcje.
export default async (page, { shot }) => {
  const w = (n) => page.waitForTimeout(n);
  const web = page.locator('.ep-web');
  const nav = async (label) => { await web.locator('.w-nav a', { hasText: label }).first().click(); await w(400); };
  const top = async (y = 0) => { await page.evaluate((y) => document.querySelector('.ep-web .w-scroll').scrollTop = y, y); await w(250); };
  await w(500);
  await web.getByRole('button', { name: 'Akceptuję wszystkie' }).click(); await w(300);
  await shot('web-t01-home');
  // historia – oś czasu
  await nav('Historia'); await shot('web-t02-history');
  await top(700); await shot('web-t03-history-tl');
  // filtr epoki
  await web.locator('.w-era').nth(4).click(); await w(300); await top(300); await shot('web-t04-history-era');
  await web.locator('.w-filters .w-link').click(); await w(200);
  // kategorie
  await top(0); await web.locator('.w-htabs [role=tab]').nth(1).click(); await w(400); await shot('web-t05-cats');
  // artykuł z wideo i 3D
  await page.evaluate(() => {}); 
  await web.locator('.w-nav a', { hasText: 'Historia' }).click(); await w(300);
  await web.locator('.w-ecard__title a', { hasText: 'Obrabiarki' }).first().click().catch(async () => { await web.locator('.w-ecard__title a').first().click(); });
  await w(500); await shot('web-t06-article');
  await top(800); await shot('web-t07-article2');
  await top(1600); await shot('web-t08-article3');
  // wideo – odtwarzanie
  const play = web.locator('.w-video .md-video__big').first();
  if (await play.count()) { await play.click(); await w(1500); await web.locator('.w-video').first().scrollIntoViewIfNeeded(); await shot('web-t09-video'); }
  // galeria – lightbox i klawiatura
  const g = web.locator('.w-gallery__item').first();
  if (await g.count()) { await g.click(); await w(300); await page.keyboard.press('ArrowRight'); await w(200); await shot('web-t10-lightbox'); await page.keyboard.press('Escape'); await w(200); }
  // galeria zdjęć, filmoteka
  await nav('Historia'); await web.locator('.w-htabs [role=tab]').nth(2).click(); await w(400); await shot('web-t11-gallery');
  await web.locator('.w-htabs [role=tab]').nth(3).click(); await w(400); await shot('web-t12-videos');
  await web.locator('.w-vthumb').first().click(); await w(1200); await shot('web-t13-video-modal'); await page.keyboard.press('Escape'); await w(200);
  // społeczność, głosowanie
  await nav('Społeczność'); await shot('web-t14-community');
  await web.locator('.w-htabs [role=tab]').nth(1).click(); await w(400);
  await web.locator('.w-vote').first().click(); await w(400); await shot('web-t15-ideas-voted');
  await web.locator('.w-htabs [role=tab]').nth(2).click(); await w(400); await shot('web-t16-orgs');
  // wydarzenia
  await nav('Wydarzenia'); await w(400); await shot('web-t17-events');
  // mapa
  await nav('Mapa'); await shot('web-t18-map');
  await web.locator('.w-poi').nth(2).click(); await w(400); await shot('web-t19-map-poi');
  await top(500); await shot('web-t20-map-poi2');
  // kreator
  await top(0); await web.locator('.w-htabs [role=tab]').nth(1).click(); await w(400);
  await web.locator('.w-planner__form .fpz-chip', { hasText: 'Historia' }).click(); await w(100);
  await web.getByRole('button', { name: 'Zaproponuj ścieżkę' }).click(); await w(500); await shot('web-t21-planner');
  await top(500); await shot('web-t22-planner2');
  await web.getByRole('button', { name: 'Zapisz', exact: true }).click(); await w(300);
  await web.getByRole('button', { name: 'Wyślij na telefon' }).click(); await w(300); await shot('web-t23-send'); await page.keyboard.press('Escape'); await w(200);
  await top(0); await web.locator('.w-htabs [role=tab]').nth(2).click(); await w(400); await shot('web-t24-routes');
  // gra
  await nav('Gra terenowa'); await shot('web-t25-game'); await top(1500); await shot('web-t26-game2'); await top(2300); await shot('web-t27-game3');
  // transmisje
  await nav('Transmisje'); await shot('web-t28-live');
  // informacje
  await nav('Informacje'); await shot('web-t29-info');
  await web.locator('.w-htabs [role=tab]').nth(1).click(); await w(400); await shot('web-t30-access');
  await web.locator('.w-htabs [role=tab]').nth(2).click(); await w(400); await shot('web-t31-tenants');
  await web.locator('.w-htabs [role=tab]').nth(4).click(); await w(400); await shot('web-t32-faq');
  // wyszukiwarka
  await web.locator('#w-q').fill('huta'); await w(400); await shot('web-t33-search');
  await page.keyboard.press('Enter'); await w(400); await shot('web-t34-search-page');
  // stopka + offline
  await top(99999); await shot('web-t35-footer');
  await web.locator('.w-foot .fpz-switch').click(); await w(300); await top(0); await shot('web-t36-offline');
};
