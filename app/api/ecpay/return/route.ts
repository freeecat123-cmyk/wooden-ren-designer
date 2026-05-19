/**
 * POST /api/ecpay/return
 *   綠界 ReturnURL — server-to-server 付款結果通知（一次性 + 定期定額首期共用）
 *
 * 收到後流程:
 *   1. 驗 CheckMacValue
 *   2. 透過 MerchantTradeNo 撈回 placeholder subscription
 *   3. RtnCode === "1" 視為成功:
 *        - 定期定額（params 含 PeriodType）→ expires_at = now + 31 天，存 gwsr
 *        - 一次性年付 → expires_at = now + 365 天
 *        - users.plan / subscription_status / subscription_expires_at 更新
 *        - payments insert status=success
 *   4. RtnCode !== "1" 視為失敗:
 *        - payments insert status=failed（subscription 維持 expired）
 *   5. 一律回 "1|OK"（200）— 否則綠界會狂重送
 *
 *   月扣定期定額第 2 期以後走 /api/ecpay/periodic-notify
 */
import { type NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCheckMacValue } from "@/lib/ecpay/check-mac-value";
import { ECPAY_HASH_IV, ECPAY_HASH_KEY } from "@/lib/ecpay/config";
import { sendEmail } from "@/lib/email/send";
import { firstPaymentSuccessEmail } from "@/lib/email/templates/payment-success";
import { planLabelFromUserPlan } from "@/lib/email/templates/subscription-expiry";
import { issueInvoiceForPayment } from "@/lib/ecpay/issue-invoice-for-payment";
import { requestRefund } from "@/lib/ecpay/refund";
import { calcProrateRefund } from "@/lib/pricing/prorate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseEcpayDate(s: string | undefined): string | null {
  if (!s) return null;
  // 綠界格式 "yyyy/MM/dd HH:mm:ss"（台北時間）
  const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  // 視為 UTC+8
  return new Date(
    `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`,
  ).toISOString();
}

/**
 * 判斷這筆是定期定額還是一次性付款。
 * 綠界定期定額回呼帶 PeriodType / PeriodAmount 欄位，一次性不會有。
 */
