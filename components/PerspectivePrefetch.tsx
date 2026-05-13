"use client";

import { useEffect } from "react";

/**
 * 在首頁 mount 時非同步 prefetch PerspectiveView chunk（~600KB）。
 * 使用者瀏覽家具卡片時 chunk 已下載到 cache；點進去設計頁的 3D 就秒開。
 *
 * 不 render 任何 DOM。
 */
export function PerspectivePrefetch() {
  useEffect(() => {
    // requestIdleCallback 避免跟首頁 image / font 載入搶頻寬
    const idle = (cb: () => void) => {
      if (typeof window === "undefined") return;
      const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void };
      if (w.requestIdleCallback) {
        w.requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 500);
      }
    };
    idle(() => {
      // Fire-and-forget. Webpack/Next 看到 import() 會 emit chunk preload。
      import("./PerspectiveView").catch(() => {
        // 無關緊要，使用者點進去時還是會載
      });
    });
  }, []);
  return null;
}
