/**
 * GET /api/cron/expiry-reminder
 *   Vercel Cron daily — 寄訂閱即將到期 / 寬限期 / 已降級 email reminder。
 *
 * 寄送規則（每位 user 最多每 5 天寄 1 次）：
 *   1. expires_at - now() ∈ [0, 7d] → expiring-soon 提醒
 *   2. expires_at < now() < expires_at + grace → grace-period 警告
 *   3. expires_at + grace ≤ now() < expires_at + grace + 1d → downgraded 通知（only once，緊跟 sweep）
 *
 * dedup：users.last_expiry_reminder_at 若 > 5 天前 / NULL 才寄。
 *
 * Auth：Bearer CRON_SECRET（同 subscription-sweep cron）。
 */
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { GRACE_PERIOD_DAYS, GRACE_PERIOD_MS } from "@/lib/pricing/expiry";
import { sendEmail } from "@/lib/email/send";
import {
  expiringSoonEmail,
  gracePeriodEmail,
  downgradedEmail,
  planLabelFromUserPlan,
} from "@/lib/email/templates/subscription-expiry";
import { timingSafeEqualStr } from "@/lib/security/timing-safe-equal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_DEDUP_MS = 5 * 86_400_000; // 5 天內不重寄

interface UserRow {
  id: string;
  email: string | null;
  plan: string | null;
  subscription_expires_at: string | null;
  subscription_status: string | null;
  last_expiry_reminder_at: string | null;
}

function classify(
  expiresAtIso: string | null,
  now: number,
): "soon" | "grace" | "downgraded" | "none" {
  if (!expiresAtIso) return "none";
  const exp = new Date(expiresAtIso).getTime();
  const sevenDays = 7 * 86_400_000;
  if (exp > now && exp - now <= sevenDays) return "soon";
  if (exp <= now && now < exp + GRACE_PERIOD_MS) return "grace";
  if (now >= exp + GRACE_PERIOD_MS && now < exp + GRACE_PERIOD_MS + 86_400_000) {
    return "downgraded";
  }
  return "none";
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqualStr(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  // 範圍：到期前 7 天 ~ 到期後 grace+1 天，省下全表掃描
  const lowerBound = new Date(now - (GRACE_PERIOD_MS + 86_400_000)).toISOString();
  const upperBound = new Date(now + 7 * 86_400_000).toISOString();

  const { data: candidates, error } = await admin
    .from("users")
    .select(
      "id, email, plan, subscription_expires_at, subscription_status, last_expiry_reminder_at",
    )
    .not("plan", "in", "(free,lifetime)")
    .not("email", "is", null)
    .gte("subscription_expires_at", lowerBound)
    .lte("subscription_expires_at", upperBound);

  if (error) {
    console.error("[cron/expiry-reminder] select failed", error);
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  // 撈 user 對應的「最新 active 月扣 subscription」(ecpay_periodic_no 非 null)
  // 月扣會自動扣款、不需提醒；如果寄「即將到期」反而會觸發退訂念頭。
  const userIds = (candidates ?? []).map((u) => u.id);
  const monthlySubUserIds = new Set<string>();
  if (userIds.length) {
    const { data: subs } = await admin
      .from("subscriptions")
      .select("user_id, ecpay_periodic_no, status")
      .in("user_id", userIds)
      .eq("status", "active")
      .not("ecpay_periodic_no", "is", null);
    for (const s of subs ?? []) {
      if (s.user_id) monthlySubUserIds.add(s.user_id);
    }
  }

  const stats = { soon: 0, grace: 0, downgraded: 0, skipped: 0, skippedMonthly: 0, failed: 0 };

  for (const u of (candidates ?? []) as UserRow[]) {
    if (!u.email || !u.subscription_expires_at) continue;
    const kind = classify(u.subscription_expires_at, now);
    if (kind === "none") continue;

    // 月扣 active subscription + kind=soon → 跳過（會自動扣、不提醒避免觸發退訂）
    // grace / downgraded 一定要寄（扣款失敗才會進 grace、user 必須知道）
    if (kind === "soon" && monthlySubUserIds.has(u.id)) {
      stats.skippedMonthly++;
      continue;
    }

    // dedup：5 天內寄過就跳過（避免 cron 每天炮轟）
    if (
      u.last_expiry_reminder_at &&
      now - new Date(u.last_expiry_reminder_at).getTime() < REMINDER_DEDUP_MS
    ) {
      stats.skipped++;
      continue;
    }

    const planLabel = planLabelFromUserPlan(u.plan);
    let payload: { subject: string; text: string; html: string };
    if (kind === "soon") {
      const daysLeft = Math.max(
        1,
        Math.ceil(
          (new Date(u.subscription_expires_at).getTime() - now) / 86_400_000,
        ),
      );
      payload = expiringSoonEmail({
        planLabel,
        expiresAt: u.subscription_expires_at,
        daysLeft,
      });
    } else if (kind === "grace") {
      const graceDaysLeft = Math.max(
        1,
        Math.ceil(
          (new Date(u.subscription_expires_at).getTime() +
            GRACE_PERIOD_MS -
            now) /
            86_400_000,
        ),
      );
      payload = gracePeriodEmail({
        planLabel,
        expiresAt: u.subscription_expires_at,
        graceDaysLeft,
      });
    } else {
      // downgraded
      payload = downgradedEmail({
        planLabel,
        expiresAt: u.subscription_expires_at,
      });
    }

    const res = await sendEmail({
      to: u.email,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    if (res.ok) {
      stats[kind]++;
      await admin
        .from("users")
        .update({ last_expiry_reminder_at: new Date(now).toISOString() })
        .eq("id", u.id);
    } else {
      stats.failed++;
      console.warn("[cron/expiry-reminder] send failed", {
        email: u.email,
        error: res.error,
        kind,
      });
    }
  }

  console.log("[cron/expiry-reminder] done", stats);
  return NextResponse.json({ ok: true, ...stats });
}
