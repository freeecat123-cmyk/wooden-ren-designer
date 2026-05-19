/**
 * 木頭仁 木作藍圖 — minimal service worker.
 *
 * 目的:讓 Chrome / Edge 桌面瀏覽器在網址列顯示「安裝 App」按鈕。
 * 一個合法 (即使空) 的 SW + 合格 manifest.json 就能觸發 install prompt。
 *
 * 不做 cache,不攔截 fetch — 純 stub。
 * 之後想做 offline / 預先 cache 縮圖再回來改這個檔。
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 不攔截 fetch,讓所有請求直接走網路 (避免 cache 過舊資源)。
self.addEventListener("fetch", () => {
  // intentionally empty
});
