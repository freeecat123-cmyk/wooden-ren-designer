/**
 * POST /api/admin/backfill-unlock-invoices
 *   一次性 backfill：歷史已成功的單範本/裝潢工具買斷,但沒開發票的 payments,
 *   全部補開。
 *
 *   原因：2026-05-23 之前的 unlock webhook 路徑漏掉 issueInvoiceForPayment,
 *        所以開賣到 fix(f93d3c1) 之間的 unlock 訂單都沒發票。
 *
 *   只開「raw_response.kind in (template_unlock, tool_unlock)」+
 *        status='success' + invoice_number is null 的。
 *   idempotent：issueInvoiceForPayment 內部已查 invoice_number,跑兩次沒問題。
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { issueInvoiceForPayment } from "@/lib/ecpay/issue-invoice-for-payment";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("payments")
    .select("id, user_id, amount, raw_response")
    .eq("status", "success")
    .is("invoice_number", null)
    .or("raw_response->>kind.eq.template_unlock,raw_response->>kind.eq.tool_unlock");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; error?: string; itemName?: string }> = [];
  for (const row of rows ?? []) {
    const raw = row.raw_response as Record<string, unknown> | null;
    const itemName =
      (raw && typeof raw.itemName === "string" ? raw.itemName : null) ??
      "木頭仁 木作藍圖 範本買斷";
    try {
      await issueInvoiceForPayment(admin, {
        paymentId: row.id,
        userId: row.user_id,
        amount: Number(row.amount ?? 0),
        itemName,
      });
      results.push({ id: row.id, ok: true, itemName });
    } catch (e) {
      results.push({
        id: row.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        itemName,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
