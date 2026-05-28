/**
 * Server-side unit resolver. Mirrors hooks/useUnit.ts on the client.
 *
 * 解析優先序（高→低）：
 *   1. locale=zh-TW → 強制 "mm"（台灣版鎖死,跟 useUnit 邏輯一致）
 *   2. cookie `wr-unit`（使用者手動偏好,由 UnitToggle 寫入 localStorage;
 *      目前 toggle 只寫 localStorage,所以這條多半 miss — 預留供未來 server-side sync 用）
 *   3. cookie `wr-geo-defaults`（middleware 依 IP 推測值）
 *   4. Hardcoded `"mm"`
 *
 * 用在 Server Component 渲染標題 badge / page metadata 等需要第一帧拿到正確 unit 的場景。
 * Client 端用 `useUnit()`。
 */

import { cookies } from "next/headers";
import { parseGeoDefaultsCookie, GEO_DEFAULTS_COOKIE, type UnitPref } from "@/lib/geo-defaults";

const UNIT_COOKIE = "wr-unit";

export async function getUnitFromCookies(locale?: string): Promise<UnitPref> {
  if (locale === "zh-TW") return "mm";

  const store = await cookies();
  const direct = store.get(UNIT_COOKIE)?.value;
  if (direct === "mm" || direct === "inch") return direct;

  const geo = parseGeoDefaultsCookie(store.get(GEO_DEFAULTS_COOKIE)?.value);
  if (geo?.unit) return geo.unit;

  return "mm";
}
