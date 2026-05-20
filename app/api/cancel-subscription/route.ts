/**
 * POST /api/cancel-subscription
 *   使用者主動取消訂閱 → 終止綠界定期定額未來扣款。
 *
 * 規則：
 *  - 已扣的款不退（要退款請走綠界後台手動處理）
 *  - 目前到期日內方案仍可用，到期後降為免費
 *  - subscriptions.status = cancelled，users.subscription_status = cancelled
 *  - 呼叫綠界 CreditCardPeriodAction (Action=Terminate)
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { assertEcpayConfigured } from "@/lib/ecpay/config";
import { terminateEcpayPeriodic } from "@/lib/ecpay/terminate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertEcpayConfigured();
  } catch (e) {
    console.error("[cancel-subscription] ECPay 未設定", e);
    return NextResponse.json({ error: "payment_not_configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  // 撈該 user 全部 active subs(可能歷史邊角 case 有 >1 筆),每筆都終止 + 標 cancelled。
  // 之前只取 .limit(1) 的最新一筆,留下 zombie active。
  const { data: subs, error: subErr } = await admin
    .from("subscriptions")
    .select("id, ecpay_merchant_trade_no, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (subErr) {
    console.error("[cancel-subscription] 撈 subscription 失敗", subErr);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "no_active_subscription" }, { status: 404 });
  }

  // 逐筆呼叫綠界 Terminate;任何一筆失敗就 502 不動 DB(避免 DB cancelled 但綠界
  // 還在自動扣)。已成功 terminate 的不回滾(綠界端終止無法撤回,反正也對使用者有利)。
  const results: Array<{ subId: string; orderId: string | null; ok: boolean; rtnCode?: string; rtnMsg?: string }> = [];
  for (const sub of subs) {
    if (!sub.ecpay_merchant_trade_no) {
      // 沒 merchant_trade_no 的(theoretically shouldn't happen for active sub)→ 跳過 ECPay,只標 DB
      await admin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
      results.push({ subId: sub.id, orderId: null, ok: true });
      continue;
    }
    const r = await terminateEcpayPeriodic(sub.ecpay_merchant_trade_no);
    const benign =
      r.rtnMsg?.includes("不存在") || r.rtnMsg?.includes("已終止");
    if (!r.ok && !benign) {
      return NextResponse.json(
        {
          error: r.error ?? "terminate_failed",
          rtnCode: r.rtnCode,
          rtnMsg: r.rtnMsg,
          subId: sub.id,
          orderId: sub.ecpay_merchant_trade_no,
          partial_results: results,
        },
        { status: 502 },
      );
    }
    await admin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id);
    results.push({
      subId: sub.id,
      orderId: sub.ecpay_merchant_trade_no,
      ok: true,
      rtnCode: r.rtnCode ?? undefined,
      rtnMsg: r.rtnMsg ?? undefined,
    });
  }

  await admin
    .from("users")
    .update({ subscription_status: "cancelled" })
    .eq("id", user.id);

  console.log("[cancel-subscription] 已取消", {
    userId: user.id,
    count: results.length,
    results,
  });

  return NextResponse.json({ ok: true, cancelled_count: results.length, results });
}
