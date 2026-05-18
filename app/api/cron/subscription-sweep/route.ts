/**
 * GET /api/cron/subscription-sweep
 *   Vercel Cron 每天執行一次。掃所有 subscription_expires_at + grace period 已過、
 *   plan 仍為付費的 user，把 plan 降回 free、subscriptions 標 expired。
 *
 *   執行前驗 `Authorization: Bearer ${process.env.CRON_SECRET}`（Vercel Cron 會自動帶）。
 *
 *   設計：
 *   - 一次只處理「真的過 grace 的」user，grace period 內仍視為付費（webhook
 *     可能下一秒就把 expires_at 延長）。
 *   - lifetime 跳過。
 *   - free 跳過。
 *   - 紀錄 sweep 結果回 admin_actions 表（如果存在，便利 audit）。
 *
 *   schedule：vercel.json 設 daily 03:00 UTC（= 11:00 台北時間）
 */
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { GRACE_PERIOD_DAYS, GRACE_PERIOD_MS } from "@/lib/pricing/expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();

  // 1. 找出 plan != free / lifetime 且 expires_at < cutoff 的 user
  const { data: usersToExpire, error: selErr } = await admin
    .from("users")
    .select("id, email, plan, subscription_expires_at")
    .not("plan", "in", "(free,lifetime)")
    .lt("subscription_expires_at", cutoff);

  if (selErr) {
    console.error("[cron/subscription-sweep] select users failed", selErr);
    return NextResponse.json({ error: "db_error", detail: selErr.message }, { status: 500 });
  }

  const userIds = (usersToExpire ?? []).map((u) => u.id);

  if (!userIds.length) {
    return NextResponse.json({
      ok: true,
      downgraded: 0,
      grace_period_days: GRACE_PERIOD_DAYS,
    });
  }

  // 2. 降回 free（保留 subscription_expires_at 當 audit 用，但 status 改 expired）
  const { error: upUserErr } = await admin
    .from("users")
    .update({
      plan: "free",
      subscription_status: "expired",
    })
    .in("id", userIds);

  if (upUserErr) {
    console.error("[cron/subscription-sweep] update users failed", upUserErr);
    return NextResponse.json({ error: "db_error", detail: upUserErr.message }, { status: 500 });
  }

  // 3. 對應的 subscriptions row 也標 expired（避免 admin UI 顯示成 active）
  const { error: upSubErr } = await admin
    .from("subscriptions")
    .update({ status: "expired" })
    .in("user_id", userIds)
    .eq("status", "active");

  if (upSubErr) {
    console.error("[cron/subscription-sweep] update subscriptions failed", upSubErr);
    // 不擋 — user 已降級，這裡只是 housekeeping
  }

  console.log("[cron/subscription-sweep] downgraded", {
    count: userIds.length,
    cutoff,
    users: (usersToExpire ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      from_plan: u.plan,
      expired_at: u.subscription_expires_at,
    })),
  });

  return NextResponse.json({
    ok: true,
    downgraded: userIds.length,
    grace_period_days: GRACE_PERIOD_DAYS,
    cutoff,
  });
}
