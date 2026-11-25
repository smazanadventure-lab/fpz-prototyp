// Atrapa Tpay do testów automatycznych (nie jest częścią systemu produkcyjnego).
// Udaje Open API Tpay w zakresie używanym przez serwer: token, utworzenie i odczyt transakcji, strona płatności,
// powiadomienie podpisane JWS (własny główny certyfikat + certyfikat podpisu, generowane przy starcie przez openssl).
//   node tools/tpay-mock.mjs --port=9911
// Serwer systemu uruchom z:  TPAY_ENV=mock TPAY_API_URL=http://localhost:9911 TPAY_SECURE_URL=http://localhost:9911
//                            TPAY_CLIENT_ID=test-id TPAY_CLIENT_SECRET=test-secret TPAY_SECURITY_CODE=kod123 TPAY_MERCHANT_ID=4010
// Strona płatności: /pay/<id>  →  /pay/<id>/ok[?nonotify=1][&amount=…][&badsig=1]  albo  /pay/<id>/fail
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const port = +args.port || 9911; const self = `http://localhost:${port}`;
const CLIENT_ID = args.id || 'test-id'; const CLIENT_SECRET = args.secret || 'test-secret'; const CODE = args.code ?? 'kod123'; const MERCHANT = String(args.merchant || '4010');

// certyfikaty: główny (CA) i podpisu powiadomień
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpay-mock-')); const f = (n) => path.join(dir, n); const ssl = (...a) => execFileSync('openssl', a, { stdio: 'pipe' });
ssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('root.key'), '-out', f('root.pem'), '-days', '2', '-subj', '/CN=Atrapa Tpay Root');
ssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('sign.key'), '-out', f('sign.csr'), '-subj', '/CN=Atrapa Tpay Notifications');
ssl('x509', '-req', '-in', f('sign.csr'), '-CA', f('root.pem'), '-CAkey', f('root.key'), '-CAcreateserial', '-out', f('sign.pem'), '-days', '2');
// certyfikat „obcy” – samopodpisany, do testu odrzucenia podpisu spoza łańcucha Tpay
ssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('evil.key'), '-out', f('evil.pem'), '-days', '2', '-subj', '/CN=Obcy');
const PEM = { root: fs.readFileSync(f('root.pem'), 'utf8'), sign: fs.readFileSync(f('sign.pem'), 'utf8'), evil: fs.readFileSync(f('evil.pem'), 'utf8') };
const KEY = { sign: fs.readFileSync(f('sign.key'), 'utf8'), evil: fs.readFileSync(f('evil.key'), 'utf8') };

const tokens = new Set(); const txs = new Map(); const log = []; let seq = 0;
const send = (res, status, body, headers) => { const b = typeof body === 'string' ? body : JSON.stringify(body); res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json', ...headers }); res.end(b); };
const readBody = async (req) => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c).toString('utf8'); };
const view = (t) => ({ result: 'success', requestId: 'req' + Date.now(), transactionId: t.id, title: t.title, posId: 'ps_mock', status: t.status, date: { creation: t.created, realization: t.paidAt }, amount: t.amount, currency: 'PLN', description: t.description, hiddenDescription: t.hidden, payer: t.payer, payments: { status: t.status, method: 'pay_by_link', amountPaid: t.status === 'correct' ? t.amount : 0, date: { realization: t.paidAt } }, transactionPaymentUrl: `${self}/pay/${t.id}` });

