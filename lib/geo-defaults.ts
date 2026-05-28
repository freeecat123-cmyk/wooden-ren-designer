/**
 * Geo-based defaults for unit & currency.
 *
 * 第一次造訪的訪客沒有任何偏好設定時，根據 Vercel geo IP 推測合理預設：
 *   - 亞洲（TW/HK/MO/CN/JP/KR）→ 公制 (mm) + TWD（暫無多幣別 → fallback TWD）
 *   - 北美/英國/澳紐（US/CA/UK/GB/AU/NZ）→ 英制 (inch) + USD
 *   - 其它 → 公制 (mm) + USD（國際預設）
 *
 * 設定來源：middleware.ts 讀 `x-vercel-ip-country` header，
 * 寫入 cookie `wr-geo-defaults`（JSON），且只在 cookie 不存在時寫入，
 * 確保不會覆蓋使用者後續手動切換的偏好。
 *
 * 消費者：client 透過 `useGeoDefaults()` hook 讀取；
 * server 元件可直接 `cookies().get(GEO_DEFAULTS_COOKIE)`。
 */

export const GEO_DEFAULTS_COOKIE = "wr-geo-defaults";

export type UnitPref = "mm" | "inch";
export type CurrencyPref = "TWD" | "USD";

export interface GeoDefaults {
  unit: UnitPref;
  currency: CurrencyPref;
  /** ISO 3166-1 alpha-2 country code, or "XX" if unknown */
  country: string;
}

const METRIC_TWD_COUNTRIES = new Set(["TW", "HK", "MO", "CN", "JP", "KR"]);
const IMPERIAL_USD_COUNTRIES = new Set(["US", "CA", "UK", "GB", "AU", "NZ"]);

export function resolveGeoDefaults(countryRaw: string | null | undefined): GeoDefaults {
  const country = (countryRaw || "XX").toUpperCase();

  if (METRIC_TWD_COUNTRIES.has(country)) {
    return { unit: "mm", currency: "TWD", country };
  }
  if (IMPERIAL_USD_COUNTRIES.has(country)) {
    return { unit: "inch", currency: "USD", country };
  }
  // 國際預設：mm + USD
  return { unit: "mm", currency: "USD", country };
}

export function parseGeoDefaultsCookie(value: string | null | undefined): GeoDefaults | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<GeoDefaults>;
    if (
      (parsed.unit === "mm" || parsed.unit === "inch") &&
      (parsed.currency === "TWD" || parsed.currency === "USD") &&
      typeof parsed.country === "string"
    ) {
      return parsed as GeoDefaults;
    }
    return null;
  } catch {
    return null;
  }
}

/** 統一預設值（沒 cookie、沒 geo header 時用）。 */
export const FALLBACK_GEO_DEFAULTS: GeoDefaults = {
  unit: "mm",
  currency: "USD",
  country: "XX",
};
