/**
 * GET /api/cron/ecpay-reconciliation
 *   Vercel Cron daily — 對帳 cron：抓所有 DB 上 active 的月扣訂閱，
 *   去綠界查實際定期定額狀態，發現「綠界已終止但 DB 仍 active」就同步。
 *
 * 為什麼需要：
 *   綠界後台「退款 / 終止」按鈕沒有 webhook 推回我們。如果你（或客服）在後台
 *   手動操作，DB 會一直顯示 active、使用者繼續用、下個月 periodic-notify 進來
 *   還會延期 — 三層慘劇。這支 cron 是 safety net，每天對一次帳。
 *
 * 規則：
 *   - 對「subscriptions.status='active' AND period='monthly' 且 ecpay_merchant_trade_no 非空」逐筆查
 *   - 綠界回 Status='終止' → 同步：sub.status='cancelled', expires_at=now,
 *     users.subscription_status='expired' (但保留現有 expires_at 讓使用者用到本期末，
 *     不要立刻 expires_at=now — 退款時 admin/refunds 才會把 expires_at 砍掉)
 *   - 一次性付款不需查（沒有 future state，付完就結束）
 *
 * Auth：Bearer CRON_SECRET（同其他 cron）
 *
 * Vercel cron schedule：vercel.json 設 0 19 * * *（UTC 19:00 = 台灣 03:00）
 */
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryPeriodicStatus } from "@/lib/ecpay/refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 每次 cron 最多檢查 N 筆，避免綠界 query API 被 rate limit
const MAX_CHECKS_PER_RUN = 100;

interface ActiveSubRow {
  id: string;
  user_id: string;
  ecpay_merchant_trade_no: string;
  expires_at: string | null;
  plan: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: activeSubs, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, ecpay_merchant_trade_no, expires_at, plan")
    .eq("status", "active")
    .eq("period", "monthly")
    .not("ecpay_merchant_trade_no", "is", null)
    .order("started_at", { ascending: true })
    .limit(MAX_CHECKS_PER_RUN);

  if (subErr) {
    console.error("[ecpay-reconciliation] 撈 subscriptions 失敗", subErr);
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }
  const subs = (activeSubs ?? []) as ActiveSubRow[];

  let checked = 0;
  let synced = 0;
  let errors = 0;
  const driftedOrders: string[] = [];

  for (const sub of subs) {
    checked++;
    const q = await queryPeriodicStatus(sub.ecpay_merchant_trade_no);
    if (!q.ok) {
      errors++;
      console.warn("[ecpay-reconciliation] query 失敗", {
        orderId: sub.ecpay_merchant_trade_no,
        error: q.error,
      });
      continue;
    }

    // 綠界 Status 中文：「執行中」「已完成」「終止」「停止中」「失敗」
    // 我們關心「終止」— 綠界後台手動停了，DB 沒同步
    if (q.status === "終止") {
      driftedOrders.push(sub.ecpay_merchant_trade_no);
      // 同步：sub.status='cancelled'（保留 expires_at — 使用者用到本期末才降）
      // users.subscription_status='cancelled' — 跟 /api/cancel-subscription 一致
      await admin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", sub.id);
      await admin
        .from("users")
        .update({ subscription_status: "cancelled" })
        .eq("id", sub.user_id);
      synced++;
      console.log("[ecpay-reconciliation] 同步：綠界已終止、DB 改 cancelled", {
        orderId: sub.ecpay_merchant_trade_no,
        userId: sub.user_id,
        ecpayStatus: q.status,
      });
    }
  }

  console.log("[ecpay-reconciliation] 完成", {
    checked,
    synced,
    errors,
    driftedOrders,
  });

  return NextResponse.json({
    ok: true,
    checked,
    synced,
    errors,
    drifted: driftedOrders,
  });
}
