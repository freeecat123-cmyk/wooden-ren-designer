/**
 * GET /api/cron/lifecycle-emails
 *   Vercel Cron daily 02:00 UTC — 生命週期自動信（新註冊 d1/d3/d7、舊免費用戶回訪、到期回流、
 *   買後要照片、結帳沒付追信、看過付費範本沒買）。
 *
 * 規則見 lib/email/lifecycle-rules.ts；內文見 lib/email/templates/lifecycle.ts。
 * 寄送紀錄寫 lifecycle_emails（每人每 key 一筆，unique 約束兜底不重寄；
 * viewed_template 的 key 存成 viewed_template_<category>）。
 *
 * 總開關：env LIFECYCLE_EMAILS_ENABLED=1 才寄，沒設回 {skipped:true}。
 * ?dry=1：只回「會寄給誰」的統計，不寄、不寫表（開關沒開也能 dry）。
 *
 * Auth：Bearer CRON_SECRET（同 expiry-reminder）。
 */
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import {
  lifecycleEmail,
  parseSendKey,
  type LifecycleEmailKey,
  type LifecycleSendKey,
  type LifecycleVars,
} from "@/lib/email/templates/lifecycle";
import { pickLifecycleEmail, type LifecycleUser, type TemplateView } from "@/lib/email/lifecycle-rules";
import { TEMPLATE_HINTS } from "@/lib/email/template-hints";
import { getUnlockPrice } from "@/lib/pricing/template-unlock";
import { CATEGORY_LABELS } from "@/lib/templates/labels";
import type { FurnitureCategory } from "@/lib/types";
import { timingSafeEqualStr } from "@/lib/security/timing-safe-equal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 比照 expiry-reminder：Vercel 60s 內安全、Resend 速率留 buffer。
const MAX_PER_RUN = 200;
const SEND_INTERVAL_MS = 150;
const DAY = 86_400_000;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Stats = Record<LifecycleEmailKey, number> & {
  failed: number;
  capped: number;
  candidates: number;
};

