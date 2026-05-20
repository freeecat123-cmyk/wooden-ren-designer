/**
 * POST /api/admin/run-reconciliation
 *   admin 立即觸發 ECPay 對帳 cron(同 /api/cron/ecpay-reconciliation 邏輯)。
 *
 *   不直接呼叫內部 fn,而是 internal fetch 到 cron endpoint 帶上 CRON_SECRET,
 *   確保兩條路徑(cron 自動 + admin 手動)邏輯完全一致。
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "cron_secret_not_set", hint: "Vercel env 沒設 CRON_SECRET" },
      { status: 500 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";
  const target = `${siteUrl}/api/cron/ecpay-reconciliation`;
  try {
    const res = await fetch(target, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const j = await res.json();
    return NextResponse.json({ ok: res.ok, status: res.status, result: j, target });
  } catch (e) {
    return NextResponse.json(
      { error: "cron_call_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
