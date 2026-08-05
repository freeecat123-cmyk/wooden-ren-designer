/**
 * 方案能力表 — 定義各方案能用哪些功能
 * 跟 supabase/schema.sql 的 plan check constraint 對齊。
 */

import type { FurnitureCategory } from "./types";

export type PlanId = "free" | "personal" | "pro" | "lifetime" | "student";

/**
 * 免費版可訪問的家具範本——「練習小物」2 種。
 */
export const FREE_UNLOCKED_CATEGORIES: FurnitureCategory[] = [
  "stool",          // 方凳（椅凳練習）
  "pencil-holder",  // 筆筒（小物件練習）
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
  /** 木作天花板骨架施工模擬器(/ceiling) */
  canUseCeilingTool: boolean;
  /** 地板施工模擬器(/floor) */
  canUseFloorTool: boolean;
  /** 和室架高平台施工模擬器(/raised-floor) */
  canUseRaisedFloorTool: boolean;
  /** CNC 刀路產生器(/cnc)：SVG/DXF→Carvera Air G-code */
  canUseCncTool: boolean;
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
    canUseCeilingTool: false,
    canUseFloorTool: false,
    canUseRaisedFloorTool: false,
    canUseCncTool: false,
  },
  personal: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: false,
    canCustomizeQuoteHeader: false,
    canManageCustomers: false,
    canUseDesignerMode: false,
    // 2026-05-21 決策：裝潢實用工具（天花板／地板／線板）整組降到個人版，
    // 把專業版完全聚焦「接案 SaaS」（報價/客戶/STL/無上限）。
    canUseCeilingTool: true,
    canUseFloorTool: true,
    canUseRaisedFloorTool: true,
    canUseCncTool: true,
  },
  pro: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
    canUseDesignerMode: true,
    canUseCeilingTool: true,
    canUseFloorTool: true,
    canUseRaisedFloorTool: true,
    canUseCncTool: true,
  },
  student: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
    canUseDesignerMode: true,
    canUseCeilingTool: true,
    canUseFloorTool: true,
    canUseRaisedFloorTool: true,
    canUseCncTool: true,
  },
  lifetime: {
    maxDesigns: Infinity,
    canDownloadPdf: true,
    hasWatermark: false,
    canUseQuoteSystem: true,
    canCustomizeQuoteHeader: true,
    canManageCustomers: true,
    canUseDesignerMode: true,
    canUseCeilingTool: true,
    canUseFloorTool: true,
    canUseRaisedFloorTool: true,
    canUseCncTool: true,
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
 * 「已付費到 subscription_expires_at 為止」的狀態。
 *
 * ⭐`cancelled` 一定要含在內：取消訂閱只是**停止下次自動扣款**，該期的錢已經收了。
 *   - `/api/cancel-subscription` 只把 status 改 cancelled，plan 與 expires_at 都原封不動
 *   - Lemon Squeezy webhook 也一樣（原始碼註解寫「保留 expires_at，仍可用到 ends_at」）
 *   - 真正的降級是 `/api/cron/subscription-sweep` 在**過期＋寬限期之後**才做（plan→free、
 *     status→expired）；退款則走 refunds 直接改 expired
 *   也就是說整套後端都以「cancelled 但未到期＝仍有權限」在運作，只有這支函式沒跟上，
 *   導致使用者一按「取消訂閱」就當場被降成免費版（付到 9/4 卻 8/4 就沒得用）。
 *
 * `expired` / `inactive` 不算：那是掃描降級、退款、admin 停權明確標記的「已無權限」。
 */
const ENTITLED_SUB_STATUSES: readonly UserPlanProfile["subscription_status"][] = [
  "active",
  "cancelled",
];

/**
 * 取得使用者實際可用的方案：
 * - student：檢查 student_expires_at，過期降 free
 * - lifetime：永久
 * - 一般訂閱：subscription_status 為 active/cancelled 且 subscription_expires_at 未到
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
    ENTITLED_SUB_STATUSES.includes(profile.subscription_status) &&
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

/** 該方案是否能進這個家具範本（免費版只能進 FREE_UNLOCKED_CATEGORIES）
 *
 *  unlockedCategories 是該 user 透過單範本買斷取得的永久解鎖清單,任一通過即可放行
 *  （訂閱 OR 單範本買斷 OR 免費版預設）。
 */
export function canAccessCategory(
  profile: UserPlanProfile | null | undefined,
  category: FurnitureCategory,
  unlockedCategories?: readonly string[],
): boolean {
  if (unlockedCategories?.includes(category)) return true;
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
