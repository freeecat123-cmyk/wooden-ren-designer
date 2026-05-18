/**
 * AI 端點每日限額（per user, per day, Asia/Taipei 重置）。
 *
 * 不適用 wood-master：那支走 Upstash IP 限流。這支限的是要登入的
 * 重成本端點（photo-to-params Vision / style-suggest）。
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getEffectivePlan, type UserPlanProfile } from "@/lib/permissions";

export type AIEndpoint = "photo-to-params" | "style-suggest";

// 2026-05-18 AI 入口 UI 全砍（AIRefineButton / PhotoToParamsButton / AskMasterButton
// 註解掉），endpoint 還活著但只給付費 user。free=0 把後門關掉、防 curl 繞 UI 用免費額度。
const DAILY_LIMITS: Record<string, number> = {
  free: 0,
  personal: 10,
  pro: 50,
  student: 50,
  lifetime: 50,
};

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  plan: string;
  userId: string;
  reason?: "unauthenticated" | "quota_exceeded";
}

/**
 * 檢查並記錄一次 AI 呼叫。allowed=true 代表已經寫入 log、可以呼叫 Claude；
 * allowed=false 代表額度滿了或沒登入，呼叫端應該回 401/429。
 */
export async function checkAndLogAIUsage(endpoint: AIEndpoint): Promise<RateLimitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      plan: "anonymous",
      userId: "",
      reason: "unauthenticated",
    };
  }

  const { data: profileRow } = await supabase
    .from("users")
    .select("plan, subscription_status, subscription_expires_at, student_expires_at, student_activated_at")
    .eq("id", user.id)
    .single();

  const plan = getEffectivePlan(profileRow as UserPlanProfile | null);
  const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;

  // 今日（Asia/Taipei）起始點
  const taipeiNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const taipeiMidnightUTC = new Date(
    Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate()) -
      8 * 60 * 60 * 1000,
  );

  const service = getServiceSupabase();
  const { count } = await service
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", taipeiMidnightUTC.toISOString());

  const used = count ?? 0;
  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      plan,
      userId: user.id,
      reason: "quota_exceeded",
    };
  }

  await service.from("ai_usage_log").insert({ user_id: user.id, endpoint });

  return { allowed: true, used: used + 1, limit, plan, userId: user.id };
}
