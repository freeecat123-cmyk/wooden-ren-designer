/**
 * 取得 user 已永久買斷的工具清單,給 ceiling/floor page paywall 用
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolId } from "@/lib/pricing/tool-unlock";

export async function fetchUnlockedTools(
  admin: SupabaseClient,
  userId: string,
): Promise<ToolId[]> {
  const { data, error } = await admin
    .from("tool_unlocks")
    .select("tool")
    .eq("user_id", userId);
  if (error) {
    console.error("[tool-unlocks] fetch failed", error);
    return [];
  }
  return (data ?? []).map((r) => r.tool as ToolId);
}
