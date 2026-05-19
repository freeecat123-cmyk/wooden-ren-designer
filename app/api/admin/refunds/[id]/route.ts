/**
 * PATCH /api/admin/refunds/[id]
 *   admin 通過 / 拒絕退費申請。
 *
 *   body: {
 *     status: 'approved' | 'rejected' | 'refunded'
 *     admin_note?: string
 *     downgrade_user?: boolean  // approved 時順便降為 free（default true）
 *   }
 *
 *   流程：
 *   - approved + downgrade_user: users.plan → free, subscription_status → expired
 *   - 任何結果都寄 email 給 user 通知
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import {
  refundApprovedEmail,
  refundRejectedEmail,
} from "@/lib/email/templates/refund";
import { requestRefund, terminatePeriodicSubscription } from "@/lib/ecpay/refund";
import { invalidInvoice } from "@/lib/ecpay/invoice";

const VALID_STATUS = ["approved", "rejected", "refunded"] as const;

async function ensureAdmin(): Promise<{
  ok: boolean;
  userId?: string;
  email?: string;
}> {
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const adminCheck = await ensureAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    status?: string;
    admin_note?: string;
    downgrade_user?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.status || !VALID_STATUS.includes(body.status as "approved")) {
    return NextResponse.json(
      { error: "invalid_status", valid: VALID_STATUS },
      { status: 400 },
    );
  }

  const svc = getServiceSupabase();
  const { data: rr, error: selErr } = await svc
    .from("refund_requests")
    .select(
      "id, user_id, payment_id, amount_requested, status, users:user_id(email, plan), payments:payment_id(ecpay_trade_no, raw_response, invoice_number, invoice_issued_at, invoice_status, subscription_id, subscriptions:subscription_id(period, ecpay_merchant_trade_no, status))",
    )
    .eq("id", id)
    .single();

  if (selErr || !rr) {
    return NextResponse.json(
      { error: "not_found", detail: selErr?.message },
      { status: 404 },
    );
  }

  if (rr.status !== "pending" && rr.status !== "approved") {
    return NextResponse.json(
      { error: "already_processed", current: rr.status },
      { status: 409 },
    );
  }

  // user join 可能是 array 也可能是 object — supabase-js 視 relation 給定
  const userRow = Array.isArray(rr.users) ? rr.users[0] : rr.users;
  const userEmail = (userRow as { email?: string })?.email;

  // 更新 refund_request
  const update: Record<string, string | null | Date> = {
    status: body.status,
    admin_note: body.admin_note ?? null,
    reviewed_by: adminCheck.userId ?? null,
    reviewed_at: new Date().toISOString(),
  };

  const { error: upErr } = await svc
    .from("refund_requests")
    .update(update)
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // approved → 完整退款流程：
  //   1. 呼叫綠界 Refund API（退本期款）
  //   2. 若是月扣定期定額 → 呼叫 Terminate（防下個月又扣）
  //   3. 若已開發票 → 24h 內 Invalid 作廢、超過則留給後續 Allowance 折讓
  //   4. mark payments.status='refunded' + invoice_status='invalid'
  let ecpayRefund: { ok: boolean; rtnCode?: string; rtnMsg?: string; error?: string } | null = null;
  let ecpayTerminate: { ok: boolean; rtnCode?: string; rtnMsg?: string; error?: string } | null = null;
  let invoiceVoid: { ok: boolean; rtnCode?: number; rtnMsg?: string } | null = null;

  if (body.status === "approved" && rr.payment_id) {
    const paymentRow = Array.isArray(rr.payments) ? rr.payments[0] : rr.payments;
    const tradeNo = (paymentRow as { ecpay_trade_no?: string })?.ecpay_trade_no;
    const raw = (paymentRow as { raw_response?: Record<string, string> })?.raw_response;
    const orderId = raw?.MerchantTradeNo;
    const invoiceNumber = (paymentRow as { invoice_number?: string })?.invoice_number;
    const invoiceIssuedAt = (paymentRow as { invoice_issued_at?: string })?.invoice_issued_at;

    const subRow = (paymentRow as {
      subscriptions?: { period?: string; ecpay_merchant_trade_no?: string };
    })?.subscriptions;
    const subPeriod = (Array.isArray(subRow) ? subRow[0] : subRow)?.period;
    const subOrderId = (Array.isArray(subRow) ? subRow[0] : subRow)?.ecpay_merchant_trade_no;

    if (tradeNo && orderId) {
      // (1) 退款本期
      ecpayRefund = await requestRefund({
        merchantTradeNo: orderId,
        tradeNo,
        amount: rr.amount_requested,
      });

      // (2) 若月扣 → 終止定期定額（不論退款成不成功都要 terminate，避免下期又扣）
      if (subPeriod === "monthly" && subOrderId) {
        ecpayTerminate = await terminatePeriodicSubscription(subOrderId);
        if (!ecpayTerminate.ok) {
          console.error("[admin/refunds] Terminate 失敗", {
            subOrderId,
            rtnMsg: ecpayTerminate.rtnMsg,
            error: ecpayTerminate.error,
          });
        }
      }

      // (3) 退款成功才動發票（不然退款失敗、發票卻作廢了 = 資料不一致）
      if (ecpayRefund.ok && invoiceNumber && invoiceIssuedAt) {
        const ageMs = Date.now() - new Date(invoiceIssuedAt).getTime();
        const within24h = ageMs < 24 * 60 * 60 * 1000;
        if (within24h) {
          const inv = await invalidInvoice({
            invoiceNumber,
            invoiceDate: new Date(invoiceIssuedAt).toISOString().slice(0, 10),
            reason: "退款作廢",
          });
          invoiceVoid = { ok: inv.success, rtnCode: inv.rtnCode, rtnMsg: inv.rtnMsg };
          if (inv.success) {
            await svc
              .from("payments")
              .update({ invoice_status: "invalid" })
              .eq("id", rr.payment_id);
          } else {
            console.error("[admin/refunds] 發票作廢失敗", {
              invoiceNumber,
              rtnCode: inv.rtnCode,
              rtnMsg: inv.rtnMsg,
            });
          }
        } else {
          // 超過 24h 不能作廢，後續要人工走 Allowance 折讓
          console.warn("[admin/refunds] 發票超過 24h 不能作廢，需手動折讓", {
            invoiceNumber,
            ageHours: ageMs / 3_600_000,
          });
        }
      }

      // (4) 標記
      if (ecpayRefund.ok) {
        await svc
          .from("refund_requests")
          .update({ status: "refunded" })
          .eq("id", id);
        await svc
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", rr.payment_id);
      } else {
        console.warn("[admin/refunds] 綠界退款失敗、保留 approved 狀態", {
          refundId: id,
          error: ecpayRefund.error,
          rtnMsg: ecpayRefund.rtnMsg,
        });
      }
    } else {
      console.warn("[admin/refunds] 缺 tradeNo / orderId，跳過綠界退款 API", {
        refundId: id,
        hasTradeNo: !!tradeNo,
        hasOrderId: !!orderId,
      });
    }
  }

  // approved + downgrade_user (default true) → 降回 free
  const downgrade = body.downgrade_user !== false;
  if (body.status === "approved" && downgrade) {
    await svc
      .from("users")
      .update({
        plan: "free",
        subscription_status: "expired",
        subscription_expires_at: null,
      })
      .eq("id", rr.user_id);
    await svc
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", rr.user_id)
      .eq("status", "active");
  }

  // 寄 email
  if (userEmail) {
    const payload =
      body.status === "approved" || body.status === "refunded"
        ? refundApprovedEmail({
            amount: rr.amount_requested,
            adminNote: body.admin_note ?? "",
          })
        : refundRejectedEmail({
            amount: rr.amount_requested,
            adminNote: body.admin_note ?? "",
          });
    void sendEmail({
      to: userEmail,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  }

  console.log("[admin/refunds] processed", {
    adminEmail: adminCheck.email,
    refundId: id,
    status: body.status,
    user: userEmail,
    amount: rr.amount_requested,
    ecpayRefund,
  });

  return NextResponse.json({
    ok: true,
    ecpay_refund: ecpayRefund,
    ecpay_terminate: ecpayTerminate,
    invoice_void: invoiceVoid,
    final_status: ecpayRefund?.ok ? "refunded" : body.status,
  });
}
