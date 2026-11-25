// Płatności Tpay (Open API): token OAuth, utworzenie transakcji, odczyt jej stanu i weryfikacja powiadomień (JWS + md5).
// Dokumentacja: https://docs-api.tpay.com  (autoryzacja, pierwsza transakcja, webhooks).
//
// Konfiguracja – zmienne środowiskowe serwera (Netlify → Project configuration → Environment variables):
//   TPAY_CLIENT_ID, TPAY_CLIENT_SECRET   klucze „Open API” z Panelu Akceptanta (wymagane – bez nich działa płatność symulowana)
//   TPAY_ENV                             sandbox (domyślnie) | production
//   TPAY_SECURITY_CODE                   kod bezpieczeństwa akceptanta (opcjonalnie – dodatkowa kontrola sumy md5 w powiadomieniu)
//   TPAY_MERCHANT_ID                     identyfikator akceptanta (opcjonalnie – kontrola pola „id” w powiadomieniu)
// Tylko do testów automatycznych: TPAY_ENV=mock + TPAY_API_URL + TPAY_SECURE_URL (atrapa Tpay: tools/tpay-mock.mjs).
import crypto from 'node:crypto';

const ENVS = {
  sandbox: { api: 'https://openapi.sandbox.tpay.com', secure: 'https://secure.sandbox.tpay.com' },
  production: { api: 'https://api.tpay.com', secure: 'https://secure.tpay.com' },
};
const UA = 'fpz-prototyp/0.5 (+https://fpz-prototyp.netlify.app; Tpay OpenAPI)'; // część zapór odrzuca żądania bez czytelnego nagłówka User-Agent
const env = (k) => { try { return (process.env[k] ?? '').trim(); } catch { return ''; } };

/** Konfiguracja Tpay albo null, gdy kluczy nie ustawiono (wtedy system używa płatności symulowanej). */
export function tpayConfig() {
  const clientId = env('TPAY_CLIENT_ID'); const clientSecret = env('TPAY_CLIENT_SECRET'); if (!clientId || !clientSecret) return null;
  const want = env('TPAY_ENV').toLowerCase(); const mode = /^prod/.test(want) ? 'production' : want === 'mock' ? 'mock' : 'sandbox';
  const base = mode === 'mock' ? { api: env('TPAY_API_URL'), secure: env('TPAY_SECURE_URL') } : ENVS[mode];
  if (!base.api || !base.secure) return null;
  const code = (() => { try { return process.env.TPAY_SECURITY_CODE; } catch { return undefined; } })();
  return { mode, clientId, clientSecret, api: base.api.replace(/\/+$/, ''), secure: base.secure.replace(/\/+$/, ''), securityCode: code === undefined ? null : String(code).trim(), merchantId: env('TPAY_MERCHANT_ID') || null };
}

export class TpayError extends Error {
  constructor(step, http, body) {
    const detail = body && typeof body === 'object' ? (body.error_description || body.message || (Array.isArray(body.errors) ? body.errors.map((e) => `${e.fieldName || e.errorCode || ''} ${e.errorMessage || ''}`.trim()).join('; ') : '') || body.error || '') : String(body || '');
    super(`Tpay ${step}: HTTP ${http}${detail ? ' – ' + String(detail).slice(0, 300) : ''}`); this.step = step; this.http = http; this.body = body;
  }
}
async function http(url, init, step) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init?.headers || {}) }, signal: ctl.signal }); const text = await r.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text.slice(0, 300); }
    if (!r.ok) throw new TpayError(step, r.status, body);
    return body;
  } catch (e) { if (e instanceof TpayError) throw e; throw new TpayError(step, 0, e?.name === 'AbortError' ? 'przekroczono czas oczekiwania' : String(e?.message || e)); } finally { clearTimeout(to); }
}

let tokenCache = null; // { key, value, exp } – ważny zwykle 2 godziny; funkcja serwera trzyma go w pamięci między wywołaniami
async function token(cfg) {
  const key = cfg.api + '|' + cfg.clientId;
  if (tokenCache && tokenCache.key === key && tokenCache.exp > Date.now() + 60000) return tokenCache.value;
  const j = await http(cfg.api + '/oauth/auth', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret }).toString() }, 'autoryzacja');
  if (!j || !j.access_token) throw new TpayError('autoryzacja', 200, 'brak tokenu w odpowiedzi');
  tokenCache = { key, value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 7200) * 1000 };
  return tokenCache.value;
}
const authed = async (cfg, path, init, step) => http(cfg.api + path, { ...init, headers: { accept: 'application/json', authorization: 'Bearer ' + (await token(cfg)), ...(init?.headers || {}) } }, step);

/** Sprawdzenie kluczy: próba pobrania tokenu. */
export async function checkAuth(cfg) { tokenCache = null; await token(cfg); return true; }

