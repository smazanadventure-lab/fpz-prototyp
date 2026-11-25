// Test plików multimedialnych na serwerze: CMS wgrywa zdjęcie, dwa filmy i nagranie → powiązania (wpis, film w playliście LCD,
// audioprzewodnik, „Dźwięki miasta”) → odtwarzanie w WWW, aplikacji, kioskach i na ekranie LCD → usunięcie plików → powrót do ilustracji/symulacji.
//   node build.mjs --target=netlify --site=site-a && node tools/dev-server.mjs --port=8791 --site=site-a --data=.data-a --fresh &
//   node test/media-flow.mjs --base=http://localhost:8791 [--dir=/tmp/media-test]
// Pliki testowe (ffmpeg): film.mp4 (6 s), film-duzy.mp4 (ok. 8 MB, 20 s), dzwiek.mp3 (8 s), zdjecie.jpg (4000 px).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const base = args.base || 'http://localhost:8791'; const dir = args.dir || '/tmp/media-test';
const F = (n) => path.join(dir, n);
for (const n of ['film.mp4', 'film-duzy.mp4', 'dzwiek.mp3', 'zdjecie.jpg']) if (!fs.existsSync(F(n))) { console.error('Brak pliku testowego', F(n)); process.exit(2); }
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = []; let fails = 0;
const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? '')); return ok; };
const IGNORE = /Failed to load resource|net::ERR_|ERR_FAILED|ERR_ABORTED/;
async function device(name, p, vp = { width: 1280, height: 800 }, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, ...opts }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`[${name}] console.error: ${m.text().slice(0, 300)}`); });
  await page.goto(base + p); await page.waitForFunction(() => window.__fpz && window.__fpz.getState().net.status === 'online' && window.__fpz.getState().net.version > 0, null, { timeout: 20000 });
  const d = { ctx, page, name, ev: (fn, arg) => page.evaluate(fn, arg), until: (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 200 }).then(() => true).catch(() => false), shot: (n) => page.screenshot({ path: `shots/${n}.png` }) };
  return d;
}
/** Wymuszenie przerysowania po zmianie stanu lokalnego końcówki (testowe skróty nawigacji). */
const poke = (d) => d.ev(() => window.__fpz.makeApi('web').stats.track('touch', 'media-test'));

// ── 0. CMS: logowanie, godzina dzienna (kioski i ekrany pracują wg harmonogramu) ──
const cms = await device('cms', '/cms', { width: 1500, height: 950 });
await cms.ev(() => window.__fpz.makeApi('sim').env.set({ simTime: '12:00' }));
await cms.page.locator('[data-testid=c-login-submit]').click(); await cms.page.waitForTimeout(400);
const nav = async (sec, sub) => { await cms.page.click(`.c-side__it:has-text("${sec}")`); if (sub) await cms.page.click(`.c-subnav button:has-text("${sub}")`); await cms.page.waitForTimeout(250); };
const modal = () => cms.page.locator('.fpz-modal').last();
/** Zrzut CMS bez przesunięcia całego dokumentu (scrollIntoView przewija także przodków panelu). */
const cmsShot = async (n) => { await cms.ev(() => { let e = document.querySelector('.c-app')?.parentElement; while (e) { e.scrollTop = 0; e = e.parentElement; } window.scrollTo(0, 0); }); await cms.shot(n); };