function isPeriodicReturn(params: Record<string, string>): boolean {
  return Boolean(params.PeriodType && params.PeriodAmount);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  if (!verifyCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV)) {
    console.error("[ecpay/return] CheckMacValue 驗證失敗", {
      orderId: params.MerchantTradeNo,
    });
    return new Response("0|CheckMacValueInvalid", { status: 200 });
  }

  const orderId = params.MerchantTradeNo;
  const rtnCode = params.RtnCode;
  const tradeNo = params.TradeNo;
  const amount = Number(params.TradeAmt ?? 0);

  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, status, expected_amount, period, replaced_subscription_id")
    .eq("ecpay_merchant_trade_no", orderId)
    .single();

  if (subErr || !sub) {
    console.error("[ecpay/return] 找不到 subscription", { orderId, subErr });
    return new Response("1|OK");
  }

  // 已處理過就不重複寫（綠界可能重送）+ idempotency by tradeNo
  // sub.status === active 還會被 sweep cron 改回 expired，replay 又會繞過 → 改用
  // payments.ecpay_trade_no 唯一索引擋（DB 層級 dedup）。先 select 看有沒有。
  if (sub.status === "active") {
    return new Response("1|OK");
  }
  if (tradeNo) {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("ecpay_trade_no", tradeNo)
      .eq("status", "success")
      .maybeSingle();
    if (existing) {
      console.warn("[ecpay/return] replay attempt blocked", { orderId, tradeNo });
      return new Response("1|OK");
    }
  }
  // 驗 MerchantID 屬於本商家（必要欄位、缺欄位也 reject 避免 short-circuit bypass）
  if (params.MerchantID !== process.env.ECPAY_MERCHANT_ID) {
    console.error("[ecpay/return] MerchantID mismatch or missing", {
      got: params.MerchantID,
      expected: process.env.ECPAY_MERCHANT_ID,
    });
    return new Response("0|MerchantIDInvalid", { status: 200 });
  }

  if (rtnCode !== "1") {
    await admin.from("payments").insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
      status: "failed",
      ecpay_trade_no: tradeNo ?? null,
      raw_response: params as Record<string, unknown>,
    });
    console.warn("[ecpay/return] 付款失敗", { orderId, rtnCode, msg: params.RtnMsg });
    return new Response("1|OK");
  }

  // 驗金額：用 checkout 時寫進 sub.expected_amount 直接比對
  // （student tier 走 basePlan 不會被 hardcode price 表卡住）
  // expected_amount 缺值 → reject（舊資料或攻擊）
  if (!sub.expected_amount || Number(amount) !== sub.expected_amount) {
    console.error("[ecpay/return] amount mismatch", {
      orderId,
      got: amount,
      expected: sub.expected_amount,
      plan: sub.plan,
      period: sub.period,
    });
    return new Response("0|AmountMismatch", { status: 200 });
  }

  // 以 checkout 時寫的 sub.period 為準決定到期日 — 不從綠界回呼欄位反推。
  // 為什麼：ReturnURL 對「一次性付款」與「定期定額首期」回的欄位是一樣的
  // （都是普通信用卡欄位，不會帶 PeriodType），所以無法用回呼欄位區分；
  // 第 2 期以後才會走 PeriodReturnURL 帶 PeriodType。
  // 舊版用 isPeriodicReturn 判斷會把每一筆月付首期當成年付給 365 天，平台虧爆。
  //
  // sub.period 缺值 → fallback 用 isPeriodicReturn 為了相容 migration 之前的舊 row
  const periodic =
    sub.period === "monthly" ||
    (!sub.period && isPeriodicReturn(params));
  const days = periodic ? 31 : 365;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 86_400_000).toISOString();
  const paymentDate = parseEcpayDate(params.PaymentDate) ?? now.toISOString();

  const { error: upSubErr } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt,
      ecpay_periodic_no: periodic ? params.gwsr ?? null : null,
    })
    .eq("id", sub.id);
  if (upSubErr) console.error("[ecpay/return] 更新 subscription 失敗", upSubErr);

  const { error: upUserErr } = await admin
    .from("users")
    .update({
      plan: sub.plan,
      subscription_status: "active",
      subscription_expires_at: expiresAt,
    })
    .eq("id", sub.user_id);
  if (upUserErr) console.error("[ecpay/return] 更新 users 失敗", upUserErr);

  const { data: insertedPayment } = await admin
    .from("payments")
    .insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
      status: "success",
      ecpay_trade_no: tradeNo,
      ecpay_payment_date: paymentDate,
      raw_response: params as Record<string, unknown>,
      invoice_status: "pending",
    })
    .select("id")
    .single();

  console.log("[ecpay/return] 付款完成,核心 DB 更新已收尾,背景跑後處理", {
    orderId,
    userId: sub.user_id,
    amount,
    expiresAt,
  });

  // ──────────────────────────────────────────────
  // 背景任務:invoice / refund / email
  // Hobby plan 10s timeout 不夠串著跑 3 個外部 API,改用 Next.js after() 在
  // response 送出後背景跑,Vercel 仍會等到任務完成才釋放 function 容器。
  // ──────────────────────────────────────────────
  after(async () => {
    try {
      // 1. 開立綠界 B2C 電子發票
      if (insertedPayment?.id) {
        try {
          await issueInvoiceForPayment(admin, {
            paymentId: insertedPayment.id,
            userId: sub.user_id,
            amount,
            itemName: `木頭仁 木作藍圖${planLabelFromUserPlan(sub.plan)}${periodic ? "月付" : "年付"}訂閱`,
          });
        } catch (e) {
          console.warn("[ecpay/return:after] invoice 例外(已記錄 failed)", e);
        }
      }

      // 2. 升級退舊版 prorate
      let upgradeRefundAmount = 0;
      if (sub.replaced_subscription_id) {
        upgradeRefundAmount = await handleUpgradeRefund(admin, sub.replaced_subscription_id, sub.id);
      }

      // 3. 寄首次付款成功 email
      try {
        const { data: u } = await admin
          .from("users")
          .select("email")
          .eq("id", sub.user_id)
          .single();
        if (u?.email) {
          const payload = firstPaymentSuccessEmail({
            planLabel: planLabelFromUserPlan(sub.plan),
            amount,
            expiresAt,
            isMonthly: periodic,
            tradeNo,
            upgradeRefundAmount: upgradeRefundAmount > 0 ? upgradeRefundAmount : undefined,
          });
          await sendEmail({
            to: u.email,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
          });
        }
      } catch (e) {
        console.warn("[ecpay/return:after] payment email error", e);
      }

      console.log("[ecpay/return:after] 後處理完成", { orderId, upgradeRefundAmount });
    } catch (e) {
      // after() 整段 catch fallback,任何 unexpected throw 都不影響已回的 1|OK
      console.error("[ecpay/return:after] 例外(已回 1|OK 給綠界)", e);
    }
  });

  return new Response("1|OK");
}

