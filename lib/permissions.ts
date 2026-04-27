/**
 * 方案能力表 — 定義各方案能用哪些功能
 * 跟 supabase/schema.sql 的 plan check constraint 對齊。
 */

export type PlanId = "free" | "personal" | "pro" | "lifetime" | "student";

export interface PlanFeatures {
  /** 同時儲存的設計件數上限 */
  maxDesigns: number;
  /** 可下載 PDF（列印頁的列印按鈕） */
  canDownloadPdf: boolean;
  /** 工程三視圖 / 列印頁是否帶浮水印 */
  hasWatermark: boolean;
  /** 客製家具報價系統可不可用 */
  canUseQuoteSystem: boolean;
  /** 自訂報價單抬頭 / LOGO */
  canCustomizeQuoteHeader: boolean;
  /** 客戶資料管理 */
  canManageCustomers: boolean;
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    maxDesigns: 1,
    canDownloadPdf: false,
    hasWatermark: true,
    canUseQuoteSystem: false,
    canCustomizeQuoteHeader: false,
    canManageCustomers: false,
  },
  personal: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: false,
    canCustomizeQuoteHeader: false,
    canManageCustomers: false,
  },
  pro: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
  },
  student: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
  },
  lifetime: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
  },
};

export const PLAN_LABEL: Record<PlanId, string> = {
  free: "免費版",
  personal: "個人版",
  pro: "專業版",
  student: "學員版",
  lifetime: "終身版",
};

/** users 表回傳的 row 型別（permissions 只需要這幾個欄位） */
export interface UserPlanProfile {
  plan: PlanId;
  subscription_status: "inactive" | "active" | "cancelled" | "expired";
  subscription_expires_at: string | null;
}

/** 取得使用者實際可用的方案：訂閱過期會降級成 free，學員/終身永久 */
export function getEffectivePlan(profile: UserPlanProfile | null | undefined): PlanId {
  if (!profile) return "free";
  if (profile.plan === "student") return "student";
  if (profile.plan === "lifetime") return "lifetime";
  if (
    profile.subscription_status === "active" &&
    profile.subscription_expires_at &&
    new Date(profile.subscription_expires_at) > new Date()
  ) {
    return profile.plan;
  }
  return "free";
}

export function canUseFeature(
  profile: UserPlanProfile | null | undefined,
  featureName: keyof PlanFeatures,
): boolean {
  const plan = getEffectivePlan(profile);
  return PLAN_FEATURES[plan][featureName] === true;
}

export function getPlanFeatures(profile: UserPlanProfile | null | undefined): PlanFeatures {
  const plan = getEffectivePlan(profile);
  return PLAN_FEATURES[plan];
}

/** 對外推薦：哪個方案最低就能用某功能 */
export function lowestPlanFor(featureName: keyof PlanFeatures): PlanId {
  const order: PlanId[] = ["free", "personal", "pro", "lifetime"]; // student 跟 pro 同級，pricing 已涵蓋
  for (const p of order) {
    const v = PLAN_FEATURES[p][featureName];
    if (typeof v === "boolean" ? v : v !== 0 && v !== Infinity ? false : true) return p;
    if (typeof v === "number" && v > 1) return p;
  }
  return "pro";
}
