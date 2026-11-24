// Kontekst końcówki (klienta): język, ustawienia dostępności, sesja, API powiązane z końcówką.
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { getState, update, useStore } from './store.js';
import { makeApi, ensureClient, sel } from './api.js';
import { tr, loc } from './i18n.js';
import { clsx } from './util.js';
import { speak, stopSpeaking } from '../ui/speech.js';

export const ClientCtx = createContext(null);
export const FS_STEPS = [0.9, 1, 1.15, 1.3, 1.5];

/**
 * Korzeń końcówki. Ustawia motyw (data-theme, data-contrast), skalę tekstu i język; udostępnia kontekst useClient().
 * <Client id="mobile" base={16} class="ep-mobile" defaults={{…}} theme="night"(opcjonalne wymuszenie)>
 */
export function Client({ id, base = 16, class: cls, defaults, theme, children, style }) {
  useStore();
  const client = ensureClient(getState(), id, defaults);
  const overlayRef = useRef(null);
  const [toasts, setToasts] = useState([]);
  const [, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const toast = useCallback((text, tone = 'ok', ms = 3200) => { const tid = Math.random().toString(36).slice(2); setToasts((t) => [...t.slice(-2), { id: tid, text, tone }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), ms); }, []);
  const onClickCapture = (e) => {
    if (!getState().clients[id]?.lector) return;
    const el = e.target.closest?.('[data-speak],button,a,h1,h2,h3,h4,p,li,label,figcaption,[role="button"]'); if (!el) return;
    const text = el.getAttribute('data-speak') || el.getAttribute('aria-label') || el.textContent; if (text && text.trim()) speak(text.trim().slice(0, 600), { lang: getState().clients[id].lang });
  };
  const value = { id, overlayRef, toast };
  return (
    <ClientCtx.Provider value={value}>
      <div class={clsx('fpz-theme fpz-client', cls)} data-client={id} data-theme={theme || client.theme || 'light'} data-contrast={client.contrast || 'normal'} lang={client.lang}
        style={{ '--fs-base': base + 'px', '--fpz-fs': client.fs || 1, ...(style || {}) }} onClickCapture={onClickCapture}>
        {children}
        <div class="fpz-overlays" ref={overlayRef} />
        <div class="fpz-toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} class={`fpz-toast fpz-toast--${t.tone}`}>{t.text}</div>)}</div>
      </div>
    </ClientCtx.Provider>
  );
}

/** { id, client, set(patch), lang, t(key, vars), L(obj), api, user, staff, toast(text, tone), overlayRef } */
export function useClient() {
  const ctx = useContext(ClientCtx);
  const s = useStore();
  const id = ctx?.id || 'shell';
  const client = ensureClient(s, id);
  const lang = client.lang || 'pl';
  return {
    id, client, lang, overlayRef: ctx?.overlayRef, toast: ctx?.toast || (() => {}),
    set: (patch) => update((st) => { Object.assign(ensureClient(st, id), patch); }),
    t: (key, vars) => tr(lang, key, vars), L: (obj) => loc(lang, obj),
    api: makeApi(id), user: sel.session(client), staff: sel.staffOf(client),
  };
}
/** Symulowane otoczenie zwiedzającego (pozycja, sieć, kamera, zegar). { env, setEnv(patch), moveTo(poiId|{lat,lng}) } */
export function useEnv() {
  const s = useStore(); const api = makeApi('sim');
  return { env: s.env, setEnv: (patch) => api.env.set(patch), moveTo: (target) => api.env.moveTo(target) };
}
/** Zegar odświeżany co intervalMs (domyślnie 1 s). */
export function useNow(intervalMs = 1000) { const [n, setN] = useState(() => new Date()); useEffect(() => { const i = setInterval(() => setN(new Date()), intervalMs); return () => clearInterval(i); }, [intervalMs]); return n; }
/** Zmiana skali tekstu o krok (dir = +1 / −1). */
export function stepFontScale(current, dir) { const i = FS_STEPS.reduce((b, v, k) => (Math.abs(v - current) < Math.abs(FS_STEPS[b] - current) ? k : b), 0); return FS_STEPS[Math.max(0, Math.min(FS_STEPS.length - 1, i + dir))]; }
export { speak, stopSpeaking };