/**
 * 升級時退舊版 prorate。
 * 撈舊 sub + 最近一筆 success payment,計算未使用比例,呼叫 ECPay AioChargeback。
 * 失敗只 log 不擋 webhook (新 sub 已啟用,退款失敗 admin 手動處理即可)。
 * 回傳實際退款金額,0 = 沒退/失敗。
 */
async function handleUpgradeRefund(
  admin: ReturnType<typeof createAdminClient>,
  oldSubId: string,
  newSubId: string,
): Promise<number> {
  try {
    const { data: oldSub } = await admin
      .from("subscriptions")
      .select("id, period, expires_at, ecpay_merchant_trade_no")
      .eq("id", oldSubId)
      .single();
    if (!oldSub?.ecpay_merchant_trade_no) {
      console.warn("[ecpay/return/upgrade-refund] old sub 找不到 merchant_trade_no", { oldSubId });
      return 0;
    }

    const { data: oldPayment } = await admin
      .from("payments")
      .select("id, amount, ecpay_trade_no")
      .eq("subscription_id", oldSubId)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!oldPayment?.ecpay_trade_no) {
      console.warn("[ecpay/return/upgrade-refund] 舊 sub 沒 success payment 可退", { oldSubId });
      return 0;
    }

    const refund = calcProrateRefund({
      paidAmount: Number(oldPayment.amount ?? 0),
      period: (oldSub.period as "monthly" | "yearly") ?? "monthly",
      expiresAt: oldSub.expires_at,
    });
    if (refund.refundAmount <= 0) {
      console.log("[ecpay/return/upgrade-refund] 沒未用天數,不退", { oldSubId, refund });
      return 0;
    }

    const result = await requestRefund({
      merchantTradeNo: oldSub.ecpay_merchant_trade_no,
      tradeNo: oldPayment.ecpay_trade_no,
      amount: refund.refundAmount,
    });
    if (!result.ok) {
      console.error("[ecpay/return/upgrade-refund] AioChargeback 失敗", { oldSubId, refund, result });
      return 0;
    }

    // 標記退款狀態(用 partial_refunded 避免跟「全退」混淆;Schema 沒有就 fallback refunded)
    await admin
      .from("payments")
      .update({ status: "refunded" })
      .eq("id", oldPayment.id);

    console.log("[ecpay/return/upgrade-refund] 升級自動退款成功", {
      oldSubId,
      newSubId,
      refundAmount: refund.refundAmount,
      remainingDays: refund.remainingDays,
    });
    return refund.refundAmount;
  } catch (e) {
    console.error("[ecpay/return/upgrade-refund] 例外", e);
    return 0;
  }
}
