// Pliki multimedialne (obrazy, wideo, audio): pozycje biblioteki w stanie (state.media) + pliki na serwerze (/api/media/<id>).
// Treści odwołują się do pliku przez „media:<id>” (np. w polu `ill` zamiast identyfikatora ilustracji) albo przez pole `src`.
import { getState } from './store.js';
import { apiBase, remoteEnabled } from './remote.js';
import { uid, nowIso } from './util.js';

export const MEDIA_CHUNK = 3 * 1024 * 1024;          // wielkość części przy wysyłaniu (jak na serwerze)
export const MEDIA_MAX = 24 * MEDIA_CHUNK;           // 72 MB na plik
export const LOCAL_IMG_MAX = 1.2 * 1024 * 1024;      // wersja jednoplikowa: obraz zapisywany w danych przeglądarki
export const MEDIA_ACCEPT = { image: 'image/jpeg,image/png,image/webp,image/gif', video: 'video/mp4,video/webm', audio: 'audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav' };
export const MEDIA_ACCEPT_ALL = Object.values(MEDIA_ACCEPT).join(',');
const PREFIX = 'media:';
export const mediaRef = (id) => PREFIX + id;
export const isMediaRef = (v) => typeof v === 'string' && v.startsWith(PREFIX);
const tempUrls = new Map(); // wersja jednoplikowa: pliki wideo/audio działają do zamknięcia karty

