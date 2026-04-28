import { NextResponse } from "next/server";
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

// ---------- GET：列出所有註冊用戶 ----------
export async function GET() {
  try {
    const check = await ensureAdmin();
    if (!check.ok) {
      return NextResponse.json(
        { error: "Unauthorized", reason: check.reason ?? "unknown" },
        { status: 401 },
      );
    }

    const svc = getServiceSupabase();
    const { data, error } = await svc
      .from("users")
      .select(
        "id, email, plan, subscription_status, student_activated_at, student_expires_at, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
