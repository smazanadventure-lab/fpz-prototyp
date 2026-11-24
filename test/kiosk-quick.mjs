// Szybki podgląd ekranu kiosku: node tools/shot.mjs --file=dist/dev-kiosk-signage.html --tab=kiosk --w=1400 --h=2000 --script=test/kiosk-quick.mjs
export default async (page, { errors }) => {
  const K = process.env.K || 'TZ.T1.1';
  const steps = (process.env.STEPS || '').split('|').filter(Boolean);
  const name = process.env.N || 'kiosk-q';
  // stała pora dnia (harmonogram trybu nocnego 18–6 nie wpływa na porównania); NIGHT=1 → 21:30
  await page.evaluate((t) => window.__fpzKiosk.makeApi('mgmt').env.set({ simTime: t }), process.env.NIGHT ? '21:30' : '12:00');
  if (process.env.H) await page.evaluate((h) => ['TZ.T1.1','TZ.T1.2','TZ.T1.3','TZ.T1.4','TZ.T1.5'].forEach((id) => window.__fpzKiosk.makeApi('mgmt').devices.set(id, { heightMode: h })), process.env.H);
  await page.click('.k-sc-list .fpz-tab:nth-child(2)');
  await page.click(`[data-kiosk="${K}"]`);
  await page.waitForTimeout(400);
  const scr = page.locator('.k-sc-bezel');
  for (const st of steps) {
    if (st.startsWith('eval:')) await page.evaluate(st.slice(5));
    else if (st.startsWith('wait:')) await page.waitForTimeout(+st.slice(5));
    else if (st.startsWith('shot:')) { await page.waitForTimeout(350); await scr.screenshot({ path: `shots/${st.slice(5)}.png` }); console.log('zrzut', st.slice(5)); }
    else await page.locator(st).first().click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  await scr.screenshot({ path: `shots/${name}.png` });
  console.log('zrzut', name, errors.length ? errors : '');
};
