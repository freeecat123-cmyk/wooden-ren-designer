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

/**
 * 這支範本的輸出（列印工程包 / 裁切計算器 / 範本包下載）能不能用：
 * 有效付費方案 **或** 買斷過這支範本。
 *
 * 🩸 2026-09-30 客訴：免費版會員買斷了玻璃展示櫃，進列印、輸出、裁切計算器全被叫去升級。
 *    定價頁寫買斷可「改尺寸、列印工程包」，但這三個入口只問 isPaidUser()（訂閱），
 *    從沒看 template_unlocks —— 買斷的人付了錢卻只拿到改尺寸。
 */
export async function canUseOutputFor(
  admin: SupabaseClient,
  userId: string,
  category: string,
  isPaid: boolean,
): Promise<boolean> {
  if (isPaid) return true;
  return (await fetchUnlockedCategories(admin, userId)).includes(category);
}
