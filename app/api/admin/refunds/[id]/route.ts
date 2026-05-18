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
import { requestRefund } from "@/lib/ecpay/refund";

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
      "id, user_id, payment_id, amount_requested, status, users:user_id(email, plan), payments:payment_id(ecpay_trade_no, raw_response)",
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

  // approved → 自動呼叫綠界 refund API（成功則 mark refunded、失敗則保留 approved
  // 等 admin 手動處理）
  let ecpayRefund: { ok: boolean; rtnCode?: string; rtnMsg?: string; error?: string } | null = null;
  if (body.status === "approved" && rr.payment_id) {
    const paymentRow = Array.isArray(rr.payments) ? rr.payments[0] : rr.payments;
    const tradeNo = (paymentRow as { ecpay_trade_no?: string })?.ecpay_trade_no;
    // 從 raw_response 撈 MerchantTradeNo（綠界 callback 回的）
    const raw = (paymentRow as { raw_response?: Record<string, string> })
      ?.raw_response;
    const orderId = raw?.MerchantTradeNo;
    if (tradeNo && orderId) {
      ecpayRefund = await requestRefund({
        merchantTradeNo: orderId,
        tradeNo,
        amount: rr.amount_requested,
      });
      if (ecpayRefund.ok) {
        // 綠界退款成功 → mark refund_request + payments 為 refunded
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
    final_status: ecpayRefund?.ok ? "refunded" : body.status,
  });
}
