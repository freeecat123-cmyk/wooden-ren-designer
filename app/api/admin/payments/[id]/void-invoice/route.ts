/**
 * POST /api/admin/payments/[id]/void-invoice
 *   admin 補作廢發票。
 *   用途:payment.status='refunded' 但 invoice_status 還是 'issued'(歷史資料、
 *        升級退舊修補前的洞)時,admin 在 /admin/ecpay 看板一鍵補作廢。
 *
 *   邏輯:
 *   - 24h 內 → 呼叫綠界 InvoiceInvalid + 更新 invoice_status='invalid'
 *   - 超過 24h → 回 422,讓 admin 知道要走 Allowance 折讓人工處理
 */
import { NextResponse } from "next/server";
import {
  createClient as createServerSupabase,
  createAdminClient,
} from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { invalidInvoice } from "@/lib/ecpay/invoice";

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
    .select("id, invoice_number, invoice_issued_at, invoice_status, status")
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
  if (payment.invoice_status === "invalid") {
    return NextResponse.json(
      { error: "already_invalid" },
      { status: 409 },
    );
  }

  const ageMs = Date.now() - new Date(payment.invoice_issued_at).getTime();
  const ageHours = ageMs / 3_600_000;
  if (ageMs >= 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      {
        error: "exceed_24h",
        ageHours,
        hint: "超過 24h 不能作廢,需走 Allowance 折讓人工處理",
      },
      { status: 422 },
    );
  }

  const inv = await invalidInvoice({
    invoiceNumber: payment.invoice_number,
    invoiceDate: new Date(payment.invoice_issued_at).toISOString().slice(0, 10),
    reason: "admin 補作廢(退款後同步)",
  });

  if (!inv.success) {
    return NextResponse.json(
      { error: "invoice_invalid_failed", rtnCode: inv.rtnCode, rtnMsg: inv.rtnMsg },
      { status: 500 },
    );
  }

  await admin
    .from("payments")
    .update({ invoice_status: "invalid" })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    invoice_number: payment.invoice_number,
    rtnMsg: inv.rtnMsg,
  });
}
