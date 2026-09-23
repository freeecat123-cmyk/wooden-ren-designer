import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import { proAccessEmail } from "@/lib/email/templates/pro-access";

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

// 合法開通年限（月）——UI 限定，非法值 fallback 12
const ALLOWED_TERM_MONTHS = [6, 12, 24];
function normalizeTerm(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return ALLOWED_TERM_MONTHS.includes(n) ? n : 12;
}

// ---------- GET：列出全部 whitelist（合併已註冊 user 的到期日） ----------
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

    // 到期日存在 users 表、只有「註冊後」才有。用 email 清單合併進每筆 whitelist。
    const rows = (data ?? []) as Array<{ email: string; [key: string]: unknown }>;
    let merged = rows;
    if (rows.length > 0) {
      const emails = rows.map((r) => r.email);
      const { data: users } = await svc
        .from("users")
        .select("email, plan, subscription_expires_at")
        .in("email", emails);
      const byEmail = new Map(
        (users ?? []).map((u: { email: string; plan: string | null; subscription_expires_at: string | null }) => [
          u.email.toLowerCase(),
          u,
        ]),
      );
      merged = rows.map((r) => {
        const u = byEmail.get(r.email.toLowerCase());
        return {
          ...r,
          registered: !!u,
          user_plan: u?.plan ?? null,
          subscription_expires_at: u?.subscription_expires_at ?? null,
        };
      });
    }

    return NextResponse.json({ data: merged });
  } catch (e) {
    return serverError(e);
  }
}

// ---------- POST：新增（單筆或批量） ----------
interface PostBody {
  emails?: string | string[];
  source?: string;
  note?: string;
  // 開通年限（月）：6 / 12 / 24，預設 12。單筆與 CSV 整批共用。
  termMonths?: number;
  // 批量匯入時可附 name（會合併到 note）；term_months 可逐筆覆蓋
  rows?: Array<{ email: string; name?: string; source?: string; note?: string; term_months?: number }>;
}

export async function POST(request: NextRequest) {
  try {
  const check = await ensureAdmin();
  if (!check.ok) return unauthorized(check.reason ?? "unknown");

  const body = (await request.json().catch(() => ({}))) as PostBody;

  // 整批預設年限（單筆 / CSV 共用）；逐筆可再覆蓋
  const batchTerm = normalizeTerm(body.termMonths);

  let records: Array<{ email: string; source: string; note: string | null; term_months: number }> = [];

  if (body.rows && Array.isArray(body.rows)) {
    records = body.rows
      .filter((r) => typeof r.email === "string" && r.email.trim().length > 0)
      .map((r) => ({
        email: r.email.toLowerCase().trim(),
        source: (r.source ?? body.source ?? "manual").toLowerCase(),
        note: r.note ?? r.name ?? body.note ?? null,
        term_months: r.term_months != null ? normalizeTerm(r.term_months) : batchTerm,
      }));
  } else if (body.emails) {
    const list = Array.isArray(body.emails) ? body.emails : [body.emails];
    records = list
      .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
      .map((email) => ({
        email: email.toLowerCase().trim(),
        source: (body.source ?? "manual").toLowerCase(),
        note: body.note ?? null,
        term_months: batchTerm,
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

  // 把已註冊但 plan='free' 的同 email 升級為 pro（專業版），到期日依該筆的年限算。
  // 先 query 一次拿要被升的 email 清單(audit:silent upgrade 沒提示,admin 看不到誰被改了)
  const emails = records.map((r) => r.email);
  const termByEmail = new Map(records.map((r) => [r.email, r.term_months]));
  const now = new Date();
  const expiresFor = (months: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() + months);
    return d;
  };

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
    // 依年限分組更新（同批可能混不同年限）
    const groups = new Map<number, string[]>();
    for (const email of upgradedEmails) {
      const months = termByEmail.get(email) ?? batchTerm;
      const list = groups.get(months) ?? [];
      list.push(email);
      groups.set(months, list);
    }

    for (const [months, groupEmails] of groups) {
      const expires = expiresFor(months);
      const { error: upErr } = await svc
        .from("users")
        .update({
          plan: "pro",
          subscription_status: "active",
          subscription_expires_at: expires.toISOString(),
        })
        .in("email", groupEmails);
      if (upErr) {
        upgradeError = upErr.message;
        console.error("[whitelist/upgrade] update failed", upErr, { groupEmails, months });
        continue;
      }
      console.log("[whitelist/upgrade] auto-upgraded free→pro", { count: groupEmails.length, months, groupEmails });

      // 寄通知信 — Promise.allSettled 不擋整個 request,單封失敗只記 log
      const sendResults = await Promise.allSettled(
        groupEmails.map(async (email) => {
          const tmpl = proAccessEmail({ email, expiresAt: expires });
          return sendEmail({ to: email, ...tmpl });
        }),
      );
      for (const r of sendResults) {
        if (r.status === "fulfilled" && r.value.ok) emailsSent += 1;
        else emailsFailed += 1;
      }
    }
    console.log("[whitelist/upgrade] notification emails", { sent: emailsSent, failed: emailsFailed });
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
