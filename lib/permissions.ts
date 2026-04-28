/**
 * 方案能力表 — 定義各方案能用哪些功能
 * 跟 supabase/schema.sql 的 plan check constraint 對齊。
 */

import type { FurnitureCategory } from "./types";

export type PlanId = "free" | "personal" | "pro" | "lifetime" | "student";

/**
 * 免費版可訪問的家具範本——只有這 3 種「入門級代表」。
 * 其他 16 種要付費（個人版以上）才能進。
 */
export const FREE_UNLOCKED_CATEGORIES: FurnitureCategory[] = [
  "stool",          // 方凳（椅凳代表）
  "tea-table",      // 茶几（桌類代表）
  "pencil-holder",  // 筆筒（小物件代表）
];

/** 該分類是否需要付費才能進 */
export function isPaidCategory(category: FurnitureCategory): boolean {
  return !FREE_UNLOCKED_CATEGORIES.includes(category);
}

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
  /** 設計師模式（自由尺寸，解除範本上限） */
  canUseDesignerMode: boolean;
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    maxDesigns: 1,
    canDownloadPdf: false,
    hasWatermark: true,
    canUseQuoteSystem: false,
    canCustomizeQuoteHeader: false,
    canManageCustomers: false,
    canUseDesignerMode: false,
  },
  personal: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: false,
    canCustomizeQuoteHeader: false,
    canManageCustomers: false,
    canUseDesignerMode: false,
  },
  pro: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
    canUseDesignerMode: true,
  },
  student: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
    canUseDesignerMode: true,
  },
  lifetime: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
    canUseDesignerMode: true,
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
  student_activated_at?: string | null;
  student_expires_at?: string | null;
}

/**
 * 取得使用者實際可用的方案：
 * - student：檢查 student_expires_at，過期降 free
 * - lifetime：永久
 * - 一般訂閱：subscription_status=active 且 subscription_expires_at 未到
 */
export function getEffectivePlan(profile: UserPlanProfile | null | undefined): PlanId {
  if (!profile) return "free";

  if (profile.plan === "student") {
    if (
      profile.student_expires_at &&
      new Date(profile.student_expires_at) > new Date()
    ) {
      return "student";
    }
    return "free";
  }

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

/**
 * 學員方案剩餘天數（負數 = 已過期；null = 不是學員或沒到期日）。
 */
export function studentDaysRemaining(
  profile: UserPlanProfile | null | undefined,
): number | null {
  if (!profile || profile.plan !== "student" || !profile.student_expires_at) {
    return null;
  }
  const ms = new Date(profile.student_expires_at).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
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

/** 該方案是否能進這個家具範本（免費版只能進 FREE_UNLOCKED_CATEGORIES） */
export function canAccessCategory(
  profile: UserPlanProfile | null | undefined,
  category: FurnitureCategory,
): boolean {
  const plan = getEffectivePlan(profile);
  if (plan === "free") return FREE_UNLOCKED_CATEGORIES.includes(category);
  return true; // 付費版全部解鎖
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
