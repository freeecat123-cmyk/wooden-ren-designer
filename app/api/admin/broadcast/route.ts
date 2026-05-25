/**
 * POST /api/admin/broadcast
 *
 * Admin 批次寄信。流程：
 *   1. 撈 users 表 + 用 getEffectivePlan 算實際方案
 *   2. 依 audience filter 篩出 recipients
 *   3. 同步 sendEmail loop（500ms throttle 配 Resend free tier 2/sec）
 *   4. 寫 email_broadcasts 紀錄 sent/failed count
 *
 * 變數展開：subject/body 內的 {{email}} {{name}} 會替換成該 recipient 的值。
 * （name 沒欄位、用 email @ 前段當 fallback）
 *
 * dryRun=true：只寄給呼叫的 admin 自己一份，不動 email_broadcasts、不寄給用戶。
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import { getEffectivePlan, type UserPlanProfile, type PlanId } from "@/lib/permissions";

interface AudienceFilter {
  kind: "all" | "unpaid" | "paid" | "plan" | "manual";
  plan?: PlanId;
  emails?: string[];
  /** 排除已填寫指定問卷者（survey_responses.survey_id）。重寄問卷常用：
   *  選 unpaid + excludeRespondentsOfSurveyId="launch-2026-05" → 沒填過的未付費者。 */
  excludeRespondentsOfSurveyId?: string;
}

interface BroadcastBody {
  audience: AudienceFilter;
  subject: string;
  text: string;
  html: string;
  dryRun?: boolean;
}

function audienceLabel(filter: AudienceFilter, count: number): string {
  const exclude = filter.excludeRespondentsOfSurveyId
    ? `，排除已填「${filter.excludeRespondentsOfSurveyId}」問卷`
    : "";
  switch (filter.kind) {
    case "all": return `全部用戶 (${count} 人)${exclude}`;
    case "unpaid": return `未付費 (${count} 人)${exclude}`;
    case "paid": return `已付費 (${count} 人)${exclude}`;
    case "plan": return `${filter.plan} 方案 (${count} 人)${exclude}`;
    case "manual": return `手動指定 (${count} emails)${exclude}`;
  }
}

function expandVars(template: string, recipient: { email: string }): string {
  const nameFallback = recipient.email.split("@")[0];
  return template
    .replaceAll("{{email}}", recipient.email)
    .replaceAll("{{name}}", nameFallback);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const adminEmail = user!.email!;

  let body: BroadcastBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.subject?.trim() || !body.text?.trim() || !body.html?.trim()) {
    return NextResponse.json({ error: "subject / text / html 必填" }, { status: 400 });
  }
  if (!body.audience?.kind) {
    return NextResponse.json({ error: "audience 必填" }, { status: 400 });
  }

  // dryRun：只寄給呼叫者自己預覽，不動 DB
  if (body.dryRun) {
    const result = await sendEmail({
      to: adminEmail,
      subject: `[預覽] ${body.subject}`,
      text: expandVars(body.text, { email: adminEmail }),
      html: expandVars(body.html, { email: adminEmail }),
    });
    return NextResponse.json({
      ok: result.ok,
      dryRun: true,
      sentTo: adminEmail,
      error: result.error,
    });
  }

  // 撈用戶 + 算 effective plan
  const svc = getServiceSupabase();
  const { data: users, error: usersErr } = await svc
    .from("users")
    .select("email, plan, subscription_status, subscription_expires_at, student_activated_at, student_expires_at");
  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }

  // 依 audience filter 篩 recipients
  type Row = UserPlanProfile & { email: string };
  let recipients: { email: string }[] = [];
  const filter = body.audience;
  if (filter.kind === "manual") {
    const emails = (filter.emails ?? [])
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));
    recipients = emails.map((email) => ({ email }));
  } else {
    const rows = (users ?? []) as Row[];
    recipients = rows
      .filter((r) => {
        const eff = getEffectivePlan(r);
        if (filter.kind === "all") return true;
        if (filter.kind === "unpaid") return eff === "free";
        if (filter.kind === "paid") return eff !== "free";
        if (filter.kind === "plan") return eff === filter.plan;
        return false;
      })
      .map((r) => ({ email: r.email }))
      .filter((r) => !!r.email);
  }

  // 排除已填某問卷者（重寄場景）
  if (filter.excludeRespondentsOfSurveyId) {
    const surveyId = filter.excludeRespondentsOfSurveyId;
    const { data: responses, error: rErr } = await svc
      .from("survey_responses")
      .select("user_id")
      .eq("survey_id", surveyId);
    if (rErr) {
      return NextResponse.json({ error: `survey filter: ${rErr.message}` }, { status: 500 });
    }
    const respondentUserIds = Array.from(new Set((responses ?? []).map((r) => r.user_id)));
    if (respondentUserIds.length > 0) {
      const { data: respUsers, error: uErr } = await svc
        .from("users")
        .select("email")
        .in("id", respondentUserIds);
      if (uErr) {
        return NextResponse.json({ error: `survey filter users: ${uErr.message}` }, { status: 500 });
      }
      const excludeSet = new Set(
        (respUsers ?? [])
          .map((u) => (u.email ?? "").trim().toLowerCase())
          .filter((e) => e),
      );
      recipients = recipients.filter((r) => !excludeSet.has(r.email.trim().toLowerCase()));
    }
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "audience 篩選後 0 人" }, { status: 400 });
  }

  // 建 broadcast 紀錄
  const { data: broadcast, error: bErr } = await svc
    .from("email_broadcasts")
    .insert({
      audience_label: audienceLabel(filter, recipients.length),
      audience_filter: filter,
      recipient_count: recipients.length,
      subject: body.subject,
      text_body: body.text,
      html_body: body.html,
      created_by_email: adminEmail,
    })
    .select("id")
    .single();
  if (bErr || !broadcast) {
    return NextResponse.json({ error: bErr?.message ?? "broadcast insert failed" }, { status: 500 });
  }

  // 寄送 loop：500ms 間隔 = Resend free tier 2/sec 上限
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sendEmail({
      to: r.email,
      subject: body.subject,
      text: expandVars(body.text, r),
      html: expandVars(body.html, r),
    });
    if (result.ok) sent++;
    else failed++;
    // 最後一封不用 sleep
    if (r !== recipients[recipients.length - 1]) {
      await sleep(500);
    }
  }

  await svc
    .from("email_broadcasts")
    .update({ sent_count: sent, failed_count: failed, finished_at: new Date().toISOString() })
    .eq("id", broadcast.id);

  return NextResponse.json({
    ok: true,
    broadcastId: broadcast.id,
    recipientCount: recipients.length,
    sent,
    failed,
  });
}
