/**
 * POST /api/ecpay/payment-info
 *   綠界 PaymentInfoURL — ATM / 超商代碼 / 超商條碼的「取號成功」幕後通知。
 *
 * 收到後流程:
 *   1. 驗 CheckMacValue + MerchantID
 *   2. 透過 MerchantTradeNo 撈回 placeholder subscription
 *   3. 取號成功（ATM RtnCode=2 / 超商 RtnCode=10100073）→
 *        - 驗金額
 *        - 組 payment_info（虛擬帳號 / 代碼 / 條碼 + 期限）
 *        - payments insert status=awaiting_payment（同 ecpay_trade_no 已存在則 skip）
 *        - 背景寄取號通知 email
 *   4. 取號失敗 → 記 log，不寫 DB
 *   5. 一律回 "1|OK"
 *
 * 使用者實際繳費後綠界打 /api/ecpay/return（RtnCode=1），那支會把這筆
 * awaiting_payment 更新成 success。
 */
import { type NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCheckMacValue } from "@/lib/ecpay/check-mac-value";
import { ECPAY_HASH_IV, ECPAY_HASH_KEY } from "@/lib/ecpay/config";
import { isGetCodeSuccess, buildPaymentInfo } from "@/lib/ecpay/payment-info";
import { sendEmail } from "@/lib/email/send";
import { awaitingPaymentEmail } from "@/lib/email/templates/payment-pending";
import { planLabelFromUserPlan } from "@/lib/email/templates/subscription-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  if (!verifyCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV)) {
    console.error("[ecpay/payment-info] CheckMacValue 驗證失敗", {
      orderId: params.MerchantTradeNo,
    });
    return new Response("0|CheckMacValueInvalid", { status: 200 });
  }

  const orderId = params.MerchantTradeNo;
  const tradeNo = params.TradeNo ?? null;
  const amount = Number(params.TradeAmt ?? 0);

  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, expected_amount")
    .eq("ecpay_merchant_trade_no", orderId)
    .single();

  if (subErr || !sub) {
    console.error("[ecpay/payment-info] 找不到 subscription", { orderId, subErr });
    return new Response("1|OK");
  }

  if (params.MerchantID !== process.env.ECPAY_MERCHANT_ID) {
    console.error("[ecpay/payment-info] MerchantID mismatch or missing", {
      got: params.MerchantID,
      expected: process.env.ECPAY_MERCHANT_ID,
    });
    return new Response("0|MerchantIDInvalid", { status: 200 });
  }

  // 取號失敗 → 記 log、不寫 DB
  if (!isGetCodeSuccess(params.RtnCode)) {
    console.warn("[ecpay/payment-info] 取號失敗", {
      orderId,
      rtnCode: params.RtnCode,
      msg: params.RtnMsg,
    });
    return new Response("1|OK");
  }

  // 驗金額
  if (!sub.expected_amount || amount !== sub.expected_amount) {
    console.error("[ecpay/payment-info] amount mismatch", {
      orderId,
      got: amount,
      expected: sub.expected_amount,
    });
    return new Response("0|AmountMismatch", { status: 200 });
  }

  const paymentInfo = buildPaymentInfo(params);
  if (!paymentInfo) {
    console.error("[ecpay/payment-info] 取號參數不完整,無法組 payment_info", {
      orderId,
      paymentType: params.PaymentType,
    });
    return new Response("1|OK");
  }

  // idempotency: 同 ecpay_trade_no 已有 payment row → skip
  if (tradeNo) {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("ecpay_trade_no", tradeNo)
      .maybeSingle();
    if (existing) {
      console.warn("[ecpay/payment-info] 同 trade_no 已存在,skip", { orderId, tradeNo });
      return new Response("1|OK");
    }
  }

  const { error: insErr } = await admin.from("payments").insert({
    user_id: sub.user_id,
    subscription_id: sub.id,
    amount,
    status: "awaiting_payment",
    ecpay_trade_no: tradeNo,
    payment_info: paymentInfo as unknown as Record<string, unknown>,
    raw_response: params as Record<string, unknown>,
  });
  if (insErr) {
    console.error("[ecpay/payment-info] payments insert 失敗", { orderId, insErr });
    return new Response("1|OK");
  }

  console.log("[ecpay/payment-info] 取號成功,已記 awaiting_payment", {
    orderId,
    method: paymentInfo.method,
  });

  // 背景寄取號通知 email
  after(async () => {
    try {
      const { data: u } = await admin
        .from("users")
        .select("email")
        .eq("id", sub.user_id)
        .single();
      if (u?.email) {
        const payload = awaitingPaymentEmail({
          planLabel: planLabelFromUserPlan(sub.plan),
          amount,
          paymentInfo,
        });
        await sendEmail({
          to: u.email,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        });
      }
    } catch (e) {
      console.warn("[ecpay/payment-info:after] 取號通知 email 例外", e);
    }
  });

  return new Response("1|OK");
}
