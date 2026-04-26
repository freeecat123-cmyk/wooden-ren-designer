/**
 * Server-side user profile helpers — 從 public.users 表讀資料、檢查訂閱狀態。
 * 只能在 Server Component / Route Handler / Server Action 用。
 */
import { createClient } from "@/lib/supabase/server";

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
  if (data.plan === "student") return true;
  if (data.subscription_status !== "active") return false;
  if (!data.subscription_expires_at) return data.plan === "lifetime";
  return new Date(data.subscription_expires_at) > new Date();
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
