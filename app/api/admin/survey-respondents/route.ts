/**
 * GET /api/admin/survey-respondents?survey_id=<id>
 *
 * Admin-only：撈某問卷的填寫者 email 清單。
 * 用途：批次寄信時可勾選「排除已填寫此問卷者」做即時人數預覽 + 後端二次過濾。
 *
 * 回傳：{ emails: string[], count: number }
 *
 * 流程：
 *   1. survey_responses → user_ids
 *   2. users 表 user_ids → emails（join）
 *   3. 排重後回傳（同一 user_id 同一 survey 唯一 row、理論上不會重，保險）
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const surveyId = new URL(req.url).searchParams.get("survey_id");
  if (!surveyId) {
    return NextResponse.json({ error: "survey_id 必填" }, { status: 400 });
  }

  const svc = getServiceSupabase();
  // 1. 撈填寫者 user_id
  const { data: responses, error: rErr } = await svc
    .from("survey_responses")
    .select("user_id")
    .eq("survey_id", surveyId);
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }
  const userIds = Array.from(new Set((responses ?? []).map((r) => r.user_id)));
  if (userIds.length === 0) {
    return NextResponse.json({ emails: [], count: 0 });
  }

  // 2. user_id → email
  const { data: users, error: uErr } = await svc
    .from("users")
    .select("email")
    .in("id", userIds);
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }
  const emails = Array.from(
    new Set(
      (users ?? [])
        .map((u) => (u.email ?? "").trim().toLowerCase())
        .filter((e) => e && e.includes("@")),
    ),
  );

  return NextResponse.json({ emails, count: emails.length });
}
