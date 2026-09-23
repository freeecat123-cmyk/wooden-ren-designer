"use client";

import { useEffect } from "react";

/**
 * 把瀏覽器端炸掉的錯誤送回 /api/client-error。
 *
 * 為什麼：2026-09-07 客人寄來一封空的問題回報，我們查不到他遇到什麼，因為站上沒有錯誤記錄。
 *
 * 只掛在最外層 layout 一次。會送三種：
 *   error      — window.onerror（同步爆掉）
 *   rejection  — 沒被 catch 的 promise
 *   boundary   — React 錯誤邊界（由 error.tsx / global-error.tsx 呼叫 reportClientError）
 */

const MAX_PER_PAGE = 5; // 同一次瀏覽最多回報 5 筆，擋住無限迴圈把資料表灌爆
let sent = 0;
const seen = new Set<string>();

export function reportClientError(
  error: unknown,
  kind: "error" | "rejection" | "boundary" = "error",
) {
  if (typeof window === "undefined") return;
  if (sent >= MAX_PER_PAGE) return;

  const err = error as { message?: unknown; stack?: unknown } | null;
  const message = String(err?.message ?? error ?? "").slice(0, 500);
  if (!message) return;

  const stack = typeof err?.stack === "string" ? err.stack.slice(0, 4000) : undefined;
  // 同一次瀏覽同一個錯誤只送一次（scroll 事件裡爆掉會連噴幾百次）
  const key = kind + "|" + message + "|" + (stack?.split("\n")[1] ?? "");
  if (seen.has(key)) return;
  seen.add(key);
  sent++;

  const payload = JSON.stringify({
    message,
    stack,
    kind,
    path: window.location.pathname + window.location.search,
    build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  });

  // keepalive：使用者當下把分頁關掉也要送得出去
  void fetch("/api/client-error", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* 回報失敗不能再引發錯誤 */
  });
}

export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message, "error");
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason, "rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
