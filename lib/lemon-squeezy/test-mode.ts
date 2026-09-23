/**
 * Lemon Squeezy 測試模式事件判定。
 *
 * LS 的 Test Mode 是 store 層級的開關（不是換 API endpoint），測試 store 發生的事件
 * **照樣會送 webhook**，payload 逐欄跟正式事件一樣，只多一個 `test_mode: true`。
 * 官方說法：測試模式讓你「用一份跟正式店分開的資料集」做 dummy purchases，
 * 而 webhook payload 內就帶 test_mode 讓你分辨事件來自哪一邊。
 *
 * 為什麼一定要擋（2026-08-11 實查線上，不是假設）：
 *   - 27 筆 webhook 事件裡 **26 筆是 test_mode=true，processed 26／rejected 0**
 *   - 它們在正式 `payments` 表留下 **10 筆 status=success 的假付款**
 *     （用 `lemonsqueezy_order_id` join 得上，0 筆落空；再拿 live API key 去 LS 官方
 *       反查那些 order 一律 **404 = live 資料裡不存在**，唯一那筆 live 的 8572998 才回 200）
 *   - 而且**還在長**：測試模式的訂閱仍在每月續扣，2026-06-28、07-28 各再寫兩筆
 *
 * 跟綠界 [[SimulatePaid]] 是同一類洞（見 lib/ecpay/simulated-payment.ts），差別：
 *   - LS 是 Merchant of Record，這條路徑**不開發票**，所以沒有稅務問題
 *   - 外人打不進來：`variant-map.ts` 已在 2026-05-31 KYC 後重建成純 Live variant ID，
 *     結帳 URL 由那份 map 反查產生，訪客不可能被導到測試結帳
 *   → 所以損害是**帳本污染**（假營收）而不是漏財或漏稅
 *
 * 寬鬆解析：payload 型別是 Record<string, unknown>，JSON 理論上可能給字串 "true"。
 */
import type { LemonWebhookPayload } from "./webhook";

export function isTestModeEvent(payload: LemonWebhookPayload): boolean {
  const v = payload?.data?.attributes?.test_mode;
  return v === true || String(v).trim().toLowerCase() === "true";
}
