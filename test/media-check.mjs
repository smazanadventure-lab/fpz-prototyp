// Testy funkcjonalne komponentów multimedialnych (dist/media-harness.html). Kod wyjścia 1 = błąd.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (h) => pathToFileURL(path.join(root, 'dist/media-harness.html')).href + '#' + h;
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = []; const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails.push(m); };
const open = async (h, w = 420) => { const p = await browser.newPage({ viewport: { width: w, height: 1000 } }); p.on('pageerror', (e) => errors.push(`${h}: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errors.push(`${h}: ${m.text()}`); }); await p.goto(url(h)); await p.waitForTimeout(600); return p; };

// 1. wideo: odtwarzanie, napisy, klawiatura, prędkość, AD, przewijanie
{ const p = await open('sec=video&w=380');
  const v = p.locator('.hx-v1'); const time = () => v.locator('.md-time').innerText();
  const t0 = await time(); await v.locator('.md-video__frame').click(); await p.waitForTimeout(1600); const t1 = await time();
  ok(t0 !== t1, `wideo: czas płynie po kliknięciu kadru (${t0} → ${t1})`);
  ok((await v.locator('.md-video__caps span').count()) > 0, `wideo: napisy widoczne: „${await v.locator('.md-video__caps').innerText()}”`);
  ok((await v.locator('.md-video__ad').innerText()).length > 10, 'wideo: pasek audiodeskrypcji z opisem');
  await v.press('Space'); const tp = await time(); await p.waitForTimeout(800); ok(tp === await time(), 'wideo: spacja = pauza');
  await v.locator('.md-range').fill('30'); await p.waitForTimeout(100); ok((await time()).startsWith('0:30'), 'wideo: przewijanie osi czasu');
  await v.locator('button[aria-label^="Napisy"]').click(); ok((await v.locator('.md-video__caps span').count()) === 0, 'wideo: CC wyłącza napisy');
  await v.locator('button[aria-label^="Prędkość"]').click(); ok((await v.locator('button[aria-label^="Prędkość"]').innerText()).includes('1,5'), 'wideo: prędkość 1,5×');
  ok(await p.locator('.hx-live .md-video__livebadge').isVisible(), 'wideo live: znacznik NA ŻYWO');
  ok((await p.locator('.hx-live .md-video__caps').innerText()).includes('orkiestra'), 'wideo live: napisy na żywo ze stanu');
  ok((await p.locator('.hx-live .md-video__viewers').innerText()).match(/\d+/), 'wideo live: licznik widzów');
  await p.close(); }
// 2. audioprzewodnik
{ const p = await open('sec=audio&w=380');
  const a = p.locator('.md-audio:not(.md-audio--compact)'); const t0 = await a.locator('.md-time').innerText();
  await a.locator('.md-btn--main').click(); await p.waitForTimeout(3500); const t1 = await a.locator('.md-time').innerText();
  ok(t0 !== t1, `audio: postęp (${t0} → ${t1})`); ok((await a.locator('.is-current').count()) === 1, `audio: podświetlone zdanie: „${(await a.locator('.is-current').innerText()).slice(0, 40)}…”`);
  await a.locator('li:nth-child(4) button').click(); await p.waitForTimeout(300); ok((await a.locator('li:nth-child(4)').getAttribute('class') || '').includes('is-current'), 'audio: klik w zdanie transkrypcji przewija');
  await a.locator('.md-btn--main').click(); ok((await p.evaluate(() => window.__log)).includes('audio:stop'), 'audio: pauza wywołuje onState(stop)');
  await p.close(); }
// 3. model 3D: obrót przeciąganiem, zoom kółkiem, reset
{ const p = await open('sec=model&w=420');
  const m = p.locator('.hx-lathe'); const tr = () => m.locator('.md-m3__obj').evaluate((e) => e.style.transform);
  const b = await m.boundingBox(); const a0 = await tr();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width / 2 + 80, b.y + b.height / 2 + 30, { steps: 6 }); await p.mouse.up();
  const a1 = await tr(); ok(a0 !== a1, 'model: obrót przeciąganiem'); await p.waitForTimeout(400); ok(a1 === await tr(), 'model: autoobrót zatrzymany po interakcji');
  await p.mouse.wheel(0, -400); await p.waitForTimeout(50); const a2 = await tr(); ok(a2 !== a1, 'model: zoom kółkiem');
  await m.locator('button[aria-label="Resetuj widok"]').click(); await p.waitForTimeout(700); ok(/rotateX\(-20deg\)/.test(await tr()), 'model: reset widoku');
  // szczypanie (2 wskaźniki dotyku)
  const z0 = await tr();
  await m.evaluate((el) => { const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const ev = (t, id, x) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: cy, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', 11, cx - 20); ev('pointerdown', 12, cx + 20); ev('pointermove', 11, cx - 60); ev('pointermove', 12, cx + 60); ev('pointerup', 11, cx - 60); ev('pointerup', 12, cx + 60); });
  ok(z0 !== await tr(), 'model: szczypanie zmienia powiększenie');
  ok((await m.locator('.md-m3__hs').count()) === 6, 'model: punkty-opisy');
  await p.close(); }
// 4. panorama: obrót przeciąganiem, strzałki, onDwell, onSelect
{ const p = await open('sec=pano&w=420');
  const pn = p.locator('.md-pano'); const b = await pn.boundingBox(); const az0 = await p.evaluate(() => window.__az);
  await p.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.7); await p.mouse.down(); await p.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.7, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(1800); const az1 = await p.evaluate(() => window.__az); ok(Math.abs(az1 - az0) > 5, `panorama: obrót przeciąganiem (${az0?.toFixed(1)} → ${az1.toFixed(1)}°, z bezwładnością)`);
  await pn.focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500); const az2 = await p.evaluate(() => window.__az); ok(Math.abs(((az2 - az1 + 540) % 360) - 180 - 10) < 1, `panorama: strzałka → +10° (${az2.toFixed(1)}°)`);
  await p.locator('#pano-go').click(); await p.waitForTimeout(500); ok(Math.round(await p.evaluate(() => window.__az)) === 208, 'panorama: sterowanie z zewnątrz (az)');
  await p.waitForTimeout(1300); ok((await p.evaluate(() => window.__log)).includes('dwell:hx-baz'), 'panorama: zatrzymanie na obiekcie → onDwell');
  ok((await p.locator('.md-pano__read').innerText()).includes('208'), 'panorama: kompas pokazuje azymut');
  await p.locator('.md-pano__hs[tabindex="0"].is-dwelt').click(); ok((await p.evaluate(() => window.__log)).includes('select:hx-baz'), 'panorama: klik w etykietę → onSelect');
  await p.close(); }
// 5. AR: śledzenie, suwak dziś↔jutro, migawka
{ const p = await open('sec=ar&w=420');
  const a = p.locator('.hx-ar1'); ok((await a.locator('.md-ar__track').innerText()).includes('Szukam'), 'AR: stan „Szukam wzorca…”');
  await p.waitForTimeout(1400); ok((await a.locator('.md-ar__track').innerText()).includes('rozpoznany'), 'AR: „Wzorzec rozpoznany” po ~1,2 s');
  await a.locator('.md-range').fill('90'); const clip = await a.locator('.md-ar__future').evaluate((e) => e.style.clipPath); ok(/inset\(0(px)? 0(px)? 0(px)? 10%\)/.test(clip), `AR: suwak odsłania wizję przyszłości (${clip})`);
  await a.locator('.md-ar__shutter').click(); ok((await p.evaluate(() => window.__log)).includes('capture'), 'AR: migawka → onCapture');
  ok(await a.locator('.md-ar__flash').count() === 1, 'AR: błysk migawki');
  await p.close(); }
// 6. dźwięki: każda ścieżka – uruchomienie, analiza offline (sygnał niezerowy, bez przesteru), analizator na żywo
{ const p = await open('sec=sound&w=420');
  for (const id of ['hala', 'kuznia', 'kolej', 'huta', 'szklo', 'kopalnia', 'symfonia']) {
    const r = await p.evaluate(async (tid) => { const x = await window.renderTrackOffline(tid, 8); const d = x.buffer.getChannelData(0); let clip = 0; for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.94) clip++; return { rms: x.rms, peak: x.peak, clip: clip / d.length }; }, id);
    ok(r.rms > 0.02 && r.peak < 0.95 && r.clip < 0.001, `dźwięk offline ${id}: rms=${r.rms.toFixed(3)} peak=${r.peak.toFixed(3)} clip=${(r.clip * 100).toFixed(3)}%`);
  }
  for (const id of ['hala', 'kuznia', 'kolej', 'huta', 'szklo', 'kopalnia', 'symfonia']) {
    await p.locator(`[data-track="${id}"]`).click(); await p.waitForTimeout(1500);
    const lv = await p.evaluate(() => window.__snd.getLevels()); ok(lv.level > 0.02, `dźwięk na żywo ${id}: poziom analizatora ${lv.level.toFixed(3)}`);
  }
  await p.locator('#snd-next').click(); await p.waitForTimeout(200); ok(await p.evaluate(() => window.__snd.current === 'hala'), 'dźwięk: next() zapętla listę');
  await p.locator('#snd-stop').click(); await p.waitForTimeout(100); ok(await p.evaluate(() => !window.__snd.playing), 'dźwięk: stop()');
  await p.close(); }
// 7. odporność: brak Web Audio, prefers-reduced-motion, montowanie w ukrytym kontenerze
{ const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push('rm: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push('rm: ' + m.text()); });
  await p.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  await p.goto(url('sec=sound&w=380')); await p.waitForTimeout(300);
  await p.locator('[data-track="kolej"]').click(); await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({ playing: window.__snd.playing, supported: window.__snd.supported, lv: window.__snd.getLevels().level }));
  ok(r.playing && !r.supported && r.lv > 0, `bez AudioContext: odtwarzanie symulowane (poziom ${r.lv.toFixed(2)})`);
  await p.goto(url('sec=model&w=380')); await p.reload(); await p.waitForTimeout(300); const t1 = await p.locator('.hx-lathe .md-m3__obj').evaluate((e) => e.style.transform); await p.waitForTimeout(500);
  ok(t1 === await p.locator('.hx-lathe .md-m3__obj').evaluate((e) => e.style.transform), 'reduced-motion: brak autoobrotu modelu');
  await p.goto(url('sec=pano&w=380')); await p.reload(); await p.waitForTimeout(300); await p.locator('#pano-go').click(); await p.waitForTimeout(1500);
  ok((await p.evaluate(() => window.__log)).includes('dwell:hx-baz'), 'reduced-motion: panorama i onDwell działają');
  await ctx.close(); }
for (const sec of ['video', 'model', 'pano', 'ar', 'audio']) {
  const p = await browser.newPage({ viewport: { width: 420, height: 900 } }); p.on('pageerror', (e) => errors.push('hidden ' + sec + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push('hidden ' + sec + ': ' + m.text()); });
  await p.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.id = 'hide'; st.textContent = '#hx-frame{display:none}'; document.head.appendChild(st); }); });
  await p.goto(url(`sec=${sec}&w=380`)); await p.waitForTimeout(800); await p.evaluate(() => document.getElementById('hide').remove()); await p.waitForTimeout(700);
  if (sec === 'model') { const tr = await p.locator('.hx-lathe .md-m3__obj').evaluate((e) => e.style.transform); ok(/scale3d\(0\.[3-9]/.test(tr) || /scale3d\(0\.[0-9]+/.test(tr), `ukryty→widoczny: model przeskalowany do kontenera (${tr.slice(0, 40)})`); }
  if (sec === 'pano') { const w = await p.locator('.md-pano__cmpstrip').evaluate((e) => e.style.width); ok(parseFloat(w) > 1000, `ukryty→widoczny: panorama zmierzona (${w})`); }
  await p.close(); }
await browser.close();
if (errors.length) console.error('BŁĘDY KONSOLI:\n' + [...new Set(errors)].join('\n'));
console.log(fails.length || errors.length ? `\nNIEPOWODZENIA: ${fails.length}, błędy konsoli: ${errors.length}` : '\nWSZYSTKO OK');
process.exit(fails.length || errors.length ? 1 : 0);
