"use client";

import { useEffect } from "react";
import { installRscFetchRetry } from "@/lib/net/rsc-retry";

/**
 * 把 RSC 請求重試層裝上 `window.fetch`。
 *
 * 為什麼需要：RSC 請求失敗時 Next.js 會退回**整頁硬導航**，使用者眼中就是
 * 「用到一半畫面自己重整」，行動網路打嗝一次就會發生。
 * 完整背景與實測記錄見 `lib/net/rsc-retry.ts` 檔頭。
 */
export function RscFetchRetry() {
  useEffect(() => installRscFetchRetry(), []);
  return null;
}
