// Test „film na ekranie LCD” (zgłoszenie testera): wgranie filmu z panelu zarządzania prosto do playlisty, wczytanie filmu do pamięci ekranu,
// pozycje z usuniętym filmem, napisy na żywo, plik w formacie nieobsługiwanym przez przeglądarkę ekranu (H.265), plik z indeksem na końcu.
//   node build.mjs --target=netlify && node test/film-flow.mjs          (test sam uruchamia i zatrzymuje serwer na porcie 8797)
// Pliki testowe (/tmp/media-test): krotki-duzy.mp4 (H.264 1080p30, 5 s, ok. 33 Mb/s), hevc60.mp4 (H.265 1080p60, 5,35 s, bez dźwięku),
// koniec-moov.mp4 (H.264, 45 s, indeks moov na końcu). Przykładowe polecenia ffmpeg (parametry orientacyjne):
//   ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine -t 5 -c:v libx264 -profile:v baseline -b:v 32M -maxrate 32M -bufsize 64M -c:a aac -movflags +faststart krotki-duzy.mp4
//   ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=60 -t 5.35 -c:v libx265 -tag:v hvc1 -b:v 32M -an -movflags +faststart hevc60.mp4
//   ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=25 -f lavfi -i sine -t 45 -c:v libx264 -b:v 3.6M -c:a aac koniec-moov.mp4
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const PORT = +(args.port || 8797); const base = `http://localhost:${PORT}`; const dir = args.dir || '/tmp/media-test'; const F = (n) => path.join(dir, n);
for (const n of ['krotki-duzy.mp4', 'hevc60.mp4', 'koniec-moov.mp4']) if (!fs.existsSync(F(n))) { console.error('Brak pliku testowego', F(n)); process.exit(2); }
if (!fs.existsSync(path.join(root, 'dist/site/index.html'))) { console.error('Brak dist/site – najpierw: node build.mjs --target=netlify'); process.exit(2); }
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });

// ── serwer testowy (z opóźnieniem odpowiedzi API, jak w sieci) ──
const srv = spawn(process.execPath, ['tools/dev-server.mjs', `--port=${PORT}`, '--fresh', '--blobs', '--delay=300', '--data=.tmp-film'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let srvLog = ''; srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
const stop = () => { try { srv.kill('SIGTERM'); } catch { /* nic */ } };
process.on('exit', stop);
for (let i = 0; i < 60 && !/Serwer testowy/.test(srvLog); i++) await new Promise((r) => setTimeout(r, 200));
if (!/Serwer testowy/.test(srvLog)) { console.error('Serwer nie wystartował:\n' + srvLog); process.exit(2); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = []; let fails = 0;
const T = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? '✓' : '✗ NIEPOWODZENIE:', name, ok ? '' : (extra ?? '')); return ok; };
const IGNORE = /Failed to load resource|net::ERR_|ERR_FAILED|ERR_ABORTED/;
async function device(name, p, vp = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`[${name}] console.error: ${m.text().slice(0, 300)}`); });
  await page.goto(base + p); await page.waitForFunction(() => window.__fpz && window.__fpz.getState().net.status === 'online' && window.__fpz.getState().net.version > 0, null, { timeout: 20000 });
  return { ctx, page, name, ev: (fn, arg) => page.evaluate(fn, arg), until: (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => true).catch(() => false), shot: (n) => page.screenshot({ path: `shots/${n}.png` }) };
}
const settle = (d) => d.until(() => window.__fpz.getState().net.pending === 0, null, 10000);
/** Zapis pozycji playlisty LCD-01 („pl-scena”) z pominięciem interfejsu – przygotowanie scenariusza. */
const setItems = async (d, items) => { await d.ev((it) => window.__fpz.makeApi('mgmt').cms.save('playlists', { id: 'pl-scena', items: it, updatedAt: new Date().toISOString() }), items); await settle(d); };
const items = (d) => d.ev(() => window.__fpz.getState().playlists.find((p) => p.id === 'pl-scena').items);