function maxIso(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/** 從 pending payment 的 raw_response 推「他要買的那頁」 */
function checkoutLinkFromRaw(raw: unknown): string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const kind = typeof r.kind === "string" ? r.kind : "";
  if (kind === "template_unlock" && typeof r.category === "string" && r.category) {
    return `${SITE_URL}/design/${r.category}`;
  }
  if (kind === "tool_unlock" && typeof r.tool === "string" && r.tool) {
    return `${SITE_URL}/${r.tool}`;
  }
  return `${SITE_URL}/pricing`;
}

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

  // 全部有 email 的人（post_purchase_photo 要寄給付費的人；free-only 的門檻在規則函式裡）
  const { data: users, error } = await admin
    .from("users")
    .select("id, email, plan, subscription_status, created_at")
    .not("email", "is", null)
    .limit(5000);
  if (error) {
    console.error("[cron/lifecycle-emails] select users failed", error);
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  const list = (users ?? []) as (LifecycleUser & { name?: string | null })[];
  const ids = list.map((u) => u.id);

  // 輔助表一次撈完，in-memory 組 context（用戶 ~數百人，不做分頁）
  const designUsers = new Set<string>();
  const subUsers = new Set<string>();
  const lastEnded = new Map<string, string>();
  const sentMap = new Map<string, Partial<Record<LifecycleSendKey, string>>>();
  const lastPurchase = new Map<string, string>();
  const lastPending = new Map<string, { at: string; raw: unknown }>();
  const viewsMap = new Map<string, TemplateView[]>();
  const unlockedMap = new Map<string, string[]>();
  if (ids.length) {
    const sinceViews = new Date(now - 11 * DAY).toISOString();
    const sincePending = new Date(now - 4 * DAY).toISOString();
    const [
      { data: designs },
      { data: subs },
      { data: sent },
      { data: paidRows },
      { data: pendingRows },
      { data: tplUnlocks },
      { data: toolUnlocks },
      { data: views, error: viewsErr },
    ] = await Promise.all([
      admin.from("designs").select("user_id").in("user_id", ids),
      admin.from("subscriptions").select("user_id, status, expires_at").in("user_id", ids),
      admin.from("lifecycle_emails").select("user_id, email_key, sent_at").in("user_id", ids),
      admin.from("payments").select("user_id, created_at").eq("status", "success").in("user_id", ids),
      admin
        .from("payments")
        .select("user_id, created_at, raw_response")
        .eq("status", "pending")
        .gte("created_at", sincePending)
        .in("user_id", ids),
      admin.from("template_unlocks").select("user_id, category, created_at").in("user_id", ids),
      admin.from("tool_unlocks").select("user_id, created_at").in("user_id", ids),
      admin
        .from("template_views")
        .select("user_id, category, viewed_at")
        .gte("viewed_at", sinceViews)
        .in("user_id", ids),
    ]);
    if (viewsErr) {
      // 表還沒建（migration 未 apply）就只是少了 viewed_template 這類，不擋其他信
      console.warn("[cron/lifecycle-emails] template_views unavailable", viewsErr.message);
    }
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
      m[r.email_key as LifecycleSendKey] = r.sent_at;
      sentMap.set(r.user_id, m);
    }
    for (const p of paidRows ?? []) {
      if (p.user_id) lastPurchase.set(p.user_id, maxIso(lastPurchase.get(p.user_id), p.created_at) as string);
    }
    for (const t of tplUnlocks ?? []) {
      if (!t.user_id) continue;
      lastPurchase.set(t.user_id, maxIso(lastPurchase.get(t.user_id), t.created_at) as string);
      if (t.category) unlockedMap.set(t.user_id, [...(unlockedMap.get(t.user_id) ?? []), t.category]);
    }
    for (const t of toolUnlocks ?? []) {
      if (t.user_id) lastPurchase.set(t.user_id, maxIso(lastPurchase.get(t.user_id), t.created_at) as string);
    }
    for (const p of pendingRows ?? []) {
      if (!p.user_id) continue;
      const prev = lastPending.get(p.user_id);
      if (!prev || new Date(p.created_at) > new Date(prev.at)) {
        lastPending.set(p.user_id, { at: p.created_at, raw: p.raw_response });
      }
    }
    for (const v of views ?? []) {
      if (!v.user_id || !v.category) continue;
      viewsMap.set(v.user_id, [...(viewsMap.get(v.user_id) ?? []), { category: v.category, viewedAt: v.viewed_at }]);
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
    post_purchase_photo: 0, checkout_abandoned: 0, viewed_template: 0,
    failed: 0, capped: 0, candidates: list.length,
  };
  let sentThisRun = 0;

  for (const u of list) {
    const sendKey = pickLifecycleEmail(u, {
      now,
      hasDesign: designUsers.has(u.id),
      hasAnySubscription: subUsers.has(u.id),
      lastEndedSubscriptionExpiresAt: lastEnded.get(u.id) ?? null,
      sent: sentMap.get(u.id) ?? {},
      lastPurchaseAt: lastPurchase.get(u.id) ?? null,
      lastPendingCheckoutAt: lastPending.get(u.id)?.at ?? null,
      templateViews: viewsMap.get(u.id) ?? [],
      unlockedCategories: unlockedMap.get(u.id) ?? [],
    });
    if (!sendKey) continue;
    const { key, category } = parseSendKey(sendKey);
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
      .insert({ user_id: u.id, email_key: sendKey, sent_at: new Date(now).toISOString() });
    if (insErr) {
      console.warn("[cron/lifecycle-emails] dedup insert failed (skip)", { user: u.id, key: sendKey, err: insErr.message });
      continue;
    }

    const vars: LifecycleVars = {};
    if (key === "checkout_abandoned") {
      vars.link = checkoutLinkFromRaw(lastPending.get(u.id)?.raw);
    } else if (key === "viewed_template" && category) {
      vars.category = category;
      vars.label = CATEGORY_LABELS[category as FurnitureCategory] ?? category;
      vars.hint = TEMPLATE_HINTS[category];
      vars.price = getUnlockPrice(category);
      vars.link = `${SITE_URL}/design/${category}`;
    }
    const payload = lifecycleEmail(key, { name: nameMap.get(u.id), vars });
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
      await admin.from("lifecycle_emails").delete().eq("user_id", u.id).eq("email_key", sendKey);
      console.warn("[cron/lifecycle-emails] send failed", { email: u.email, key: sendKey, error: res.error });
    }
    sentThisRun++;
    await sleep(SEND_INTERVAL_MS);
  }

  console.log("[cron/lifecycle-emails] done", { dry, ...stats });
  return NextResponse.json({ ok: true, dry, ...stats });
}
