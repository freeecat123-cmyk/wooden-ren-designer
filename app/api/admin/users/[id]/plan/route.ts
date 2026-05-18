/**
 * PATCH /api/admin/users/[id]/plan
 *   admin 改 user plan / subscription_status / subscription_expires_at。
 *
 *   body: {
 *     plan: 'free' | 'personal' | 'pro' | 'lifetime' | 'student',
 *     subscription_status?: 'active' | 'inactive' | 'cancelled' | 'expired',
 *     subscription_expires_at?: string (ISO) | null,
 *     reason?: string  // 給 admin_actions log（之後做）
 *   }
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

const VALID_PLANS = ["free", "personal", "pro", "lifetime", "student"] as const;
const VALID_STATUS = ["active", "inactive", "cancelled", "expired"] as const;

type ValidPlan = (typeof VALID_PLANS)[number];
type ValidStatus = (typeof VALID_STATUS)[number];

async function ensureAdmin(): Promise<{
  ok: boolean;
  email?: string;
  reason?: string;
}> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "not-logged-in" };
    if (!isAdminEmail(user.email, getServerAdminEmails())) {
      return { ok: false, reason: "not-admin" };
    }
    return { ok: true, email: user.email ?? undefined };
  } catch {
    return { ok: false, reason: "auth-error" };
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json(
      { error: "Unauthorized", reason: check.reason ?? "unknown" },
      { status: 401 },
    );
  }
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  let body: {
    plan?: string;
    subscription_status?: string;
    subscription_expires_at?: string | null;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const plan = body.plan;
  if (!plan || !VALID_PLANS.includes(plan as ValidPlan)) {
    return NextResponse.json(
      { error: "invalid plan", valid: VALID_PLANS },
      { status: 400 },
    );
  }

  const status = body.subscription_status;
  if (status && !VALID_STATUS.includes(status as ValidStatus)) {
    return NextResponse.json(
      { error: "invalid subscription_status", valid: VALID_STATUS },
      { status: 400 },
    );
  }

  const expiresAt =
    body.subscription_expires_at === undefined
      ? undefined
      : body.subscription_expires_at; // null 表示明確清除、字串表示 ISO 時間

  const update: Record<string, string | null> = { plan: plan };
  if (status !== undefined) update.subscription_status = status;
  if (expiresAt !== undefined) update.subscription_expires_at = expiresAt;

  // lifetime 自動清掉 expires_at（一輩子）
  if (plan === "lifetime" && update.subscription_expires_at === undefined) {
    update.subscription_expires_at = null;
    if (!update.subscription_status) update.subscription_status = "active";
  }
  // free 自動清掉 status / expires_at
  if (plan === "free") {
    if (update.subscription_status === undefined) update.subscription_status = "inactive";
    if (update.subscription_expires_at === undefined) update.subscription_expires_at = null;
  }

  const svc = getServiceSupabase();
  const { data, error } = await svc
    .from("users")
    .update(update)
    .eq("id", id)
    .select("id, email, plan, subscription_status, subscription_expires_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[admin/users/plan] updated", {
    adminEmail: check.email,
    target: data?.email,
    update,
    reason: body.reason,
  });

  return NextResponse.json({ ok: true, data });
}
