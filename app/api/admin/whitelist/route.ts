import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import { studentEnrolledEmail } from "@/lib/email/templates/student-enrolled";

interface AdminCheck {
  ok: boolean;
  reason?: string;
}

async function ensureAdmin(): Promise<AdminCheck> {
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

function unauthorized(reason: string) {
  return NextResponse.json({ error: "Unauthorized", reason }, { status: 401 });
}

function serverError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status: 500 });
}

// ---------- GET：列出全部 whitelist ----------
export async function GET() {
  try {
    const check = await ensureAdmin();
    if (!check.ok) return unauthorized(check.reason ?? "unknown");

    const svc = getServiceSupabase();
    const { data, error } = await svc
      .from("whitelist")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    return serverError(e);
  }
}

// ---------- POST：新增（單筆或批量） ----------
interface PostBody {
  emails?: string | string[];
  source?: string;
  note?: string;
  // 批量匯入時可附 name（會合併到 note）
  rows?: Array<{ email: string; name?: string; source?: string; note?: string }>;
}

export async function POST(request: NextRequest) {
  try {
  const check = await ensureAdmin();
  if (!check.ok) return unauthorized(check.reason ?? "unknown");

  const body = (await request.json().catch(() => ({}))) as PostBody;

  let records: Array<{ email: string; source: string; note: string | null }> = [];

  if (body.rows && Array.isArray(body.rows)) {
    records = body.rows
      .filter((r) => typeof r.email === "string" && r.email.trim().length > 0)
      .map((r) => ({
        email: r.email.toLowerCase().trim(),
        source: (r.source ?? body.source ?? "manual").toLowerCase(),
        note: r.note ?? r.name ?? body.note ?? null,
      }));
  } else if (body.emails) {
    const list = Array.isArray(body.emails) ? body.emails : [body.emails];
    records = list
      .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
      .map((email) => ({
        email: email.toLowerCase().trim(),
        source: (body.source ?? "manual").toLowerCase(),
        note: body.note ?? null,
      }));
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid emails provided" }, { status: 400 });
  }

  const svc = getServiceSupabase();
  const { data, error } = await svc
    .from("whitelist")
    .upsert(records, { onConflict: "email" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 把已註冊但 plan='free' 的同 email 升級為 student（補 2 年到期日）。
  // 先 query 一次拿要被升的 email 清單(audit:silent upgrade 沒提示,admin 看不到誰被改了)
  const emails = records.map((r) => r.email);
  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 2);

  const { data: candidates } = await svc
    .from("users")
    .select("email")
    .in("email", emails)
    .eq("plan", "free");
  const upgradedEmails = (candidates ?? []).map((u: { email: string }) => u.email);

  let upgradeError: string | null = null;
  let emailsSent = 0;
  let emailsFailed = 0;
  if (upgradedEmails.length > 0) {
    const { error: upErr } = await svc
      .from("users")
      .update({
        plan: "student",
        subscription_status: "active",
        student_activated_at: now.toISOString(),
        student_expires_at: expires.toISOString(),
      })
      .in("email", upgradedEmails);
    upgradeError = upErr?.message ?? null;
    if (upErr) {
      console.error("[whitelist/upgrade] update failed", upErr, { upgradedEmails });
    } else {
      console.log("[whitelist/upgrade] auto-upgraded free→student", { count: upgradedEmails.length, upgradedEmails });

      // 寄通知信 — Promise.allSettled 不擋整個 request,單封失敗只記 log
      const sendResults = await Promise.allSettled(
        upgradedEmails.map(async (email) => {
          const tmpl = studentEnrolledEmail({ email, expiresAt: expires });
          return sendEmail({ to: email, ...tmpl });
        }),
      );
      for (const r of sendResults) {
        if (r.status === "fulfilled" && r.value.ok) emailsSent += 1;
        else emailsFailed += 1;
      }
      console.log("[whitelist/upgrade] notification emails", { sent: emailsSent, failed: emailsFailed });
    }
  }

  return NextResponse.json({
    data,
    added: records.length,
    upgradedCount: upgradedEmails.length,
    upgradedEmails,
    upgradeError,
    emailsSent,
    emailsFailed,
  });
  } catch (e) {
    return serverError(e);
  }
}

// ---------- DELETE：移除單筆 ----------
export async function DELETE(request: NextRequest) {
  try {
    const check = await ensureAdmin();
    if (!check.ok) return unauthorized(check.reason ?? "unknown");

    const { email } = (await request.json().catch(() => ({}))) as { email?: string };
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const svc = getServiceSupabase();
    const { error } = await svc
      .from("whitelist")
      .delete()
      .eq("email", email.toLowerCase().trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // 注意：不自動降級已升 student 的 user—— 需手動處理（避免誤砍學員）
    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
