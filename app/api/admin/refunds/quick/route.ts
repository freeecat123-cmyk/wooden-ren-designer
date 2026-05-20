/**
 * POST /api/admin/refunds/quick
 *   admin 一鍵代開退費單 + 立即 approve(測試 N→E→R fallback 用)。
 *
 *   body: { payment_id: string }  ← 必填,要退的 payment.id
 *
 *   流程:
 *   1. admin auth
 *   2. 撈 payment + 對應的 user / subscription
 *   3. 用 service_role 插一筆 refund_request(status=pending, reason=admin 測試)
 *   4. 直接呼叫退款 pipeline(requestRefund + terminate + invalidInvoice)
 *   5. 同 admin/refunds PATCH 一樣寫 DB 並降權,但**不寄 email**(測試用)
 *   6. 回傳完整結果含 ecpay_refund.action / attempts,前端直接 alert 看
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { requestRefund, terminatePeriodicSubscription } from "@/lib/ecpay/refund";
import { voidOrAllowanceAfterRefund } from "@/lib/ecpay/invoice-after-refund";

async function ensureAdmin(): Promise<{ ok: boolean; userId?: string; email?: string }> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    if (!isAdminEmail(user.email, getServerAdminEmails())) return { ok: false };
    return { ok: true, userId: user.id, email: user.email ?? undefined };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: Request) {
  const adminCheck = await ensureAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { payment_id?: string; user_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.payment_id && !body.user_email) {
    return NextResponse.json(
      { error: "missing_payment_id_or_user_email" },
      { status: 400 },
    );
  }

  const svc = getServiceSupabase();

  // 1. 撈 payment + 關聯
  //    走 user_email → 找最新 success 的 payment(尚未退款)
  let paymentId = body.payment_id;
  if (!paymentId && body.user_email) {
    const { data: u } = await svc
      .from("users")
      .select("id")
      .eq("email", body.user_email)
      .maybeSingle();
    if (!u) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    // 排除 SIM* 模擬付款(simulate-periodic 工具產的、不存在綠界系統、無法真的退款)
    const { data: p } = await svc
      .from("payments")
      .select("id")
      .eq("user_id", u.id)
      .eq("status", "success")
      .not("ecpay_trade_no", "ilike", "SIM%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!p) {
      return NextResponse.json(
        { error: "no_success_payment_for_user", hint: "可能該帳號只有模擬付款(SIM*)、沒有真實成功扣款可退" },
        { status: 404 },
      );
    }
    paymentId = p.id as string;
  }

  const { data: payment, error: pErr } = await svc
    .from("payments")
    .select(
      "id, user_id, amount, status, ecpay_trade_no, raw_response, invoice_number, invoice_issued_at, subscription_id, subscriptions:subscription_id(period, ecpay_merchant_trade_no)",
    )
    .eq("id", paymentId!)
    .single();
  if (pErr || !payment) {
    return NextResponse.json(
      { error: "payment_not_found", detail: pErr?.message },
      { status: 404 },
    );
  }

  const tradeNo = payment.ecpay_trade_no as string | null;
  const raw = payment.raw_response as Record<string, string> | null;
  const orderId = raw?.MerchantTradeNo;
  const invoiceNumber = payment.invoice_number as string | null;
  const invoiceIssuedAt = payment.invoice_issued_at as string | null;

  const subRow = Array.isArray(payment.subscriptions)
    ? payment.subscriptions[0]
    : payment.subscriptions;
  const subPeriod = (subRow as { period?: string } | null)?.period;
  const subOrderId = (subRow as { ecpay_merchant_trade_no?: string } | null)
    ?.ecpay_merchant_trade_no;

  if (!tradeNo || !orderId) {
    return NextResponse.json(
      { error: "missing_trade_info", tradeNo, orderId },
      { status: 400 },
    );
  }

  // 防呆:直接指定 payment_id 也可能誤點到 SIM*
  if (tradeNo.startsWith("SIM")) {
    return NextResponse.json(
      {
        error: "sim_payment_cannot_refund",
        hint: "此為 simulate-periodic 工具產的模擬付款(SIM*),不存在綠界系統、無法真的退款。請直接 SQL 砍掉這筆 payment + refund_request。",
        tradeNo,
      },
      { status: 400 },
    );
  }

  // 2. 插 refund_request(會撞 unique 就回原本那筆 id)
  const { data: existing } = await svc
    .from("refund_requests")
    .select("id, status")
    .eq("payment_id", paymentId)
    .in("status", ["pending", "approved", "refunded"])
    .maybeSingle();

  let refundReqId: string;
  if (existing) {
    refundReqId = existing.id as string;
  } else {
    const { data: ins, error: insErr } = await svc
      .from("refund_requests")
      .insert({
        user_id: payment.user_id,
        payment_id: paymentId,
        amount_requested: payment.amount,
        reason: `admin 代開測試退費 by ${adminCheck.email}`,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !ins) {
      return NextResponse.json(
        { error: "insert_refund_request_failed", detail: insErr?.message },
        { status: 500 },
      );
    }
    refundReqId = ins.id as string;
  }

  // 3. 跑退款 pipeline
  const ecpayRefund = await requestRefund({
    merchantTradeNo: orderId,
    tradeNo,
    amount: payment.amount,
  });

  let ecpayTerminate: Awaited<ReturnType<typeof terminatePeriodicSubscription>> | null = null;
  if (subPeriod === "monthly" && subOrderId) {
    ecpayTerminate = await terminatePeriodicSubscription(subOrderId);
  }

  // 撈 user.email 給折讓 notify(>24h 走 Allowance)
  let userEmail: string | undefined;
  if (ecpayRefund.ok && invoiceNumber && invoiceIssuedAt) {
    const { data: u } = await svc
      .from("users")
      .select("email")
      .eq("id", payment.user_id)
      .single();
    userEmail = u?.email ?? undefined;
  }

  let invoiceResult: Awaited<ReturnType<typeof voidOrAllowanceAfterRefund>> | null = null;
  if (ecpayRefund.ok && invoiceNumber && invoiceIssuedAt) {
    invoiceResult = await voidOrAllowanceAfterRefund(svc, {
      paymentId: paymentId!,
      invoiceNumber,
      invoiceIssuedAt,
      refundAmount: payment.amount,
      notifyEmail: userEmail,
      invalidReason: "quick-refund 作廢",
    });
  }

  // 4. 寫 DB
  await svc
    .from("refund_requests")
    .update({
      status: ecpayRefund.ok ? "refunded" : "approved",
      admin_note: `quick-refund: action=${ecpayRefund.action ?? "?"} ok=${ecpayRefund.ok}`,
      reviewed_by: adminCheck.userId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", refundReqId);

  if (ecpayRefund.ok) {
    await svc
      .from("payments")
      .update({ status: "refunded" })
      .eq("id", paymentId);
    await svc
      .from("users")
      .update({
        plan: "free",
        subscription_status: "expired",
        subscription_expires_at: null,
      })
      .eq("id", payment.user_id);
    await svc
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", payment.user_id)
      .eq("status", "active");
  }

  return NextResponse.json({
    ok: ecpayRefund.ok,
    refund_request_id: refundReqId,
    ecpay_refund: ecpayRefund,
    ecpay_terminate: ecpayTerminate,
    invoice_result: invoiceResult,
  });
}
