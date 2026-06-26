/* pharmacy-portal Service Worker
 * 僅快取入口 shell（index.html / tools.json / manifest / 圖示）。
 * 外部工具（github.io、GAS）與 Google Fonts 不攔截，一律走網路。
 */
const CACHE = 'pharmacy-portal-v1';
const SHELL = [
  './',
  'index.html',
  'tools.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只處理同源請求；外部工具/字型交給瀏覽器直接連網
  if (url.origin !== self.location.origin) return;

  // 入口頁與工具清單：stale-while-revalidate（離線可開、上線即更新）
  if (req.mode === 'navigate' || url.pathname.endsWith('/tools.json')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 其餘同源靜態資源（圖示、manifest 等）：cache-first
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then((cache) =>
    cache.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}
