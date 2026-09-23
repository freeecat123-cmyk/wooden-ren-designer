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
  reason?: "unauthenticated" | "quota_exceeded" | "quota_unknown";
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
  const { count, error: countErr } = await service
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", taipeiMidnightUTC.toISOString());

  /**
   * ⛔ 原本只解構 `count`,把 error 丟掉 → 查詢失敗時 `count ?? 0` = **0**,
   *    也就是「今天一次都沒用過」。DB 暫時性錯誤 / service key 失效 / 逾時 的當下,
   *    每一個帳號的額度都等於被重置 —— 用 curl 迴圈直打 /api/photo-to-params,
   *    每次都是一張圖的 Claude vision 呼叫,**Anthropic 帳單無上限**。
   *    「查不到」不能當成「用了 0 次」。(2026-08-21 稽核發現。)
   *
   * ⚠️ 這裡選擇**擋下來**而不是放行:AI 呼叫是花錢的動作,寧可少數人暫時用不了,
   *    也不要讓帳單失控。跟付費牆那條「查不到不等於沒權限」的取捨方向相反,
   *    因為代價不對稱(那邊是誤擋付費客戶、這邊是燒錢)。
   */
  if (countErr) {
    console.error("[ai-rate-limit] 讀取今日用量失敗,保守擋下", {
      userId: user.id,
      endpoint,
      error: countErr.message,
    });
    return {
      allowed: false,
      used: 0,
      limit,
      plan,
      userId: user.id,
      reason: "quota_unknown",
    };
  }

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

  /**
   * 🧷 **先寫再數**,不是先數再寫。
   *
   * ⛔ 原本是「count → 比對 → insert」。個人版上限 10 次的人同時發 100 個請求
   *    (curl 後面加 & 就行),100 個都在任何一筆 insert 落地**之前**跑完 count,
   *    全部讀到 used=0 → `used >= limit` 全部不成立 → **100 次 Claude 呼叫全放行**。
   *    上面那個 count 只是快速路徑(擋掉明顯超量的),不是最終判定。
   *    (2026-08-21 稽核發現。)
   *
   * ✅ 改成先 insert 自己那一筆、再數一次:計數只會單調遞增,
   *    所以最多只有 `limit` 個請求會數到 ≤ limit。超過的把自己剛寫的那筆**刪掉**,
   *    否則被擋下來的請求會虛增用量、害使用者隔天才恢復。
   *
   * ⚠️ 這不是資料庫層的原子操作(要做到那樣得加 migration 用 unique 序號或 RPC),
   *    但它把「同時 100 個全部放行」壓到「最多多放行少數幾個」。
   *    以「花錢的 API 呼叫」而言,這個成本效益比是合理的。
   */
  const { data: inserted } = await service
    .from("ai_usage_log")
    .insert({ user_id: user.id, endpoint })
    .select("id")
    .single();

  const { count: after, error: afterErr } = await service
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", taipeiMidnightUTC.toISOString());

  if (!afterErr && (after ?? 0) > limit) {
    // 自己這一筆讓總數超過上限 → 撤回,不佔用量
    if (inserted?.id) await service.from("ai_usage_log").delete().eq("id", inserted.id);
    return {
      allowed: false,
      used: limit,
      limit,
      plan,
      userId: user.id,
      reason: "quota_exceeded",
    };
  }

  return { allowed: true, used: after ?? used + 1, limit, plan, userId: user.id };
}
