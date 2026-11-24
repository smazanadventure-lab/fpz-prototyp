const R = '.ep-validator';
const check = (c, m) => { if (!c) throw new Error('ASERCJA: ' + m); console.log('ok –', m); };
const res = async (page) => { await page.waitForSelector('[data-testid=v-result]'); return page.$eval('[data-testid=v-result]', (e) => ({ tone: e.dataset.tone, text: e.innerText.replace(/\s+/g, ' ') })); };
const dismiss = async (page) => { await page.click('[data-testid=v-result]', { position: { x: 30, y: 30 } }); await page.waitForTimeout(250); };
const scan = async (page, code) => { await page.fill('[data-testid=v-code]', code); await page.press('[data-testid=v-code]', 'Enter'); await page.waitForTimeout(150); return res(page); };
export default async (page, { shot }) => {
  await page.evaluate(() => localStorage.clear());
  check(await page.inputValue(`${R} input[name=v-login]`) === 'bileter' && await page.inputValue(`${R} input[name=v-pass]`) === 'bileter', 'logowanie: wypełnione bileter / bileter');
  await shot('validator-login'); await shot('login-validator');
  await page.click('[data-testid=v-login-acc-admin]'); await page.waitForTimeout(100);
  check(await page.inputValue(`${R} input[name=v-login]`) === 'admin' && !(await page.$('[data-testid=v-code]')), 'szybki wybór wpisuje dane admin (bez logowania)');
  await page.click('[data-testid=v-login-acc-bileter]'); await page.click('[data-testid=v-login-submit]'); await page.waitForTimeout(300);
  // nowy bilet kupiony „w aplikacji” pojawia się od razu w panelu testera
  const code = await page.evaluate(() => { const { makeApi, getState } = window.__fpzValidator; const api = makeApi('mobile'); api.auth.login('anna.kowalska@example.com', 'demo1234'); const p = getState().products.find((x) => x.eventId && x.active !== false); api.booking.addToCart(p.id, 1); const o = api.booking.checkout(); const r = api.booking.pay(o.order.id, {}); return r.tickets[0].code; });
  await page.waitForTimeout(200);
  check(await page.$(`${R} .v-tcode[data-code="FPZ:T:${code}"]`), 'nowy bilet z aplikacji widoczny w panelu testera');
  await shot('validator-ready');
  let r = await scan(page, `FPZ:T:${code}`); check(r.tone === 'ok' && r.text.includes('Bilet ważny'), 'bilet ważny: ' + r.text.slice(0, 80));
  await page.waitForTimeout(350); await shot('validator-ok');
  await page.waitForTimeout(3400); check(!(await page.$('[data-testid=v-result]')), 'automatyczny powrót do gotowości');
  r = await scan(page, code); check(r.tone === 'bad' && r.text.includes('już wykorzystany') && r.text.includes('Wykorzystany'), 'ponowny skan odrzucony (kiedy i gdzie)');
  await page.waitForTimeout(350); await shot('validator-used'); await dismiss(page);
  await page.click('[data-testid=v-unknown]'); r = await res(page); check(r.tone === 'bad' && r.text.includes('Nie znaleziono'), 'kod nieznany'); await dismiss(page);
  // nagroda i kupon z gry
  await page.evaluate(() => { const { makeApi, getState } = window.__fpzValidator; const api = makeApi('mobile'); const s = getState(); for (const rt of s.gameRoutes) for (const m of rt.missions) api.game.completeMission(m.id, { force: true }); const rw = s.rewards.slice().sort((a, b) => a.cost - b.cost)[0]; api.game.redeemReward(rw.id); for (const c of s.coupons) { if (api.game.claimCoupon(c.id).ok) break; } });
  await page.click(`${R} .fpz-tab:has-text("Nagrody")`); await page.waitForTimeout(150);
  await page.click(`${R} .v-tcode >> nth=0`); r = await res(page); check(r.tone === 'ok' && r.text.includes('Wydaj nagrodę'), 'nagroda: ' + r.text.slice(0, 80));
  await page.waitForTimeout(350); await shot('validator-reward'); await dismiss(page);
  await page.click(`${R} .v-tcode >> nth=0`); r = await res(page); check(r.tone === 'bad' && r.text.includes('już odebrana'), 'nagroda już odebrana'); await dismiss(page);
  await page.click(`${R} .fpz-tab:has-text("Kupony")`); await page.click(`${R} .v-tcode >> nth=0`); r = await res(page); check(r.tone === 'ok' && r.text.includes('Kupon przyjęty'), 'kupon przyjęty'); await dismiss(page);
  // wydarzenie: ostrzeżenie o bilecie na inne wydarzenie
  const ev = await page.evaluate(() => { const s = window.__fpzValidator.getState(); const t = s.tickets.find((x) => x.code === 'DEMO2K7P2X'); const other = [...document.querySelectorAll('[data-testid=v-event] option')].map((o) => o.value).find((v) => v && v !== t.eventId); return { other, own: t.eventId }; });
  if (ev.other) {
    await page.selectOption('[data-testid=v-event]', ev.other, { timeout: 2000 }).catch(() => null);
    const sel = await page.$eval('[data-testid=v-event]', (e) => e.value);
    if (sel === ev.other) { r = await scan(page, 'FPZ:T:DEMO2K7P2X'); check(r.tone === 'warn', 'ostrzeżenie: bilet na inne wydarzenie'); await shot('validator-other-event'); await page.click('[data-testid=v-allow]'); r = await res(page); check(r.tone === 'ok', 'wpuszczono mimo to'); await dismiss(page); }
  }
  await page.selectOption('[data-testid=v-event]', ev.own);
  await page.click(`${R} .fpz-tab:has-text("Historia")`); await page.waitForTimeout(200);
  const n = await page.evaluate(() => window.__fpzValidator.getState().stats.validations.length); check(n >= 6, 'historia walidacji: ' + n);
  await shot('validator-history');
};
