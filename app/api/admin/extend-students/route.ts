import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

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

/**
 * 批次延長所有 student 方案的到期日。呼叫 Supabase RPC `extend_all_students(int)`。
 * Body: { days?: number }（預設 365）
 */
export async function POST(request: NextRequest) {
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json(
      { error: "Unauthorized", reason: check.reason },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { days?: number };
  const days = Number(body.days);
  if (!Number.isFinite(days) || days <= 0 || days > 3650) {
    return NextResponse.json(
      { error: "days must be a positive integer ≤ 3650" },
      { status: 400 },
    );
  }

  const svc = getServiceSupabase();
  const { data, error } = await svc.rpc("extend_all_students", {
    days: Math.round(days),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, affected: data ?? null });
}
