// 這支 Service Worker 刻意做得很保守：
// 只快取「外殼」檔案（首頁本身、圖示），完全不快取 /api/ 開頭的資料庫請求，
// 也不快取天氣、維基百科圖片等外部即時資料——這些東西一旦被快取住变成舊資料，
// 會讓使用者看到過期的人潮、天氣、或別人新增的內容，比沒有離線功能還糟。
// 所以這裡的離線能力很有限：只保證「至少能打開 App 的外殼畫面」，
// 不保證離線時資料是最新的。

const CACHE_NAME = 'kyushu-shell-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 呼叫、外部資料一律不經過 Service Worker 快取，直接走網路，
  // 確保資料永遠是最新的（共用景點、行程、天氣、維基圖片等）
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return; // 不攔截，讓瀏覽器照正常方式處理
  }

  // 外殼檔案：先試網路拿最新版本，失敗（離線）時才退回快取
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
