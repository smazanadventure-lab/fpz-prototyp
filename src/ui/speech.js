// Synteza mowy (lektor, audioprzewodnik). Gdy przeglądarka nie udostępnia Web Speech API – symulacja czasu trwania,
// aby interfejs (postęp, podświetlanie transkrypcji) działał tak samo.
import { nativeTtsAvailable, nativeSpeak, nativeStopSpeak } from '../shell/native.js';
// W aplikacji Android (WebView nie ma Web Speech API) lektor korzysta z natywnego syntezatora mowy telefonu.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let simTimer = null; let current = null;
const LANGS = { pl: 'pl-PL', en: 'en-GB', de: 'de-DE', cs: 'cs-CZ', uk: 'uk-UA' };
const webSpeech = () => !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
export const speechSupported = () => webSpeech() || nativeTtsAvailable();
export const estimateSeconds = (text, rate = 1) => Math.max(2, String(text || '').split(/\s+/).length / (2.4 * rate));
export function stopSpeaking() { try { synth?.cancel(); } catch { /* nic */ } if (nativeTtsAvailable()) nativeStopSpeak(); clearTimeout(simTimer); simTimer = null; const c = current; current = null; c?.onend?.(false); }
/** speak('tekst', { lang: 'pl', rate: 1, onend(finished), onboundary(charIndex) }) → { simulated } */
export function speak(text, opts = {}) {
  stopSpeaking(); const t = String(text || '').trim(); if (!t) { opts.onend?.(true); return { simulated: true }; }
  current = opts;
  if (nativeTtsAvailable()) { nativeSpeak(t, { lang: LANGS[opts.lang] || opts.lang || 'pl-PL', rate: opts.rate || 1 }).then((fin) => { if (current === opts) { current = null; opts.onend?.(!!fin); } }); return { simulated: false }; }
  if (webSpeech()) {
    try {
      const u = new SpeechSynthesisUtterance(t); u.lang = LANGS[opts.lang] || opts.lang || 'pl-PL'; u.rate = opts.rate || 1;
      const v = synth.getVoices().find((x) => x.lang?.toLowerCase().startsWith((opts.lang || 'pl').toLowerCase())); if (v) u.voice = v;
      u.onend = () => { if (current === opts) { current = null; opts.onend?.(true); } }; u.onerror = () => { if (current === opts) { current = null; opts.onend?.(false); } };
      u.onboundary = (e) => opts.onboundary?.(e.charIndex);
      synth.speak(u); return { simulated: false };
    } catch { /* przejście do symulacji */ }
  }
  simTimer = setTimeout(() => { if (current === opts) { current = null; opts.onend?.(true); } }, estimateSeconds(t, opts.rate) * 1000);
  return { simulated: true };
}
