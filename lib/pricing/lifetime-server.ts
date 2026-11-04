/**
 * 終身買斷已佔用名額數（server only，要用 service role 讀 payments）。
 *
 * 算法：
 *   已付款（status=success）
 *   ＋ 開單後 30 分鐘內還沒付的（pending，信用卡流程）
 *   ＋ 已產生 ATM／超商繳費代碼、72 小時內的（awaiting_payment）
 * 退款後 status 變 refunded，名額自動釋出；放棄付款的單過了保留時間也不再佔名額。
 *
 * ⚠️ 讀失敗要丟錯，不能當 0：當 0 等於「名額沒用過」，會把已額滿的方案又開賣。
 */
import type { createAdminClient } from "@/lib/supabase/server";
import {
  LIFETIME_AWAITING_HOLD_HOURS,
  LIFETIME_PAYMENT_KIND,
  LIFETIME_PENDING_HOLD_MINUTES,
} from "./lifetime";

type Admin = ReturnType<typeof createAdminClient>;

export async function countLifetimeTaken(admin: Admin, now: Date = new Date()): Promise<number> {
  const pendingSince = new Date(now.getTime() - LIFETIME_PENDING_HOLD_MINUTES * 60_000).toISOString();
  const awaitingSince = new Date(now.getTime() - LIFETIME_AWAITING_HOLD_HOURS * 3_600_000).toISOString();

  const base = () =>
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .filter("raw_response->>kind", "eq", LIFETIME_PAYMENT_KIND);

  const [paid, pending, awaiting] = await Promise.all([
    base().eq("status", "success"),
    base().eq("status", "pending").gte("created_at", pendingSince),
    base().eq("status", "awaiting_payment").gte("created_at", awaitingSince),
  ]);

  const err = paid.error ?? pending.error ?? awaiting.error;
  if (err) throw new Error(`countLifetimeTaken failed: ${err.message}`);
  return (paid.count ?? 0) + (pending.count ?? 0) + (awaiting.count ?? 0);
}