// ── 0. Zarządzanie ekspozycją: logowanie (technik), godzina dzienna, krótka playlista LCD-01 ──
const mg = await device('ekspozycja', '/ekspozycja', { width: 1500, height: 950 });
await mg.ev(() => window.__fpz.makeApi('sim').env.set({ simTime: '12:00' }));
await mg.page.click('[data-testid=x-login-submit]'); await mg.page.waitForTimeout(300);
const CAPS = { id: 'ps-1', type: 'captions', title: 'Napisy na żywo (symultaniczny przekaz tekstowy)', durationSec: 3 };
await setItems(mg, [CAPS]);
await mg.page.click('.x-nav__it:has-text("Treści i playlisty")'); await mg.page.waitForTimeout(300);
await mg.page.click('[data-pl=pl-scena]'); await mg.page.waitForTimeout(300);
T('edytor: lista ekranów odtwarzających playlistę (LCD-01 z odnośnikiem do podglądu)', await mg.until(() => { const a = document.querySelector('[data-testid=x-pl-where] a[data-screen=LCD-01]'); return a && /\/lcd\/LCD-01$/.test(a.href) && a.target === '_blank'; }));
T('edytor: podpowiedź przy napisach na żywo', await mg.until(() => /tylko napisy/.test(document.querySelector('[data-testid=x-caps-hint]')?.innerText || '')));

// ── 1. „Wgraj film z dysku” w panelu zarządzania → pozycja, potwierdzenie, biblioteka, ekran z pamięci ──
await mg.page.setInputFiles('[data-testid=x-add-upload-file]', F('krotki-duzy.mp4'));
T('wgrywanie: postęp widoczny', await mg.until(() => /Wysyłanie… \d+%/.test(document.querySelector('[data-testid=x-add-upload]')?.innerText || ''), null, 10000));
T('wgrywanie: pozycja dodana do playlisty', await mg.until(() => window.__fpz.getState().playlists.find((p) => p.id === 'pl-scena').items.some((i) => i.type === 'video' && /^media:/.test(i.ref)), null, 60000));
const toast1 = await mg.page.locator('.fpz-toast', { hasText: 'Dodano' }).first().innerText().catch(() => '');
T('wgrywanie: potwierdzenie z nazwą ekranu', /Dodano „krotki-duzy” – zagra na: LCD-01/.test(toast1), toast1);
T('wgrywanie: potwierdzenie wspomina ciężki plik', /Ciężki plik/.test(toast1), toast1);
T('wgrywanie: nowy wiersz podświetlony i z fokusem', await mg.until(() => { const el = document.querySelector('.x-item.is-new'); return el && document.activeElement === el; }, null, 5000));
const film = await mg.ev(() => { const s = window.__fpz.getState(); const it = s.playlists.find((p) => p.id === 'pl-scena').items.find((i) => i.type === 'video'); return { it, m: s.media.find((m) => 'media:' + m.id === it.ref) }; });
T('biblioteka: rekord z kodekiem H.264, kl./s, przepływnością', film.m && film.m.codec === 'h264' && film.m.fps === 30 && film.m.bitrateMbps > 30 && film.m.moovAtEnd === false && film.m.stored === 'server', JSON.stringify(film.m));
T('pozycja: tytuł z nazwy pliku, czas = pełna długość (5 s)', film.it.title === 'krotki-duzy' && +film.it.durationSec === 5, JSON.stringify(film.it));
T('edytor: znaczniki techniczne przy pozycji (ciężki plik)', await mg.until(() => /ciężki plik · \d+ Mb\/s/.test(document.querySelector('.x-item[data-item="1"] [data-testid=video-tech]')?.textContent || '')));
await mg.page.waitForTimeout(2700); await mg.shot('film-editor-upload');
// podwójne „Dodaj pozycję” – każde z potwierdzeniem (nie po cichu)
await mg.page.click('[data-testid=x-item-add]'); await mg.page.waitForTimeout(300);
T('„Dodaj pozycję”: potwierdzenie z listą ekranów', /zagra na: LCD-01/.test(await mg.page.locator('.fpz-toast').last().innerText().catch(() => '')));
await setItems(mg, [{ id: 'ps-img', type: 'image', title: 'Panorama miasta', ref: 'city-panorama', durationSec: 2 }, film.it]); // pętla 7 s: ilustracja 2 s + film 5 s

