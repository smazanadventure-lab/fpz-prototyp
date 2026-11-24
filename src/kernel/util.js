// Narzędzia wspólne (bez zależności od DOM).
let seq = 0;
// Identyfikatory i kody. W trakcie operacji API działa generator z ziarnem (withIdSeed), aby ta sama operacja
// wykonana lokalnie (optymistycznie) i powtórzona na serwerze nadała rekordom identyczne identyfikatory.
let seeded = null;
const hash32 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const newNonce = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export function withIdSeed(nonce, fn) { const prev = seeded; seeded = { tag: String(nonce).slice(-9), n: 0, rnd: mulberry(hash32(String(nonce))) }; try { return fn(); } finally { seeded = prev; } }
const rnd = () => (seeded ? seeded.rnd() : Math.random());
export const uid = (prefix = 'id') => (seeded ? `${prefix}-${seeded.tag}${(seeded.n++).toString(36)}` : `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`);
export const code = (len = 8) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < len; i++) s += a[Math.floor(rnd() * a.length)]; return s; };
/** Bieżący czas w strefie Europe/Warsaw (serwer działa w UTC): { hhmm: '21:30', day: 0..6 (0 = niedziela) } */
export function warsawNow(d = new Date()) {
  try { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
    return { hhmm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
  } catch { return { hhmm: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`, day: d.getDay() }; }
}
export const clsx = (...xs) => xs.flat().filter(Boolean).join(' ');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pad2 = (n) => String(n).padStart(2, '0');
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (f(x) || 0), 0);
export const byId = (arr, id) => (arr || []).find((x) => x.id === id) || null;
export const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
export const deepClone = (o) => JSON.parse(JSON.stringify(o));

// Daty – ISO lokalne 'YYYY-MM-DDTHH:MM'
export const nowIso = () => new Date().toISOString();
export const dayStr = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const localIso = (d) => `${dayStr(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const LOCALES = { pl: 'pl-PL', en: 'en-GB', de: 'de-DE', cs: 'cs-CZ', uk: 'uk-UA' };
export const locale = (lang) => LOCALES[lang] || lang || 'pl-PL';
export function fmtDate(iso, lang = 'pl', opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return ''; try { return new Intl.DateTimeFormat(locale(lang), opts).format(new Date(iso)); } catch { return String(iso).slice(0, 10); }
}
export const fmtDay = (iso, lang) => fmtDate(iso, lang, { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso, lang) => fmtDate(iso, lang, { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (iso, lang) => fmtDate(iso, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export function fmtMoney(v, lang = 'pl') {
  try { return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).format(v || 0); } catch { return `${(v || 0).toFixed(2)} zł`; }
}
export function fmtDuration(sec) { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; }
export function ago(iso, lang = 'pl') {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const pl = lang === 'pl';
  if (s < 10) return pl ? 'przed chwilą' : 'just now';
  if (s < 60) return pl ? `${s} s temu` : `${s}s ago`;
  if (s < 3600) return pl ? `${Math.floor(s / 60)} min temu` : `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return pl ? `${Math.floor(s / 3600)} godz. temu` : `${Math.floor(s / 3600)} h ago`;
  return fmtDate(iso, lang, { day: 'numeric', month: 'short' });
}

// Geografia
export function distanceM(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtDistance = (m) => (m == null || !isFinite(m) ? '—' : m < 950 ? `${Math.round(m / 5) * 5} m` : `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`);

// Tekst: akapity + **pogrubienie** → tablica akapitów z segmentami
export function paragraphs(text) {
  return String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => p.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((seg) => (seg.startsWith('**') ? { b: true, text: seg.slice(2, -2) } : { b: false, text: seg })));
}
export const stripMarks = (text) => String(text || '').replace(/\*\*/g, '');
export const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
export const matches = (q, ...fields) => { const n = normalize(q).trim(); return !n || fields.some((f) => normalize(f).includes(n)); };
export function download(filename, text, mime = 'text/plain') {
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch { /* środowisko bez pobierania */ }
}
