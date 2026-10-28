/* pharmacy-portal Service Worker
 * 僅快取入口 shell（index.html / tools.json / manifest / 圖示）。
 * 外部工具（github.io、GAS）與 Google Fonts 不攔截，一律走網路。
 *
 * 不 precache 'index.html'：線上 /index.html 會 307 → /，cache.addAll 存到的是
 * redirected=true 的 response，拿它回應導覽請求會被瀏覽器拒絕（導覽失敗）。
 * 導覽一律以 './'（= 入口頁）為 cache key，/index.html、/?x=1 等變體都共用它。
 */
const PREFIX = 'pharmacy-portal-';
const CACHE = `${PREFIX}v10`;
const SHELL = [
  './',
  'tools.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];
const SHELL_KEY = new URL('./', self.location.href).href;
const SHELL_PATH = new URL(SHELL_KEY).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // 只汰換**本工具自己的** cache。
      // 本站目前獨佔 workers.dev 子網域，刪不到別人；前綴守衛是為了「哪天同源再放東西」
      // 時不必回頭想起這件事——CacheStorage 是 origin 共用的。
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只處理同源請求；外部工具/字型交給瀏覽器直接連網
  if (url.origin !== self.location.origin) return;

  // 入口頁（/、/index.html，任意 query）：stale-while-revalidate，cache key 固定為 './'
  // 其他導覽（如 /sitemap.xml）不攔截，免得被換成入口頁
  if (req.mode === 'navigate' &&
      (url.pathname === SHELL_PATH || url.pathname === SHELL_PATH + 'index.html')) {
    event.respondWith(staleWhileRevalidate(event, SHELL_KEY, offlineFallback));
    return;
  }

  // 工具清單：stale-while-revalidate（離線可開、上線即更新）
  if (url.pathname.endsWith('/tools.json')) {
    event.respondWith(staleWhileRevalidate(event, req, null));
    return;
  }

  // 其餘同源靜態資源（圖示、manifest 等）：cache-first
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});

/* 先回 cache，背景以網路更新。
 * 背景更新在 fetch 事件分派期間同步掛上 event.waitUntil，避免 SW 在 put 完成前被終止。
 * 網路失敗又無 cache 時交給 fallback；無 fallback 則讓錯誤冒泡（等同未攔截時的網路錯誤），
 * 絕不 resolve 成 undefined（respondWith(undefined) 會變成網路錯誤）。
 */
function staleWhileRevalidate(event, key, fallback) {
  const network = fetch(key, { cache: 'no-cache' }).then((res) => {
    // redirected 的 response 不能拿來回應導覽，不入快取
    if (res && res.ok && !res.redirected) {
      return caches.open(CACHE)
        .then((cache) => cache.put(key, res.clone()))
        .catch(() => {})
        .then(() => res);
    }
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  return caches.open(CACHE)
    .then((cache) => cache.match(key))
    .then((cached) => cached ||
      network.catch((err) => (fallback ? fallback() : Promise.reject(err))));
}

function offlineFallback() {
  return caches.match(SHELL_KEY).then((hit) => hit || new Response(
    '<!DOCTYPE html><html lang="zh-TW"><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>離線中 — 個人臨床藥學工具集</title>' +
    '<p style="font-family:sans-serif;padding:2rem;text-align:center">目前離線，且尚無快取的入口頁。請連線後重新整理。</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  ));
}