/** Pozycja biblioteki dla identyfikatora, odwołania „media:<id>” albo samej pozycji; null, gdy jej nie ma. */
export function mediaItem(ref) { if (!ref) return null; if (typeof ref === 'object') return ref; const id = isMediaRef(ref) ? ref.slice(PREFIX.length) : ref; return (getState().media || []).find((m) => m.id === id) || null; }
/** Adres pliku do <img> / <video> / <audio> albo null (brak pliku – np. sama metryczka). */
export function mediaUrl(ref) { const m = mediaItem(ref); if (!m) return null; if (m.stored === 'server') return `${apiBase() || ''}/api/media/${m.id}`; return m.dataUrl || tempUrls.get(m.id) || null; }
/** Rodzaj pliku po typie MIME / rozszerzeniu: 'image' | 'video' | 'audio' | null. */
export function mediaKind(file) {
  const t = (file.type || '').toLowerCase(); const ext = (file.name || '').toLowerCase().split('.').pop();
  if (/^image\/(jpeg|png|webp|gif)$/.test(t) || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (/^video\/(mp4|webm)$/.test(t) || ['mp4', 'm4v', 'webm'].includes(ext)) return 'video';
  if (/^audio\//.test(t) || ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'wav'].includes(ext)) return 'audio';
  return null;
}
const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav' };
const mimeOf = (file) => { const t = (file.type || '').toLowerCase(); if (t === 'audio/mp3') return 'audio/mpeg'; if (t === 'audio/x-wav') return 'audio/wav'; if (t === 'video/x-m4v') return 'video/mp4'; return /^(image|video|audio)\//.test(t) && t !== 'audio/x-m4a' ? t : MIME_BY_EXT[(file.name || '').toLowerCase().split('.').pop()] || t; };
const fail = (pl) => ({ ok: false, error: 'MEDIA', message: { pl, en: pl } });
const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const loadImage = (blob) => new Promise((res, rej) => { const url = URL.createObjectURL(blob); const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Nie udało się odczytać obrazu.')); }; img.src = url; });

/** Obraz: zmniejszenie do 2560 px i jednej części (≤ 3 MB), żeby wczytywał się zwykłym żądaniem. GIF bez zmian. */
async function prepareImage(file, limit) {
  const img = await loadImage(file); const meta = { w: img.naturalWidth, h: img.naturalHeight };
  if (file.type === 'image/gif' || (file.size <= Math.min(limit, 1.5 * 1024 * 1024) && Math.max(meta.w, meta.h) <= 2560)) return { blob: file, type: mimeOf(file), ...meta };
  const alpha = file.type === 'image/png' || file.type === 'image/webp';
  for (const [maxSide, q] of [[2560, 0.88], [2560, 0.8], [1920, 0.82], [1920, 0.7], [1280, 0.7]]) {
    const k = Math.min(1, maxSide / Math.max(meta.w, meta.h)); const c = document.createElement('canvas'); c.width = Math.round(meta.w * k); c.height = Math.round(meta.h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const type = alpha ? 'image/webp' : 'image/jpeg'; const blob = await new Promise((res) => c.toBlob(res, type, q));
    if (blob && blob.size <= limit) return { blob, type: blob.type || type, w: c.width, h: c.height };
  }
  throw new Error('Obraz jest zbyt duży – zmniejsz go przed wgraniem.');
}
/** Wideo / audio: długość i wymiary odczytane przez przeglądarkę. */
function probeAv(blob, kind) {
  return new Promise((res) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio'); const url = URL.createObjectURL(blob); let done = false;
    const end = (meta) => { if (done) return; done = true; URL.revokeObjectURL(url); res(meta); };
    el.preload = 'metadata'; el.muted = true; el.onloadedmetadata = () => end({ durationSec: Number.isFinite(el.duration) ? Math.round(el.duration) : null, ...(kind === 'video' ? { w: el.videoWidth, h: el.videoHeight } : {}) });
    el.onerror = () => end({ unplayable: true }); setTimeout(() => end({}), 6000); el.src = url;
  });
}
async function sendPart(id, part, parts, size, type, name, chunk) {
  const q = new URLSearchParams({ part, parts, size, type, name }); let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { const r = await fetch(`${apiBase()}/api/media/${id}?${q}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: chunk }); const j = await r.json().catch(() => null); if (r.ok && j?.ok) return; last = new Error(j?.message || j?.error || 'HTTP ' + r.status); if (r.status >= 400 && r.status < 500) break; }
    catch (e) { last = e; }
    await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
  }
  throw last || new Error('Nie udało się wysłać pliku.');
}

/**
 * Wgranie pliku do biblioteki mediów. W trybie serwerowym plik trafia na serwer (w częściach, z postępem),
 * w wersji jednoplikowej obraz jest zapisywany w danych przeglądarki, a wideo/audio działa do zamknięcia karty.
 * @param {File} file  @param {{ api: object, onProgress?: (0..1) => void, extra?: object }} opts – api z useClient()
 * @returns {Promise<{ ok: true, item } | { ok: false, message: { pl, en } }>}
 */
export async function uploadMedia(file, { api, onProgress, extra } = {}) {
  const kind = mediaKind(file); if (!kind) return fail('Nieobsługiwany typ pliku. Dozwolone: obrazy JPG/PNG/WebP/GIF, wideo MP4/WebM, audio MP3/M4A/OGG/WAV.');
  const remote = remoteEnabled(); let blob = file; let type = mimeOf(file); let meta = {};
  try {
    if (kind === 'image') { const p = await prepareImage(file, remote ? MEDIA_CHUNK : LOCAL_IMG_MAX); blob = p.blob; type = p.type; meta = { w: p.w, h: p.h }; }
    else meta = await probeAv(file, kind);
  } catch (e) { return fail(String(e?.message || e)); }
  if (meta.unplayable) return fail('Przeglądarka nie potrafi odtworzyć tego pliku. Zapisz wideo jako MP4 (H.264 + AAC), a dźwięk jako MP3 lub M4A.');
  if (blob.size > MEDIA_MAX) return fail(`Plik jest za duży (${Math.round(blob.size / 1048576)} MB). Limit w pilotażu to ${Math.round(MEDIA_MAX / 1048576)} MB – zmniejsz rozdzielczość lub długość.`);
  const id = uid('m'); const item = { id, name: file.name, type: kind, mime: type, size: blob.size, tags: [], uploadedAt: nowIso(), ...meta, ...(extra || {}) };
  if (remote) {
    const parts = Math.max(1, Math.ceil(blob.size / MEDIA_CHUNK));
    try { for (let i = 0; i < parts; i++) { await sendPart(id, i, parts, blob.size, type, file.name, blob.slice(i * MEDIA_CHUNK, (i + 1) * MEDIA_CHUNK)); onProgress?.((i + 1) / parts); } }
    catch (e) { return fail('Wysyłanie przerwane: ' + String(e?.message || e)); }
    item.stored = 'server'; item.parts = parts;
  } else if (kind === 'image') { item.dataUrl = await toDataUrl(blob); onProgress?.(1); }
  else { tempUrls.set(id, URL.createObjectURL(blob)); item.stored = 'session'; item.note = 'Wersja jednoplikowa: plik działa do zamknięcia tej karty. W wersji serwerowej jest zapisywany na serwerze.'; onProgress?.(1); }
  const res = api.cms.save('media', item); return res && res.ok === false ? res : { ok: true, item: mediaItem(id) || item };
}
/** Usunięcie pozycji biblioteki razem z plikiem na serwerze. */
export async function removeMedia(id, { api } = {}) {
  const m = mediaItem(id); if (!m) return fail('Nie ma takiej pozycji.');
  if (m.stored === 'server' && remoteEnabled()) { try { await fetch(`${apiBase()}/api/media/${m.id}`, { method: 'DELETE' }); } catch { /* metryczkę usuwamy mimo to */ } }
  const u = tempUrls.get(m.id); if (u) { URL.revokeObjectURL(u); tempUrls.delete(m.id); }
  return api.cms.remove('media', m.id);
}
export const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB');
