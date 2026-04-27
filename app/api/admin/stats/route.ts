import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

/**
 * 後台儀表板統計：聚合 users / designs / whitelist / subscriptions / payments。
 * 全部用 service-role client（繞 RLS 直接撈 count）。
 *
 * 估算 MRR：
 *   - personal：×290
 *   - pro：×890
 *   - student（仍在期）：算成 0（學員免費）
 *   - lifetime：不入 MRR（一次性收入）
 *
 * 學員續用版未來會塞回 plan='pro' 但價 490，目前沒有區分標記，
 * 暫以 pro 全估 890 計（保守上限）。
 */

interface PlanCount {
  plan: string;
  count: number;
}

async function ensureAdmin(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "not-logged-in" };
    if (!isAdminEmail(user.email, getServerAdminEmails())) {
      return { ok: false, reason: "not-admin" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "auth-error" };
  }
}

async function totalCount(svc: ReturnType<typeof getServiceSupabase>, table: string) {
  const { count } = await svc.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function planCounts(svc: ReturnType<typeof getServiceSupabase>): Promise<PlanCount[]> {
  // 一次撈 plan 欄做 group by（client side 因為 PostgREST 無內建 group by）
  const { data, error } = await svc.from("users").select("plan");
  if (error || !data) return [];
  const map = new Map<string, number>();
  for (const r of data as Array<{ plan: string }>) {
    map.set(r.plan, (map.get(r.plan) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count);
}

async function studentBreakdown(svc: ReturnType<typeof getServiceSupabase>) {
  const { data } = await svc
    .from("users")
    .select("student_expires_at")
    .eq("plan", "student");
  const now = Date.now();
  let active = 0;
  let expired = 0;
  let expiringSoon = 0; // ≤30 天
  for (const r of (data ?? []) as Array<{ student_expires_at: string | null }>) {
    if (!r.student_expires_at) {
      // 沒填到期日視為 active（migration 之前的舊資料）
      active++;
      continue;
    }
    const ms = new Date(r.student_expires_at).getTime() - now;
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days <= 0) expired++;
    else if (days <= 30) {
      expiringSoon++;
      active++;
    } else {
      active++;
    }
  }
  return { active, expired, expiringSoon };
}

async function signupTrend(svc: ReturnType<typeof getServiceSupabase>, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);
  const { data } = await svc
    .from("users")
    .select("created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  const buckets: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const r of (data ?? []) as Array<{ created_at: string }>) {
    const key = r.created_at.slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}

async function recentSubscriptions(svc: ReturnType<typeof getServiceSupabase>) {
  // 過去 30 天「成功付款」的訂單筆數與金額
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data } = await svc
    .from("payments")
    .select("amount, status, created_at")
    .gte("created_at", since.toISOString())
    .eq("status", "success");
  const list = (data ?? []) as Array<{ amount: number }>;
  return {
    count: list.length,
    revenue: list.reduce((s, r) => s + (r.amount ?? 0), 0),
  };
}

export async function GET() {
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json(
      { error: "Unauthorized", reason: check.reason },
      { status: 401 },
    );
  }

  const svc = getServiceSupabase();

  const [
    totalUsers,
    totalDesigns,
    totalWhitelist,
    plansBreakdown,
    students,
    trend7,
    trend30,
    last30Pay,
  ] = await Promise.all([
    totalCount(svc, "users"),
    totalCount(svc, "designs"),
    totalCount(svc, "whitelist"),
    planCounts(svc),
    studentBreakdown(svc),
    signupTrend(svc, 7),
    signupTrend(svc, 30),
    recentSubscriptions(svc),
  ]);

  // 估算 MRR（NTD）
  const PRICE_BY_PLAN: Record<string, number> = {
    personal: 290,
    pro: 890,
    // student / lifetime / free 都算 0
  };
  const mrrEstimate = plansBreakdown.reduce((s, { plan, count }) => {
    return s + (PRICE_BY_PLAN[plan] ?? 0) * count;
  }, 0);

  // 流失：subscription_status in ('cancelled', 'expired') 且非 student
  const { data: churnRows } = await svc
    .from("users")
    .select("subscription_status, plan")
    .in("subscription_status", ["cancelled", "expired"]);
  const churnedCount = (churnRows ?? []).filter(
    (r: { plan: string }) => r.plan !== "student",
  ).length;

  return NextResponse.json({
    totalUsers,
    totalDesigns,
    totalWhitelist,
    plansBreakdown,
    students,
    churnedCount,
    mrrEstimate,
    last30Pay,
    trend7,
    trend30,
    generatedAt: new Date().toISOString(),
  });
}
