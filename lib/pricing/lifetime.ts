/**
 * 終身買斷（限量）— 單一真相來源。
 *
 * 跟既有的 `lifetime`（Lemon Squeezy 英文站 US$129、後台手動升級，專業版等級）是**兩個不同的方案**：
 *   - `lifetime`          專業版等級，既有會員在用，這支檔案完全不碰它。
 *   - `lifetime_personal` 本檔的新方案：個人版等級、永久、限量，走綠界一次性付款。
 *
 * 判斷「這個人能不能買」「還剩幾個名額」都只在這裡算一套，
 * 結帳路由、綠界回傳、pricing 頁都吃這裡，不要各寫各的。
 */
import type { PlanId } from "@/lib/permissions";

/** 售價（新台幣整數，含稅） */
export const LIFETIME_PRICE = 6900;

/**
 * 名額上限。想調整名額只改這個數字。
 * ⚠️ 2026-11-04 木頭仁只選了「只設名額」沒填數字，暫用 50（他看到建議值）——要改請告訴他確認。
 */
export const LIFETIME_QUOTA = 50;

/**
 * 綠界訂單品項名稱。綠界後台、發票、付款成功信都看這個字串，
 * 所以刻意帶「終身買斷」四個字，跟工具的「永久買斷」、訂閱的「個人版月付」分得開。
 */
export const LIFETIME_ITEM_NAME = "木作藍圖 終身買斷（限量）";

/** payments.raw_response.kind 的值。名額統計與回傳處理都靠它認訂單。 */
export const LIFETIME_PAYMENT_KIND = "lifetime_buyout";

/** 開單後還沒付款的訂單佔住名額多久（信用卡流程），單位：分鐘 */
export const LIFETIME_PENDING_HOLD_MINUTES = 30;
/** ATM／超商已產生繳費代碼、等客人去繳的訂單佔住名額多久，單位：小時（綠界 ATM 預設 3 天內要繳） */
export const LIFETIME_AWAITING_HOLD_HOURS = 72;

export interface LifetimeStatus {
  quota: number;
  /** 已賣出＋保留中的數量 */
  taken: number;
  remaining: number;
  /** 還有名額可以買 */
  available: boolean;
}

/** 由「已佔用名額數」算出狀態。taken 為負或非數字時當 0，超過名額時 remaining 夾在 0。 */
export function getLifetimeStatus(taken: number, quota: number = LIFETIME_QUOTA): LifetimeStatus {
  const t = Number.isFinite(taken) && taken > 0 ? Math.floor(taken) : 0;
  const remaining = Math.max(0, quota - t);
  return { quota, taken: t, remaining, available: remaining > 0 };
}

export type LifetimeEligibility =
  | { ok: true }
  | { ok: false; reason: "owned" | "has_plan" };

/**
 * 這個帳號現在能不能買終身買斷。
 *
 * 只開放給「目前實際是免費版」的帳號。理由：
 *   - 不動既有訂閱用戶的權限與價格——已訂閱的人若買了終身，plan 欄位會被覆寫，
 *     綠界定期定額卻還在扣款 → 雙扣，所以直接不讓這條路通。
 *   - 已是終身（任一種）→ 回 owned，頁面顯示「你已經是終身會員」。
 * 傳入的是 getEffectivePlan() 的結果（已經處理過到期、寬限期、學員到期）。
 */
export function lifetimeEligibility(effectivePlan: PlanId): LifetimeEligibility {
  if (effectivePlan === "lifetime" || effectivePlan === "lifetime_personal") {
    return { ok: false, reason: "owned" };
  }
  if (effectivePlan !== "free") return { ok: false, reason: "has_plan" };
  return { ok: true };
}
