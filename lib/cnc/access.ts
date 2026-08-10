/**
 * CNC 刀路產生器「能不能用」的單一判斷來源。
 *
 * 為什麼要抽出來：同一個判斷有四個呼叫點——
 *   1. /cnc 銷售頁（決定給銷售頁還是工具本體）
 *   2. /api/cnc-tool（真的吐出 1MB 工具 HTML 前再驗一次，defense in depth）
 *   3. /api/cnc-license（工具本體開檔時問「我現在還能不能產碼」）
 *   4. /api/trial/start（不讓已經有權限的人白白燒掉試用資格）
 * 各寫一份的話，之後加一種新資格一定會漏掉其中一份，而漏掉的後果不是誤擋付費客
 * 就是白送產品。這裡是唯一定義，其他地方只准呼叫。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";

/** 免費試用天數。改這個值只影響「之後新開的試用」，既有試用存的是絕對到期時間。 */
export const CNC_TRIAL_DAYS = 7;

export type CncAccessReason =
  | "admin" // 站方帳號
  | "plan" // 訂閱個人版以上
  | "purchase" // 單買 NT$499 買斷
  | "trial" // 試用期內
  | "trialExpired" // 試用過且已到期，沒有其他資格
  | "none"; // 從沒試用過，也沒付費

export interface CncAccess {
  allowed: boolean;
  reason: CncAccessReason;
  /**
   * 這份權限**什麼時候失效**（ISO）。null = 不會失效（買斷／永久版／admin）。
   *
   * ⭐刻意不是「試用到期日」而是通用的到期日：訂閱個人版的人，CNC 權限是跟著
   * 訂閱走的，訂閱一斷某天打開工具就突然變鎖頭。工具要能提前提醒他，
   * 就必須拿得到這個日期 —— 只給試用用的欄位辦不到。
   */
  expiresAt: string | null;
  /** 距離失效還剩幾天（無條件進位，最少 1）；不會失效是 null */
  daysLeft: number | null;
  /** 資格名稱，給工具顯示用（個人版／專業版／買斷…）；admin 是 null */
  planLabel: string | null;
  /** 試用到期時間（ISO）。試用中或試用已到期都會有值；從沒試用過是 null */
  trialEndsAt: string | null;
  /** 這個帳號的試用資格已用掉（不論還在不在期內）→ 銷售頁不該再給「免費試用」鈕 */
  trialUsed: boolean;
}

const NO_ACCESS: CncAccess = {
  allowed: false,
  reason: "none",
  expiresAt: null,
  daysLeft: null,
  planLabel: null,
  trialEndsAt: null,
  trialUsed: false,
};

/** 方案顯示名稱。工具本體只有中文，這裡就直接給中文。 */
const PLAN_LABEL_ZH: Record<string, string> = {
  personal: "個人版",
  pro: "專業版",
  student: "學員方案",
  lifetime: "永久版",
};

/**
 * 訂閱／學員資格什麼時候到期。
 * lifetime 回 null＝不會到期，不要對他顯示任何倒數。
 */
function planExpiry(profile: UserPlanProfile | null): string | null {
  if (!profile) return null;
  if (profile.plan === "lifetime") return null;
  if (profile.plan === "student") return profile.student_expires_at ?? null;
  return profile.subscription_expires_at ?? null;
}

/**
 * 剩餘天數：無條件進位，且最少顯示 1。
 * 「剩 0 天」對還能用的人是錯的訊息（會以為已經不能用了），
 * 真的到期是走 allowed=false 那條路，不會落到這裡。
 */
function daysLeftOf(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/**
 * 判定一個已登入使用者對 CNC 工具的權限。
 *
 * 判定順序刻意是 admin → 訂閱 → 買斷 → 試用：
 * 已經有長期權限的人，reason 不該回報成「試用中」，否則工具會對他顯示
 * 「剩 N 天」的倒數，而他其實根本沒在試用。
 */
export async function resolveCncAccess(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<CncAccess> {
  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return { ...NO_ACCESS, allowed: true, reason: "admin" };
  }

  const admin = createAdminClient();
  const [profileRes, unlockedTools, trialRes] = await Promise.all([
    supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single(),
    fetchUnlockedTools(admin, user.id),
    admin
      .from("tool_trials")
      .select("expires_at")
      .eq("user_id", user.id)
      .eq("tool", "cnc")
      .maybeSingle(),
  ]);

  const profile = profileRes.data as UserPlanProfile | null;
  const trialEndsAt = (trialRes.data?.expires_at as string | undefined) ?? null;
  const trialUsed = trialEndsAt !== null;
  const trialActive = trialEndsAt !== null && new Date(trialEndsAt) > new Date();
  const base = { trialEndsAt, trialUsed };

  if (canUseFeature(profile, "canUseCncTool")) {
    const expiresAt = planExpiry(profile);
    return {
      ...base,
      allowed: true,
      reason: "plan",
      expiresAt,
      daysLeft: daysLeftOf(expiresAt),
      planLabel: PLAN_LABEL_ZH[profile?.plan ?? ""] ?? "訂閱方案",
    };
  }
  if (unlockedTools.includes("cnc")) {
    // 買斷沒有到期日 —— expiresAt 留 null，工具就不會對他顯示任何倒數
    return {
      ...base,
      allowed: true,
      reason: "purchase",
      expiresAt: null,
      daysLeft: null,
      planLabel: "永久買斷",
    };
  }
  if (trialActive) {
    return {
      ...base,
      allowed: true,
      reason: "trial",
      expiresAt: trialEndsAt,
      daysLeft: daysLeftOf(trialEndsAt),
      planLabel: "免費試用",
    };
  }
  return {
    ...base,
    allowed: false,
    reason: trialUsed ? "trialExpired" : "none",
    expiresAt: null,
    daysLeft: null,
    planLabel: null,
  };
}

export type StartTrialResult =
  | { ok: true; expiresAt: string }
  | { ok: false; code: "alreadyUsed" | "alreadyEntitled" | "failed" };

/**
 * 開始 7 天試用。
 *
 * 兩道擋：
 * - 已經有權限的人（訂閱／買斷）擋掉 → 不讓他把一次性的試用資格燒在自己已經
 *   能用的東西上。之後訂閱到期時他還留著這張牌。
 * - 已經試用過的人擋掉 → 靠 DB 的 unique(user_id, tool) 當最終防線，
 *   不是只靠這裡的 if（併發連點兩次會兩條都通過檢查）。
 */
export async function startCncTrial(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<StartTrialResult> {
  const access = await resolveCncAccess(supabase, user);
  if (access.trialUsed) return { ok: false, code: "alreadyUsed" };
  if (access.allowed) return { ok: false, code: "alreadyEntitled" };

  const expiresAt = new Date(
    Date.now() + CNC_TRIAL_DAYS * 86_400_000,
  ).toISOString();

  const { error } = await createAdminClient().from("tool_trials").insert({
    user_id: user.id,
    tool: "cnc",
    expires_at: expiresAt,
  });

  if (error) {
    // unique violation = 併發下另一個 request 剛建好，對使用者來說試用已經開始，
    // 不該回報成失敗；其餘錯誤才是真的失敗。
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      return { ok: false, code: "alreadyUsed" };
    }
    console.error("[cnc/trial] insert failed", error);
    return { ok: false, code: "failed" };
  }
  return { ok: true, expiresAt };
}