// CMS: plik w bibliotece z kodekiem i ostrzeżeniem
const cms = await device('cms', '/cms', { width: 1500, height: 950 });
await cms.page.locator('[data-testid=c-login-submit]').click(); await cms.page.waitForTimeout(400);
const nav = async (sec, sub) => { await cms.page.click(`.c-side__it:has-text("${sec}")`); if (sub) await cms.page.click(`.c-subnav button:has-text("${sub}")`); await cms.page.waitForTimeout(250); };
await nav('Treści', 'Biblioteka mediów');
T('CMS: karta pliku – H.264 i ciężki plik', await cms.until((id) => { const t = document.querySelector(`[data-media="${id}"]`)?.textContent || ''; return /H\.264 \(AVC\)/.test(t) && /ciężki plik/.test(t); }, film.m.id));
await cms.page.click(`[data-media="${film.m.id}"]`);
T('CMS: szczegóły – format i podpowiedź o 8–10 Mb/s', await cms.until(() => { const t = document.querySelector('[data-testid=media-tech]')?.textContent || ''; return /H\.264 \(AVC\) · 30 kl\.\/s · \d+ Mb\/s/.test(t) && /8–10 Mb\/s/.test(t); }));
await cms.page.waitForTimeout(300); await cms.shot('film-cms-detail');
await cms.page.locator('.fpz-modal').last().locator('button:has-text("Zamknij")').last().click();

// Ekran LCD-01: plansza wczytywania, potem film z pamięci (blob:) – do końca w swoim czasie, bez ponownego pobierania
const lcd = await device('lcd', '/lcd/LCD-01', { width: 1280, height: 720 });
let mediaGets = 0; lcd.page.on('request', (r) => { if (r.method() === 'GET' && r.url().includes('/api/media/')) mediaGets++; });
await lcd.page.route('**/api/media/**', async (route) => { await new Promise((r) => setTimeout(r, 1200)); await route.continue(); }); // wolniejsza sieć – plansza wczytywania na pewno widoczna
await lcd.page.reload(); await lcd.until(() => window.__fpz && window.__fpz.getState().net.version > 0, null, 20000);
T('LCD: plansza „Wczytywanie filmu… %”', await lcd.until(() => /Wczytywanie filmu… \d+%/.test(document.querySelector('.s-load')?.innerText || ''), null, 20000));
await lcd.until(() => +document.querySelector('.s-load')?.dataset.loading > 0, null, 8000); await lcd.page.waitForTimeout(500); await lcd.shot('film-lcd-loading');
T('LCD: plansza wczytywania nie jest pustym odtwarzaczem', await lcd.ev(() => !document.querySelector('.s-video video')));
T('LCD: film odtwarzany z pamięci (blob:)', await lcd.until(() => { const v = document.querySelector('.s-video video.md-video__file'); return v && v.src.startsWith('blob:') && v.currentTime > 0.3; }, null, 40000));
await lcd.page.unroute('**/api/media/**');
await lcd.until(() => { const v = document.querySelector('.s-video video.md-video__file'); return v && v.currentTime > 1.5 && v.currentTime < 3.5; }, null, 20000); await lcd.shot('film-lcd-playing');
/** Kolejne przebiegi filmu: największy currentTime osiągnięty przez każdy element <video> (każda pętla playlisty = nowy element). */
const runs = (n, ms) => lcd.ev(([n, ms]) => new Promise((res) => {
  const seen = []; let cur = null; const t0 = Date.now();
  const i = setInterval(() => {
    const v = document.querySelector('.s-video video.md-video__file');
    if (v && v !== cur) { cur = v; seen.push({ max: 0, src: v.src.slice(0, 5) }); }
    if (v && seen.length) seen[seen.length - 1].max = Math.max(seen[seen.length - 1].max, v.currentTime);
    if (!v) cur = null;
    if ((seen.length > n && !v) || Date.now() - t0 > ms) { clearInterval(i); res(seen); }
  }, 50);
}), [n, ms]);
const loops = await runs(2, 30000);
T('LCD: w 2. pętli film dochodzi prawie do końca w swoim czasie (≥ 4,2 s z 5 s)', loops.length >= 2 && loops[1].max >= 4.2 && loops[1].src === 'blob:', JSON.stringify(loops));
console.log('   (najdalszy punkt filmu w kolejnych pętlach:', loops.map((x) => x.max.toFixed(2)).join(' / '), 's)');
const g0 = mediaGets; const more = await runs(3, 30000);
T('LCD: kolejne 3 pętle bez pobierania pliku (liczba GET /api/media/ stała)', more.length >= 3 && mediaGets === g0 && more.every((x) => x.max >= 4.2), JSON.stringify({ g0, after: mediaGets, more }));

