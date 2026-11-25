// Płatności Tpay (/api/pay/*) – ta sama logika co reszta API (server/core.mjs + server/pay-routes.mjs),
// ale osobna funkcja, żeby mogła działać w regionie europejskim: środowisko testowe Tpay (sandbox)
// odrzuca połączenia z serwerów w USA (HTTP 403), a domyślny region funkcji Netlify to US East (Ohio).
// Uwaga: wybór regionu Netlify udostępnia w planach Pro i Enterprise; w planie Free ustawienie może zostać pominięte.
// Stan faktyczny pokazuje GET /api/pay/check (pola „region” i „reach”).
import handler from '../../server/build/handler.mjs';

export default handler;
export const config = { path: '/api/pay/*', region: 'fra' };
