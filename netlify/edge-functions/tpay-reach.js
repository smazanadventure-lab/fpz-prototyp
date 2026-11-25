// Diagnostyka (bez kluczy i bez danych): czy środowisko testowe Tpay (sandbox) jest osiągalne z węzła brzegowego Netlify
// najbliższego osobie, która otwiera ten adres. Funkcje serwera działają w USA i sandbox je odrzuca (HTTP 403) –
// ten adres pokazuje, czy z węzła w Europie byłoby inaczej.   GET /api/pay/reach-edge
export default async (request, context) => {
  const one = async (url) => { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000); try { const r = await fetch(url, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': 'fpz-prototyp/0.5 (+https://fpz-prototyp.netlify.app; Tpay OpenAPI)' } }); return r.status; } catch (e) { return e && e.name === 'AbortError' ? 'timeout' : 'błąd sieci'; } finally { clearTimeout(to); } };
  const [api, cert, prod] = await Promise.all([one('https://openapi.sandbox.tpay.com/'), one('https://secure.sandbox.tpay.com/x509/tpay-jws-root.pem'), one('https://api.tpay.com/')]);
  const body = { ok: true, where: 'węzeł brzegowy Netlify', node: (context.server && context.server.region) || null, visitorCountry: (context.geo && context.geo.country && context.geo.country.code) || null, reach: { sandbox: { api, cert }, production: { api: prod } }, verdict: api === 403 ? 'sandbox Tpay odrzuca także ten węzeł' : api === 200 ? 'sandbox Tpay jest stąd osiągalny' : 'wynik niejednoznaczny' };
  return new Response(JSON.stringify(body, null, 2), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
};
export const config = { path: '/api/pay/reach-edge' };
