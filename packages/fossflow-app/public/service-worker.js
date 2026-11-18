/**
 * FossFLOW service worker
 *
 * 只缓存「同源静态资源」；/api 请求必须绕过缓存，否则保存/加载后台架构、
 * 运行视图指标与日志都会读到旧快照（实测：保存后再 GET 仍返回旧 diagram）。
 */
const CACHE_NAME = 'fossflow-static-v2';

self.addEventListener('install', () => {
  // 新版立即进入等待完成状态，避免旧 SW 继续用缓存响应
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 跨域与后端 API 一律走网络，不进入缓存
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // 页面导航：网络优先，离线时才回退到缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') ).then(response => response || fetch(request))
    );
    return;
  }

  // 静态资源（带 hash 的 js/css/svg 等）：缓存优先
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        }

        return response;
      });
    })
  );
});
