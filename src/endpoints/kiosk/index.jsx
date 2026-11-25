// Końcówka „Kioski multimedialne” (TZ.T1.1–T1.5): scena z listą stanowisk, totem wg próbki B i ekran 1080×1920.
import { useEffect, useRef, useState } from 'preact/hooks';
import './strings.js';
import './kiosk.css';
import { Client, useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { sel, makeApi } from '../../kernel/api.js';
import { KIOSKS } from '../../kernel/seed.js';
import { clsx } from '../../kernel/util.js';
import { Icon, Logo, ScaleBox, Tag, Tabs, IconButton } from '../../ui/components.jsx';
import { useSoundscape } from '../../ui/media.jsx';
import { LOGO } from '../../ui/logo-data.js';
import { KioskScreen, SCREEN_W, SCREEN_H } from './app.jsx';

// Pomocnik wyłącznie do testów automatycznych (Playwright): dostęp do API i stanu.
if (typeof window !== 'undefined') window.__fpzKiosk = Object.assign(window.__fpzKiosk || {}, { makeApi, getState });

const POWER = { on: ['Włączony', 'green'], off: ['Wyłączony', 'neutral'], service: ['Serwis', 'warn'], fault: ['Awaria', 'danger'] };
const HEIGHT_PL = { standing: '150 cm – stojący', child: '130 cm – średni', seated: '105 cm – wózek' };

export default function KioskEndpoint({ standalone } = {}) {
  if (standalone) return <StandaloneKiosk id={standalone} />;
  return <KioskScene />;
}

/** Tryb samodzielny (/kiosk/<id>): sam ekran 1080×1920 na całe okno – aplikacja uruchamiana na monitorze kiosku. */
function StandaloneKiosk({ id }) {
  useStore();
  const ok = KIOSKS.some((k) => k.id === id) && sel.device(id);
  if (!ok) return (
    <div class="ep-kiosk k-sa k-sa--err fpz-theme" data-theme="light">
      <div class="k-sa__box"><Icon name="alert" size={40} /><h1>Nieznane stanowisko „{String(id)}”</h1><p>Poprawne adresy kiosków:</p>
        <ul>{KIOSKS.map((k) => <li key={k.id}><a href={'/kiosk/' + k.id}><code>/kiosk/{k.id}</code></a> – {k.name}</li>)}</ul></div>
    </div>);
  return <div class="ep-kiosk k-sa fpz-theme" data-theme="light"><Station id={id} standalone /></div>;
}

function KioskScene() {
  const s = useStore();
  const [cur, setCur] = useState(() => { try { return localStorage.getItem('fpz-kiosk-sel') || KIOSKS[0].id; } catch { return KIOSKS[0].id; } });
  const [view, setView] = useState('totem');
  const pick = (id) => { setCur(id); try { localStorage.setItem('fpz-kiosk-sel', id); } catch { /* brak pamięci */ } };
  return (
    <div class="ep-kiosk k-scene fpz-theme" data-theme="light">
      <aside class="k-sc-list">
        <h2>Kioski multimedialne</h2>
        <p class="k-sc-hint">Zewnętrzne totemy z pionowym ekranem dotykowym 55″. Stanem steruje moduł „Zarządzanie ekspozycją”.</p>
        <Tabs variant="pill" value={view} onChange={setView} tabs={[{ id: 'totem', label: 'Totem', icon: 'monitor' }, { id: 'screen', label: 'Sam ekran', icon: 'zoomIn' }]} />
        <ul>{KIOSKS.map((k) => { const d = sel.device(k.id) || {}; const [pl, tone] = POWER[d.power] || POWER.off; return (
          <li key={k.id}><button type="button" class={clsx('k-sc-it', cur === k.id && 'is-active')} onClick={() => pick(k.id)} aria-pressed={cur === k.id} data-kiosk={k.id}>
            <span class="k-sc-it__id">{k.id}</span>
            <b>{k.name}</b>
            <span class="k-sc-it__tags"><Tag tone={tone}>{pl}</Tag>{d.night && <Tag tone="deep" icon="moon">noc</Tag>}<Tag>{HEIGHT_PL[d.heightMode] || HEIGHT_PL.child}</Tag></span>
            <small>{k.variant === 'sound' ? 'Monitor 55″ + słuchawka wandaloodporna, przyciski ścieżek, pętla indukcyjna' : 'Monitor 55″, mapa · informator · historia, pętla indukcyjna'} · dotknięcia dziś: {d.touchesToday ?? 0}</small>
          </button></li>); })}</ul>
        <p class="k-sc-hint"><Icon name="key" size={14} /> Menu serwisowe: przytrzymaj lewy górny róg ekranu 1,5 s, PIN 1234. Wygaszacz po 60 s bezczynności.</p>
      </aside>
      <Station key={cur} id={cur} view={view} />
    </div>
  );
}

/** Stanowisko: urządzenie + jego aplikacja (osobny <Client>) + osprzęt (słuchawka T1.5). */
function Station({ id, view, standalone }) {
  useStore(); const device = sel.device(id) || {}; const kiosk = KIOSKS.find((k) => k.id === id);
  const snd = useSoundscape(); const [cur, setCur] = useState(snd.tracks[0]?.id); const [offHook, setOffHook] = useState(false); const [userVol, setUserVol] = useState(0.8);
  const activityRef = useRef(Date.now());
  const isSound = kiosk?.variant === 'sound'; const powered = device.power === 'on';
  const maxV = (device.volume ?? 100) / 100;
  useEffect(() => { snd.setVolume(userVol * maxV); }, [userVol, maxV]);
  useEffect(() => { if (offHook && powered) snd.play(cur); else snd.stop(); }, [offHook, powered]);
  const select = (tid) => { activityRef.current = Date.now(); setCur(tid); if (offHook && powered) snd.play(tid); };
  const step = (d) => { const i = snd.tracks.findIndex((x) => x.id === cur); select(snd.tracks[(i + d + snd.tracks.length) % snd.tracks.length].id); };
  const sound = isSound ? { tracks: snd.tracks, current: cur, track: snd.tracks.find((x) => x.id === cur), playing: snd.playing && offHook, offHook, setOffHook: (v) => { activityRef.current = Date.now(); setOffHook(v); }, select, next: () => step(1), prev: () => step(-1), userVol, setUserVol, getLevels: snd.getLevels } : null;
  // przyciski fizyczne T1.5 podłączone przez kontroler HID (klawiatura): spacja = słuchawka, ←/→ = ścieżka
  const sRef = useRef(sound); sRef.current = sound;
  useEffect(() => {
    if (!standalone || !isSound) return;
    const k = (e) => { const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return; const sd = sRef.current; if (!sd) return;
      if (e.code === 'Space') { e.preventDefault(); sd.setOffHook(!sd.offHook); } else if (e.key === 'ArrowRight') { e.preventDefault(); sd.next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); sd.prev(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [standalone, isSound]);
  const screen = (
    <Client id={'kiosk:' + id} base={18} class="ep-kiosk" theme={device.night ? 'night' : undefined}>
      <KioskScreen deviceId={id} sound={sound} activityRef={activityRef} standalone={!!standalone} />
    </Client>);
  if (standalone) return <ScaleBox width={SCREEN_W} height={SCREEN_H} maxScale={4}><div class="k-sa__screen">{screen}</div></ScaleBox>;
  return (
    <section class="k-sc-stage" aria-label={`Kiosk ${id}`}>
      {view === 'totem'
        ? <ScaleBox width={px(VB.w)} height={px(VB.h)}><Totem kiosk={kiosk} device={device} sound={sound}>{screen}</Totem></ScaleBox>
        : <div class="k-sc-screenonly"><ScaleBox width={SCREEN_W} height={SCREEN_H}><div class="k-sc-bezel">{screen}</div></ScaleBox>
          {isSound && <div class="k-sc-hw"><HwButtons sound={sound} powered={powered} inline /><button type="button" class={clsx('k-sc-hook', offHook && 'is-off')} onClick={() => sound.setOffHook(!offHook)}><Icon name={offHook ? 'phoneOff' : 'phoneCall'} size={18} />{offHook ? 'Odłóż słuchawkę' : 'Podnieś słuchawkę'}</button></div>}</div>}
    </section>
  );
}

function HwButtons({ sound, powered, inline }) {
  const i = sound.tracks.findIndex((x) => x.id === sound.current) + 1;
  return (<div class={clsx('k-hw', inline && 'k-hw--inline')} role="group" aria-label="Fizyczne przyciski zmiany ścieżki">
    <span class={clsx('k-hw__led', powered && 'is-on')} aria-label={`Ścieżka ${i} z ${sound.tracks.length}`}>{powered ? `${i}/${sound.tracks.length}` : '--'}</span>
    <button type="button" class="k-hw__btn" aria-label="Poprzednia ścieżka (przycisk fizyczny)" onClick={sound.prev}><Icon name="skipBack" size={inline ? 18 : 44} /></button>
    <button type="button" class="k-hw__btn" aria-label="Następna ścieżka (przycisk fizyczny)" onClick={sound.next}><Icon name="skipForward" size={inline ? 18 : 44} /></button>
  </div>);
}

/* Totem wg rysunku wymiarowego próbki B (front): układ 395 × 1006 jednostek; ekran 220 × 391 j. = 1080 × 1920 px. */
const S = SCREEN_W / 220; // px ekranu na jednostkę rysunku
const VB = { x: -18, y: -14, w: 560, h: 1046 };
const CM = (cm) => 1006 - cm * (388 / 106); // wysokość nad gruntem → y rysunku (70 cm = 750, 176 cm = 362)
const HEIGHT_CM = { standing: 150, child: 130, seated: 105 };
const px = (v, o = 0) => (v - o) * S;

/** Totem: korpus ze ściętym lewym górnym narożnikiem, rama z profili po lewej, podświetlany logotyp i nazwa hali, ekran 55″,
 *  listwa audiodeskrypcji z czujnikami, neutralna tabliczka (bez herbu), perforacja głośników w bocznej ściance; T1.5 – słuchawka i przyciski w prawej ściance. */
function Totem({ kiosk, device, sound, children }) {
  const lit = device.power !== 'off';
  const led = { on: 'ok', off: 'off', service: 'warn', fault: 'bad' }[device.power] || 'off';
  const hall = sel.poi(device.poiId); const hm = device.heightMode || 'child';
  const dots = []; for (let y = 300; y <= 430; y += 4) for (let x = 382; x <= 390; x += 4) dots.push([x, y]);
  const sensors = [150, 190, 237, 284, 324];
  return (
    <div class="k-totem" style={{ width: px(VB.w) + 'px', height: px(VB.h) + 'px' }}>
      <svg class="k-totem__svg" width={px(VB.w)} height={px(VB.h)} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} aria-hidden="true">
        <defs>
          <linearGradient id="kt-body" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#34373c" /><stop offset=".55" stop-color="#2b2d31" /><stop offset="1" stop-color="#232529" /></linearGradient>
          <linearGradient id="kt-frame" x1="0" x2="1"><stop offset="0" stop-color="#26282c" /><stop offset="1" stop-color="#1c1d20" /></linearGradient>
          <linearGradient id="kt-bar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a9bdd6" /><stop offset=".5" stop-color="#8ea5c2" /><stop offset="1" stop-color="#7890ae" /></linearGradient>
          <radialGradient id="kt-shadow"><stop offset="0" stop-color="rgba(0,0,0,.28)" /><stop offset="1" stop-color="rgba(0,0,0,0)" /></radialGradient>
        </defs>
        <ellipse cx="210" cy="1008" rx="260" ry="14" fill="url(#kt-shadow)" />
        {/* rama dekoracyjna z profili stalowych */}
        <polygon class="k-totem__frame" points="0,1006 0,208 257,0 395,113 350,113 257,38 29,223 29,978 84,978 84,1006" fill="url(#kt-frame)" />
        {/* korpus */}
        <polygon points="84,1006 84,254 257,113 395,113 395,1006" fill="url(#kt-body)" />
        <polygon points="84,254 257,113 395,113 395,116 258,116 84,257" fill="#3d4146" />
        <rect x="392" y="113" width="3" height="893" fill="#3a3d42" />
        {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".9" fill="#17181a" />)}
        <rect x="127" y="330" width="220" height="2" rx="1" class={clsx('k-totem__rule', lit && 'is-lit')} />
        <rect x="123.5" y="358.5" width="227" height="398" rx="2" fill="#0a0b0c" />
        <rect x="127" y="769" width="220" height="25" rx="2" fill="url(#kt-bar)" />
        <rect x="127" y="769" width="220" height="7" rx="2" fill="rgba(255,255,255,.22)" />
        {sensors.map((x) => <circle key={x} cx={x} cy="781.5" r="3.2" fill="#2f3d52" stroke="#c9d6e6" stroke-width=".6" />)}
        <rect x="218" y="813" width="38" height="45" rx="4" fill="#4b4f55" stroke="#62676d" stroke-width="1" />
        <svg x="230" y="818" width="14" height="15" viewBox={LOGO.mark.box.join(' ')} aria-hidden="true"><path d={LOGO.mark.d} fill="#d6dad8" /></svg>
        <text x="237" y="846" text-anchor="middle" font-size="5" fill="#b9bfbc">{kiosk.id}</text>
        <circle cx="300" cy="835" r="3" class={`k-totem__led is-${led}`} />
        {/* linie wymiarowe (wysokości odbiorców) */}
        <g class="k-totem__dims">
          {[[176, '176 cm'], [150, '150 cm'], [130, '130 cm'], [105, '105 cm'], [70, '70 cm']].map(([cm, lb]) => (
            <g key={cm} class={clsx(HEIGHT_CM[hm] === cm && 'is-on')}>
              <line x1={sound ? 450 : 404} x2="472" y1={CM(cm)} y2={CM(cm)} />
              <text x="476" y={CM(cm) + 3.5}>{lb}</text>
            </g>))}
        </g>
        {sound && <>
          <rect x="395" y="372" width="22" height="200" rx="3" fill="#1b1c1f" stroke="#3d4146" />
          <rect x="413" y="392" width="8" height="14" rx="2" fill="#7c8186" /><rect x="413" y="540" width="8" height="14" rx="2" fill="#7c8186" />
          <path class="k-totem__cord" d={sound.offHook ? 'M406 572 C 410 600, 440 600, 438 630 S 420 670, 452 690 S 470 700, 466 640' : 'M406 572 C 404 585, 414 590, 410 600'} />
          <rect x="395" y="586" width="22" height="92" rx="3" fill="#2a2c30" stroke="#3d4146" />
        </>}
      </svg>
      <div class={clsx('k-totem__logo', lit && 'is-lit')} style={{ left: px(127, VB.x) + 'px', top: px(251, VB.y) + 'px' }}><Logo onDark /></div>
      <div class={clsx('k-totem__name', lit && 'is-lit')} style={{ left: px(127, VB.x) + 'px', top: px(298, VB.y) + 'px', fontSize: px(24) + 'px' }}>{hall ? hall.name.pl : kiosk.name}</div>
      <div class="k-totem__glass" style={{ left: px(127, VB.x) + 'px', top: px(362, VB.y) + 'px', width: SCREEN_W + 'px', height: SCREEN_H + 'px' }}>{children}</div>
      {sound && <>
        <button type="button" class={clsx('k-handset', sound.offHook && 'is-off')} style={{ left: px(397, VB.x) + 'px', top: px(380, VB.y) + 'px', width: px(18) + 'px', height: px(184) + 'px' }}
          onClick={() => sound.setOffHook(!sound.offHook)} aria-pressed={sound.offHook} aria-label={sound.offHook ? 'Odłóż słuchawkę na widełki' : 'Podnieś słuchawkę'}>
          <svg viewBox="0 0 18 184" width="100%" height="100%" aria-hidden="true" preserveAspectRatio="none">
            <path d="M3 0 h12 a3 3 0 0 1 3 3 v40 a3 3 0 0 1 -3 3 h-4 v92 h4 a3 3 0 0 1 3 3 v40 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 v-178 a3 3 0 0 1 3 -3z" fill="#2c2f33" stroke="#585d63" stroke-width=".8" />
            {[10, 18, 26, 34].map((y) => <circle key={y} cx="10" cy={y} r="1.6" fill="#101113" />)}{[150, 158, 166, 174].map((y) => <circle key={y} cx="10" cy={y} r="1.4" fill="#101113" />)}
          </svg>
        </button>
        <div class="k-totem__hwbox" style={{ left: px(395, VB.x) + 'px', top: px(588, VB.y) + 'px', width: px(22) + 'px' }}><HwButtons sound={sound} powered={device.power === 'on'} /></div>
      </>}
    </div>
  );
}
