/**
 * POST /api/admin/payments/[id]/retry-invoice
 *   admin 手動重試發票開立。
 *   用途:webhook 因 Vercel timeout 或綠界 invoice API 暫時掛掉導致
 *        invoice_status=failed 的 payment,admin 在 /admin/ecpay 看板點重試。
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { issueInvoiceForPayment } from "@/lib/ecpay/issue-invoice-for-payment";
import { planLabelFromUserPlan } from "@/lib/email/templates/subscription-expiry";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  // admin gate
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
  // 撈 payment + 連帶 subscription.plan + period
  const { data: payment, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, amount, status, invoice_status, subscription_id, raw_response")
    .eq("id", id)
    .single();
  if (payErr || !payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }
  if (payment.status !== "success") {
    return NextResponse.json(
      { error: "not_a_success_payment", currentStatus: payment.status },
      { status: 400 },
    );
  }

  let itemName = "木頭仁 木作藍圖訂閱";
  if (payment.subscription_id) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan, period")
      .eq("id", payment.subscription_id)
      .single();
    if (sub) {
      const periodLabel = sub.period === "monthly" ? "月付" : "年付";
      itemName = `木頭仁 木作藍圖${planLabelFromUserPlan(sub.plan)}${periodLabel}訂閱`;
    }
  } else {
    // 無 subscription_id = 一次性買斷（template_unlock / tool_unlock），
    // itemName 從 raw_response 拿（checkout 寫進去的）
    const raw = payment.raw_response as Record<string, unknown> | null;
    if (raw && typeof raw.itemName === "string") {
      itemName = raw.itemName;
    }
  }

  try {
    await issueInvoiceForPayment(admin, {
      paymentId: payment.id,
      userId: payment.user_id,
      amount: Number(payment.amount ?? 0),
      itemName,
    });
  } catch (e) {
    console.error("[admin/retry-invoice] 例外", e);
    return NextResponse.json(
      { error: "issue_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  // 撈最新狀態回 UI
  const { data: after } = await admin
    .from("payments")
    .select("invoice_status")
    .eq("id", id)
    .single();

  return NextResponse.json({
    ok: true,
    invoice_status: after?.invoice_status ?? null,
  });
}
