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

/** 一次性付款的有效天數（month=30, year=365；定期定額 Phase 2 再加） */
export function getPeriodDays(period: BillingPeriod): number {
  return period === "yearly" ? 365 : 30;
}

export function getBasePlan(plan: CheckoutPlan): "personal" | "pro" {
  return PLAN_PRICES[plan].basePlan;
}

export function isStudentOnly(plan: CheckoutPlan): boolean {
  return PLAN_PRICES[plan].studentOnly;
}
