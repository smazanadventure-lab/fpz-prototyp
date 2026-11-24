// Cienka warstwa natywna (Capacitor) dla aplikacji Android.
// Bezpieczna w zwykłej przeglądarce: nic nie rejestruje i nie rzuca wyjątków.
//
// Celowo używamy samego registerPlugin() z @capacitor/core zamiast importów
// '@capacitor/app' i '@capacitor-community/text-to-speech' – te pakiety dociągają
// implementacje webowe (dynamic import), które w paczce IIFE trafiłyby do bundla.
// Na urządzeniu wywołania i tak idą mostem do natywnych wtyczek (nazwy: 'App', 'TextToSpeech').
import { Capacitor, registerPlugin } from '@capacitor/core';

const App = registerPlugin('App');
const TextToSpeech = registerPlugin('TextToSpeech');

/** true tylko w aplikacji natywnej (Android/iOS), false w przeglądarce. */
export function isNative() {
  try {
    return !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

let backHandle = null;

/**
 * Inicjalizacja powłoki natywnej.
 * onBack(): zwraca false, gdy aplikacja nie ma już dokąd wrócić → aplikacja jest minimalizowana.
 * W przeglądarce nic nie robi.
 */
export function initNative({ onBack } = {}) {
  if (!isNative() || backHandle) return;
  try {
    backHandle = App.addListener('backButton', async () => {
      let handled = false;
      try {
        handled = onBack ? await onBack() : false;
      } catch (e) {
        console.warn('[native] onBack', e);
      }
      if (handled === false) {
        try { await App.minimizeApp(); } catch (e) { console.warn('[native] minimizeApp', e); }
      }
    });
  } catch (e) {
    console.warn('[native] initNative', e);
  }
}

/** Czy dostępny jest natywny lektor (wtyczka TTS w aplikacji Android). */
export function nativeTtsAvailable() {
  try {
    return isNative() && Capacitor.isPluginAvailable('TextToSpeech');
  } catch {
    return false;
  }
}

// Android nie zgłasza końca wypowiedzi przerwanej przez stop(), więc sami
// rozliczamy oczekującą obietnicę (false = przerwano).
let pending = null;
function settlePending(value) {
  if (pending) {
    const p = pending;
    pending = null;
    p(value);
  }
}

/**
 * Wypowiada tekst natywnym lektorem.
 * Promise<boolean>: true po zakończeniu wypowiedzi, false przy błędzie,
 * przerwaniu (nativeStopSpeak / nowa wypowiedź) lub braku wtyczki. Nigdy nie odrzuca.
 */
export function nativeSpeak(text, { lang = 'pl-PL', rate = 1, pitch = 1, volume = 1 } = {}) {
  if (!nativeTtsAvailable() || !text) return Promise.resolve(false);
  settlePending(false);
  return new Promise((resolve) => {
    pending = resolve;
    TextToSpeech.speak({ text: String(text), lang, rate, pitch, volume, category: 'playback' })
      .then(() => { if (pending === resolve) settlePending(true); })
      .catch((e) => {
        console.warn('[native] speak', e);
        if (pending === resolve) settlePending(false);
      });
  });
}

/** Przerywa bieżącą wypowiedź (bez efektu poza aplikacją natywną). */
export function nativeStopSpeak() {
  settlePending(false);
  if (!nativeTtsAvailable()) return Promise.resolve();
  return TextToSpeech.stop().catch((e) => console.warn('[native] stop', e));
}
