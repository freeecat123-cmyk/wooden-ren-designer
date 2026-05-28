"use client";

/**
 * Client hook：讀 middleware 寫入的 `wr-geo-defaults` cookie。
 * 回傳推測的 unit / currency 預設值，供 unit / currency state hook 當 fallback 使用。
 *
 * 使用範例：
 *   const geo = useGeoDefaults();
 *   const [unit, setUnit] = useState<UnitPref>(
 *     () => readLocal("wr-unit") ?? geo.unit
 *   );
 *
 * 注意：cookie 是 middleware 在第一次造訪時寫入；SSR 第一帧若想避免 hydration
 * mismatch，server component 可以直接從 `cookies()` 拿到同樣的值再 SSR。
 */

import { useEffect, useState } from "react";
import {
  FALLBACK_GEO_DEFAULTS,
  GEO_DEFAULTS_COOKIE,
  parseGeoDefaultsCookie,
  type GeoDefaults,
} from "@/lib/geo-defaults";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }
  return null;
}

export function useGeoDefaults(): GeoDefaults {
  const [defaults, setDefaults] = useState<GeoDefaults>(FALLBACK_GEO_DEFAULTS);

  useEffect(() => {
    const parsed = parseGeoDefaultsCookie(readCookie(GEO_DEFAULTS_COOKIE));
    if (parsed) setDefaults(parsed);
  }, []);

  return defaults;
}
