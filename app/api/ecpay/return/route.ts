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
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCheckMacValue } from "@/lib/ecpay/check-mac-value";
import { ECPAY_HASH_IV, ECPAY_HASH_KEY } from "@/lib/ecpay/config";

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
 * 從 checkout 時寫進 payments.raw_response 的 checkout_initiated 紀錄
 * 撈出原本選的 period（"monthly" | "yearly"）。
 *
 * ⚠️ 不能依賴綠界回呼帶 PeriodType — 實測首期定期定額回呼跟一次性回呼欄位一樣
 * （只有第 2 期以後走 PeriodReturnURL 才會帶 PeriodType / PeriodAmount / gwsr）。
 */
async function lookupCheckoutPeriod(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
): Promise<"monthly" | "yearly"> {
  const { data } = await admin
    .from("payments")
    .select("raw_response")
    .filter("raw_response->>kind", "eq", "checkout_initiated")
    .filter("raw_response->>orderId", "eq", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const p = (data?.raw_response as { period?: string } | null)?.period;
  return p === "yearly" ? "yearly" : "monthly";
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
    .select("id, user_id, plan, status")
    .eq("ecpay_merchant_trade_no", orderId)
    .single();

  if (subErr || !sub) {
    console.error("[ecpay/return] 找不到 subscription", { orderId, subErr });
    return new Response("1|OK");
  }

  // 已處理過就不重複寫（綠界可能重送）
  if (sub.status === "active") {
    return new Response("1|OK");
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

  const billingPeriod = await lookupCheckoutPeriod(admin, orderId);
  const periodic = billingPeriod === "monthly";
  // 月扣定期定額 → 給 31 天緩衝（綠界月扣會在 30 天時自動扣下一期）
  // 年付一次性 → 365 天
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

  await admin.from("payments").insert({
    user_id: sub.user_id,
    subscription_id: sub.id,
    amount,
    status: "success",
    ecpay_trade_no: tradeNo,
    ecpay_payment_date: paymentDate,
    raw_response: params as Record<string, unknown>,
  });

  console.log("[ecpay/return] 付款完成", { orderId, userId: sub.user_id, amount, expiresAt });
  return new Response("1|OK");
}
