// Prawdziwy skaner QR: kamera urządzenia (getUserMedia) + dekodowanie (BarcodeDetector, a gdy brak – jsQR).
import { useEffect, useRef, useState } from 'preact/hooks';
import jsQR from 'jsqr';
import { useClient } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { Icon } from '../../ui/components.jsx';

strings({
  'cam.starting': ['Uruchamianie aparatu…', 'Starting camera…'], 'cam.aim': ['Skieruj aparat na kod QR', 'Point the camera at a QR code'],
  'cam.unsupported': ['Aparat niedostępny w tej przeglądarce (wymagane połączenie HTTPS lub aplikacja). Używam trybu symulacji.', 'Camera not available in this browser (HTTPS or the app is required). Using simulation mode.'],
  'cam.denied': ['Brak zgody na użycie aparatu. Zezwól w ustawieniach telefonu albo wpisz kod ręcznie.', 'Camera permission denied. Allow it in the phone settings or type the code.'],
  'cam.nocam': ['Nie znaleziono aparatu w tym urządzeniu.', 'No camera found on this device.'], 'cam.error': ['Błąd aparatu: {e}', 'Camera error: {e}'],
});

export const cameraSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Dekodowanie kodu QR z danych obrazu (RGBA) – jsQR. Zwraca tekst albo null. */
export function decodeImageData(img) { const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' }); return r?.data || null; }

/** Podgląd kamery i odczyt kodów. props: active (skanuj tylko gdy ekran widoczny), onCode(text), onFail(reason) */
export function CameraScanner({ active, onCode, onFail }) {
  const { t } = useClient(); const video = useRef(null); const canvas = useRef(null);
  const [state, setState] = useState('starting'); const [err, setErr] = useState(null); const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const last = useRef({ code: null, at: 0 }); const cb = useRef(onCode); cb.current = onCode;
  useEffect(() => { const v = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', v); return () => document.removeEventListener('visibilitychange', v); }, []);
  useEffect(() => {
    if (!active || !visible) return;
    if (!cameraSupported()) { setState('error'); setErr('unsupported'); onFail?.('unsupported'); return; }
    let stream = null; let timer = null; let stopped = false; let detector = null;
    try { if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
    const hit = (text) => { if (!text) return; const now = Date.now(); if (text === last.current.code && now - last.current.at < 3000) return; last.current = { code: text, at: now }; try { navigator.vibrate?.(60); } catch { /* brak wibracji */ } cb.current?.(text); };
    const tick = async () => {
      if (stopped) return; const v = video.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        try {
          if (detector) { const r = await detector.detect(v); if (r?.[0]?.rawValue) hit(r[0].rawValue); }
          else { const k = Math.min(1, 480 / v.videoWidth); const w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k); const c = canvas.current; c.width = w; c.height = h; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(v, 0, 0, w, h); hit(decodeImageData(ctx.getImageData(0, 0, w, h))); }
        } catch (e) { if (detector) detector = null; /* przejście na jsQR */ }
      }
      if (!stopped) timer = setTimeout(tick, 200);
    };
    setState('starting'); setErr(null);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then((s) => {
      if (stopped) { s.getTracks().forEach((x) => x.stop()); return; }
      stream = s; const v = video.current; v.srcObject = s; v.play?.().catch(() => {}); setState('on'); tick();
    }).catch((e) => { if (stopped) return; const r = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'nocam' : (e?.message || 'error'); setState('error'); setErr(r); onFail?.(r); });
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((x) => x.stop()); if (video.current) video.current.srcObject = null; };
  }, [active, visible]);
  const msg = err === 'unsupported' ? t('cam.unsupported') : err === 'denied' ? t('cam.denied') : err === 'nocam' ? t('cam.nocam') : err ? t('cam.error', { e: err }) : null;
  return (<div class="m-cam m-cam--live">
    <video ref={video} class="m-cam__video" playsInline muted autoPlay aria-hidden="true" />
    <canvas ref={canvas} hidden />
    <span class="m-cam__corners" /><span class="m-cam__line" />
    {state === 'starting' && <p class="m-cam__hint">{t('cam.starting')}</p>}
    {state === 'on' && <p class="m-cam__hint m-cam__hint--bottom"><Icon name="camera" size={14} /> {t('cam.aim')}</p>}
    {state === 'error' && <p class="m-cam__hint" role="alert">{msg}</p>}
  </div>);
}