/** Nowa transakcja. Zwraca { transactionId, title, status, url } – url to strona płatności Tpay dla płacącego. */
export async function createTransaction(cfg, { amount, description, crc, email, name, lang, successUrl, errorUrl, notifyUrl }) {
  const body = {
    amount: Math.round(Number(amount) * 100) / 100, description: String(description).slice(0, 128), hiddenDescription: String(crc), lang: lang === 'en' ? 'en' : 'pl',
    payer: { email: email || 'gosc@example.com', name: name || 'Gość' },
    callbacks: { payerUrls: { success: successUrl, error: errorUrl }, notification: { url: notifyUrl } },
  };
  const j = await authed(cfg, '/transactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 'utworzenie transakcji');
  const url = j?.transactionPaymentUrl; if (!j?.transactionId || typeof url !== 'string') throw new TpayError('utworzenie transakcji', 200, j?.result === 'failed' ? j : 'brak adresu płatności w odpowiedzi');
  if (!url.startsWith(cfg.secure + '/')) throw new TpayError('utworzenie transakcji', 200, 'adres płatności spoza domeny Tpay');
  return { transactionId: String(j.transactionId), title: j.title ? String(j.title) : null, status: j.status || 'pending', url };
}

/** Stan transakcji u operatora. */
export async function getTransaction(cfg, transactionId) {
  const j = await authed(cfg, '/transactions/' + encodeURIComponent(transactionId), { method: 'GET' }, 'odczyt transakcji');
  return { transactionId: String(j?.transactionId || transactionId), title: j?.title || null, status: String(j?.status || '').toLowerCase(), amount: Number(j?.amount), crc: j?.hiddenDescription ?? null, paid: Number(j?.payments?.amountPaid ?? NaN), method: j?.payments?.method || null };
}
/** Czy transakcja jest opłacona (stan „correct” – w nowszej dokumentacji „paid”) na pełną kwotę zamówienia. */
export const isPaid = (tx, total, crc) => ['correct', 'paid'].includes(tx.status) && sameAmount(tx.amount, total) && (tx.crc == null || tx.crc === '' || tx.crc === crc);
export const sameAmount = (a, b) => Number.isFinite(Number(a)) && Math.abs(Number(a) - Number(b)) < 0.005;

/* ───── powiadomienia (webhook) ───── */
const pemCache = new Map(); // adres → { pem, at }
async function fetchPem(url) {
  const hit = pemCache.get(url); if (hit && Date.now() - hit.at < 3600e3) return hit.pem;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, { headers: { 'user-agent': UA }, signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const pem = await r.text(); if (!/BEGIN CERTIFICATE/.test(pem)) throw new Error('to nie jest certyfikat'); pemCache.set(url, { pem, at: Date.now() }); return pem; } finally { clearTimeout(to); }
}
/** Kontrola certyfikatu podpisu: wystawiony przez główny certyfikat Tpay i ważny dziś. */
export function checkChain(certPem, rootPem, now = Date.now()) {
  const cert = new crypto.X509Certificate(certPem); const root = new crypto.X509Certificate(rootPem);
  if (!cert.checkIssued(root) || !cert.verify(root.publicKey)) return { ok: false, reason: 'certyfikat podpisu nie został wystawiony przez Tpay' };
  if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) return { ok: false, reason: 'certyfikat podpisu jest nieważny (data)' };
  return { ok: true, cert };
}
/**
 * Weryfikacja podpisu JWS powiadomienia (nagłówek X-JWS-Signature, RFC 7515, treść odłączona):
 * certyfikat z adresu x5u (tylko domena Tpay) → kontrola względem głównego certyfikatu Tpay → podpis RSA-SHA256
 * nad „<nagłówek>.<base64url(treść żądania)>”.
 */
export async function verifyJws(cfg, jws, rawBody) {
  try {
    if (!jws || typeof jws !== 'string') return { ok: false, reason: 'brak nagłówka X-JWS-Signature' };
    const parts = jws.trim().split('.'); if (parts.length !== 3 || !parts[0] || !parts[2]) return { ok: false, reason: 'nieprawidłowy format podpisu' };
    let header; try { header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { return { ok: false, reason: 'nieczytelny nagłówek podpisu' }; }
    // algorytm ustalamy sami (RSA-SHA256, jak w dokumentacji Tpay) – nie ufamy polu „alg” z nagłówka
    const x5u = header.x5u; if (typeof x5u !== 'string' || !x5u.startsWith(cfg.secure + '/')) return { ok: false, reason: 'certyfikat podpisu spoza domeny Tpay' };
    const chain = checkChain(await fetchPem(x5u), await fetchPem(cfg.secure + '/x509/tpay-jws-root.pem')); if (!chain.ok) return chain;
    const payload = Buffer.from(rawBody, 'utf8').toString('base64url');
    const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + payload, 'utf8'), chain.cert.publicKey, Buffer.from(parts[2], 'base64url'));
    return ok ? { ok: true } : { ok: false, reason: 'podpis nie zgadza się z treścią' };
  } catch (e) { return { ok: false, reason: 'nie udało się sprawdzić podpisu: ' + String(e?.message || e).slice(0, 120) }; }
}
/** Pola powiadomienia (application/x-www-form-urlencoded) + ocena: paid | refund | other. */
export function parseNotification(cfg, rawBody) {
  const n = Object.fromEntries(new URLSearchParams(rawBody)); const st = String(n.tr_status || '').toUpperCase();
  const out = { fields: n, crc: n.tr_crc || '', title: n.tr_id || '', amount: Number(n.tr_amount), paid: Number(n.tr_paid ?? n.tr_amount), kind: /^(TRUE|PAID|CORRECT)$/.test(st) ? 'paid' : st === 'CHARGEBACK' ? 'refund' : 'other', test: n.test_mode === '1' };
  if (cfg.securityCode !== null) { const sum = crypto.createHash('md5').update(`${n.id ?? ''}${n.tr_id ?? ''}${n.tr_amount ?? ''}${n.tr_crc ?? ''}${cfg.securityCode}`).digest('hex'); if (sum !== String(n.md5sum || '').toLowerCase()) return { ...out, ok: false, reason: 'suma kontrolna md5 się nie zgadza' }; }
  if (cfg.merchantId && String(n.id || '') !== cfg.merchantId) return { ...out, ok: false, reason: 'powiadomienie dla innego akceptanta' };
  if (!out.crc) return { ...out, ok: false, reason: 'brak identyfikatora zamówienia (tr_crc)' };
  return { ...out, ok: true };
}
