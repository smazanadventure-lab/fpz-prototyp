// API systemu (pilotaż): wszystkie końcówki – aplikacja mobilna, WWW, kioski, ekrany, bileter, CMS, zarządzanie –
// korzystają z tych samych operacji i tych samych danych. Kod: server/core.mjs + src/kernel/api.js.
// Płatności (/api/pay/*) obsługuje osobna funkcja pay.mjs (ten sam kod, region europejski).
import handler from '../../server/build/handler.mjs';

export default handler;
export const config = { path: '/api/*', excludedPath: '/api/pay/*' };
