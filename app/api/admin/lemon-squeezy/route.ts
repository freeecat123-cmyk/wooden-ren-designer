/**
 * GET /api/admin/lemon-squeezy
 *
 * Admin dashboard data for the international (LS / USD) checkout pipeline.
 * Returns subscriptions, payments and recent webhook_log rows.
 *
 * Query params:
 *   ?limit=100  (1-500, applied to each list)
 *   ?subStatus=active|cancelled|expired|unpaid|paused  (filter subscriptions)
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

interface SubRow {
  id: string;
  user_id: string;
  plan: string | null;
  period: string | null;
  status: string | null;
  expires_at: string | null;
  started_at: string | null;
  lemonsqueezy_subscription_id: string | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number | null;
  status: string;
  lemonsqueezy_order_id: string | null;
  created_at: string;
}

interface WebhookLogRow {
  id: string;
  event_id: string;
  event_name: string;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string | null;
  plan: string | null;
}

export async function GET(req: NextRequest) {
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100") || 100));
  const subStatus = searchParams.get("subStatus");

  const svc = getServiceSupabase();

  let subQ = svc
    .from("subscriptions")
    .select(
      "id, user_id, plan, period, status, expires_at, started_at, lemonsqueezy_subscription_id, created_at",
    )
    .eq("payment_provider", "lemonsqueezy")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (subStatus) subQ = subQ.eq("status", subStatus);

  const payQ = svc
    .from("payments")
    .select(
      "id, user_id, subscription_id, amount, status, lemonsqueezy_order_id, created_at",
    )
    .eq("payment_provider", "lemonsqueezy")
    .order("created_at", { ascending: false })
    .limit(limit);

  const logQ = svc
    .from("lemonsqueezy_webhook_log")
    .select("id, event_id, event_name, processed_at, processing_error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const [subRes, payRes, logRes] = await Promise.all([subQ, payQ, logQ]);

  if (subRes.error) return NextResponse.json({ error: subRes.error.message }, { status: 500 });
  if (payRes.error) return NextResponse.json({ error: payRes.error.message }, { status: 500 });
  if (logRes.error) return NextResponse.json({ error: logRes.error.message }, { status: 500 });

  const subs = (subRes.data ?? []) as SubRow[];
  const payments = (payRes.data ?? []) as PaymentRow[];
  const webhookLog = (logRes.data ?? []) as WebhookLogRow[];

  const userIds = Array.from(
    new Set([...subs.map((s) => s.user_id), ...payments.map((p) => p.user_id)].filter(Boolean)),
  );

  const userMap: Record<string, UserRow> = {};
  if (userIds.length > 0) {
    const { data: users } = await svc
      .from("users")
      .select("id, email, plan")
      .in("id", userIds);
    for (const u of (users ?? []) as UserRow[]) userMap[u.id] = u;
  }

  return NextResponse.json({ subs, payments, webhookLog, userMap });
}
