"use client";

import { useEffect } from "react";

/**
 * 註冊 /sw.js — 讓 Chrome / Edge 桌面顯示「安裝 App」按鈕。
 * SW 本身不做 cache (純 stub),只是 PWA install eligibility 需要它。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // 不在 localhost dev 跑,避免 SW cache 干擾熱更新
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[sw] register failed", err);
    });
  }, []);
  return null;
}
