/**
 * 訂閱方案價格表 — 後端付款/前端 pricing card 都從這裡讀，避免雙邊不同步。
 */

export type CheckoutPlan = "personal" | "pro" | "student_personal" | "student_pro";
export type BillingPeriod = "monthly" | "yearly";

interface PlanPriceRow {
  monthly: number;
  yearly: number;
  /** 對應到 supabase users.plan / subscriptions.plan 欄位 */
  basePlan: "personal" | "pro";
  studentOnly: boolean;
}

export const PLAN_PRICES: Record<CheckoutPlan, PlanPriceRow> = {
  personal: { monthly: 390, yearly: 3900, basePlan: "personal", studentOnly: false },
  pro: { monthly: 890, yearly: 8900, basePlan: "pro", studentOnly: false },
  student_personal: { monthly: 219, yearly: 2190, basePlan: "personal", studentOnly: true },
  student_pro: { monthly: 690, yearly: 6900, basePlan: "pro", studentOnly: true },
};

export const PLAN_NAME_ZH: Record<CheckoutPlan, string> = {
  personal: "個人版",
  pro: "專業版",
  student_personal: "學員續用·個人",
  student_pro: "學員續用·專業",
};

export function getPlanPrice(plan: CheckoutPlan, period: BillingPeriod): number {
  return PLAN_PRICES[plan][period];
}

/** 訂閱有效天數(monthly=31 對齊 webhook 設 expires_at;yearly=365) */
export function getPeriodDays(period: BillingPeriod): number {
  return period === "yearly" ? 365 : 31;
}

export function getBasePlan(plan: CheckoutPlan): "personal" | "pro" {
  return PLAN_PRICES[plan].basePlan;
}

export function isStudentOnly(plan: CheckoutPlan): boolean {
  return PLAN_PRICES[plan].studentOnly;
}

/**
 * Plan tier 排序:數字越大越貴。用來判斷升/降級。
 * free=0 < personal=1 < pro=2 < lifetime=3
 * student 算 pro 級 (功能相同)
 */
const TIER: Record<string, number> = {
  free: 0,
  personal: 1,
  student: 2,
  pro: 2,
  lifetime: 3,
};

export function getPlanTier(plan: string | null | undefined): number {
  if (!plan) return 0;
  return TIER[plan] ?? 0;
}

export type UpgradeRelation = "fresh" | "upgrade" | "same" | "downgrade";

/**
 * 比較 user 當前 plan 與目標 plan 的關係。
 * - fresh: user 沒 active sub (free 或從沒訂過)
 * - upgrade: 升級 (個人→專業 之類)
 * - same: 同 tier (例如已經是 personal 月付,又買 personal 月付)
 * - downgrade: 降級 (專業→個人)
 */
export function comparePlanUpgrade(
  currentPlan: string | null | undefined,
  targetBasePlan: "personal" | "pro",
): UpgradeRelation {
  const cur = getPlanTier(currentPlan);
  const tgt = getPlanTier(targetBasePlan);
  if (cur === 0) return "fresh";
  if (cur < tgt) return "upgrade";
  if (cur === tgt) return "same";
  return "downgrade";
}
