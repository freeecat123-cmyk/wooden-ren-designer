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
import { cancelLemonSqueezySubscription } from "@/lib/lemon-squeezy/cancel";
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
    .select("id, ecpay_merchant_trade_no, status, payment_provider, lemonsqueezy_subscription_id")
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
    /**
     * ⛔ 這一段原本是「沒有綠界訂單編號 → 跳過金流商、只把 DB 標成 cancelled、回報成功」。
     *    Lemon Squeezy(國際版)的訂閱正好沒有 ecpay_merchant_trade_no,
     *    於是每一筆 LS 訂閱按取消都走進這裡:**畫面說已取消,LS 照樣每個月扣款**,
     *    而且我們的 DB 還顯示他已經取消,對帳完全看不出來。(2026-08-21 稽核發現。)
     */
    if (sub.payment_provider === "lemonsqueezy" || sub.lemonsqueezy_subscription_id) {
      if (!sub.lemonsqueezy_subscription_id) {
        console.error("[cancel-subscription] LS 訂閱缺 lemonsqueezy_subscription_id,無法取消", {
          subId: sub.id,
        });
        results.push({ subId: sub.id, orderId: null, ok: false, rtnMsg: "缺少 LS 訂閱編號" });
        continue;
      }
      const ls = await cancelLemonSqueezySubscription(sub.lemonsqueezy_subscription_id);
      if (!ls.ok) {
        console.error("[cancel-subscription] LS 取消失敗,不標 DB(避免畫面說取消了卡還在扣)", {
          subId: sub.id,
          status: ls.status,
          detail: ls.detail,
        });
        results.push({
          subId: sub.id,
          orderId: sub.lemonsqueezy_subscription_id,
          ok: false,
          rtnMsg: ls.detail ?? "LS 取消失敗",
        });
        continue;
      }
      await admin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
      results.push({ subId: sub.id, orderId: sub.lemonsqueezy_subscription_id, ok: true });
      continue;
    }

    if (!sub.ecpay_merchant_trade_no) {
      /**
       * ⚠️ 走到這裡 = 既不是 LS、也沒有綠界訂單編號 —— 沒有任何金流商可以通知。
       *    以前這裡直接標 cancelled 並回報成功,等於「假裝取消」。
       *    現在標 DB 但**回報失敗**,讓呼叫端知道要人工確認,不會給使用者假的安心。
       */
      console.error("[cancel-subscription] 訂閱沒有任何金流商識別碼,只能標 DB,需人工確認", {
        subId: sub.id,
      });
      await admin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
      results.push({ subId: sub.id, orderId: null, ok: false, rtnMsg: "查無金流商識別碼,請人工確認自動扣款已停止" });
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
