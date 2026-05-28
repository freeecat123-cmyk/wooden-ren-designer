"use client";

/**
 * 統一的 currency 讀取 hook。預留給未來 pricing / quote 顯示用，
 * 目前還沒有實際呼叫端 — 因為 pricing 涉及匯率、稅、發票，
 * 不適合在本輪 infra finalization 一起改。
 *
 * 解析優先序（高→低）：
 *   1. localStorage `wr-currency`（手動偏好，未來 UI 預留）
 *   2. `useGeoDefaults().currency`（middleware 推測值）
 *   3. Hardcoded `"TWD"`（向後相容：原本整站預設 TWD）
 *
 * SSR-safe：第一帧回 fallback，useEffect 後 hydrate。
 */

import { useEffect, useState } from "react";
import { useGeoDefaults } from "./useGeoDefaults";
import type { CurrencyPref } from "@/lib/geo-defaults";

const LS_KEY = "wr-currency";
const FALLBACK: CurrencyPref = "TWD";

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
    const local = readLocalCurrency();
    if (local) {
      setCurrency(local);
      return;
    }
    setCurrency(geo.currency);
  }, [geo.currency]);

  return currency;
}
