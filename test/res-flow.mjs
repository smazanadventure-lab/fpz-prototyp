// Pełna ścieżka E2E systemu rezerwacji w obu kanałach (telefon + WWW) na wspólnym stanie.
import { open } from './res-lib.mjs';
import { fileURLToPath } from 'node:url';
const { browser, page, errors, M, W, shot } = await open();
const ok = (c, msg) => { if (!c) throw new Error('ASERCJA: ' + msg); console.log('✓ ' + msg); };
const wait = (ms) => page.waitForTimeout(ms);
const sec = (host, name) => host.locator('.r-secnav__b', { hasText: name }).click();
try {
  await wait(300); await shot('home');
  // 1. przeglądanie: lista + kalendarz
  await sec(M, 'Wydarzenia'); await sec(W, 'Wydarzenia'); await wait(300);
  await W.getByRole('tab', { name: 'Kalendarz' }).click(); await M.getByRole('tab', { name: 'Kalendarz' }).click(); await wait(300);
  ok(await W.locator('.r-cal__day.has-ev').count() > 0, 'kalendarz pokazuje dni z wydarzeniami');
  await shot('calendar');
  await M.getByRole('tab', { name: 'Lista' }).click();
  await M.locator('.fpz-chip', { hasText: 'Koncerty' }).click(); await wait(200);
  ok(await M.locator('.r-ecard').count() >= 1, 'filtr kategorii Koncerty');
  await M.locator('.fpz-chip', { hasText: 'Wszystko' }).click();
  await M.getByPlaceholder('Szukaj wydarzeń…').fill('Młoda'); await wait(200);
  ok(await M.locator('.r-ecard').count() === 1, 'wyszukiwarka zawęża listę');
  await shot('events');
  // 2. szczegóły wydarzenia + koszyk
  await M.locator('.r-ecard').first().getByRole('button', { name: 'Kup bilet' }).click(); await wait(300);
  await M.getByRole('button', { name: /Więcej: Bilet normalny/ }).click();
  await M.locator('.r-prod').first().getByRole('button', { name: 'Dodaj do koszyka' }).click(); await wait(200);
  await M.locator('.r-prod').nth(1).getByRole('button', { name: 'Dodaj do koszyka' }).click(); await wait(200);
  ok((await M.locator('.r-cartbtn .fpz-iconbtn__badge').innerText()) === '3', 'licznik koszyka = 3');
  await M.getByRole('button', { name: 'Pokaż na mapie' }).first().click();
  ok(await page.evaluate(() => window.__fpz.mapCalls.length) === 1, 'Pokaż na mapie → nav.showOnMap');
  await page.evaluate(() => window.__fpz.open_web('event', 'koncert-mloda-scena')); await wait(400);
  await shot('event');
  await M.locator('.r-cartbar').getByRole('button').click(); await wait(300);
  await M.getByRole('button', { name: /Więcej: Bilet ulgowy/ }).click(); await wait(100);
  await shot('cart', 'mobile');
  await M.getByRole('button', { name: 'Przejdź do kasy' }).click(); await wait(300);
  ok(await M.getByText('Zaloguj się lub załóż konto, aby kupić bilety').count() === 1, 'kasa wymaga logowania');
  // walidacja formularza rejestracji
  ok(await M.getByLabel('Adres e-mail').inputValue() === 'anna.kowalska@example.com' && await M.getByLabel('Hasło').inputValue() === 'demo1234', 'makieta logowania: wypełnione dane konta testowego');
  await M.locator('.r-auth').scrollIntoViewIfNeeded(); await M.locator('.r-mock').scrollIntoViewIfNeeded(); await wait(100);
  await M.screenshot({ path: fileURLToPath(new URL('../shots/login-res-mobile.png', import.meta.url)) }); console.log('zrzut: shots/login-res-mobile.png');
  await M.getByRole('tab', { name: 'Rejestracja' }).click();
  ok(await M.getByLabel('Adres e-mail').inputValue() === '' && await M.getByLabel('Hasło').inputValue() === '', 'rejestracja: pola puste');
  await M.getByRole('button', { name: 'Załóż konto' }).click(); await wait(100);
  ok(await M.getByText('Zaznacz wymagane zgody.').count() === 1, 'walidacja rejestracji (zgody)');
  await M.getByRole('tab', { name: 'Logowanie' }).click();
  await M.getByLabel('Adres e-mail').fill('anna.kowalska@example.com'); await M.getByLabel('Hasło').fill('zle-haslo'); await M.getByRole('button', { name: 'Zaloguj', exact: true }).click(); await wait(100);
  ok(await M.getByText('Nieprawidłowy e-mail lub hasło.').count() >= 1, 'komunikat z API przy złym haśle');
  await shot('login', 'mobile');
  await M.getByLabel('Hasło').fill('demo1234'); await M.getByRole('button', { name: 'Zaloguj', exact: true }).click(); await wait(300);
  await M.getByRole('button', { name: /Zamawiam i płacę/ }).click(); await wait(100);
  ok(await M.getByText('Zaakceptuj regulamin, aby kontynuować.').count() >= 1, 'wymagana akceptacja regulaminu');
  await M.getByText('Akceptuję regulamin sprzedaży').click();
  await shot('checkout', 'mobile');
  await M.getByRole('button', { name: /Zamawiam i płacę/ }).click(); await wait(300);
  ok(await M.locator('.r-gw').count() === 1, 'bramka operatora płatności');
  await M.locator('.r-gw__m', { hasText: 'Karta' }).click(); await wait(100); await shot('pay-card', 'mobile');
  await M.locator('.r-gw__m', { hasText: 'BLIK' }).click(); await wait(100); await shot('pay-blik', 'mobile');
  // płatność odrzucona
  await M.getByRole('button', { name: 'Przejdź do potwierdzenia' }).click(); await wait(1800);
  await shot('sca', 'mobile');
  await M.getByRole('button', { name: 'Odrzuć' }).click(); await wait(900);
  ok(await M.getByText('Płatność nie powiodła się').count() === 1, 'odrzucona płatność obsłużona');
  await shot('pay-failed', 'mobile');
  await M.getByRole('button', { name: 'Ponów płatność' }).click();
  await M.getByRole('button', { name: 'Przejdź do potwierdzenia' }).click(); await wait(1800);
  await M.getByRole('button', { name: 'Zatwierdź płatność testową' }).click(); await wait(1000);
  ok(await M.getByText('Dziękujemy! Płatność przyjęta').count() >= 1, 'potwierdzenie zakupu');
  const n = await M.locator('.r-ticket').count(); ok(n === 4, 'wydano 4 bilety z QR (2 normalne + 2 ulgowe)');
  await shot('confirm', 'mobile');
  const code = await M.locator('.r-ticket').first().getAttribute('data-code');
  // 3. WWW: to samo konto → bilety
  await W.locator('.r-secnav__b', { hasText: 'Moje bilety' }).click(); await wait(200);
  await W.screenshot({ path: fileURLToPath(new URL('../shots/login-res.png', import.meta.url)) }); console.log('zrzut: shots/login-res.png');
  await W.getByRole('button', { name: 'Zaloguj', exact: true }).click(); await wait(300);
  ok(await W.locator(`.r-ticket[data-code="${code}"]`).count() === 1, 'bilet widoczny w kanale WWW');
  // 4. walidacja przez stanowisko bileterskie
  const vr = await page.evaluate((c) => window.__fpz.makeApi('validator').tickets.validate('FPZ:T:' + c, { gate: 'Brama A' }), code); await wait(200);
  ok(vr.ok, 'walidacja biletu OK');
  ok(/wykorzystany.*brama a/i.test(await M.locator(`.r-ticket[data-code="${code}"] .r-ticket__status`).innerText()), 'status „wykorzystany” w aplikacji');
  ok(/wykorzystany.*brama a/i.test(await W.locator(`.r-ticket[data-code="${code}"] .r-ticket__status`).innerText()), 'status „wykorzystany” na WWW');
  await shot('tickets');
  // 5. zwrot innego zamówienia (demo) na WWW
  await W.getByRole('tab', { name: /Zamówienia/ }).click(); await wait(200);
  await shot('orders', 'web');
  await W.locator('.r-orow', { hasText: '000101' }).click(); await wait(300);
  await W.getByRole('button', { name: 'Zwróć bilety' }).click(); await wait(200);
  await shot('refund', 'web');
  await page.locator('.fpz-modal').getByRole('button', { name: /Potwierdź zwrot/ }).click(); await wait(300);
  ok(await W.locator('.fpz-tag', { hasText: /zwrócone/i }).count() >= 1, 'zamówienie zwrócone');
  ok(await page.evaluate(() => window.__fpz.getState().tickets.filter((t) => t.orderId === 'ord-demo1').every((t) => t.status === 'refunded')), 'bilety zamówienia unieważnione');
  // odmowa zwrotu dla zamówienia z wykorzystanym biletem
  await M.locator('.r-secnav__b', { hasText: 'Moje bilety' }).click(); await M.getByRole('tab', { name: /Zamówienia/ }).click(); await wait(200);
  await M.locator('.r-orow').first().click(); await wait(300);
  ok(await M.getByText('Co najmniej jeden bilet został już wykorzystany.').count() === 1, 'powód odmowy zwrotu');
  await shot('order-denied', 'mobile');
  // 6. zapytanie o termin (WWW) i odpowiedź z CMS
  await W.locator('.r-secnav__b', { hasText: 'Obiekty' }).click(); await wait(200);
  await shot('venues', 'web');
  await W.locator('.fpz-chip', { hasText: 'Kontakty' }).click(); await wait(200); await shot('contacts', 'web');
  await W.locator('.fpz-chip', { hasText: 'Gastronomia' }).click(); await wait(200);
  await W.locator('.r-vcard', { hasText: 'Bistro Kotłownia' }).getByRole('button', { name: /Dowiedz się więcej/ }).click(); await wait(300);
  await shot('venue', 'web');
  await W.getByRole('button', { name: 'Zapytaj o termin' }).click(); await wait(200);
  await page.locator('.fpz-modal').getByLabel('Liczba osób').fill('6');
  await page.locator('.fpz-modal').getByLabel('Wiadomość').fill('Stolik dla 6 osób, urodziny.');
  await shot('inquiry-form', 'web');
  await page.locator('.fpz-modal').getByRole('button', { name: 'Wyślij zapytanie' }).click(); await wait(300);
  ok(await W.locator('.r-inq li[data-status="new"]').count() >= 1, 'zapytanie wysłane, status „nowe”');
  const qid = await page.evaluate(() => window.__fpz.getState().inquiries.find((q) => q.message.includes('urodziny')).id);
  await page.evaluate((id) => window.__fpz.makeApi('cms').cms.replyInquiry(id, { status: 'confirmed', reply: 'Potwierdzamy rezerwację stolika na 6 osób.' }), qid); await wait(200);
  ok(await W.getByText('Potwierdzamy rezerwację stolika').count() === 1, 'odpowiedź obiektu widoczna na żywo (WWW)');
  await M.getByRole('button', { name: /Konto/ }).click(); await wait(200); await M.locator('.r-tile', { hasText: 'Moje zapytania' }).click(); await wait(200);
  ok(await M.getByText('Potwierdzamy rezerwację stolika').count() === 1, 'odpowiedź widoczna w aplikacji');
  await shot('inquiries');
  await M.locator('.r-secnav__b', { hasText: 'Obiekty' }).click(); await wait(200);
  await M.locator('.r-vcard', { hasText: 'Kawiarnia' }).getByRole('button', { name: /Dowiedz/ }).click(); await wait(300);
  await shot('venue-mobile', 'mobile');
  await M.getByRole('button', { name: 'Zapytaj o termin' }).click(); await wait(300);
  await shot('inquiry-sheet', 'mobile');
  await page.locator('#host-mobile .fpz-modal').getByRole('button', { name: 'Zamknij' }).click(); await wait(200);
  await M.getByRole('button', { name: /Konto/ }).click(); await wait(200);
  // 7. profil
  await M.getByLabel('Telefon').fill('+48 600 111 222'); await M.getByRole('button', { name: 'Zapisz dane' }).click(); await wait(100);
  ok(await page.evaluate(() => window.__fpz.getState().users[0].phone) === '+48 600 111 222', 'aktualizacja profilu');
  await shot('account');
  // 8. offline / wolna sieć
  await page.evaluate(() => window.__fpz.makeApi('sim').env.set({ network: 'offline' })); await wait(200);
  await M.locator('.r-secnav__b', { hasText: 'Moje bilety' }).click(); await W.locator('.r-secnav__b', { hasText: 'Wydarzenia' }).click(); await wait(300);
  ok(await M.locator('.r-offline').count() === 1 && await M.locator('.r-ticket').count() > 0, 'offline: baner + bilety widoczne');
  await W.getByRole('tab', { name: 'Lista' }).click(); await W.locator('.fpz-chip', { hasText: 'Koncerty' }).click(); await W.locator('.r-ecard').first().getByRole('button', { name: /Dowiedz/ }).click(); await wait(300);
  ok(await W.getByRole('button', { name: 'Dodaj do koszyka' }).first().isDisabled(), 'offline: zakup zablokowany');
  await shot('offline');
  await page.evaluate(() => window.__fpz.makeApi('sim').env.set({ network: 'slow' }));
  await W.locator('.r-secnav__b', { hasText: 'Start' }).click(); await wait(150);
  ok(await W.locator('.r-skel').count() === 1, 'szkielet ładowania przy wolnej sieci');
  await shot('slow', 'web'); await wait(900);
  ok(await W.locator('.r-skel').count() === 0, 'szkielet znika');
  await page.evaluate(() => window.__fpz.makeApi('sim').env.set({ network: 'online' }));
  // 9. EN + wysoki kontrast + tryb nocny
  await page.evaluate(() => { window.__fpz.setClient('mobile', { lang: 'en' }); window.__fpz.setClient('web', { lang: 'en' }); }); await wait(200);
  await sec(M, 'Events'); await W.locator('.r-secnav__b', { hasText: 'Events' }).click(); await wait(300);
  await W.getByRole('tab', { name: 'Calendar' }).click(); await wait(200);
  await shot('en');
  await page.evaluate(() => { window.__fpz.setClient('mobile', { contrast: 'high' }); window.__fpz.setClient('web', { contrast: 'high' }); }); await wait(200);
  await M.locator('.r-secnav__b', { hasText: 'My tickets' }).click(); await wait(300);
  await shot('contrast');
  await page.evaluate(() => { window.__fpz.setClient('mobile', { contrast: 'normal', theme: 'night', lang: 'pl' }); window.__fpz.setClient('web', { contrast: 'normal', theme: 'night', lang: 'pl' }); }); await wait(200);
  await W.locator('.r-secnav__b', { hasText: 'Start' }).click(); await wait(300);
  await shot('night');
} catch (e) { console.error('BŁĄD:', e.message.split('\n').slice(0, 8).join('\n')); await shot('flow-error'); errors.push('flow'); }
await browser.close();
if (errors.length) { console.error('BŁĘDY:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK – pełna ścieżka bez błędów konsoli');
