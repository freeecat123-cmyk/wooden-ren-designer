"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "ios-install-banner-dismissed-v1";
const DELAY_MS = 4000; // 進站 4 秒後才跳,不打擾首次瀏覽

/**
 * iOS Safari 首次訪問才看到的「加到主畫面」底部 banner。
 *
 * 規則：
 *   - 只在 iOS（含 iPadOS 13+ Macintosh UA + maxTouchPoints > 1）顯示
 *   - 必須是 Safari(WebKit + 沒有 CriOS/FxiOS/EdgiOS) — iOS Chrome/Firefox 不能裝
 *   - 已安裝 (display-mode standalone 或 navigator.standalone) → 不顯示
 *   - 使用者按 ✕ 後 localStorage 記住 → 永久不再顯示
 *   - 進站 4 秒後才跳,讓首屏內容先呈現
 *   - webview (LINE / FB / IG) → 不顯示(裝不了)
 */
export function IOSInstallBanner() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. 已記住關閉過 → 跳過
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* localStorage 不可用就當沒記住,讓 banner 跳 */
    }

    // 2. 已安裝 → 跳過
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // 3. 偵測 iOS（含 iPadOS 13+）
    const ua = window.navigator.userAgent;
    const isLegacyIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isIPadOS =
      /Macintosh/.test(ua) &&
      typeof window.navigator.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1;
    const isIOS = isLegacyIOS || isIPadOS;
    if (!isIOS) return;

    // 4. 必須是 Safari（iOS Chrome=CriOS / Firefox=FxiOS / Edge=EdgiOS 都不能裝）
    const isNonSafariBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isNonSafariBrowser) return;

    // 5. webview (LINE / FB / IG) → 不顯示
    const isWebview =
      /Line|FB_IAB|FBAN|FBAV|Instagram/i.test(ua) ||
      // iOS in-app browser 沒有 Safari/ 字串
      (!/Safari/.test(ua) && /Mobile/.test(ua));
    if (isWebview) return;

    // 4 秒後跳
    const t = window.setTimeout(() => setShow(true), DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-300 shadow-xl">
        {!expanded ? (
          <div className="flex items-center gap-3 p-3">
            <span aria-hidden className="text-2xl">📲</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 leading-tight">
                加到主畫面，下次一秒打開
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">免下載、完整 App 體驗</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800"
            >
              安裝
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="關閉"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-zinc-900">
                安裝到主畫面（iOS）
              </h3>
              <button
                type="button"
                onClick={dismiss}
                aria-label="關閉"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200"
              >
                ✕
              </button>
            </div>
            <ol className="text-sm text-zinc-700 space-y-2 list-decimal list-inside">
              <li>
                點 Safari <strong>下方分享</strong>按鈕{" "}
                <span aria-hidden className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-xs">⬆</span>
              </li>
              <li>
                往下滑，選擇 <strong>「加入主畫面」</strong>
              </li>
              <li>
                點右上角 <strong>「新增」</strong> 完成
              </li>
            </ol>
            <p className="text-xs text-amber-800 bg-amber-100 rounded px-2 py-1.5 leading-relaxed">
              💡 必須用 <strong>Safari</strong> 開啟才有這個選項；Chrome / Line / FB 內建瀏覽器都沒有。
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="w-full min-h-[44px] rounded-lg bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-900"
            >
              知道了
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