// ── 2. Pozycja z usuniętym filmem: ekran jej nie pokazuje (żadnej symulacji transmisji w zastępstwie), edytor ją oznacza ──
const vDel = await mg.ev(() => window.__fpz.makeApi('mgmt').cms.save('videos', { title: { pl: 'Film do usunięcia', en: 'Film to delete' }, description: { pl: '', en: '' }, durationSec: 4, ill: 'studio', kind: 'studio', captions: [] }).item.id);
await setItems(mg, [{ id: 'ps-img', type: 'image', title: 'Panorama miasta', ref: 'city-panorama', durationSec: 2 }, film.it, { id: 'ps-del', type: 'video', title: 'Film do usunięcia', ref: vDel, durationSec: 4 }]);
await cms.until(() => window.__fpz.getState().playlists.find((p) => p.id === 'pl-scena').items.some((i) => i.id === 'ps-del'), null, 15000); // CMS ma już aktualną playlistę
await nav('Treści', 'Filmy');
await cms.page.fill('.c-page input[type=search]', 'Film do usunięcia'); await cms.page.waitForTimeout(300);
await cms.page.locator('tbody tr', { hasText: 'Film do usunięcia' }).first().click(); await cms.page.waitForTimeout(300);
await cms.page.locator('.fpz-modal').last().locator('button[aria-label="Usuń"], button:has-text("Usuń")').first().click();
T('CMS: usuwanie filmu – ostrzeżenie z nazwą playlisty i pomijaniem na ekranach', await cms.until(() => { const t = document.querySelector('.c-confirm')?.innerText || ''; return /Scena – transmisja i napisy na żywo/.test(t) && /Ekrany będą pomijać/.test(t); }, null, 5000), await cms.ev(() => document.querySelector('.c-confirm')?.innerText));
await cms.page.waitForTimeout(200); await cms.shot('film-cms-delete-film');
await cms.page.locator('.fpz-modal').last().locator('button:has-text("Usuń")').last().click();
T('CMS: film usunięty', await cms.until((id) => !window.__fpz.getState().videos.some((v) => v.id === id), vDel));
await lcd.until((id) => !window.__fpz.getState().videos.some((v) => v.id === id), vDel, 15000); // ekran dostał już stan po usunięciu
const sim = await lcd.ev(() => new Promise((res) => { let bad = 0, vids = 0; const t0 = Date.now(); const i = setInterval(() => { if (document.querySelector('.md-video__kb, .md-video--off')) bad++; if (document.querySelector('.s-video video.md-video__file')) vids++; if (Date.now() - t0 > 9000) { clearInterval(i); res({ bad, vids }); } }, 100); }));
T('LCD: po usunięciu filmu – nigdy symulacja w jego miejscu, film z pliku gra dalej', sim.bad === 0 && sim.vids > 0, JSON.stringify(sim));
T('edytor: pozycja oznaczona „film usunięty” + licznik w nagłówku', await mg.until(() => { const el = document.querySelector('.x-item[data-issue=film]'); return el && /film usunięty/.test(el.textContent) && /Ekrany pomijają tę pozycję/.test(el.innerText) && /1 pozycja pomijana/.test(document.querySelector('.x-pled')?.textContent || ''); }));
await mg.page.locator('.x-item[data-issue=film]').scrollIntoViewIfNeeded(); await mg.page.waitForTimeout(300); await mg.shot('film-editor-deleted');

