// Płatności po stronie klienta. W trybie serwerowym serwer może mieć włączony Tpay (net.pay.provider === 'tpay');
// wtedy płatność odbywa się na stronie Tpay, a bilety wydaje serwer po potwierdzeniu od operatora.
// Bez Tpay (albo w wersji jednoplikowej bez serwera) działa płatność symulowana – operacja booking.pay.
import { getState } from './store.js';
import { remoteEnabled, whenSent, apiCall, syncNow } from './remote.js';

/** 'tpay' albo null (płatność symulowana). */
export const payProvider = () => (remoteEnabled() && getState().net.pay?.provider) || null;
/** 'sandbox' | 'production' | 'mock' | null */
export const payEnv = () => (payProvider() ? getState().net.pay.env || null : null);

const NET_ERR = { ok: false, error: 'NETWORK', message: { pl: 'Brak połączenia z serwerem płatności. Sprawdź internet i spróbuj ponownie.', en: 'Cannot reach the payment server. Check your connection and try again.' } };

/**
 * Rozpoczęcie płatności Tpay dla zamówienia. Zwraca { ok, url } (adres strony płatności Tpay), { ok, paid: true }
 * (zamówienie nie wymaga płatności lub jest już opłacone) albo { ok: false, error, message: { pl, en } }.
 * opts: lang 'pl'|'en', fresh – wymuś nową transakcję (po nieudanej próbie), native – aplikacja APK.
 */
export async function startPayment(orderId, { lang = 'pl', fresh = false, native = false } = {}) {
  const sent = await whenSent(8000); // zamówienie musi najpierw dotrzeć na serwer
  if (!sent) return { ok: false, error: 'QUEUE', message: { pl: 'Zamówienie nie zostało jeszcze wysłane na serwer. Sprawdź internet i spróbuj ponownie.', en: 'The order has not been sent to the server yet. Check your connection and try again.' } };
  try { return await apiCall('/pay/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId, lang, fresh, native, deviceId: getState().deviceId }) }); } catch { return NET_ERR; }
}
/** Stan zamówienia na serwerze: { ok, status: 'pending'|'paid'|'cancelled'|'refunded', url? }. Serwer przy okazji sam dopytuje Tpay. */
export async function paymentStatus(orderId) { try { return await apiCall('/pay/status?z=' + encodeURIComponent(orderId)); } catch { return NET_ERR; } }
/** Natychmiastowe pobranie świeżych danych z serwera (np. biletów po opłaceniu). */
export const refreshNow = () => syncNow();
