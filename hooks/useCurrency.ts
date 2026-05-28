"use client";

/**
 * 統一的 currency 讀取 hook。
 *
 * 解析優先序（高→低）：
 *   1. localStorage `wr-currency`（手動偏好，由 CurrencyToggle 寫入）
 *   2. `useGeoDefaults().currency`（middleware 推測值）
 *   3. Hardcoded `"TWD"`（向後相容：原本整站預設 TWD）
 *
 * SSR-safe：第一帧回 fallback，useEffect 後 hydrate。
 * 需要 SSR 第一帧就拿到正確 currency 的 server component，請改用
 * `lib/units/server-currency.ts` 的 `getCurrencyFromCookies()`。
 *
 * Live update：訂閱 CURRENCY_CHANGE_EVENT，CurrencyToggle 切換時所有
 * useCurrency() 訂閱者即時換顯示；跨頁籤靠 `storage` event 同步。
 *
 * 注意：本 hook 只決定「顯示哪個幣別 LABEL」。金額本身的匯率換算是
 * 商業決策（390 TWD ≠ 12 USD），不在這層處理。
 */

import { useEffect, useState } from "react";
import { useGeoDefaults } from "./useGeoDefaults";
import type { CurrencyPref } from "@/lib/geo-defaults";

const LS_KEY = "wr-currency";
const FALLBACK: CurrencyPref = "TWD";

export const CURRENCY_CHANGE_EVENT = "wr-currency-change";

function readLocalCurrency(): CurrencyPref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "TWD" || v === "USD") return v;
    return null;
  } catch {
    return null;
  }
}

export function useCurrency(): CurrencyPref {
  const geo = useGeoDefaults();
  const [currency, setCurrency] = useState<CurrencyPref>(FALLBACK);

  useEffect(() => {
    const resolve = () => {
      const local = readLocalCurrency();
      setCurrency(local ?? geo.currency);
    };
    resolve();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) resolve();
    };
    const onCustom = () => resolve();
    window.addEventListener("storage", onStorage);
    window.addEventListener(CURRENCY_CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CURRENCY_CHANGE_EVENT, onCustom);
    };
  }, [geo.currency]);

  return currency;
}
