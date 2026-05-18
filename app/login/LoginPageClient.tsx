"use client";

import { useEffect, useState } from "react";
import { detectWebviewApp } from "@/lib/webview";
import {
  GoogleButton,
  MagicLinkForm,
  WebviewWarning,
} from "@/components/auth/LoginButton";

/**
 * /login 頁面內容。沿用 LoginButton 內部 MagicLinkForm + GoogleButton 元件、
 * 但不走 dropdown — 直接展開顯示。
 *
 * `next` 從 URL 帶入給 callback URL，user 登入完跳回原本要去的頁面（書籤 /
 * 分享連結就能正確 deep-link）。
 */
export function LoginPageClient({ next }: { next: string }) {
  const [webviewApp, setWebviewApp] = useState<string | null>(null);

  useEffect(() => {
    setWebviewApp(detectWebviewApp());
    // 把 next 寫進 sessionStorage、給 LoginButton 內 form 用（form 內部直接
    // 用 window.location.pathname 組 callback、會吃不到 ?next= 的值。把它
    // 改寫到 window.location.search 模擬 form 內部行為。）
    // 簡化：直接修改 URL（不重整）讓 form 內讀 window.location.search 拿到 next
    if (typeof window !== "undefined" && next && next !== "/") {
      const url = new URL(window.location.href);
      url.searchParams.set("next", next);
      window.history.replaceState({}, "", url.toString());
    }
  }, [next]);

  return (
    <div>
      {webviewApp && <WebviewWarning app={webviewApp} />}
      <MagicLinkForm />
      <div className="my-4 flex items-center gap-2 text-xs text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200" />
        <span>或</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
      <GoogleButton
        disabledReason={webviewApp ? `${webviewApp} 內無法用 Google 登入` : null}
      />
    </div>
  );
}