// ── 3. Napisy + transmisja na żywo: ostrzeżenie w edytorze; po transmisji film wraca ──
await setItems(mg, [CAPS, { id: 'ps-img', type: 'image', title: 'Panorama miasta', ref: 'city-panorama', durationSec: 2 }, film.it]);
await mg.ev(() => window.__fpz.makeApi('mgmt').live.start('Transmisja testowa')); await settle(mg);
T('edytor: ostrzeżenie „Trwa transmisja na żywo…”', await mg.until(() => /Trwa transmisja na żywo: ekrany z tą playlistą pokazują teraz wyłącznie napisy/.test(document.querySelector('.x-pl-live')?.innerText || '')));
await mg.ev(() => document.querySelector('.x-pled')?.scrollIntoView()); await mg.page.waitForTimeout(300); await mg.shot('film-editor-live');
T('LCD: w czasie transmisji tylko napisy', await lcd.until(() => !!document.querySelector('.s-caps:not(.s-caps--wait)') && !document.querySelector('.s-video'), null, 10000));
await mg.ev(() => window.__fpz.makeApi('mgmt').live.stop()); await settle(mg);
T('edytor: ostrzeżenie znika po transmisji', await mg.until(() => !document.querySelector('.x-pl-live')));
T('LCD: po transmisji film wraca', await lcd.until(() => { const v = document.querySelector('.s-video video.md-video__file'); return v && v.currentTime > 0.3; }, null, 20000));

