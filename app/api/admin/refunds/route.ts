/**
 * GET /api/admin/refunds
 *   admin 列所有退費申請（join user.email + payment.amount）。
 *   query: ?status=pending|approved|rejected|refunded|all (default: all)
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

async function ensureAdmin(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    if (!isAdminEmail(user.email, getServerAdminEmails())) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function GET(req: NextRequest) {
  if (!(await ensureAdmin()).ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const svc = getServiceSupabase();

  let query = svc
    .from("refund_requests")
    .select(
      "id, user_id, payment_id, amount_requested, reason, status, admin_note, created_at, reviewed_at, users:user_id(email, plan), payments:payment_id(amount, ecpay_trade_no, ecpay_payment_date)",
    )
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
