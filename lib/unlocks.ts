/**
 * 取得 user 已永久買斷的範本 category 清單（從 template_unlocks 表）
 * server-side 用,給 canAccessCategory 第三參數
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchUnlockedCategories(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("template_unlocks")
    .select("category")
    .eq("user_id", userId);
  if (error) {
    console.error("[unlocks] fetch failed", error);
    return [];
  }
  return (data ?? []).map((r) => r.category as string);
}