// ── 1. Biblioteka mediów: wgranie zdjęcia, dużego filmu i nagrania naraz (prawdziwe pole pliku) ──
await nav('Treści', 'Biblioteka mediów');
await cms.page.setInputFiles('[data-testid=media-upload]', [F('zdjecie.jpg'), F('film-duzy.mp4'), F('dzwiek.mp3')]);
const sawProgress = await cms.page.waitForFunction(() => [...document.querySelectorAll('[data-testid=media-queue] li[data-status=up]')].some((li) => /Wysyłanie… [1-9]\d*%/.test(li.innerText)), null, { timeout: 30000, polling: 'raf' }).then(() => true).catch(() => false);
await cms.shot('media-library-upload');
T('biblioteka: postęp wgrywania widoczny', sawProgress);
T('biblioteka: trzy pliki wgrane na serwer', await cms.until(() => window.__fpz.getState().media.filter((m) => m.stored === 'server').length === 3, null, 60000));
const lib = await cms.ev(() => { const m = window.__fpz.getState().media; const by = (t, n) => m.find((x) => x.type === t && (!n || x.name === n)); return { img: by('image'), big: by('video'), aud: by('audio') }; });
T('obraz zmniejszony (≤ 2560 px, jedna część)', lib.img && Math.max(lib.img.w, lib.img.h) <= 2560 && lib.img.parts === 1 && lib.img.w > 1000, JSON.stringify(lib.img));
T('duży film wysłany w częściach, długość odczytana', lib.big && lib.big.parts >= 3 && lib.big.durationSec === 20, JSON.stringify(lib.big));
T('nagranie: długość odczytana', lib.aud && lib.aud.durationSec === 8, JSON.stringify(lib.aud));
T('kolejka: wszystkie pliki „Wgrano”', await cms.until(() => document.querySelectorAll('[data-testid=media-queue] li[data-status=ok]').length === 3));
// zły plik → komunikat po polsku
await cms.page.setInputFiles('[data-testid=media-upload]', { name: 'uszkodzone.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(4096, 7) });
T('biblioteka: plik nieodtwarzalny odrzucony z komunikatem', await cms.until(() => [...document.querySelectorAll('[data-testid=media-queue] li[data-status=err]')].some((li) => /nie potrafi odtworzyć/.test(li.innerText)), null, 12000));
// szczegóły z prawdziwym podglądem
await cms.page.click(`[data-media="${lib.big.id}"]`);
T('szczegóły: podgląd wideo wczytany', await cms.until(() => { const v = document.querySelector('[data-testid=media-preview] video'); return v && v.readyState >= 1 && Math.round(v.duration) === 20; }));
await cms.page.waitForTimeout(400); await cms.shot('media-library-preview');
await modal().locator('button:has-text("Zamknij")').last().click();
await cms.page.click(`[data-media="${lib.img.id}"]`);
T('szczegóły: podgląd zdjęcia', await cms.until(() => { const i = document.querySelector('[data-testid=media-preview] img'); return i && i.complete && i.naturalWidth > 0; }));
await modal().locator('input[aria-label="Polski"]').first().fill('Hala w słońcu – zdjęcie testowe').catch(() => {});
await modal().locator('button:has-text("Zapisz")').click(); await cms.page.waitForTimeout(300);
await cms.shot('media-library');

// ── 2. Filmy: plik wideo dla rekordu z playlisty „Informator” (wgrany wprost z edytora) ──
const vid = await cms.ev(() => window.__fpz.getState().videos.find((v) => v.kind === 'studio'));
await nav('Treści', 'Filmy');
await cms.page.locator('tbody tr', { hasText: vid.title.pl }).first().click();
await cms.page.setInputFiles('[data-testid=mp-video-file]', F('film.mp4'));
T('Filmy: film wgrany z edytora i wybrany', await cms.until(() => /film\.mp4/.test(document.querySelector('[data-testid=mp-video]')?.innerText || ''), null, 30000));
T('Filmy: podgląd prawdziwego pliku w edytorze', await cms.until(() => !!document.querySelector('.c-vprev video.md-video__file')));
await cms.page.waitForTimeout(500); await cms.shot('media-video-editor');
await modal().locator('button:has-text("Zapisz")').last().click();
T('Filmy: zapisano src i długość z pliku', await cms.until((id) => { const v = window.__fpz.getState().videos.find((x) => x.id === id); return /^media:/.test(v.src || '') && v.durationSec === 6; }, vid.id));
const small = await cms.ev(() => window.__fpz.getState().media.find((m) => m.name === 'film.mp4'));

// ── 3. Wpis: zdjęcie, film, audioprzewodnik (MediaPicker → biblioteka) ──
const ent = await cms.ev(() => window.__fpz.getState().entries.find((e) => e.status === 'published' && e.audioGuide && ['mobile', 'web', 'kiosk'].every((c) => e.channels.includes(c)) && e.media[0]?.type === 'image'));
await nav('Treści', 'Wpisy');
await cms.page.fill('.c-page input[type=search]', ent.title.pl.slice(0, 18)); await cms.page.waitForTimeout(300);
await cms.page.locator('tbody tr', { hasText: ent.title.pl }).first().click(); await cms.page.waitForSelector('.c-editor');
const pick = async (testid, id) => { await cms.page.click(`[data-testid=${testid}-lib]`); await modal().locator(`[data-media="${id}"]`).click(); await cms.page.waitForTimeout(200); };
await cms.page.click('[data-testid=mp-item-0-lib]'); await cms.page.waitForTimeout(300); await cmsShot('media-picker');
await modal().locator(`[data-media="${lib.img.id}"]`).click();
const n = ent.media.length; await cms.page.click('[data-testid=c-madd-video]'); await pick(`mp-item-${n}`, lib.big.id);
await pick('mp-guide', lib.aud.id);
T('edytor: podgląd na żywo – zdjęcie, film i nagranie', await cms.until(() => { const p = document.querySelector('.c-preview'); const i = p?.querySelector('.fpz-media img'); return i && i.naturalWidth > 0 && !!p.querySelector('video.md-video__file') && !!p.querySelector('.md-audio--file audio'); }));
await cms.ev((i) => { const c = document.querySelector('.c-content'); const it = document.querySelectorAll('.c-mitem')[i]; c.scrollTop = it.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 120; }, n); await cms.page.waitForTimeout(400); await cmsShot('media-entry-editor');
await cms.page.click('.c-wf button:has-text("Zapisz zmiany")');
T('wpis: zapisano odwołania media:<id>', await cms.until(([id, img, big, aud]) => { const e = window.__fpz.getState().entries.find((x) => x.id === id); return e.media[0].ill === 'media:' + img && e.media.some((m) => m.type === 'video' && m.src === 'media:' + big) && e.audioGuide.src === 'media:' + aud; }, [ent.id, lib.img.id, lib.big.id, lib.aud.id]));

// ── 4. Ustawienia → Dźwięki miasta: nagranie dla ścieżki „Hala maszyn” ──
await nav('Ustawienia', 'Dźwięki miasta');
await cms.page.click('[data-testid=mp-sound-hala-lib]'); await modal().locator(`[data-media="${lib.aud.id}"]`).click();
T('Dźwięki miasta: zapisano settings.sounds', await cms.until((a) => window.__fpz.getState().settings.sounds?.hala === 'media:' + a, lib.aud.id));
await cms.page.waitForTimeout(300); await cms.shot('media-sounds');
await nav('Treści', 'Biblioteka mediów'); await cms.page.click(`[data-media="${lib.aud.id}"]`);
T('„Używane w”: wpis i dźwięki miasta', await cms.until(() => { const t = document.querySelector('[data-testid=media-uses]')?.innerText || ''; return /Wpis:/.test(t) && /Dźwięki miasta/.test(t); }));
await modal().locator('button:has-text("Zamknij")').last().click();

// ── 5. Zarządzanie ekspozycją: playlista „Informator” – zdjęcie z biblioteki, przypisanie do LCD-01 ──
const mg = await device('ekspozycja', '/ekspozycja', { width: 1400, height: 900 });
await mg.page.click('[data-testid=x-login-submit]'); await mg.page.waitForTimeout(400);
await mg.page.click('.x-nav__it:has-text("Treści i playlisty")'); await mg.page.waitForTimeout(300);
await mg.page.click('[data-pl=pl-info]');
const imgIdx = await mg.ev(() => window.__fpz.getState().playlists.find((p) => p.id === 'pl-info').items.findIndex((i) => i.type === 'image'));
await mg.page.locator(`.x-item[data-item="${imgIdx}"] select[aria-label="Obraz"]`).selectOption('media:' + lib.img.id);
const vIdx = await mg.ev(() => window.__fpz.getState().playlists.find((p) => p.id === 'pl-info').items.findIndex((i) => i.type === 'video'));
await mg.page.locator(`.x-item[data-item="${vIdx}"] select[aria-label="Film"]`).selectOption(vid.id);
T('playlista: film z plikiem – czas pozycji = długość pliku', await mg.until(([i, id]) => { const it = window.__fpz.getState().playlists.find((p) => p.id === 'pl-info').items[i]; return it.ref === id && +it.durationSec === 6; }, [vIdx, vid.id]));
const dur = mg.page.locator(`.x-item[data-item="${vIdx}"] input[aria-label="Czas trwania (s)"]`); await dur.fill('15'); await dur.press('Tab'); // dłuższa pozycja → film gra w pętli
const assigned = await mg.page.locator('[data-assign=LCD-01]').isChecked(); if (!assigned) await mg.page.check('[data-assign=LCD-01]');
T('playlista: zdjęcie z biblioteki i przypisanie do LCD-01', await mg.until((img) => { const s = window.__fpz.getState(); const items = s.playlists.find((p) => p.id === 'pl-info').items; return items.some((i) => i.ref === 'media:' + img) && items.some((i) => i.type === 'video' && +i.durationSec === 15) && s.devices.find((d) => d.id === 'LCD-01').playlistId === 'pl-info'; }, lib.img.id));
await mg.page.locator('.x-item[data-item="0"]').scrollIntoViewIfNeeded(); await mg.page.waitForTimeout(1500); await mg.shot('media-playlist');
await mg.ctx.close();

// ── 6. Strona WWW: artykuł ze zdjęciem, filmem (przewijanie) i nagraniem ──
const www = await device('www', '/www', { width: 1320, height: 900 });
await www.ev((id) => { window.__fpz.getState().clients.web = { ...(window.__fpz.getState().clients.web || {}), path: 'historia/wpis/' + id }; }, ent.id); await poke(www); await www.page.waitForTimeout(900);
await www.page.reload(); await www.page.waitForFunction(() => window.__fpz?.getState().net.status === 'online', null, { timeout: 15000 });
T('WWW: zdjęcie z serwera (naturalWidth > 0)', await www.until((id) => { const i = document.querySelector('.w-fig--hero img'); return i && i.complete && i.naturalWidth > 0 && i.src.includes('/api/media/' + id); }, lib.img.id));
const wv = '.w-video video.md-video__file';
T('WWW: odtwarzacz prawdziwego filmu', await www.until((sel) => !!document.querySelector(sel), wv));
await www.page.locator('.w-video').first().scrollIntoViewIfNeeded(); await www.page.locator('.w-video .md-video__big').first().click();
T('WWW: film gra (rośnie currentTime) i ma długość 20 s', await www.until((sel) => { const v = document.querySelector(sel); return v && v.currentTime > 1 && Math.round(v.duration) === 20 && !v.paused; }, wv, 20000));
const seekOk = await www.ev((sel) => new Promise((res) => { const v = document.querySelector(sel); const to = setTimeout(() => res(false), 10000); v.addEventListener('seeked', () => { clearTimeout(to); res(v.currentTime > 17); }, { once: true }); v.currentTime = v.duration - 2; }), wv);
T('WWW: przewijanie blisko końca dużego pliku (seeked)', seekOk);
T('WWW: czas na pasku odtwarzacza z prawdziwej długości', await www.until(() => /0:1[7-9] \/ 0:20|0:20 \/ 0:20/.test(document.querySelector('.w-video .md-time')?.innerText || '')));
await www.page.waitForTimeout(300); await www.shot('media-www');
await www.page.locator('.w-aside__card .md-btn--main').first().click();
T('WWW: audioprzewodnik gra nagranie', await www.until(() => { const a = document.querySelector('.w-aside__card audio'); return a && a.currentTime > 0.3; }));
await www.page.locator('.w-aside__card .md-btn--main').first().click();

// ── 7. Aplikacja (/app) ──
const tel = await device('aplikacja', '/app', { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await tel.page.waitForSelector('.m-onb', { timeout: 8000 }); await tel.page.click('.m-onb .fpz-btn'); await tel.page.click('.m-tut__skip button'); await tel.page.waitForSelector('.m-bnav');
await tel.ev((id) => window.__fpzMobile.push('entry', { id }), ent.id);
T('aplikacja: zdjęcie wpisu z serwera', await tel.until(() => { const i = document.querySelector('.m-entry__hero img'); return i && i.complete && i.naturalWidth > 0; }));
await tel.page.waitForTimeout(400); await tel.shot('media-app');
T('aplikacja: audioprzewodnik z nagraniem', await tel.until(() => !!document.querySelector('.m-entry .md-audio--file audio')));
await tel.page.locator('.m-vid').first().scrollIntoViewIfNeeded(); await tel.page.locator('.m-vid .md-video__big').first().click();
T('aplikacja: film gra', await tel.until(() => { const v = document.querySelector('.m-vid video.md-video__file'); return v && v.currentTime > 1 && Math.round(v.duration) === 20; }, null, 20000));
await tel.page.waitForTimeout(300); await tel.shot('media-app-video');

// ── 8. Kiosk TZ.T1.3: wpis i ekran filmu ──
const kiosk = await device('kiosk', '/kiosk/TZ.T1.3', { width: 540, height: 960 });
const kNav = async (stack) => { await kiosk.ev((st) => { const c = window.__fpz.getState().clients; c['kiosk:TZ.T1.3'] = { ...(c['kiosk:TZ.T1.3'] || {}), kNav: st }; }, stack); await poke(kiosk); await kiosk.page.waitForTimeout(500); };
await kNav([{ v: 'home' }, { v: 'entry', p: { id: ent.id } }]);
T('kiosk: zdjęcie wpisu z serwera', await kiosk.until(() => { const i = document.querySelector('.k-entry__fig img'); return i && i.complete && i.naturalWidth > 0; }));
T('kiosk: audioprzewodnik z nagraniem', await kiosk.until(() => !!document.querySelector('.k-entry .md-audio--file audio')));
await kiosk.shot('media-kiosk');
await kNav([{ v: 'home' }, { v: 'videos' }, { v: 'video', p: { id: vid.id } }]);
T('kiosk: film z rekordu „Filmy” gra (autoodtwarzanie)', await kiosk.until(() => { const v = document.querySelector('.k-video video.md-video__file'); return v && v.currentTime > 0.5 && Math.round(v.duration) === 6; }, null, 20000));
await kiosk.page.waitForTimeout(300); await kiosk.shot('media-kiosk-video');

// ── 9. Ekran LCD-01: film w pętli playlisty i zdjęcie ──
const lcd = await device('lcd', '/lcd/LCD-01', { width: 1280, height: 720 });
T('LCD: pozycja wideo odtwarza prawdziwy plik', await lcd.until(() => { const v = document.querySelector('.s-video video.md-video__file'); return v && v.currentTime > 0.5; }, null, 60000));
const loopSeen = await lcd.ev(() => new Promise((res) => { let hi = false; const t0 = Date.now(); const i = setInterval(() => { const v = document.querySelector('.s-video video.md-video__file'); if (!v) { clearInterval(i); res(false); return; } if (v.currentTime > 4.5) hi = true; else if (hi && v.currentTime < 2.5 && v.currentTime > 0) { clearInterval(i); res(true); } if (Date.now() - t0 > 14000) { clearInterval(i); res(false); } }, 150); }));
T('LCD: film zapętla się w czasie pozycji playlisty', loopSeen);
await lcd.shot('media-lcd');
T('LCD: zdjęcie z biblioteki na planszy obrazu', await lcd.until(() => { const i = document.querySelector('.s-image img'); return i && i.complete && i.naturalWidth > 0; }, null, 60000));
await lcd.page.waitForTimeout(500); await lcd.shot('media-lcd-image');

// ── 10. Kiosk TZ.T1.5 „Dźwięki miasta”: nagranie zamiast syntezy, słupki poziomu ──
const snd = await device('kiosk-dzwieki', '/kiosk/TZ.T1.5', { width: 540, height: 960 });
await snd.page.waitForTimeout(500); await snd.page.keyboard.press('Space');
T('T1.5: gra plik nagrania (audio.currentTime > 0)', await snd.until(() => { const a = document.querySelector('audio[data-fpz-sound=hala]'); return a && a.currentTime > 0.5 && !a.paused; }, null, 15000));
const bars = async () => snd.ev(() => [...document.querySelectorAll('.k-viz.is-live i')].map((i) => parseFloat(i.style.height) || 0));
const b1 = await bars(); await snd.page.waitForTimeout(450); const b2 = await bars();
T('T1.5: słupki poziomu reagują na nagranie', b1.length > 0 && Math.max(...b2) > 20 && b1.some((x, i) => Math.abs(x - b2[i]) > 1), JSON.stringify([b1.slice(0, 6), b2.slice(0, 6)]));
await snd.shot('media-kiosk-sound');

// ── 11. Usunięcie plików w CMS → końcówki wracają do ilustracji / symulacji ──
await nav('Treści', 'Biblioteka mediów');
for (const m of [lib.img, lib.big, lib.aud, small]) {
  await cms.page.click(`[data-media="${m.id}"]`); await cms.page.click('[data-testid=media-delete]');
  if (m.id !== small.id) T(`usuwanie „${m.name}”: ostrzeżenie o użyciu`, await cms.until(() => /Plik jest używany/.test(document.querySelector('.c-confirm')?.innerText || ''), null, 3000));
  await cms.page.locator('.fpz-modal').last().locator('button:has-text("Usuń plik")').click();
  await cms.until((id) => !window.__fpz.getState().media.some((x) => x.id === id), m.id);
}
T('CMS: biblioteka pusta', await cms.until(() => window.__fpz.getState().media.length === 0));
T('serwer: pliki usunięte (404)', (await Promise.all([lib.img, lib.big, lib.aud, small].map(async (m) => (await fetch(`${base}/api/media/${m.id}`)).status))).every((s) => s === 404));
T('WWW: wraca ilustracja i symulacja filmu', await www.until(() => !document.querySelector('.w-fig--hero img') && !!document.querySelector('.w-fig--hero svg') && !document.querySelector('video.md-video__file') && !!document.querySelector('.w-video .md-video__kb') && !document.querySelector('.md-audio--file'), null, 20000));
T('aplikacja: wraca ilustracja i symulacja', await tel.until(() => !document.querySelector('.m-entry__hero img') && !document.querySelector('video.md-video__file') && !document.querySelector('.md-audio--file'), null, 20000));
await kNav([{ v: 'home' }, { v: 'videos' }, { v: 'video', p: { id: vid.id } }]); // (kiosk mógł w międzyczasie przejść w wygaszacz)
T('kiosk: wraca symulacja filmu', await kiosk.until(() => !document.querySelector('video.md-video__file') && !!document.querySelector('.k-video .md-video__kb'), null, 20000));
T('LCD: bez pliku wideo', await lcd.until(() => !document.querySelector('video.md-video__file'), null, 20000));
await snd.page.keyboard.press('Space'); await snd.page.waitForTimeout(900); await snd.page.keyboard.press('Space');
T('T1.5: po usunięciu – synteza (bez elementu audio), słupki działają', await snd.until(() => !document.querySelector('audio[data-fpz-sound]') && [...document.querySelectorAll('.k-viz.is-live i')].some((i) => parseFloat(i.style.height) > 9), null, 10000));
await www.page.waitForTimeout(500); await www.shot('media-www-after');

// ── wynik ──
await browser.close();
if (errors.length) { console.log('\nBłędy konsoli:'); errors.forEach((e) => console.log('  ' + e)); }
console.log(`\n${fails ? `✗ ${fails} niepowodzeń` : '✓ wszystkie sprawdzenia zaliczone'} · błędy konsoli: ${errors.length}`);
process.exit(fails || errors.length ? 1 : 0);
