/**
 * 取得 user 已永久買斷的工具清單,給 ceiling/floor page paywall 用
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolId } from "@/lib/pricing/tool-unlock";

/**
 * 同上，但**會告訴你查詢失敗了**。
 *
 * ⭐為什麼要有這個變體：`fetchUnlockedTools` 查詢失敗時回空陣列，呼叫端無法分辨
 * 「這個人沒買過」和「我們查不到」。對付費牆來說這兩件事天差地遠——前者該擋，
 * 後者擋下去就是把買斷客關在門外。CNC 那條路徑（見 lib/cnc/access.ts）必須分辨，
 * 所以判定邏輯放這裡，舊的簽章保留給其他四個頁面沿用。
 */
export async function fetchUnlockedToolsResult(
  admin: SupabaseClient,
  userId: string,
): Promise<{ tools: ToolId[]; failed: boolean }> {
  const { data, error } = await admin
    .from("tool_unlocks")
    .select("tool")
    .eq("user_id", userId);
  if (error) {
    console.error("[tool-unlocks] fetch failed", error);
    return { tools: [], failed: true };
  }
  return { tools: (data ?? []).map((r) => r.tool as ToolId), failed: false };
}

export async function fetchUnlockedTools(
  admin: SupabaseClient,
  userId: string,
): Promise<ToolId[]> {
  return (await fetchUnlockedToolsResult(admin, userId)).tools;
}
