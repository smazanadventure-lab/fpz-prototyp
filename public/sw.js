// Prosty service worker: zapamiętuje powłokę aplikacji (jeden plik HTML), aby wersja zainstalowana na telefonie uruchamiała się bez sieci.
// Dane (/api/*) nie są tu buforowane – aplikacja trzyma je sama i synchronizuje po odzyskaniu połączenia.
const CACHE = 'fpz-powloka-__BUILD__';
const SHELLS = ['/index.html', '/app/index.html'];
const shellOf = (pathname) => (/^\/(app|q)(\/|$)/.test(pathname) ? '/app/index.html' : '/index.html');
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELLS.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET' || r.mode !== 'navigate') return;
  const u = new URL(r.url); if (u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;
  const key = shellOf(u.pathname);
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; }).catch(() => caches.match(key)));
});