// ── 4. Plik H.265 (ta przeglądarka go nie dekoduje): ostrzeżenie, pominięcie na ekranie, jedno zgłoszenie ──
await setItems(mg, [{ id: 'ps-img', type: 'image', title: 'Panorama miasta', ref: 'city-panorama', durationSec: 2 }, film.it]);
await mg.page.setInputFiles('[data-testid=x-add-upload-file]', F('hevc60.mp4'));
T('H.265: wgrany do biblioteki z ostrzeżeniem (nie odrzucony)', await mg.until(() => window.__fpz.getState().media.some((m) => m.name === 'hevc60.mp4' && m.codec === 'hevc'), null, 60000));
const hevc = await mg.ev(() => { const s = window.__fpz.getState(); const m = s.media.find((x) => x.name === 'hevc60.mp4'); return { m, it: s.playlists.find((p) => p.id === 'pl-scena').items.find((i) => i.ref === 'media:' + m.id) }; });
T('H.265: rekord – kodek, 60 kl./s, czas pozycji 6 s (5,35 s w górę)', hevc.m.fps === 60 && hevc.m.bitrateMbps > 30 && hevc.it && +hevc.it.durationSec === 6, JSON.stringify({ m: hevc.m, it: hevc.it }));
const toast4 = await mg.page.locator('.fpz-toast', { hasText: 'hevc60' }).first().innerText().catch(() => '');
T('H.265: potwierdzenie z ostrzeżeniem o formacie', /Nie każde urządzenie odtworzy ten format/.test(toast4), toast4);
T('H.265: znacznik ostrzegawczy w edytorze', await mg.until(() => { const t = [...document.querySelectorAll('.x-item [data-testid=video-tech]')].map((e) => e.textContent).join('|'); return /H\.265 \(HEVC\)/.test(t) && /H\.264 \(AVC\)/.test(t); }));
await mg.page.waitForTimeout(2700); await mg.page.locator('.x-item[data-item="2"]').scrollIntoViewIfNeeded(); await mg.shot('film-editor-hevc');
const skip = await lcd.ev(() => new Promise((res) => { const o = { blank: 0, sim: 0, load: 0, film: 0, clock: 0 }; const t0 = Date.now(); const i = setInterval(() => { if (document.querySelector('.md-video--off')) o.blank++; if (document.querySelector('.md-video__kb')) o.sim++; if (document.querySelector('.s-load')) o.load++; if (document.querySelector('.s-video video.md-video__file')) o.film++; if (document.querySelector('.s-image')) o.clock++; if (Date.now() - t0 > 16000) { clearInterval(i); res(o); } }, 100); }));
T('LCD: plik H.265 pominięty – inne pozycje grają, bez pustego odtwarzacza i symulacji', skip.blank === 0 && skip.sim === 0 && skip.film > 0 && skip.clock > 0 && skip.load < 15, JSON.stringify(skip));
const inc = (d) => d.ev((id) => window.__fpz.getState().incidents.filter((x) => x.deviceId === 'LCD-01' && x.status !== 'closed' && x.title.includes('hevc60.mp4')).map((x) => ({ title: x.title, severity: x.severity })), hevc.m.id);
T('zgłoszenie: dokładnie jedno w stanie zarządzania', await mg.until(() => window.__fpz.getState().incidents.filter((x) => x.deviceId === 'LCD-01' && x.title.includes('hevc60.mp4')).length === 1, null, 15000));
const incs = await inc(mg);
T('zgłoszenie: tytuł z formatem HEVC/H.265, priorytet P3', incs.length === 1 && /Ekran nie odtwarza pliku „hevc60\.mp4” \(format HEVC\/H\.265 nie jest obsługiwany przez przeglądarkę ekranu\)/.test(incs[0].title) && incs[0].severity === 'P3', JSON.stringify(incs));
await lcd.page.reload(); await lcd.until(() => window.__fpz && window.__fpz.getState().net.version > 0, null, 20000); await lcd.page.waitForTimeout(9000); await settle(mg); await mg.page.waitForTimeout(1500);
T('zgłoszenie: po ponownym uruchomieniu ekranu nadal jedno', (await inc(mg)).length === 1, JSON.stringify(await inc(mg)));
// poza ekranami (podgląd filmu w CMS): plik H.265 → od razu symulacja z informacją, bez czarnego odtwarzacza
const vH = await cms.ev((id) => window.__fpz.makeApi('cms').cms.save('videos', { title: { pl: 'Film HEVC', en: 'HEVC film' }, description: { pl: '', en: '' }, durationSec: 6, ill: 'studio', kind: 'studio', captions: [], src: 'media:' + id }).item.id, hevc.m.id);
await settle(cms); await nav('Treści', 'Filmy');
await cms.page.fill('.c-page input[type=search]', 'Film HEVC'); await cms.page.waitForTimeout(300);
await cms.page.locator('tbody tr', { hasText: 'Film HEVC' }).first().click();
const sawVideo = await cms.ev(() => new Promise((res) => { let n = 0; const t0 = Date.now(); const i = setInterval(() => { if (document.querySelector('.c-vprev video')) n++; if (Date.now() - t0 > 1500) { clearInterval(i); res(n); } }, 30); }));
T('podgląd poza ekranem: H.265 od razu jako symulacja z informacją (bez pustego <video>)', sawVideo === 0 && await cms.until(() => !!document.querySelector('.c-vprev .md-video__kb') && /Nie udało się odtworzyć pliku/.test(document.querySelector('.c-vprev')?.innerText || ''), null, 5000), 'klatki z <video>: ' + sawVideo);
await cms.page.keyboard.press('Escape'); await cms.ev((id) => window.__fpz.makeApi('cms').cms.remove('videos', id), vH);
// symulator: informacja techniczna przy ekranie na liście
const shell = await device('symulator', '/', { width: 1500, height: 950 });
await shell.page.click('.sh-tabbtn:has-text("Ekrany LCD")'); await shell.page.waitForTimeout(500);
T('symulator: „Pominięto: … H.265 (HEVC)” pod ekranem na liście', await shell.until(() => [...document.querySelectorAll('[data-screen=LCD-01] .s-it__skip')].some((e) => /Pominięto: hevc60 – ten ekran nie odtwarza formatu H\.265 \(HEVC\)/.test(e.innerText)), null, 20000));
await shell.page.waitForTimeout(400); await shell.shot('film-scene-skip');
T('ekran /lcd/LCD-01: bez informacji technicznej', await lcd.ev(() => !/Pominięto|HEVC/.test(document.body.innerText)));
// tylko plik H.265 w playliście → neutralna plansza
await setItems(mg, [hevc.it]);
T('LCD: sama pozycja H.265 → „Playlista nie ma nic do pokazania”', await lcd.until(() => /Playlista nie ma nic do pokazania/.test(document.querySelector('.s-empty[data-empty=nothing]')?.innerText || ''), null, 10000));
await lcd.page.waitForTimeout(400); await lcd.shot('film-lcd-nothing');

