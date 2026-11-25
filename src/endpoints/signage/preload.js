// Ekrany LCD: filmy z biblioteki wczytywane w całości do pamięci przed odtworzeniem (tak działają odtwarzacze digital signage).
// Plik pobierany częściami (Range, serwer oddaje najwyżej jedną część 3 MB na odpowiedź, 3 żądania naraz) → Blob → adres blob:,
// odtwarzany potem w pętli bez ponownego pobierania. Pamięć podręczna wspólna dla całej karty, limit ok. 200 MB (najdawniej używane wypadają).
// Stan pozycji: loading (progress 0–1) | ready (url) | error (reason: 'decode' – przeglądarka nie odtwarza formatu, 'download' – nie udało się pobrać).
import { useEffect, useState } from 'preact/hooks';
import { mediaUrl, MEDIA_CHUNK, cannotDecode, readMp4Info } from '../../kernel/media.js';

const CAP = 200 * 1024 * 1024; const PARALLEL = 3; const TRIES = 4; const META_MS = 15000; const RETRY_DOWNLOAD_MS = 60000;
const cache = new Map(); // id → { state, progress, url, bytes, used, reason, codec, own }
const subs = new Set(); let ver = 0;
const emit = () => { ver++; subs.forEach((f) => f(ver)); };
const put = (id, p) => { const e = { ...(cache.get(id) || {}), ...p }; cache.set(id, e); emit(); return e; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stan pliku w pamięci ekranu albo null (jeszcze nie zlecono). */
export const fileState = (id) => { const e = cache.get(id); if (e) e.used = Date.now(); return e || null; };
/** Odtwarzacz zgłosił błąd pliku z pamięci – oznaczamy go jako nieodtwarzalny (ekrany go pomijają). */
export function markFailed(id, reason = 'decode') { const e = cache.get(id); if (!e || e.state === 'error') return; if (e.own && e.url) URL.revokeObjectURL(e.url); put(id, { state: 'error', reason, url: null }); }

async function fetchPart(url, a, z) {
  let last;
  for (let i = 0; i < TRIES; i++) {
    try {
      const r = await fetch(url, { headers: { range: `bytes=${a}-${z - 1}` } });
      if (r.status === 404 || r.status === 410) throw Object.assign(new Error('HTTP ' + r.status), { final: true });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = new Uint8Array(await r.arrayBuffer()); const tot = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
      return { buf, full: r.status === 200, total: tot ? +tot[1] : null };
    } catch (e) { last = e; if (e.final) break; await sleep(700 * (i + 1)); }
  }
  throw last || new Error('Nie udało się pobrać pliku');
}
/** Pobranie całego pliku częściami (do PARALLEL naraz). */
async function download(m, url) {
  let size = +m.size || 0;
  if (!size) { const f = await fetchPart(url, 0, MEDIA_CHUNK); if (f.full) return [f.buf]; size = f.total || f.buf.length; if (f.buf.length >= size) return [f.buf]; }
  const n = Math.max(1, Math.ceil(size / MEDIA_CHUNK)); const bufs = new Array(n); let next = 0; let got = 0;
  const worker = async () => {
    while (next < n) {
      const i = next++; let a = i * MEDIA_CHUNK; const z = Math.min(size, a + MEDIA_CHUNK); const parts = [];
      while (a < z) { const f = await fetchPart(url, a, z); if (f.full) { bufs.length = 0; bufs.push(f.buf); next = n; return; } if (!f.buf.length) throw new Error('Pusta odpowiedź'); parts.push(f.buf); a += f.buf.length; got += f.buf.length; put(m.id, { progress: Math.min(0.99, got / size) }); }
      bufs[i] = parts.length === 1 ? parts[0] : new Blob(parts);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, n) }, worker));
  return bufs;
}
/** Czy przeglądarka odczyta obraz z pliku: metadane z wymiarami obrazu w rozsądnym czasie (bez tego – błąd formatu). */
function verify(url) {
  return new Promise((res) => {
    const el = document.createElement('video'); let done = false;
    const end = (ok) => { if (done) return; done = true; clearTimeout(t); el.removeAttribute('src'); try { el.load(); } catch { /* nic */ } res(ok); };
    const t = setTimeout(() => end(false), META_MS);
    el.muted = true; el.preload = 'metadata'; el.onloadedmetadata = () => end(el.videoWidth > 0); el.onerror = () => end(false); el.src = url;
  });
}
function evict(keep) {
  let total = 0; for (const e of cache.values()) if (e.state === 'ready' && e.own) total += e.bytes || 0;
  const old = [...cache.entries()].filter(([id, e]) => id !== keep && e.state === 'ready' && e.own).sort((a, b) => (a[1].used || 0) - (b[1].used || 0));
  while (total > CAP && old.length) { const [id, e] = old.shift(); URL.revokeObjectURL(e.url); total -= e.bytes || 0; cache.delete(id); }
}
async function load(m) {
  const url = mediaUrl(m);
  if (!url) { put(m.id, { state: 'none', progress: 0 }); return; } // np. plik z wersji jednoplikowej z innej karty – zostaje dotychczasowe zachowanie (symulacja)
  if (cannotDecode(m)) { put(m.id, { state: 'error', reason: 'decode', codec: m.codec, progress: 0 }); return; } // nie pobieramy pliku, którego i tak nie odtworzymy
  let own = false; let src = url; let bytes = 0; let codec = m.codec || null;
  if (m.stored === 'server') {
    try { const bufs = await download(m, url); const blob = new Blob(bufs, { type: m.mime || 'video/mp4' }); bytes = blob.size; src = URL.createObjectURL(blob); own = true; if (!codec) codec = (await readMp4Info(blob).catch(() => null))?.codec || null; }
    catch { put(m.id, { state: 'error', reason: 'download', at: Date.now() }); return; }
  }
  put(m.id, { progress: 1, codec });
  const ok = await verify(src);
  if (!ok) { if (own) URL.revokeObjectURL(src); put(m.id, { state: 'error', reason: 'decode', url: null, codec }); return; }
  put(m.id, { state: 'ready', url: src, own, bytes, progress: 1, used: Date.now() }); evict(m.id);
}
/** Zlecenie wczytania pliku wideo z biblioteki (bez skutku, gdy już jest w pamięci lub się wczytuje). */
export function preload(m) {
  if (!m || m.type !== 'video') return;
  const e = cache.get(m.id);
  if (e && !(e.state === 'error' && e.reason === 'download' && Date.now() - (e.at || 0) > RETRY_DOWNLOAD_MS)) { e.used = Date.now(); return; }
  cache.set(m.id, { state: 'loading', progress: 0, used: Date.now() }); emit();
  load(m).catch(() => put(m.id, { state: 'error', reason: 'download', at: Date.now() }));
}
/** Hook: wczytuje podane pliki (rekordy biblioteki) i odświeża komponent przy każdej zmianie stanu pamięci. Zwraca fileState. */
export function usePreload(files) {
  const [, set] = useState(0);
  useEffect(() => { const f = (n) => set(n); subs.add(f); return () => { subs.delete(f); }; }, []);
  const key = files.map((m) => m.id).join(',');
  useEffect(() => { files.forEach(preload); }, [key]);
  return fileState;
}
