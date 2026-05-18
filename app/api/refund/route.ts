/**
 * POST /api/refund
 *   user 送出退費申請。body: { paymentId?: string, amount: number, reason: string }
 *
 *   流程：
 *   1. 驗 user 登入
 *   2. 找到 user 最近 success 的 payment（如果 paymentId 沒帶）
 *   3. 檢查：付款是否在 7 天內、是否已有 pending/approved/refunded request
 *   4. insert refund_requests
 *   5. 寄 email 給 user + admin
 *   6. 回 { ok, id }
 *
 * GET /api/refund
 *   列出 user 自己的退費申請紀錄
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getServerAdminEmails } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import {
  refundReceivedToAdminEmail,
  refundReceivedToUserEmail,
} from "@/lib/email/templates/refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  let body: { paymentId?: string; amount?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reason = (body.reason ?? "").trim();
  if (reason.length < 5) {
    return NextResponse.json(
      { error: "reason_too_short", min: 5 },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 找 payment：如果有 paymentId 用它、否則撈 user 最近一筆 success
  let payment: {
    id: string;
    amount: number;
    user_id: string;
    status: string;
    ecpay_payment_date: string | null;
  } | null = null;

  if (body.paymentId) {
    const { data: p } = await admin
      .from("payments")
      .select("id, amount, user_id, status, ecpay_payment_date")
      .eq("id", body.paymentId)
      .eq("user_id", user.id)
      .single();
    payment = p;
  } else {
    const { data: ps } = await admin
      .from("payments")
      .select("id, amount, user_id, status, ecpay_payment_date")
      .eq("user_id", user.id)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1);
    payment = ps?.[0] ?? null;
  }

  if (!payment) {
    return NextResponse.json(
      { error: "no_payment_to_refund" },
      { status: 400 },
    );
  }

  const amount = typeof body.amount === "number" ? body.amount : payment.amount;
  if (amount <= 0 || amount > payment.amount) {
    return NextResponse.json(
      { error: "invalid_amount", paymentAmount: payment.amount },
      { status: 400 },
    );
  }

  // 檢查是否已有 active request
  const { data: existing } = await admin
    .from("refund_requests")
    .select("id, status")
    .eq("payment_id", payment.id)
    .in("status", ["pending", "approved", "refunded"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "duplicate_request", existing_status: existing.status },
      { status: 409 },
    );
  }

  const { data: inserted, error: insErr } = await admin
    .from("refund_requests")
    .insert({
      user_id: user.id,
      payment_id: payment.id,
      amount_requested: amount,
      reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("[api/refund] insert failed", insErr);
    return NextResponse.json(
      { error: "db_error", detail: insErr?.message },
      { status: 500 },
    );
  }

  // 寄 email 給 user + admin（非 await，不擋回應）
  if (user.email) {
    const userPayload = refundReceivedToUserEmail({ amount, reason });
    void sendEmail({
      to: user.email,
      subject: userPayload.subject,
      text: userPayload.text,
      html: userPayload.html,
    });
  }
  const admins = getServerAdminEmails();
  if (admins.length) {
    const adminPayload = refundReceivedToAdminEmail({
      userEmail: user.email ?? "(no email)",
      amount,
      reason,
    });
    for (const ae of admins) {
      void sendEmail({
        to: ae,
        subject: adminPayload.subject,
        text: adminPayload.text,
        html: adminPayload.html,
      });
    }
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("refund_requests")
    .select(
      "id, payment_id, amount_requested, reason, status, admin_note, created_at, reviewed_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
