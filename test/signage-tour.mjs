// node tools/shot.mjs --file=dist/dev-kiosk-signage.html --tab=signage --w=1500 --h=1000 --script=test/signage-tour.mjs
export default async (page, { shot, errors }) => {
  const api = (code) => page.evaluate(code);
  const mon = page.locator('.s-mon__panel');
  const big = async (n) => { await page.waitForTimeout(700); await mon.screenshot({ path: `shots/${n}.png` }); console.log('zrzut', n); };
  await page.click('[data-screen="LCD-02"]'); await page.waitForTimeout(500);
  await shot('signage-lcd02');
  // przejdź przez wszystkie pozycje playlisty: przesuwamy zegar przeglądarki
  const types = await api(`(() => { const s = window.__fpzKiosk.getState(); return s.playlists.find(p => p.id === s.devices.find(d => d.id === 'LCD-02').playlistId).items.map(i => i.type + ':' + i.durationSec); })()`);
  console.log('playlista LCD-02:', types.join(', '));
  const seen = new Set();
  for (let i = 0; i < 14 && seen.size < 4; i++) {
    const txt = await page.locator('.s-status').innerText();
    const k = (txt.match(/Pozycja\s+(\d+)\/\d+/) || [])[1];
    if (k && !seen.has(k)) { seen.add(k); await big('signage-lcd02-item' + k); }
    await page.waitForTimeout(2600);
  }
  // synchronizacja: przypisz LCD-01 tę samą playlistę i porównaj pozycję
  await api(`window.__fpzKiosk.makeApi('mgmt').devices.set('LCD-01', { playlistId: 'pl-info' })`);
  const pos = async (id) => { await page.click(`[data-screen="${id}"]`); await page.waitForTimeout(200); return (await page.locator('.s-status').innerText()).match(/Pozycja\s+\S+/)[0]; };
  const a = await pos('LCD-01'), b = await pos('LCD-02'); console.log('synchronizacja:', a, '|', b);
  await api(`window.__fpzKiosk.makeApi('mgmt').devices.set('LCD-01', { playlistId: 'pl-scena' })`);
  // napisy na żywo
  await page.click('[data-screen="LCD-01"]'); await page.waitForTimeout(300);
  await api(`(() => { const a = window.__fpzKiosk.makeApi('mgmt'); a.live.start('Debata: przyszłość Fabryki Pełnej Życia'); ['Dzień dobry, witamy w Hali Ząbkowice.', 'Za chwilę rozpoczniemy debatę o przyszłości terenu fabryki.', 'Pierwszy głos zabierze przedstawicielka mieszkańców Śródmieścia.', 'Chcemy, aby hale były otwarte dla wszystkich – także wieczorem.'].forEach(t => a.live.caption(t)); })()`);
  await big('signage-captions');
  await shot('signage-captions-scene');
  await api(`window.__fpzKiosk.makeApi('mgmt').live.stop()`);
  // projektor + stany urządzenia
  await page.click('[data-screen="PRJ-01"]'); await page.waitForTimeout(800); await shot('signage-prj');
  await api(`window.__fpzKiosk.makeApi('mgmt').devices.set('LCD-02', { power: 'service' })`); await page.click('[data-screen="LCD-02"]'); await big('signage-service');
  await api(`window.__fpzKiosk.makeApi('mgmt').devices.set('LCD-02', { power: 'on', night: true, brightness: 40 })`); await big('signage-night');
  await api(`window.__fpzKiosk.makeApi('mgmt').devices.set('LCD-02', { night: false, brightness: 80 })`);
  if (errors.length) console.log('BŁĘDY', errors);
};
