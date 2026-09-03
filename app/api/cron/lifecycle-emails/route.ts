/**
 * GET /api/cron/lifecycle-emails
 *   Vercel Cron daily 02:00 UTC — 生命週期自動信（新註冊 d1/d3/d7、舊免費用戶回訪、到期回流）。
 *
 * 規則見 lib/email/lifecycle-rules.ts；內文見 lib/email/templates/lifecycle.ts。
 * 寄送紀錄寫 lifecycle_emails（每人每 key 一筆，unique 約束兜底不重寄）。
 *
 * 總開關：env LIFECYCLE_EMAILS_ENABLED=1 才寄，沒設回 {skipped:true}。
 * ?dry=1：只回「會寄給誰」的統計，不寄、不寫表（開關沒開也能 dry）。
 *
 * Auth：Bearer CRON_SECRET（同 expiry-reminder）。
 */
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { lifecycleEmail, type LifecycleEmailKey } from "@/lib/email/templates/lifecycle";
import { pickLifecycleEmail, type LifecycleUser } from "@/lib/email/lifecycle-rules";
import { timingSafeEqualStr } from "@/lib/security/timing-safe-equal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 比照 expiry-reminder：Vercel 60s 內安全、Resend 速率留 buffer。
const MAX_PER_RUN = 200;
const SEND_INTERVAL_MS = 150;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Stats = Record<LifecycleEmailKey, number> & {
  failed: number;
  capped: number;
  candidates: number;
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqualStr(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const enabled = process.env.LIFECYCLE_EMAILS_ENABLED === "1";
  if (!enabled && !dry) {
    return NextResponse.json({ skipped: true, reason: "LIFECYCLE_EMAILS_ENABLED not set" });
  }

  const admin = createAdminClient();
  const now = Date.now();

  const { data: users, error } = await admin
    .from("users")
    .select("id, email, plan, subscription_status, created_at")
    .eq("plan", "free")
    .not("email", "is", null)
    .limit(5000);
  if (error) {
    console.error("[cron/lifecycle-emails] select users failed", error);
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  const list = (users ?? []) as (LifecycleUser & { name?: string | null })[];
  const ids = list.map((u) => u.id);

  // 三張輔助表一次撈完，in-memory 組 context（免費用戶 ~數百人，不做分頁）
  const designUsers = new Set<string>();
  const subUsers = new Set<string>();
  const lastEnded = new Map<string, string>();
  const sentMap = new Map<string, Partial<Record<LifecycleEmailKey, string>>>();
  if (ids.length) {
    const [{ data: designs }, { data: subs }, { data: sent }] = await Promise.all([
      admin.from("designs").select("user_id").in("user_id", ids),
      admin
        .from("subscriptions")
        .select("user_id, status, expires_at")
        .in("user_id", ids),
      admin.from("lifecycle_emails").select("user_id, email_key, sent_at").in("user_id", ids),
    ]);
    for (const d of designs ?? []) if (d.user_id) designUsers.add(d.user_id);
    for (const s of subs ?? []) {
      if (!s.user_id) continue;
      subUsers.add(s.user_id);
      if ((s.status === "expired" || s.status === "cancelled") && s.expires_at) {
        const prev = lastEnded.get(s.user_id);
        if (!prev || new Date(s.expires_at) > new Date(prev)) lastEnded.set(s.user_id, s.expires_at);
      }
    }
    for (const r of sent ?? []) {
      if (!r.user_id) continue;
      const m = sentMap.get(r.user_id) ?? {};
      m[r.email_key as LifecycleEmailKey] = r.sent_at;
      sentMap.set(r.user_id, m);
    }
  }

  // name 要另外撈（select 欄位分開是為了 LifecycleUser 型別乾淨）
  const nameMap = new Map<string, string | null>();
  if (ids.length && !dry) {
    const { data: names } = await admin.from("users").select("id, name").in("id", ids);
    for (const n of names ?? []) nameMap.set(n.id, n.name ?? null);
  }

  const stats: Stats = {
    new_d1: 0, new_d3: 0, new_d7: 0, reengage_1: 0, reengage_2: 0, winback: 0,
    failed: 0, capped: 0, candidates: list.length,
  };
  let sentThisRun = 0;

  for (const u of list) {
    const key = pickLifecycleEmail(u, {
      now,
      hasDesign: designUsers.has(u.id),
      hasAnySubscription: subUsers.has(u.id),
      lastEndedSubscriptionExpiresAt: lastEnded.get(u.id) ?? null,
      sent: sentMap.get(u.id) ?? {},
    });
    if (!key) continue;
    if (dry) {
      stats[key]++;
      continue;
    }
    if (sentThisRun >= MAX_PER_RUN) {
      stats.capped++;
      continue;
    }

    // 先佔位再寄：unique(user_id,email_key) 撞到代表別的 run 已寄，跳過。
    const { error: insErr } = await admin
      .from("lifecycle_emails")
      .insert({ user_id: u.id, email_key: key, sent_at: new Date(now).toISOString() });
    if (insErr) {
      console.warn("[cron/lifecycle-emails] dedup insert failed (skip)", { user: u.id, key, err: insErr.message });
      continue;
    }

    const payload = lifecycleEmail(key, { name: nameMap.get(u.id) });
    const res = await sendEmail({
      to: u.email as string,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    if (res.ok) {
      stats[key]++;
    } else {
      stats.failed++;
      // 寄失敗就把佔位撤掉，明天再試（sendEmail 內已 retry 3 次並進 email_queue）
      await admin.from("lifecycle_emails").delete().eq("user_id", u.id).eq("email_key", key);
      console.warn("[cron/lifecycle-emails] send failed", { email: u.email, key, error: res.error });
    }
    sentThisRun++;
    await sleep(SEND_INTERVAL_MS);
  }

  console.log("[cron/lifecycle-emails] done", { dry, ...stats });
  return NextResponse.json({ ok: true, dry, ...stats });
}
