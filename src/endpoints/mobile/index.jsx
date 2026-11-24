// Aplikacja mobilna FPŻ – wirtualny przewodnik (iOS / Android, symulowana w ramce telefonu).
import { Client } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { App } from './app.jsx';
import './mobile.css';

const DEFAULTS = { platform: 'ios', onboarded: false, autoBeacon: true, audioAuto: false, audioQueue: true, notif: true, offlinePack: false, offlinePackAt: null, pushReadAt: null, scans: [], memories: [], layout: 'grid', statusBar: 'dark' };

const detectPlatform = () => (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '') ? 'android' : 'ios');

/** props: platform 'ios'|'android' (domyślnie: w symulatorze z ustawień powłoki, samodzielnie – z navigator.userAgent); standalone – aplikacja na całe okno / WebView (APK, adres /app). */
export default function MobileApp({ platform, standalone }) {
  const s = useStore(); const p = platform || (standalone ? detectPlatform() : s.clients.mobile?.platform || 'ios');
  return <Client id="mobile" base={16} class={`ep-mobile m-root-${p}${standalone ? ' m-root-standalone' : ''}`} defaults={DEFAULTS}><App platform={p} standalone={!!standalone} /></Client>;
}
