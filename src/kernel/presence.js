// Prawdziwy stan urządzeń: strony kiosków i ekranów (oraz program sterujący na komputerze kiosku) meldują się serwerowi
// co ok. 30 s (POST /api/beat), a panel zarządzania odczytuje te sygnały (GET /api/presence).
import { useEffect, useState } from 'preact/hooks';
import { getState, subscribe } from './store.js';
import { apiBase, remoteEnabled } from './remote.js';

const boot = Date.now(); let lastInput = Date.now(); let listening = false;
const isFull = () => { try { return !!document.fullscreenElement || (window.innerHeight >= screen.height - 4 && window.innerWidth >= screen.width - 4); } catch { return false; } };

// Co urządzenie teraz pokazuje: końcówka (ekran, kiosk) zapisuje tu swój stan przy każdej zmianie – bez sieci, trafia do najbliższego sygnału.
const nowReg = new Map();
/** Zapis bieżącej treści urządzenia (null – usuń). Wywołanie tanie: zwykłe przypisanie w pamięci. */
export function setNowPlaying(deviceId, data) { if (data == null) nowReg.delete(deviceId); else nowReg.set(deviceId, data); }
const MEDIA_WAIT = 1100, MEDIA_RETRY = 280;
/** Skąd pochodzi obraz – opis dla panelu. */
const mediaSrc = (el) => { if (el.srcObject) return 'kamera – transmisja'; const u = el.currentSrc || el.src || ''; return /^blob:/.test(u) ? 'pamięć ekranu' : /\/api\/media/.test(u) ? 'serwer' : u ? 'inne' : 'brak źródła'; };
const frames = (el) => { try { return el.getVideoPlaybackQuality ? el.getVideoPlaybackQuality().totalVideoFrames : null; } catch { return null; } };
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
/** Element, który się liczy: największe widoczne wideo, a bez niego – grające audio. */
function pickMedia() {
  let best = null, area = 0;
  for (const v of document.querySelectorAll('video')) { const r = v.getBoundingClientRect(); const a = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)); if (a > area) { area = a; best = v; } }
  if (best) return best;
  return [...document.querySelectorAll('audio')].find((a) => !a.paused) || null;
}
/** Prawdziwe odtwarzanie na stronie: dwa odczyty czasu (i liczby klatek) w odstępie ~1,1 s. Bez elementu → null. */
async function sampleMedia() {
  let el = pickMedia(); if (!el) return null;
  const t0 = el.currentTime, f0 = frames(el);
  await new Promise((r) => setTimeout(r, MEDIA_WAIT));
  let gone = false, a0 = t0, g0 = f0, min = 0.2;
  // treść zmieniła się w trakcie pomiaru (np. film zapętlony od nowa) – krótki drugi pomiar na nowym elemencie
  if (!el.isConnected) { el = pickMedia(); if (!el) return null; gone = true; a0 = el.currentTime; g0 = frames(el); min = 0.08; await new Promise((r) => setTimeout(r, MEDIA_RETRY)); }
  const live = !!el.srcObject; const t1 = el.currentTime, f1 = frames(el);
  const moved = t1 - a0 > min || (g0 != null && f1 != null && f1 > g0 && !el.paused);
  const advancing = moved ? true : !gone || el.paused ? false : null; // null – obraz dopiero się zmienił, nie da się ocenić
  const err = el.error ? (el.error.message || `kod błędu ${el.error.code}`) : null;
  return { el: el.tagName.toLowerCase(), advancing, gone, pos: r1(t1), dur: live || !Number.isFinite(el.duration) ? null : r1(el.duration), w: el.videoWidth || null, h: el.videoHeight || null, muted: !!el.muted, paused: !!el.paused, ready: el.readyState, error: err, src: mediaSrc(el) };
}
/** Raport „co teraz na ekranie” do sygnału; najwyżej ~1,5 s, a błąd próbkowania nie blokuje sygnału (wtedy undefined). */
async function nowReport(id) {
  try {
    const media = await Promise.race([sampleMedia(), new Promise((r) => setTimeout(() => r(undefined), 1500))]);
    if (media === undefined) return undefined;
    return { ...(nowReg.get(id) || {}), media, at: Date.now() };
  } catch { return undefined; }
}

