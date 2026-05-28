"use client";

/**
 * 統一的 unit 讀取 hook。
 *
 * 解析優先序（高→低）：
 *   1. localStorage `wr-unit`（未來使用者手動切換的偏好；目前還沒有 UI 寫入，先預留）
 *   2. `useGeoDefaults().unit`（middleware 依 IP 寫入的 cookie 推測值）
 *   3. Hardcoded `"mm"`（向後相容：原本沒 geo 推測時整站預設台灣使用 mm）
 *
 * SSR-safe：第一帧回傳 fallback (`"mm"`)，useEffect 後才 hydrate 自 cookie / localStorage，
 * 避免 hydration mismatch。需要 SSR 第一帧就拿到正確單位的情境（例如 server component
 * 渲染 PDF / OG image），請改用 server-side `cookies()` 直接讀 `wr-geo-defaults`。
 *
 * 注意：目前大多數呼叫端仍用 `locale === "en" ? "inch" : "mm"`。本 hook 是新的標準，
 * 後續會逐步把這些呼叫點遷移過來。
 */

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useGeoDefaults } from "./useGeoDefaults";
import type { UnitPref } from "@/lib/geo-defaults";

const LS_KEY = "wr-unit";
const FALLBACK: UnitPref = "mm";

function readLocalUnit(): UnitPref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "mm" || v === "inch") return v;
    return null;
  } catch {
    return null;
  }
}

export const UNIT_CHANGE_EVENT = "wr-unit-change";

export function useUnit(): UnitPref {
  const locale = useLocale();
  const geo = useGeoDefaults();
  const [unit, setUnit] = useState<UnitPref>(FALLBACK);

  useEffect(() => {
    // 台灣版(zh-TW)強制 mm,不給切英寸
    if (locale === "zh-TW") {
      setUnit("mm");
      return;
    }
    const resolve = () => {
      const local = readLocalUnit();
      setUnit(local ?? geo.unit);
    };
    resolve();
    // Live update when UnitToggle changes localStorage in same tab,
    // or another tab via storage event.
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) resolve();
    };
    const onCustom = () => resolve();
    window.addEventListener("storage", onStorage);
    window.addEventListener(UNIT_CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(UNIT_CHANGE_EVENT, onCustom);
    };
  }, [geo.unit, locale]);

  return unit;
}
