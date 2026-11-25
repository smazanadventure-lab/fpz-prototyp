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
/** Pełna długość klipu w sekundach (w górę – pozycja playlisty musi pomieścić cały film; 20 ms tolerancji na zaokrąglenia kontenera). */
export const ceilSec = (d) => (Number.isFinite(d) && d > 0 ? Math.max(1, Math.ceil(d - 0.02)) : null);
/** Wideo / audio: długość i wymiary odczytane przez przeglądarkę. */
function probeAv(blob, kind) {
  return new Promise((res) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio'); const url = URL.createObjectURL(blob); let done = false;
    const end = (meta) => { if (done) return; done = true; URL.revokeObjectURL(url); res(meta); };
    el.preload = 'metadata'; el.muted = true; el.onloadedmetadata = () => end({ durationSec: Number.isFinite(el.duration) ? (kind === 'video' ? ceilSec(el.duration) : Math.round(el.duration)) : null, ...(kind === 'video' ? { w: el.videoWidth, h: el.videoHeight } : {}) });
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
  let info = null;
  try {
    if (kind === 'image') { const p = await prepareImage(file, remote ? MEDIA_CHUNK : LOCAL_IMG_MAX); blob = p.blob; type = p.type; meta = { w: p.w, h: p.h }; }
    else { [meta, info] = await Promise.all([probeAv(file, kind), kind === 'video' ? readMp4Info(file).catch(() => null) : null]); }
  } catch (e) { return fail(String(e?.message || e)); }
  // poprawny MP4 z rozpoznaną ścieżką wideo, którego ta przeglądarka nie odtwarza (np. H.265) – przyjmujemy z ostrzeżeniem: ekrany mogą go obsługiwać
  if (meta.unplayable && !info?.codec) return fail('Przeglądarka nie potrafi odtworzyć tego pliku. Zapisz wideo jako MP4 (H.264 + AAC), a dźwięk jako MP3 lub M4A.');
  if (info?.codec) meta = { ...meta, ...videoMeta(info, blob.size), ...(meta.unplayable || !meta.w ? { w: info.w || meta.w, h: info.h || meta.h } : {}), ...(info.durationSec ? { durationSec: ceilSec(info.durationSec) } : {}) };
  if (info?.codec && !meta.unplayable && !meta.w && cannotDecode({ mime: type, codecs: meta.codecs })) meta.unplayable = true; // metadane nie przyszły, a przeglądarka wprost odmawia kodeka
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

/* ───── Nagłówek MP4: kodek, klatki, długość, położenie indeksu (moov) – bez zależności ─────
 * Odczyt pudełek ISO BMFF: z pliku (File/Blob – fragmenty przez slice) albo z serwera (żądania Range, każda odpowiedź ≤ jedna część).
 * Nigdy nie rzuca wyjątku – przy nietypowym pliku zwraca pola null. */
export const CODEC_LABEL = { h264: 'H.264 (AVC)', hevc: 'H.265 (HEVC)', av1: 'AV1', vp9: 'VP9' };
const FOURCC = { avc1: 'h264', avc3: 'h264', hvc1: 'hevc', hev1: 'hevc', av01: 'av1', vp09: 'vp9' };
export const RISKY_CODECS = ['hevc', 'av1', 'vp9'];   // nie każde urządzenie je odtworzy
export const HEAVY_MBPS = 12;                         // powyżej – ostrzeżenie o ciężkim pliku
export const codecLabel = (c) => CODEC_LABEL[c] || (c ? String(c).toUpperCase() : null);
const u32 = (b, p) => ((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3];
const four = (b, p) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
const hex2 = (n) => n.toString(16).padStart(2, '0');
/** Pudełka w buforze [start, end) → [{ type, start, body, end }]. */
function boxesIn(b, start, end) {
  const out = []; let p = start;
  while (p + 8 <= end) {
    let size = u32(b, p); const type = four(b, p + 4); let hdr = 8;
    if (size === 1) { if (p + 16 > end) break; size = u32(b, p + 8) * 4294967296 + u32(b, p + 12); hdr = 16; } else if (size === 0) size = end - p;
    if (size < hdr || p + size > end) { out.push({ type, start: p, body: p + hdr, end: Math.min(end, p + size), cut: true }); break; }
    out.push({ type, start: p, body: p + hdr, end: p + size }); p += size;
  }
  return out;
}
const child = (b, box, ...path) => { let cur = box; for (const t of path) { cur = cur && boxesIn(b, cur.body, cur.end).find((x) => x.type === t); } return cur || null; };
/** Ciąg kodeka w stylu RFC 6381 (do canPlayType) z pudełka konfiguracji: avc1.64002a, hvc1.1.6.L120.90, av01.0.08M.08, vp09.00.40.08. */
function codecsString(b, fourcc, cfg) {
  try {
    if (!cfg) return fourcc;
    const d = cfg.body;
    if (cfg.type === 'avcC') return `${fourcc}.${hex2(b[d + 1])}${hex2(b[d + 2])}${hex2(b[d + 3])}`;
    if (cfg.type === 'hvcC') {
      const sp = b[d + 1] >> 6; const tier = (b[d + 1] >> 5) & 1; const prof = b[d + 1] & 31; let compat = u32(b, d + 2); let rev = 0; for (let i = 0; i < 32; i++) { rev = (rev << 1) | (compat & 1); compat >>>= 1; }
      const cons = Array.from(b.subarray(d + 6, d + 12)); while (cons.length && !cons[cons.length - 1]) cons.pop();
      return [fourcc, (['', 'A', 'B', 'C'][sp] || '') + prof, (rev >>> 0).toString(16), (tier ? 'H' : 'L') + b[d + 12], ...cons.map((x) => x.toString(16).toUpperCase())].join('.');
    }
    if (cfg.type === 'av1C') { const prof = b[d + 1] >> 5; const lvl = b[d + 1] & 31; const tier = b[d + 2] >> 7; const hi = (b[d + 2] >> 6) & 1; const twelve = (b[d + 2] >> 5) & 1; return `${fourcc}.${prof}.${String(lvl).padStart(2, '0')}${tier ? 'H' : 'M'}.${hi ? (twelve ? '12' : '10') : '08'}`; }
    if (cfg.type === 'vpcC') { const p = d + 4; return `${fourcc}.${String(b[p]).padStart(2, '0')}.${String(b[p + 1]).padStart(2, '0')}.${String(b[p + 2] >> 4).padStart(2, '0')}`; }
  } catch { /* nietypowa konfiguracja */ }
  return fourcc;
}
/** Analiza zawartości moov (bufor z całym pudełkiem moov). */
export function parseMoov(b) {
  const out = { codec: null, fourcc: null, codecs: null, w: null, h: null, fps: null, durationSec: null, hasAudio: false };
  try {
    const moov = boxesIn(b, 0, b.length).find((x) => x.type === 'moov'); if (!moov) return out;
    const mvhd = child(b, moov, 'mvhd');
    if (mvhd) { const v = b[mvhd.body]; const ts = v === 1 ? u32(b, mvhd.body + 20) : u32(b, mvhd.body + 12); const du = v === 1 ? u32(b, mvhd.body + 24) * 4294967296 + u32(b, mvhd.body + 28) : u32(b, mvhd.body + 16); if (ts) out.durationSec = du / ts; }
    for (const trak of boxesIn(b, moov.body, moov.end).filter((x) => x.type === 'trak')) {
      const hdlr = child(b, trak, 'mdia', 'hdlr'); const kind = hdlr ? four(b, hdlr.body + 8) : '';
      if (kind === 'soun') { out.hasAudio = true; continue; }
      if (kind !== 'vide' || out.codec) continue;
      const mdhd = child(b, trak, 'mdia', 'mdhd'); let dur = null;
      if (mdhd) { const v = b[mdhd.body]; const ts = v === 1 ? u32(b, mdhd.body + 20) : u32(b, mdhd.body + 12); const du = v === 1 ? u32(b, mdhd.body + 24) * 4294967296 + u32(b, mdhd.body + 28) : u32(b, mdhd.body + 16); if (ts) dur = du / ts; }
      const stbl = child(b, trak, 'mdia', 'minf', 'stbl'); const stsd = stbl && child(b, stbl, 'stsd');
      if (stsd) {
        const e = stsd.body + 8; let fc = four(b, e + 4);
        let entryEnd = Math.min(stsd.end, e + u32(b, e)); let cfgs = boxesIn(b, e + 86, entryEnd);
        if (fc === 'encv') { const sinf = cfgs.find((x) => x.type === 'sinf'); const frma = sinf && child(b, sinf, 'frma'); if (frma) fc = four(b, frma.body); }
        out.fourcc = fc; out.codec = FOURCC[fc] || fc.trim() || null; out.w = (b[e + 32] << 8) | b[e + 33]; out.h = (b[e + 34] << 8) | b[e + 35];
        out.codecs = codecsString(b, fc, cfgs.find((x) => ['avcC', 'hvcC', 'av1C', 'vpcC'].includes(x.type)));
      }
      const stsz = stbl && child(b, stbl, 'stsz'); const n = stsz ? u32(b, stsz.body + 8) : 0;
      if (n && dur) out.fps = Math.round((n / dur) * 100) / 100;
      if (!out.durationSec && dur) out.durationSec = dur;
    }
  } catch { /* nietypowy plik – zostają wartości null */ }
  return out;
}
/**
 * Informacje o pliku MP4: { codec, fourcc, codecs, w, h, fps, durationSec, hasAudio, moovAtEnd, size }.
 * src: File/Blob albo adres (Range). Szuka moov na początku pliku (pierwsze 256 kB), a gdy go tam nie ma – przechodzi po nagłówkach pudełek do końca pliku.
 */
export async function readMp4Info(src, knownSize) {
  const none = { codec: null, fourcc: null, codecs: null, w: null, h: null, fps: null, durationSec: null, hasAudio: false, moovAtEnd: null, size: knownSize || null };
  try {
    let size = knownSize || (typeof src === 'object' ? src.size : null);
    const read = typeof src === 'object'
      ? async (a, z) => new Uint8Array(await src.slice(a, z).arrayBuffer())
      : async (a, z) => { // zakres [a, z) kolejnymi żądaniami Range (serwer oddaje najwyżej jedną część naraz)
        const parts = []; let p = a; let n = 0;
        while (p < z && n++ < 40) { const r = await fetch(src, { headers: { range: `bytes=${p}-${z - 1}` } }); if (!r.ok) throw new Error('HTTP ' + r.status); const tot = /\/(\d+)$/.exec(r.headers.get('content-range') || ''); if (tot) size = +tot[1]; const buf = new Uint8Array(await r.arrayBuffer()); if (!buf.length) break; if (r.status === 200) { parts.length = 0; parts.push(buf.subarray(a, z)); break; } parts.push(buf); p += buf.length; }
        const all = new Uint8Array(parts.reduce((x, y) => x + y.length, 0)); let o = 0; for (const x of parts) { all.set(x, o); o += x.length; } return all;
      };
    const HEAD = 256 * 1024; const head = await read(0, size ? Math.min(size, HEAD) : HEAD); if (!size) size = head.length;
    if (head.length < 8 || four(head, 4) !== 'ftyp') return none; // to nie jest MP4 (np. WebM)
    let p = 0; let sawMdat = false; let guard = 0;
    while (p + 8 <= size && guard++ < 64) {
      const hb = p + 16 <= head.length ? head.subarray(p, p + 16) : await read(p, Math.min(size, p + 16)); if (hb.length < 8) break;
      let bs = u32(hb, 0); const type = four(hb, 4); if (bs === 1 && hb.length >= 16) bs = u32(hb, 8) * 4294967296 + u32(hb, 12); else if (bs === 0) bs = size - p;
      if (bs < 8) break;
      if (type === 'moov') {
        if (bs > 32 * 1024 * 1024) break;
        const buf = p + bs <= head.length ? head.subarray(p, p + bs) : await read(p, Math.min(size, p + bs));
        return { ...none, ...parseMoov(buf), moovAtEnd: sawMdat, size };
      }
      if (type === 'mdat') sawMdat = true;
      p += bs;
    }
    return { ...none, moovAtEnd: sawMdat || null, size };
  } catch { return none; }
}
/** Pola rekordu biblioteki z informacji o pliku: kodek, kl./s, przepływność (Mb/s), indeks na końcu. */
export function videoMeta(info, size) {
  if (!info?.codec) return {};
  const d = info.durationSec; const sz = size || info.size;
  return { codec: info.codec, codecs: info.codecs || info.fourcc, fps: info.fps || null, bitrateMbps: d > 0 && sz ? Math.round(((sz * 8) / d / 1e6) * 10) / 10 : null, moovAtEnd: !!info.moovAtEnd, ...(d ? { durationExact: Math.round(d * 1000) / 1000 } : {}) };
}
const probes = new Map(); // id → Promise (starsze pozycje bez pól kodeka – sprawdzane raz na sesję)
/** Kodek i parametry pliku wideo z biblioteki (pola rekordu albo – dla starszych pozycji – odczyt nagłówka z serwera / z pamięci). */
export function probeMediaInfo(ref) {
  const m = mediaItem(ref); if (!m || m.type !== 'video') return Promise.resolve(null);
  if (m.codec) return Promise.resolve(m);
  if (!probes.has(m.id)) {
    const url = mediaUrl(m);
    probes.set(m.id, !url || url.startsWith('data:') ? Promise.resolve(null) : (m.stored === 'server' ? readMp4Info(url, m.size) : fetch(url).then((r) => r.blob()).then((b) => readMp4Info(b))).then((info) => (info?.codec ? { ...m, ...videoMeta(info, m.size) } : null)).catch(() => null));
  }
  return probes.get(m.id);
}
/** Ciąg typu do canPlayType: video/mp4; codecs="…" (null, gdy kodek nieznany). */
export const mimeWithCodecs = (m) => (m?.codecs ? `${m.mime || 'video/mp4'}; codecs="${m.codecs}"` : null);
/** Czy ta przeglądarka na pewno NIE odtworzy pliku (canPlayType == "" dla rozpoznanego kodeka). */
export function cannotDecode(m) {
  const t = mimeWithCodecs(m); if (!t || typeof document === 'undefined') return false;
  try { return document.createElement('video').canPlayType(t) === ''; } catch { return false; }
}
const mbps = (x) => (x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10).replace('.', ','));
/** Ostrzeżenia techniczne dla pliku wideo → [{ id, tag, text, tone }] (kodek spoza H.264, ciężki plik, nieodtwarzalny przy wgrywaniu). */
export function videoWarnings(m) {
  const out = []; if (!m || m.type !== 'video') return out;
  if (RISKY_CODECS.includes(m.codec)) out.push({ id: 'codec', tone: 'warn', tag: codecLabel(m.codec), text: 'Nie każde urządzenie odtworzy ten format. Najbezpieczniej wgrać film w H.264 (AVC).' });
  if (m.bitrateMbps > HEAVY_MBPS) out.push({ id: 'heavy', tone: 'warn', tag: `ciężki plik · ${mbps(m.bitrateMbps)} Mb/s`, text: `Ciężki plik: ${mbps(m.bitrateMbps)} Mb/s. Do ekranów wystarcza 8–10 Mb/s.` });
  if (m.unplayable) out.push({ id: 'unplayable', tone: 'danger', tag: 'ta przeglądarka go nie odtwarza', text: 'Przeglądarka, w której wgrano plik, nie potrafiła go odtworzyć – na części ekranów film zostanie pominięty.' });
  return out;
}
/** Krótki opis techniczny: „H.264 (AVC) · 30 kl./s · 33 Mb/s”. */
export const videoTech = (m) => (m?.codec ? [codecLabel(m.codec), m.fps ? `${String(Math.round(m.fps * 100) / 100).replace('.', ',')} kl./s` : null, m.bitrateMbps ? `${mbps(m.bitrateMbps)} Mb/s` : null, m.moovAtEnd ? 'indeks na końcu pliku' : null].filter(Boolean).join(' · ') : '');

/* ───── Pozycje playlist ekranów: do jakiego pliku prowadzą i czy da się je pokazać (czyste funkcje stanu) ───── */
const libOf = (s, ref) => (isMediaRef(ref) ? (s.media || []).find((m) => m.id === ref.slice(PREFIX.length)) || null : null);
/** Plik wideo z biblioteki odtwarzany przez pozycję „video” (bezpośrednio „media:<id>” albo przez pole src filmu z CMS); null – symulacja / transmisja / brak. */
export function itemVideoFile(s, item) {
  if (item?.type !== 'video') return null;
  if (isMediaRef(item.ref)) { const m = libOf(s, item.ref); return m && m.type === 'video' ? m : null; }
  const v = (s.videos || []).find((x) => x.id === item.ref); if (!v || v.kind === 'live') return null;
  const m = isMediaRef(v.src) ? libOf(s, v.src) : v.src ? (s.media || []).find((x) => x.id === v.src) || null : null; return m && m.type === 'video' ? m : null;
}
/** Problem pozycji, przez który ekran ją pomija: 'film' (film usunięty z CMS), 'file' (plik usunięty z biblioteki) albo null. */
export function itemIssue(s, item) {
  if (item?.type === 'video') { if (isMediaRef(item.ref)) return libOf(s, item.ref) ? null : 'file'; return (s.videos || []).some((v) => v.id === item.ref) ? null : 'film'; }
  if (item?.type === 'image' && isMediaRef(item.ref)) return libOf(s, item.ref) ? null : 'file';
  return null;
}