/** Powiadomienie jak z Tpay: formularz + nagłówek X-JWS-Signature (treść odłączona). opts: amount, badsig, evil, x5u */
export function buildNotification(t, opts = {}) {
  const amount = (opts.amount ?? t.amount).toFixed(2);
  const fields = { id: MERCHANT, tr_id: t.title, tr_date: new Date().toISOString().slice(0, 19).replace('T', ' '), tr_crc: t.hidden, tr_amount: amount, tr_paid: amount, tr_desc: t.description, tr_status: opts.status || 'TRUE', tr_error: 'none', tr_email: t.payer?.email || '', test_mode: '1' };
  fields.md5sum = crypto.createHash('md5').update(`${fields.id}${fields.tr_id}${fields.tr_amount}${fields.tr_crc}${opts.code ?? CODE}`).digest('hex');
  const body = new URLSearchParams(fields).toString();
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', x5u: opts.x5u || `${self}/x509/${opts.evil ? 'evil' : 'notifications-jws'}.pem` })).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(header + '.' + Buffer.from(body, 'utf8').toString('base64url')), opts.evil ? KEY.evil : KEY.sign).toString('base64url');
  return { body: opts.tamper ? body.replace(/tr_amount=[^&]+/, 'tr_amount=0.01') : body, jws: `${header}..${opts.badsig ? sig.slice(0, -6) + 'AAAAAA' : sig}` };
}
async function notify(t, opts) {
  if (!t.notifyUrl) return { skipped: true };
  const n = buildNotification(t, opts);
  try { const r = await fetch(t.notifyUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-jws-signature': n.jws }, body: n.body }); const text = await r.text(); const out = { status: r.status, text: text.slice(0, 160) }; log.push({ at: Date.now(), tx: t.id, ...out }); return out; }
  catch (e) { const out = { status: 0, text: String(e?.message || e) }; log.push({ at: Date.now(), tx: t.id, ...out }); return out; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, self); const p = url.pathname; const q = Object.fromEntries(url.searchParams);
    if (p === '/x509/notifications-jws.pem') return send(res, 200, PEM.sign, { 'content-type': 'application/x-pem-file' });
    if (p === '/x509/tpay-jws-root.pem') return send(res, 200, PEM.root, { 'content-type': 'application/x-pem-file' });
    if (p === '/x509/evil.pem') return send(res, 200, PEM.evil, { 'content-type': 'application/x-pem-file' });
    if (p === '/oauth/auth' && req.method === 'POST') {
      const b = new URLSearchParams(await readBody(req)); if (b.get('client_id') !== CLIENT_ID || b.get('client_secret') !== CLIENT_SECRET) return send(res, 401, { error: 'invalid_client', error_description: 'Client authentication failed' });
      const tok = crypto.randomBytes(20).toString('hex'); tokens.add(tok); return send(res, 200, { issued_at: Math.floor(Date.now() / 1000), scope: 'read write', token_type: 'Bearer', expires_in: 7200, client_id: CLIENT_ID, access_token: tok });
    }
    if (p.startsWith('/transactions')) {
      const tok = (req.headers.authorization || '').replace(/^Bearer /, ''); if (!tokens.has(tok)) return send(res, 401, { result: 'failed', errors: [{ errorCode: 'unauthorized', errorMessage: 'Unauthorized' }] });
      if (p === '/transactions' && req.method === 'POST') {
        const b = JSON.parse(await readBody(req)); if (!(b.amount > 0) || !b.description) return send(res, 400, { result: 'failed', errors: [{ errorCode: 'value_is_required', fieldName: !b.description ? 'description' : 'amount', errorMessage: 'Field is required' }] });
        const id = 'ta_' + crypto.randomBytes(8).toString('hex'); const t = { id, title: `TR-MOCK-${(++seq).toString().padStart(4, '0')}X`, status: 'pending', created: new Date().toISOString(), paidAt: null, amount: b.amount, description: b.description, hidden: b.hiddenDescription || '', payer: b.payer || {}, lang: b.lang, successUrl: b.callbacks?.payerUrls?.success, errorUrl: b.callbacks?.payerUrls?.error, notifyUrl: b.callbacks?.notification?.url };
        txs.set(id, t); return send(res, 200, view(t));
      }
      const m = p.match(/^\/transactions\/([\w-]+)$/); if (m && req.method === 'GET') { const t = txs.get(m[1]); return t ? send(res, 200, view(t)) : send(res, 404, { result: 'failed', errors: [{ errorCode: 'not_found', errorMessage: 'Transaction not found' }] }); }
    }
    const pm = p.match(/^\/pay\/([\w-]+)(?:\/(ok|fail))?$/);
    if (pm) {
      const t = txs.get(pm[1]); if (!t) return send(res, 404, '<h1>Nie ma takiej transakcji</h1>');
      if (!pm[2]) return send(res, 200, `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atrapa Tpay</title><body style="font:18px system-ui;max-width:460px;margin:40px auto;padding:0 16px"><h1>Atrapa strony płatności Tpay</h1><p>${t.description}</p><p><b>${t.amount.toFixed(2)} zł</b> · ${t.title}</p><p><a id="ok" href="/pay/${t.id}/ok">Zapłać (symulacja banku)</a></p><p><a id="ok-nonotify" href="/pay/${t.id}/ok?nonotify=1">Zapłać – bez powiadomienia</a></p><p><a id="fail" href="/pay/${t.id}/fail">Odrzuć płatność</a></p></body></html>`);
      if (pm[2] === 'fail') { res.writeHead(302, { location: t.errorUrl || '/' }); return res.end(); }
      if (q.badsig || q.evil || q.amount || q.tamper || q.x5u || q.badcode) { const out = await notify(t, { badsig: !!q.badsig, evil: !!q.evil, tamper: !!q.tamper, amount: q.amount ? +q.amount : undefined, x5u: q.x5u, code: q.badcode ? 'zly-kod' : undefined }); return send(res, 200, { forged: true, notify: out }); } // powiadomienia nieprawidłowe – stan transakcji bez zmian
      t.status = 'correct'; t.paidAt = new Date().toISOString();
      const out = q.nonotify ? { skipped: true } : await notify(t, {});
      if (q.json) return send(res, 200, { paid: true, notify: out });
      res.writeHead(302, { location: t.successUrl || '/' }); return res.end();
    }
    const rm = p.match(/^\/renotify\/([\w-]+)$/); if (rm) { const t = txs.get(rm[1]); return t ? send(res, 200, { notify: await notify(t, { status: q.status }) }) : send(res, 404, {}); }
    if (p === '/__log') return send(res, 200, { log, txs: [...txs.values()].map((t) => ({ id: t.id, status: t.status, amount: t.amount, hidden: t.hidden, lang: t.lang, payer: t.payer, successUrl: t.successUrl, notifyUrl: t.notifyUrl })) });
    send(res, 404, { error: 'not_found', path: p });
  } catch (e) { console.error(e); send(res, 500, { error: String(e?.message || e) }); }
});
server.listen(port, () => console.log(`Atrapa Tpay: ${self}  (client_id=${CLIENT_ID})`));
process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* nic */ } });
process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
