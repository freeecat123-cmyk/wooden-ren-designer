/**
 * Lemon Squeezy 設定 — 環境變數讀取 + API endpoint
 * Lemon Squeezy 沒有 sandbox / production URL 切換（Test Mode 是 store-level flag）。
 */

export const LEMONSQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY ?? "";
export const LEMONSQUEEZY_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID ?? "";
export const LEMONSQUEEZY_WEBHOOK_SECRET =
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";

export const LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1";

/** 檢查 env 完整性，server-only call。回傳 missing keys 陣列。 */
export function checkLemonSqueezyConfig(): string[] {
  const missing: string[] = [];
  if (!LEMONSQUEEZY_API_KEY) missing.push("LEMONSQUEEZY_API_KEY");
  if (!LEMONSQUEEZY_STORE_ID) missing.push("LEMONSQUEEZY_STORE_ID");
  if (!LEMONSQUEEZY_WEBHOOK_SECRET) missing.push("LEMONSQUEEZY_WEBHOOK_SECRET");
  return missing;
}
