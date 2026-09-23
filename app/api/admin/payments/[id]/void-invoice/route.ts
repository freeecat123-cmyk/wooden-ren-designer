/**
 * POST /api/admin/payments/[id]/void-invoice
 *   admin 補處理發票(退款後同步、歷史漏網)。
 *
 *   邏輯:
 *   - 24h 內 → 作廢 invalidInvoice + invoice_status='invalid'
 *   - 超過 24h → 自動改開折讓單 Allowance + invoice_status='allowanced'
 *
 *   兩條都透過 voidOrAllowanceAfterRefund helper 處理,確保跟標準 refund 流程一致。
 */
import { NextResponse } from "next/server";
import {
  createClient as createServerSupabase,
  createAdminClient,
} from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { voidOrAllowanceAfterRefund } from "@/lib/ecpay/invoice-after-refund";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: payment, error: payErr } = await admin
    .from("payments")
    .select(
      "id, user_id, amount, invoice_number, invoice_issued_at, invoice_status, status",
    )
    .eq("id", id)
    .single();
  if (payErr || !payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }
  if (!payment.invoice_number || !payment.invoice_issued_at) {
    return NextResponse.json(
      { error: "no_invoice_to_void" },
      { status: 400 },
    );
  }
  if (payment.invoice_status === "invalid" || payment.invoice_status === "allowanced") {
    return NextResponse.json(
      { error: "already_handled", current: payment.invoice_status },
      { status: 409 },
    );
  }

  // 撈 user.email 給 Allowance notifyEmail 用
  const { data: u } = await admin
    .from("users")
    .select("email")
    .eq("id", payment.user_id)
    .single();

  const result = await voidOrAllowanceAfterRefund(admin, {
    paymentId: payment.id,
    invoiceNumber: payment.invoice_number,
    invoiceIssuedAt: payment.invoice_issued_at,
    refundAmount: payment.amount,
    notifyEmail: u?.email ?? undefined,
    invalidReason: "admin 補作廢(退款後同步)",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.mode === "skipped" ? "skipped" : `${result.mode}_failed`,
        ...result,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    invoice_number: payment.invoice_number,
    allowance_number: result.allowanceNumber,
    age_hours: result.ageHours,
    rtnMsg: result.rtnMsg,
  });
}
