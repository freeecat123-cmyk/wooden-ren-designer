import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

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

// ---------- GET：列出全部 whitelist ----------
export async function GET() {
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

  // 把已註冊但 plan='free' 的同 email 升級為 student
  const emails = records.map((r) => r.email);
  const { error: upErr } = await svc
    .from("users")
    .update({ plan: "student", subscription_status: "active" })
    .in("email", emails)
    .eq("plan", "free");
  // 升級失敗不致命（可能根本還沒註冊）—— 只記錄

  return NextResponse.json({
    data,
    added: records.length,
    upgradeError: upErr?.message ?? null,
  });
}

// ---------- DELETE：移除單筆 ----------
export async function DELETE(request: NextRequest) {
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
}
