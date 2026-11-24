// Test arkusza kodów QR (/kody): karty, filtr, powiększenie, dekodowanie kodów (jsQR), zrzuty i PDF wydruku.
// Wymaga: node build.mjs --target=netlify; node tools/dev-server.mjs --port=8791 --data=.data-qr --fresh
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8791;
const BASE = 'https://fpz-prototyp.netlify.app';
const URL = `http://localhost:${PORT}/kody?base=${BASE}`;
const shots = path.join(root, 'shots'); fs.mkdirSync(shots, { recursive: true });
const JSQR = path.join(root, 'node_modules/jsqr/dist/jsQR.js');

let fails = 0;
const check = (cond, msg) => { if (cond) console.log('✓', msg); else { fails++; console.log('✗ NIE SPEŁNIONO:', msg); } };

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForSelector('.qs-root');
  await page.waitForFunction(() => window.__fpz?.getState().net.version > 0, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.addScriptTag({ path: JSQR });

  // dekodowanie: zrzut elementu (biały kwadrat z marginesem) → canvas → jsQR
  const decode = async (locator) => {
    const buf = await locator.screenshot();
    return page.evaluate(async (b64) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      return window.jsQR(img.data, img.width, img.height)?.data ?? null;
    }, buf.toString('base64'));
  };

  const st = await page.evaluate(() => {
    const s = window.__fpz.getState(); const qr = s.triggers.filter((t) => t.kind === 'qr');
    return { poi: qr.filter((t) => t.target?.type === 'poi' && t.active !== false).length, mission: qr.filter((t) => t.target?.type === 'mission' && t.active !== false).length,
      inactive: qr.filter((t) => t.active === false).length, entry: s.entries.find((e) => e.channels?.includes('mobile'))?.id, coupon: s.coupons[0]?.id };
  });
  console.log('dane:', st);
  const counts = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.qs-sec')].map((s) => [s.dataset.section, s.querySelectorAll('.qs-card').length])));
  const total = await page.locator('.qs-card').count();
  console.log('karty:', counts, 'razem', total);
  check(counts.places === st.poi && st.poi >= 18, `sekcja miejsc: ${counts.places} kart`);
  check(counts.game === st.mission && st.mission >= 15, `sekcja gry: ${counts.game} kart`);
  check(counts.kiosk >= 6, `sekcja kiosków: ${counts.kiosk} kart`);
  check(counts.errors === 1 + st.inactive, `sekcja błędnych: ${counts.errors} kart`);
  check(total >= 33 + counts.kiosk + counts.errors, `liczba kart ${total} ≥ 33 + kioski + błędne`);
  check(await page.locator('.qs-group__title').count() >= 2, 'misje pogrupowane trasami');
  // kolejność: miejsca Fabryki przed miejskimi
  const subs = await page.evaluate(() => [...document.querySelectorAll('[data-section=places] .qs-card')].map((c) => c.dataset.value));
  check(subs.every((v) => v.startsWith(`https://fpz-prototyp.netlify.app/q/FPZ-Q-`)), 'kody miejsc mają adres z parametru ?base');

  // dekodowanie (≥ 6)
  const want = [
    ['[data-section=places] .qs-card >> nth=0', null],
    ['[data-section=places] .qs-card >> nth=-1', null],
    ['[data-section=game] .qs-card >> nth=0', null],
    ['[data-section=kiosk] .qs-card >> nth=0', st.entry ? `E:${st.entry}` : null],
    ['[data-section=kiosk] .qs-card >> nth=-1', st.coupon ? `C:${st.coupon}` : null],
    ['[data-section=errors] .qs-card >> nth=0', `${BASE}/q/FPZ-Q-999`],
  ];
  let decoded = 0;
  for (const [selr, exp] of want) {
    const card = page.locator(selr); const expected = exp || await card.getAttribute('data-value');
    const got = await decode(card.locator('.qs-qr'));
    const ok = got === expected; if (ok) decoded++;
    check(ok, `dekodowanie ${await card.getAttribute('data-code')}: ${got}`);
  }
  check((await page.locator('[data-section=places] .qs-card >> nth=0').getAttribute('data-value')) === `${BASE}/q/FPZ-Q-101`, 'pierwszy kod miejsca = …/q/FPZ-Q-101');
  await page.evaluate(() => document.querySelector('.qs-root').scrollTo(0, 0)); await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(shots, 'qrsheet-desktop.png') });

  // filtr
  await page.click('.qs-chip[data-filter=game]'); await page.waitForTimeout(150);
  check(await page.locator('.qs-sec').count() === 1 && await page.locator('.qs-card').count() === counts.game, 'filtr „Gra terenowa” pokazuje tylko kody misji');
  await page.click('.qs-chip[data-filter=errors]'); await page.waitForTimeout(150);
  check(await page.locator('.qs-card').count() === counts.errors, 'filtr „Błędne”');
  await page.click('.qs-chip:has-text("Wszystkie")'); await page.waitForTimeout(150);
  check(await page.locator('.qs-card').count() === total, 'filtr „Wszystkie”');
  // rozmiar
  const w0 = (await page.locator('.qs-card .qs-qr >> nth=0').boundingBox()).width;
  await page.click('.qs-chip:has-text("Duże")'); await page.waitForTimeout(150);
  const w1 = (await page.locator('.qs-card .qs-qr >> nth=0').boundingBox()).width;
  check(w1 > w0 + 40, `rozmiar „Duże” powiększa kody (${Math.round(w0)} → ${Math.round(w1)} px)`);
  await page.click('.qs-chip:has-text("Normalne")'); await page.waitForTimeout(150);

  // powiększenie: klawiatura (Enter na karcie), strzałki, Esc
  await page.locator('[data-section=places] .qs-card >> nth=1').focus();
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  check(await page.isVisible('.qs-zoom'), 'Enter na karcie otwiera powiększenie');
  const code1 = await page.textContent('.qs-zoom__code');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  const code2 = await page.textContent('.qs-zoom__code');
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
  check(code1 !== code2 && (await page.textContent('.qs-zoom__code')) === code1, `strzałki: ${code1} → ${code2} → ${code1}`);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  const zbox = await page.locator('.qs-zoom__qr').boundingBox();
  check(Math.abs(zbox.width - Math.min(0.78 * 900, 520)) < 3, `powiększony kod ${Math.round(zbox.width)} px`);
  const zgot = await decode(page.locator('.qs-zoom__qr')); const zexp = await page.getAttribute('.qs-zoom__qr', 'data-value');
  if (zgot === zexp) decoded++;
  check(zgot === zexp, `dekodowanie w powiększeniu: ${zgot}`);
  await page.screenshot({ path: path.join(shots, 'qrsheet-zoom.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check(!(await page.isVisible('.qs-zoom')), 'Esc zamyka powiększenie');
  check(await page.evaluate(() => document.activeElement?.classList.contains('qs-card')), 'fokus wraca na kartę');
  await page.click('[data-section=game] .qs-card >> nth=2'); await page.waitForTimeout(150);
  check((await page.textContent('.qs-zoom__what')).includes('pkt'), 'powiększenie misji: opis z trasą i punktami');
  await page.mouse.click(8, 8); await page.waitForTimeout(150);
  check(!(await page.isVisible('.qs-zoom')), 'klik w tło zamyka powiększenie');

  // aktualizacja po zmianie danych (CMS): nowy nieaktywny kod QR → sekcja „błędne”
  const added = await page.evaluate(async () => {
    const api = window.__fpz.makeApi('cms'); const s = window.__fpz.getState();
    const r = await api.cms.save('triggers', { kind: 'qr', code: 'FPZ-Q-TEST', label: 'Kod wyłączony (test)', target: { type: 'poi', id: s.pois[0].id }, poiId: s.pois[0].id, active: false });
    return r?.ok !== false;
  });
  await page.waitForTimeout(400);
  if (added) {
    check(await page.locator('[data-section=errors] .qs-card[data-code="FPZ-Q-TEST"]').count() === 1, 'nowy nieaktywny kod pojawia się w sekcji „błędne” bez przeładowania');
    const g = await decode(page.locator('[data-section=errors] .qs-card[data-code="FPZ-Q-TEST"] .qs-qr'));
    if (g === `${BASE}/q/FPZ-Q-TEST`) decoded++;
    check(g === `${BASE}/q/FPZ-Q-TEST`, `dekodowanie kodu nieaktywnego: ${g}`);
  } else console.log('– zapis wyzwalacza przez CMS odrzucony (brak uprawnień) – pomijam test aktualizacji');
  console.log(`zdekodowano poprawnie: ${decoded}`);
  check(decoded >= 6, 'zdekodowano ≥ 6 kodów');

  // PDF wydruku
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'qrsheet.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });

  // telefon
  await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(300);
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.qs-grid')).gridTemplateColumns.split(' ').length);
  check(cols === 2, `telefon: ${cols} kolumny`);
  const mgot = await decode(page.locator('[data-section=places] .qs-card >> nth=0 >> .qs-qr'));
  check(mgot === `${BASE}/q/FPZ-Q-101`, `telefon: dekodowanie małej karty: ${mgot}`);
  check(await page.evaluate(() => document.querySelector('.qs-root').scrollWidth <= 390), 'telefon: brak przewijania w poziomie');
  await page.evaluate(() => document.querySelector('.qs-root').scrollTo(0, 0)); await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(shots, 'qrsheet-mobile.png') });
} finally { await browser.close(); }

check(errors.length === 0, `brak błędów konsoli${errors.length ? ': ' + errors.join(' | ') : ''}`);
console.log(fails ? `BŁĘDY: ${fails}` : 'OK – wszystkie testy zaliczone');
process.exit(fails ? 1 : 0);
