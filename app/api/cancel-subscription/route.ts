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
  // 找這個使用者目前 active 的 subscription（最後一筆有 merchant_trade_no 的）
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, ecpay_merchant_trade_no, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) {
    console.error("[cancel-subscription] 撈 subscription 失敗", subErr);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!sub || !sub.ecpay_merchant_trade_no) {
    return NextResponse.json({ error: "no_active_subscription" }, { status: 404 });
  }

  // 呼叫綠界 Terminate API。失敗 (含網路 / 綠界回 RtnCode != 1) 都 return 502,
  // 不標 DB cancelled — 否則綠界其實沒終止、DB 卻顯示 cancelled,下個月 periodic-notify
  // 還會進來把 user 反 active 害 user 再被扣款。
  const result = await terminateEcpayPeriodic(sub.ecpay_merchant_trade_no);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, rtnCode: result.rtnCode, rtnMsg: result.rtnMsg },
      { status: 502 },
    );
  }
  const rtnCode = result.rtnCode;
  const rtnMsg = result.rtnMsg;

  await admin
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", sub.id);
  await admin
    .from("users")
    .update({ subscription_status: "cancelled" })
    .eq("id", user.id);

  console.log("[cancel-subscription] 已取消", {
    userId: user.id,
    orderId: sub.ecpay_merchant_trade_no,
    rtnCode,
    rtnMsg,
  });

  return NextResponse.json({ ok: true });
}