/** Uruchamia meldowanie strony urządzenia (kiosk, ekran LCD…). Wykonuje też prawdziwy restart aplikacji po poleceniu z panelu. */
export function startBeat({ id, kind }) {
  if (!remoteEnabled() || typeof window === 'undefined') return () => {};
  if (!listening) { listening = true; for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { lastInput = Date.now(); }, { capture: true, passive: true }); }
  const dev = () => (getState().devices || []).find((d) => d.id === id);
  const send = async () => {
    if (!dev()) return; // nieznane urządzenie – nic nie meldujemy
    const now = await nowReport(id); const s = getState(); const d = dev(); if (!d) return;
    const body = { now, id, src: 'page', kind: kind || d.kind, instance: s.deviceId, boot, ver: s.build, ua: navigator.userAgent, lang: navigator.language, screen: [screen.width, screen.height, window.devicePixelRatio || 1], viewport: [window.innerWidth, window.innerHeight], fullscreen: isFull(), visible: !document.hidden, online: navigator.onLine, standalone: true, lastInput, appliedRestart: d.restartedAt || null };
    fetch(`${apiBase()}/api/beat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true, credentials: 'omit' }).catch(() => { /* brak sieci – następna próba za chwilę */ });
  };
  const t0 = setTimeout(send, 1500); const timer = setInterval(send, 30000); const vis = () => send(); document.addEventListener('visibilitychange', vis); window.addEventListener('online', vis);
  // polecenie „restart” z panelu: aplikacja na urządzeniu naprawdę uruchamia się od nowa (przeładowanie strony)
  let seen = dev()?.restartedAt || null; let armed = false; setTimeout(() => { seen = dev()?.restartedAt || null; armed = true; }, 4000);
  const unsub = subscribe(() => { const r = dev()?.restartedAt || null; if (armed && r && r !== seen) { seen = r; setTimeout(() => window.location.reload(), 1200); } });
  return () => { clearTimeout(t0); clearInterval(timer); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', vis); unsub(); };
}

/**
 * Sygnały urządzeń dla panelu zarządzania. W wersji jednoplikowej (bez serwera) mode = 'local' i beats = null.
 * @returns {{ mode: 'remote'|'local', beats: Record<string, { page?: object, agent?: object }>|null, now: number, staleMs: number, error: string|null, refresh: () => void }}
 */
export function usePresence(active = true) {
  const [st, setSt] = useState({ mode: remoteEnabled() ? 'remote' : 'local', beats: null, now: Date.now(), staleMs: 100000, error: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active || !remoteEnabled()) return undefined; let dead = false;
    const load = () => { if (document.hidden) return; fetch(`${apiBase()}/api/presence`, { cache: 'no-store', credentials: 'omit' }).then((r) => r.json()).then((j) => { if (!dead && j && j.beats) setSt({ mode: 'remote', beats: j.beats, now: j.now, staleMs: j.staleMs || 100000, error: null }); }).catch((e) => { if (!dead) setSt((p) => ({ ...p, error: String(e?.message || e) })); }); };
    load(); const t = setInterval(load, 10000); return () => { dead = true; clearInterval(t); };
  }, [active, n]);
  return { ...st, refresh: () => setN((x) => x + 1) };
}
/**
 * Stan połączenia jednego urządzenia na podstawie sygnałów.
 * @returns {{ state: 'online'|'offline'|'never', lastAt: number|null, agoSec: number|null, page: object|null, agent: object|null }}
 */
export function deviceLink(presence, id) {
  const b = presence?.beats?.[id]; const page = b?.page || null; const agent = b?.agent || null; const lastAt = Math.max(page?.at || 0, agent?.at || 0) || null;
  if (!lastAt) return { state: 'never', lastAt: null, agoSec: null, page, agent };
  const ago = Math.max(0, (presence.now || Date.now()) - lastAt); return { state: ago <= (presence.staleMs || 100000) ? 'online' : 'offline', lastAt, agoSec: Math.round(ago / 1000), page, agent };
}
/** Czytelny opis przeglądarki i systemu z nagłówka User-Agent. */
export function describeUa(ua = '') {
  const os = /Windows NT 10/.test(ua) ? 'Windows 10/11' : /Windows/.test(ua) ? 'Windows' : /Android ([\d.]+)/.test(ua) ? 'Android ' + RegExp.$1 : /(iPhone|iPad).*OS (\d+)/.test(ua) ? 'iOS ' + RegExp.$2 : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'system nieznany';
  const br = /Edg\/(\d+)/.test(ua) ? 'Edge ' + RegExp.$1 : /Firefox\/(\d+)/.test(ua) ? 'Firefox ' + RegExp.$1 : /Chrome\/(\d+)/.test(ua) ? 'Chrome ' + RegExp.$1 : /Version\/(\d+).*Safari/.test(ua) ? 'Safari ' + RegExp.$1 : 'przeglądarka';
  return `${br} · ${os}`;
}