// ── 5. Plik z indeksem na końcu (moov po mdat): kodek rozpoznany, film gra ──
await nav('Treści', 'Biblioteka mediów');
await cms.page.setInputFiles('[data-testid=media-upload]', F('koniec-moov.mp4'));
T('koniec-moov: wgrany, kodek H.264, indeks na końcu', await cms.until(() => window.__fpz.getState().media.some((m) => m.name === 'koniec-moov.mp4' && m.codec === 'h264' && m.moovAtEnd === true && m.durationSec === 45), null, 60000));
const km = await cms.ev(() => window.__fpz.getState().media.find((m) => m.name === 'koniec-moov.mp4'));
await setItems(mg, [{ id: 'ps-km', type: 'video', title: 'Indeks na końcu', ref: 'media:' + km.id, durationSec: 45 }]);
T('koniec-moov: gra na ekranie z pamięci', await lcd.until(() => { const v = document.querySelector('.s-video video.md-video__file'); return v && v.src.startsWith('blob:') && v.currentTime > 1; }, null, 40000));
// starszy rekord bez pól kodeka → znaczniki z odczytu nagłówka (Range)
await cms.ev((id) => window.__fpz.makeApi('cms').cms.save('media', { id, codec: null, codecs: null, fps: null, bitrateMbps: null, moovAtEnd: null }), km.id);
await cms.page.click('.c-subnav button:has-text("Biblioteka mediów")'); await cms.page.waitForTimeout(300);
T('starszy rekord: kodek odczytany z nagłówka pliku na serwerze', await cms.until((id) => /H\.264 \(AVC\)/.test(document.querySelector(`[data-media="${id}"]`)?.textContent || ''), km.id, 20000));
// usuwanie pliku użytego w playliście – ostrzeżenie
await cms.page.click(`[data-media="${km.id}"]`); await cms.page.click('[data-testid=media-delete]');
T('CMS: usuwanie pliku – ostrzeżenie o playliście', await cms.until(() => /Plik jest w playlistach ekranów: „Scena – transmisja i napisy na żywo”/.test(document.querySelector('.c-del-pl')?.innerText || ''), null, 5000));
await cms.page.keyboard.press('Escape');

await browser.close(); stop();
if (errors.length) { console.log('\nBłędy konsoli:'); errors.forEach((e) => console.log('  ' + e)); }
console.log(`\n${fails ? `✗ ${fails} niepowodzeń` : '✓ wszystkie sprawdzenia zaliczone'} · błędy konsoli: ${errors.length}`);
process.exit(fails || errors.length ? 1 : 0);
