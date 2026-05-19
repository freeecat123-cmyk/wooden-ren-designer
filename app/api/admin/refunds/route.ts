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

  // 統計每個 status 各幾筆,讓 admin 一眼看到「pending=N 件待處理」
  const { data: countsData } = await svc
    .from("refund_requests")
    .select("status");
  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, refunded: 0 };
  for (const r of (countsData ?? []) as Array<{ status: string }>) {
    if (r.status in counts) counts[r.status] += 1;
  }

  return NextResponse.json({ data, counts });
}
