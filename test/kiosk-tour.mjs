// Pełny przegląd kiosków: node tools/shot.mjs --file=dist/dev-kiosk-signage.html --tab=kiosk --w=1500 --h=1000 --script=test/kiosk-tour.mjs
export default async (page, { shot, errors }) => {
  const ev = (code) => page.evaluate(code);
  const mg = (code) => ev(`(() => { const a = window.__fpzKiosk.makeApi('mgmt'); ${code} })()`);
  const scr = () => page.locator('.k-sc-bezel');
  const big = async (n, ms = 450) => { await page.waitForTimeout(ms); await scr().screenshot({ path: `shots/${n}.png` }); console.log('zrzut', n); };
  const click = async (sel, ms = 350) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
  const kiosk = (id) => click(`[data-kiosk="${id}"]`, 500);
  const home = async () => { for (let i = 0; i < 6 && !(await page.locator('.k-menu').count()); i++) { const b = page.locator('.k-ctx__back'); if (await b.count()) await b.first().click(); await page.waitForTimeout(300); } };
  const sec = async (name, ms = 450) => { await home(); await click(`.k-menu__it:has-text("${name}")`, ms); };
  const pill = (name, ms = 450) => click(`.k-ctx .k-pill:has-text("${name}")`, ms);
  await ev(`localStorage.removeItem('fpz-kiosk-sel')`);
  await mg(`a.env.set({ simTime: '12:00' })`); // stała pora dnia (tryb nocny z harmonogramu testujemy osobno)
  // scena z totemem
  await kiosk('TZ.T1.1'); await shot('kiosk-scene');
  await kiosk('TZ.T1.5'); await shot('kiosk-scene-t15');
  await click('.k-handset', 700); await shot('kiosk-scene-t15-offhook'); await ev(`document.querySelector('.k-handset').click()`); await page.waitForTimeout(500);
  // tryb „Sam ekran”
  await click('.k-sc-list .fpz-tab >> nth=1');
  await kiosk('TZ.T1.1'); await big('kiosk-t11-home');
  // mapa + wyszukiwarka z klawiaturą ekranową
  await sec('Nawigacja', 800); await big('kiosk-map');
  await click('.k-navpanel__search input');
  for (const ch of ['k', 'a', 'w']) await click(`.k-kbd button:text-is("${ch}")`, 120);
  await big('kiosk-map-kbd');
  await click('.k-flyout .k-res', 900); await big('kiosk-map-search');
  await click('.k-navpanel .k-pill:has-text("Usługi")', 500); await big('kiosk-map-services');
  await click('.k-flyout__head .fpz-iconbtn[aria-label="Zamknij"]');
  await click('.k-seg .fpz-iconbtn >> nth=1', 700); await big('kiosk-map-plan');
  const th = page.locator('.k-callout .k-lcorner--qr'); if (await th.count()) { await th.first().click(); await big('kiosk-qr-poi'); await click('.fpz-modal__head .fpz-iconbtn'); }
  // informator (pigułki w panelu kontekstowym)
  await sec('Informacje'); await big('kiosk-info-today');
  await pill('7 dni'); await big('kiosk-info-week');
  await pill('Kalendarz'); await big('kiosk-info-cal');
  await pill('7 dni');
  await click('.k-ev', 500); await big('kiosk-event');
  const buy = page.locator('.k-view .fpz-btn:has-text("Kup bilet")'); if (await buy.count()) { await buy.first().click(); await big('kiosk-qr-ticket'); await click('.fpz-modal__head .fpz-iconbtn'); }
  await pill('Informacje praktyczne'); await big('kiosk-info-practical');
  // historia: artykuły, galeria, podgląd ze swipe, filmy, wpis, oś czasu, zadanie
  await sec('Historia'); await big('kiosk-history');
  await pill('Galeria zdjęć'); await big('kiosk-gallery');
  await click('.k-filterbar .k-pill >> nth=0'); await big('kiosk-gallery-filter'); await click('.k-filterbar .k-pill >> nth=0');
  await click('.k-mosaic__it >> nth=1', 500);
  const box = await page.locator('.k-lb__img').boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
  await big('kiosk-lightbox');
  await click('.k-lb__top .fpz-iconbtn');
  await pill('Galeria filmów'); await big('kiosk-videos');
  await click('.k-vcard', 1600); await big('kiosk-video');
  await pill('Artykuły'); await click('.k-grid2 .k-card', 600); await big('kiosk-entry');
  await pill('Oś czasu'); await big('kiosk-timeline');
  const sb = await page.locator('.k-tl__slide').boundingBox();
  await page.mouse.move(sb.x + sb.width * 0.8, sb.y + 60); await page.mouse.down(); await page.mouse.move(sb.x + sb.width * 0.2, sb.y + 60, { steps: 6 }); await page.mouse.up();
  await big('kiosk-timeline-swipe');
  await pill('Ułóż oś czasu'); await big('kiosk-puzzle');
  const n = await page.locator('.k-pz-pool .k-pc').count();
  for (let i = 0; i < n; i++) {
    const card = page.locator('.k-pz-pool .k-pc').first(); const cb = await card.boundingBox();
    const era = page.locator('.k-pz-era').nth(i % 3); const eb = await era.boundingBox();
    await page.mouse.move(cb.x + 20, cb.y + 20); await page.mouse.down(); await page.mouse.move(cb.x + 50, cb.y + 50, { steps: 3 }); await page.mouse.move(eb.x + eb.width / 2, eb.y + 15, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(150);
  }
  await click('.k-puzzle .fpz-btn:has-text("Sprawdź")'); await big('kiosk-puzzle-checked');
  // wysokości (domyślnie „średni” → wózek → stojący → średni)
  await home();
  await click('.k-hbtn', 700); await big('kiosk-h-seated');
  await click('.k-hbtn', 700); await big('kiosk-h-standing');
  await sec('Nawigacja', 800); await big('kiosk-h-standing-map');
  await home(); await click('.k-hbtn', 700);
  // kontrast + EN + powiększenie
  await click('.fpz-a11y .fpz-iconbtn >> nth=0'); await click('.fpz-a11y .fpz-iconbtn >> nth=1'); await click('.fpz-a11y .fpz-iconbtn >> nth=2'); await big('kiosk-contrast-en');
  await click('.fpz-a11y .fpz-iconbtn >> nth=1'); await big('kiosk-en');
  await click('.fpz-a11y .fpz-iconbtn >> nth=3'); await click('.fpz-a11y .fpz-iconbtn >> nth=0');
  // PJM
  await click('.fpz-a11y .fpz-iconbtn >> nth=5', 2200); await big('kiosk-pjm'); await click('.fpz-modal__foot .fpz-btn');
  // tryb nocny i stany urządzenia
  await mg(`a.devices.set('TZ.T1.1', { night: true })`); await big('kiosk-night', 600);
  await mg(`a.devices.set('TZ.T1.1', { night: false, power: 'service' })`); await big('kiosk-service');
  await mg(`a.devices.set('TZ.T1.1', { power: 'fault' })`); await big('kiosk-fault');
  await mg(`a.devices.set('TZ.T1.1', { power: 'off' })`); await big('kiosk-off');
  await mg(`a.devices.set('TZ.T1.1', { power: 'on', brightness: 30 })`); await big('kiosk-dim');
  await mg(`a.devices.set('TZ.T1.1', { brightness: 80 })`);
  await sec('Historia');
  await mg(`a.devices.restart('TZ.T1.1')`); await big('kiosk-restart', 300); await page.waitForTimeout(1800);
  console.log('po restarcie ekran główny:', (await page.locator('.k-welcome').count()) === 1);
  // menu serwisowe: długie przytrzymanie rogu + PIN
  const cb = await page.locator('.k-corner').boundingBox();
  await page.mouse.move(cb.x + 10, cb.y + 10); await page.mouse.down(); await page.waitForTimeout(1700); await page.mouse.up(); await page.waitForTimeout(300);
  for (const d of ['1', '2', '3', '4']) await click(`.k-pin__pad button:text-is("${d}")`, 100);
  await big('kiosk-service-menu'); await click('.fpz-modal__foot .fpz-btn:has-text("Zamknij")');
  // wygaszacz (skrócony czas bezczynności) + reset ustawień poprzedniego użytkownika
  await sec('Informacje'); await click('.fpz-a11y .fpz-iconbtn >> nth=1'); await click('.k-hbtn', 300);
  await ev(`window.__fpzKiosk.idleMs = 1500`); await page.waitForTimeout(3200); await big('kiosk-attract', 200);
  await click('.k-attract');
  const reset = await ev(`(() => { const s = window.__fpzKiosk.getState(); const c = s.clients['kiosk:TZ.T1.1']; return c.contrast + '/' + c.lang + '/' + c.kNav.length + '/' + s.devices.find(d => d.id === 'TZ.T1.1').heightMode; })()`);
  console.log('reset po wygaszaczu (kontrast/język/stos/wysokość):', reset);
  await ev(`window.__fpzKiosk.idleMs = 0`);
  // pozostałe kioski
  for (const k of ['TZ.T1.2', 'TZ.T1.3', 'TZ.T1.4']) { await kiosk(k); await big('kiosk-home-' + k.replace(/\./g, '')); }
  // T1.5 – Dźwięki miasta
  await kiosk('TZ.T1.5'); await big('kiosk-t15-home');
  await click('.k-sc-hook', 600); await big('kiosk-t15-home-live');
  await sec('Dźwięki', 800);
  await click('.k-sc-hw .k-hw__btn >> nth=1', 500); await big('kiosk-t15-sound');
  await click('.k-now__ctl .fpz-iconbtn >> nth=1', 400); console.log('ścieżka po zmianie:', await page.locator('.k-now__title').innerText());
  await click('.k-sc-hook', 300);
  await sec('Kalendarium', 600); await big('kiosk-t15-calendar');
  await sec('Społeczność', 600); await big('kiosk-t15-community');
  await mg(`a.env.set({ simTime: '21:30' })`); await home(); await big('kiosk-t15-night', 600);
  await ev(`document.querySelectorAll('.k-sc-list .fpz-tab')[0].click()`); await page.waitForTimeout(600); await shot('kiosk-scene-night');
  await ev(`document.querySelectorAll('.k-sc-list .fpz-tab')[1].click()`); await page.waitForTimeout(400);
  await mg(`a.env.set({ simTime: '12:00' })`);
  console.log('dotknięcia T1.1:', await ev(`window.__fpzKiosk.getState().devices.find(d => d.id === 'TZ.T1.1').touchesToday`));
  if (errors.length) console.log('BŁĘDY:', errors);
};
