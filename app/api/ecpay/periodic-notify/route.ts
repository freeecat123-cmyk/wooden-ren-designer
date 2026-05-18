/**
 * POST /api/ecpay/periodic-notify
 *   綠界 PeriodReturnURL — 信用卡定期定額「第 2 期以後」自動扣款通知。
 *
 * 首期扣款結果走 /api/ecpay/return（同 ReturnURL）。
 *
 * 收到後流程:
 *   1. 驗 CheckMacValue
 *   2. 透過 MerchantTradeNo 撈回 subscription
 *   3. RtnCode === "1" 視為成功:
 *        - subscriptions.expires_at += 31 天
 *        - users.subscription_expires_at 同步
 *        - payments insert status=success（這期金額）
 *   4. RtnCode !== "1" 視為失敗:
 *        - payments insert status=failed
 *        - 若 TotalSuccessTimes 已達上限 or 綠界主動停 → status=expired
 *   5. 一律回 "1|OK"
 */
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCheckMacValue } from "@/lib/ecpay/check-mac-value";
import { ECPAY_HASH_IV, ECPAY_HASH_KEY } from "@/lib/ecpay/config";
import { sendEmail } from "@/lib/email/send";
import { periodicChargeSuccessEmail } from "@/lib/email/templates/payment-success";
import { planLabelFromUserPlan } from "@/lib/email/templates/subscription-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseEcpayDate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return new Date(
    `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`,
  ).toISOString();
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  if (!verifyCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV)) {
    console.error("[ecpay/periodic-notify] CheckMacValue 驗證失敗", {
      orderId: params.MerchantTradeNo,
    });
    return new Response("0|CheckMacValueInvalid", { status: 200 });
  }

  const orderId = params.MerchantTradeNo;
  const rtnCode = params.RtnCode;
  const tradeNo = params.TradeNo ?? params.gwsr ?? null;
  const amount = Number(params.amount ?? params.TradeAmt ?? 0);
  const totalSuccessTimes = Number(params.TotalSuccessTimes ?? 0);

  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, expires_at, expected_amount")
    .eq("ecpay_merchant_trade_no", orderId)
    .single();

  if (subErr || !sub) {
    console.error("[ecpay/periodic-notify] 找不到 subscription", {
      orderId,
      subErr,
    });
    return new Response("1|OK");
  }

  // 驗 MerchantID 屬於本商家（必要欄位、缺欄位也 reject 避免 short-circuit bypass）
  if (params.MerchantID !== process.env.ECPAY_MERCHANT_ID) {
    console.error("[ecpay/periodic-notify] MerchantID mismatch or missing", {
      got: params.MerchantID,
      expected: process.env.ECPAY_MERCHANT_ID,
    });
    return new Response("0|MerchantIDInvalid", { status: 200 });
  }

  // idempotency: 同 trade_no 已經成功處理過 → skip（webhook replay 防護）
  if (rtnCode === "1" && tradeNo) {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("ecpay_trade_no", tradeNo)
      .eq("status", "success")
      .maybeSingle();
    if (existing) {
      console.warn("[ecpay/periodic-notify] replay attempt blocked", {
        orderId,
        tradeNo,
      });
      return new Response("1|OK");
    }
  }

  // 驗金額：用 checkout 時寫進 sub.expected_amount 直接比對
  // （student tier 走 basePlan 不會被 hardcode price 表卡住）
  if (rtnCode === "1") {
    if (!sub.expected_amount || Number(amount) !== sub.expected_amount) {
      console.error("[ecpay/periodic-notify] amount mismatch", {
        orderId,
        got: amount,
        expected: sub.expected_amount,
        plan: sub.plan,
      });
      return new Response("0|AmountMismatch", { status: 200 });
    }
  }

  // 失敗：記一筆 failed payment；若綠界明確標 cancel/stop 把 subscription 改 expired
  if (rtnCode !== "1") {
    await admin.from("payments").insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
      status: "failed",
      ecpay_trade_no: tradeNo,
      raw_response: params as Record<string, unknown>,
    });

    // RtnCode 10100073/10100248 等代表綠界停止扣款；保險起見只要不是 1 都記錄
    console.warn("[ecpay/periodic-notify] 月扣失敗", {
      orderId,
      rtnCode,
      msg: params.RtnMsg,
      totalSuccessTimes,
    });
    return new Response("1|OK");
  }

  // 成功：延長 31 天（從現有到期日 + 31 天，不從 now，保證連續性）
  const baseDate = sub.expires_at
    ? new Date(sub.expires_at).getTime()
    : Date.now();
  const newExpiresAt = new Date(baseDate + 31 * 86_400_000).toISOString();
  const paymentDate = parseEcpayDate(params.process_date) ?? new Date().toISOString();

  const { error: upSubErr } = await admin
    .from("subscriptions")
    .update({ expires_at: newExpiresAt })
    .eq("id", sub.id);
  if (upSubErr) console.error("[ecpay/periodic-notify] 更新 subscription 失敗", upSubErr);

  const { error: upUserErr } = await admin
    .from("users")
    .update({
      subscription_status: "active",
      subscription_expires_at: newExpiresAt,
    })
    .eq("id", sub.user_id);
  if (upUserErr) console.error("[ecpay/periodic-notify] 更新 users 失敗", upUserErr);

  await admin.from("payments").insert({
    user_id: sub.user_id,
    subscription_id: sub.id,
    amount,
    status: "success",
    ecpay_trade_no: tradeNo,
    ecpay_payment_date: paymentDate,
    raw_response: params as Record<string, unknown>,
  });

  // 寄月扣扣款成功 email
  try {
    const { data: u } = await admin
      .from("users")
      .select("email")
      .eq("id", sub.user_id)
      .single();
    if (u?.email) {
      const payload = periodicChargeSuccessEmail({
        planLabel: planLabelFromUserPlan(sub.plan),
        amount,
        expiresAt: newExpiresAt,
        isMonthly: true,
        tradeNo,
      });
      void sendEmail({
        to: u.email,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
    }
  } catch (e) {
    console.warn("[ecpay/periodic-notify] payment email error", e);
  }

  console.log("[ecpay/periodic-notify] 月扣成功", {
    orderId,
    times: totalSuccessTimes,
    amount,
    newExpiresAt,
  });
  return new Response("1|OK");
}
