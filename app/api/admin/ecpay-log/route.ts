/**
 * GET /api/admin/ecpay-log
 *
 * 回最近 100 筆 payments (one-time + recurring) 給 admin /admin/ecpay 看板用。
 * 含 join 出 user email + sub plan / merchant_trade_no。
 *
 * Query params:
 *   ?limit=100 (1-500)
 *   ?status=success|failed|refunded (optional)
 *   ?since=ISO date (optional)
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, reason: "not-logged-in" };
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    return { ok: false as const, status: 403, reason: "not-admin" };
  }
  return { ok: true as const };
}

interface PaymentRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number | null;
  status: string;
  ecpay_trade_no: string | null;
  ecpay_payment_date: string | null;
  invoice_status: string | null;
  invoice_error_message: string | null;
  raw_response: Record<string, unknown> | null;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string | null;
  plan: string | null;
}

interface SubRow {
  id: string;
  plan: string | null;
  ecpay_merchant_trade_no: string | null;
  ecpay_periodic_no: string | null;
  expected_amount: number | null;
  status: string | null;
}

export async function GET(req: NextRequest) {
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100") || 100));
  const statusFilter = searchParams.get("status");
  const since = searchParams.get("since");

  const svc = getServiceSupabase();
  let q = svc
    .from("payments")
    .select("id, user_id, subscription_id, amount, status, ecpay_trade_no, ecpay_payment_date, invoice_status, invoice_error_message, raw_response, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (statusFilter) q = q.eq("status", statusFilter);
  if (since) q = q.gte("created_at", since);

  const { data: payments, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (payments ?? []) as PaymentRow[];
  if (rows.length === 0) {
    return NextResponse.json({ rows: [], userMap: {}, subMap: {} });
  }

  // Batch fetch user + sub for join
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const subIds = Array.from(new Set(rows.map((r) => r.subscription_id).filter(Boolean) as string[]));

  const [usersRes, subsRes] = await Promise.all([
    userIds.length > 0
      ? svc.from("users").select("id, email, plan").in("id", userIds)
      : Promise.resolve({ data: [] as UserRow[], error: null }),
    subIds.length > 0
      ? svc.from("subscriptions").select("id, plan, ecpay_merchant_trade_no, ecpay_periodic_no, expected_amount, status").in("id", subIds)
      : Promise.resolve({ data: [] as SubRow[], error: null }),
  ]);

  const userMap: Record<string, UserRow> = {};
  for (const u of (usersRes.data ?? []) as UserRow[]) userMap[u.id] = u;
  const subMap: Record<string, SubRow> = {};
  for (const s of (subsRes.data ?? []) as SubRow[]) subMap[s.id] = s;

  return NextResponse.json({ rows, userMap, subMap });
}
