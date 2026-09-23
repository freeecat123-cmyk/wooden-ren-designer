/**
 * Server-side user profile helpers — 從 public.users 表讀資料、檢查訂閱狀態。
 * 只能在 Server Component / Route Handler / Server Action 用。
 */
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/permissions";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  plan: "free" | "personal" | "pro" | "lifetime" | "student";
  subscription_status: "inactive" | "active" | "cancelled" | "expired";
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single<UserProfile>();
  return { data, error };
}

/**
 * 檢查使用者是否能用付費功能：
 * - student plan：永久免費（學員白名單批進來的）
 * - 其他付費方案：subscription_status = active 且未過期
 * - lifetime：expires_at 為 null 視同未過期
 */
export async function isPaidUser(userId: string): Promise<boolean> {
  const { data } = await getUserProfile(userId);
  if (!data) return false;
  /**
   * ⛔ 原本這裡自己寫一套 `subscription_status !== "active" → false`,
   *    跟 lib/permissions.ts 的 getEffectivePlan() 不一致:
   *    使用者一按「取消訂閱」(status 變 cancelled、付費期還沒到) 就當場
   *    失去列印 / 裁切 / 報價 —— 但設計頁上那些按鈕還在(它們走 permissions),
   *    點下去直接被踢到 /pricing。付到 9/4、8/4 就沒得用。
   *
   * 取消訂閱只是停止下次扣款,該期的錢已經收了。真正的降級是
   * /api/cron/subscription-sweep 過期後才做。整套後端都這樣運作,
   * 只有這支沒跟上 —— 所以改成直接用同一個判準,不要再有第二套。(2026-08-24)
   */
  return getEffectivePlan(data as never) !== "free";
}

/**
 * Convenience：拿當前登入使用者的 profile（沒登入回 null）
 */
export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await getUserProfile(user.id);
  return data;
}
