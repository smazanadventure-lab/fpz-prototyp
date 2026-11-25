// Sprawdzenie integracji na PRAWDZIWYM środowisku testowym Tpay (sandbox) – bez przeglądarki i bez pieniędzy.
// Uruchamiane w GitHub Actions (.github/workflows/tpay-sandbox.yml); wymaga dostępu do internetu.
//   TPAY_CLIENT_ID=… TPAY_CLIENT_SECRET=… node test/tpay-live.mjs
// Kroki: token → utworzenie transakcji → odczyt transakcji → pobranie certyfikatów powiadomień i kontrola łańcucha.
import crypto from 'node:crypto';
import { tpayConfig, checkAuth, createTransaction, getTransaction, checkChain } from '../server/tpay.mjs';
const gh = !!process.env.GITHUB_ACTIONS; let fails = 0;
const say = (ok, name, detail) => { if (!ok) fails++; const line = `${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`; console.log(line); if (gh) console.log(`::${ok ? 'notice' : 'error'} title=Tpay sandbox::${line.replace(/\r?\n/g, ' ').slice(0, 900)}`); };
const cfg = tpayConfig(); if (!cfg) { say(false, 'konfiguracja', 'brak TPAY_CLIENT_ID / TPAY_CLIENT_SECRET'); process.exit(1); }
console.log('środowisko:', cfg.mode, cfg.api, '· client_id:', cfg.clientId.slice(0, 6) + '…');
const site = process.env.FPZ_SITE || 'https://fpz-prototyp.netlify.app'; const crc = 'ord-live' + Date.now().toString(36);
try { await checkAuth(cfg); say(true, 'autoryzacja (POST /oauth/auth)', 'token przyznany'); } catch (e) { say(false, 'autoryzacja (POST /oauth/auth)', e.message); }
let tx = null;
if (!fails) {
  try {
    tx = await createTransaction(cfg, { amount: 12.34, description: 'Fabryka Pełna Życia – bilety, zamówienie próbne', crc, email: 'tester@example.com', name: 'Tester Integracji', lang: 'pl', successUrl: `${site}/api/pay/return?z=${crc}&w=ok&l=pl`, errorUrl: `${site}/api/pay/return?z=${crc}&w=blad&l=pl`, notifyUrl: `${site}/api/pay/notify` });
    say(true, 'utworzenie transakcji (POST /transactions)', `stan: ${tx.status}, tytuł: ${tx.title}, strona płatności: ${tx.url.replace(/[?#].*$/, '').slice(0, 80)}`);
  } catch (e) { say(false, 'utworzenie transakcji (POST /transactions)', e.message + (e.body ? ' · ' + JSON.stringify(e.body).slice(0, 500) : '')); }
}
if (tx) {
  try { const g = await getTransaction(cfg, tx.transactionId); say(g.status === 'pending' && Math.abs(g.amount - 12.34) < 0.005 && g.crc === crc, 'odczyt transakcji (GET /transactions/{id})', `stan: ${g.status}, kwota: ${g.amount}, hiddenDescription wraca: ${g.crc === crc ? 'tak' : 'NIE (' + g.crc + ')'}`); }
  catch (e) { say(false, 'odczyt transakcji (GET /transactions/{id})', e.message); }
}
// certyfikaty podpisu powiadomień – te same adresy, z których korzysta serwer przy weryfikacji JWS
for (const [label, secure] of [[cfg.mode, cfg.secure], ...(cfg.mode === 'sandbox' ? [['production', 'https://secure.tpay.com']] : [])]) {
  try {
    const [cert, root] = await Promise.all(['notifications-jws.pem', 'tpay-jws-root.pem'].map(async (f) => { const r = await fetch(`${secure}/x509/${f}`, { headers: { 'user-agent': 'fpz-prototyp/0.5 (+https://fpz-prototyp.netlify.app; Tpay OpenAPI)' } }); if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`); return r.text(); }));
    const c = new crypto.X509Certificate(cert); const chain = checkChain(cert, root);
    say(chain.ok, `certyfikat powiadomień (${label})`, chain.ok ? `wystawca zgodny z certyfikatem głównym; klucz ${c.publicKey.asymmetricKeyType} ${c.publicKey.asymmetricKeyDetails?.modulusLength || ''}; ważny do ${c.validTo}` : `${chain.reason}; issued=${c.checkIssued(new crypto.X509Certificate(root))} verify=${c.verify(new crypto.X509Certificate(root).publicKey)} subject=${c.subject.replace(/\n/g, ',')} issuer=${c.issuer.replace(/\n/g, ',')}`);
  } catch (e) { say(false, `certyfikat powiadomień (${label})`, String(e.message || e)); }
}
console.log(fails ? `\n✗ niepowodzenia: ${fails}` : '\n✓ integracja z sandboxem Tpay działa (token, transakcja, odczyt, certyfikaty)'); process.exit(fails ? 1 : 0);
