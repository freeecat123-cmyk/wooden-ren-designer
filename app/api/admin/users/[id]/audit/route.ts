/**
 * GET /api/admin/users/[id]/audit
 *   admin 看某 user 被改過的歷史 (admin_actions where target_user_id = id),
 *   倒序最多 50 筆。debug「user.plan 怎麼變了」用。
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const svc = getServiceSupabase();
  const { data, error } = await svc
    .from("admin_actions")
    .select("id, actor_email, action, before_state, after_state, reason, created_at")
    .eq("target_user_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}
