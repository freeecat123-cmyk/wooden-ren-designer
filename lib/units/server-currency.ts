/**
 * Server-side currency resolver. Mirrors hooks/useCurrency.ts on the client.
 *
 * 解析優先序（高→低）：
 *   1. cookie `wr-currency`（使用者手動偏好，由 CurrencyToggle 寫入；
 *      不過目前 toggle 只寫 localStorage，所以這條多半 miss — 預留供未來 server-side
 *      sync 用）
 *   2. cookie `wr-geo-defaults`（middleware 依 IP 推測值）
 *   3. Hardcoded `"TWD"`（向後相容：原本整站預設 TWD）
 *
 * 用在 Server Component 渲染 JSON-LD / SEO metadata / OG image 等需要第一帧
 * 就拿到正確 currency 的場景。Client 端用 `useCurrency()`。
 *
 * TODO（未本輪處理）：pricing 金額本身的匯率換算是商業決策（390 TWD ≠ 12 USD），
 * 目前 USD 顯示用的 amount 直接是 hardcode 表（layout.tsx 維護兩份 offer 陣列），
 * 將來統一定價後可以單向轉換。
 */

import { cookies } from "next/headers";
import { parseGeoDefaultsCookie, GEO_DEFAULTS_COOKIE, type CurrencyPref } from "@/lib/geo-defaults";

const CURRENCY_COOKIE = "wr-currency";

export async function getCurrencyFromCookies(): Promise<CurrencyPref> {
  const store = await cookies();
  const direct = store.get(CURRENCY_COOKIE)?.value;
  if (direct === "TWD" || direct === "USD") return direct;

  const geo = parseGeoDefaultsCookie(store.get(GEO_DEFAULTS_COOKIE)?.value);
  if (geo?.currency) return geo.currency;

  return "TWD";
}
