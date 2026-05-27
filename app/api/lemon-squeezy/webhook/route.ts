/**
 * POST /api/lemon-squeezy/webhook
 *
 * Lemon Squeezy webhook handler — 收 6 種事件，更新 Supabase。
 *
 * 安全：
 *   1. 簽章驗證（HMAC-SHA256 with LEMONSQUEEZY_WEBHOOK_SECRET）
 *   2. Idempotency 靠 lemonsqueezy_webhook_log.event_id unique 擋 replay
 *   3. 所有 DB 寫入走 service_role 繞 RLS（createAdminClient）
 *
 * 事件對應：
 *   order_created                    → lifetime / single-template 一次性付款 → payments + (subscriptions | template_unlocks | tool_unlocks)
 *   subscription_created             → 新訂閱 → subscriptions insert
 *   subscription_updated             → 方案變更 → subscriptions update
 *   subscription_cancelled           → 取消（仍可用到 expires_at）→ status='cancelled'
 *   subscription_payment_success     → 續扣成功 → payments insert + 延長 expires_at
 *   subscription_payment_failed      → 續扣失敗 → payments insert (status='failed')
 *
 * 一律回 200，避免 LS 重送（重送會被 idempotency 擋但浪費資源）。
 * 處理錯誤寫進 lemonsqueezy_webhook_log.processing_error 給 admin 看。
 */

import { type NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  extractEventId,
  type LemonWebhookPayload,
  verifyLemonWebhook,
} from "@/lib/lemon-squeezy/webhook";
import { lookupVariant } from "@/lib/lemon-squeezy/variant-map";
import { isSellableFurniture, isSellableTool } from "@/lib/lemon-squeezy/tier-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifyLemonWebhook(rawBody, signature)) {
    console.error("[ls/webhook] signature verify failed");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: LemonWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LemonWebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const admin = createAdminClient();
  const eventId = extractEventId(payload);
  const eventName = payload.meta.event_name;

  // Idempotency：先 insert log，UNIQUE conflict = 已處理過直接 200 走人
  const { error: logErr } = await admin
    .from("lemonsqueezy_webhook_log")
    .insert({
      event_id: eventId,
      event_name: eventName,
      raw_payload: payload,
    });

  if (logErr) {
    // unique violation = 23505 → replay，視為成功
    if (logErr.code === "23505") {
      return new Response("Duplicate event ignored", { status: 200 });
    }
    console.error("[ls/webhook] log insert failed", logErr);
    return new Response("Log insert failed", { status: 500 });
  }

  // 背景處理 + 寫 processed_at（讓 LS 拿到 200 不重送）
  after(async () => {
    try {
      await dispatchEvent(admin, payload);
      await admin
        .from("lemonsqueezy_webhook_log")
        .update({ processed_at: new Date().toISOString() })
        .eq("event_id", eventId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ls/webhook] processing failed", eventName, msg);
      await admin
        .from("lemonsqueezy_webhook_log")
        .update({ processing_error: msg })
        .eq("event_id", eventId);
    }
  });

  return new Response("OK", { status: 200 });
}

// ---------------------------------------------------------------------------
// Event dispatcher
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Supabase JS 的 query builder 不會 throw error，會把錯誤放在回傳物件 .error。
 * 不檢查就會 silent fail（log 標 OK 但 row 沒寫進去）。
 * 所有 DB 寫入都包這個 helper，有錯一律 throw 進 catch → 記到 processing_error。
 */
// supabase-js 的 query builder 是 thenable 但不是 Promise，用 PromiseLike 才能 await
type SupabaseResult = { error: { message: string; code?: string } | null };

async function mustOk<T extends SupabaseResult>(
  query: PromiseLike<T>,
  label: string,
): Promise<T> {
  const res = await query;
  if (res.error) {
    throw new Error(
      `[${label}] ${res.error.message} (code=${res.error.code ?? "?"})`,
    );
  }
  return res;
}

async function dispatchEvent(
  admin: AdminClient,
  payload: LemonWebhookPayload,
): Promise<void> {
  const { event_name } = payload.meta;
  switch (event_name) {
    case "order_created":
      return handleOrderCreated(admin, payload);
    case "subscription_created":
      return handleSubscriptionCreated(admin, payload);
    case "subscription_updated":
      return handleSubscriptionUpdated(admin, payload);
    case "subscription_cancelled":
      return handleSubscriptionCancelled(admin, payload);
    case "subscription_payment_success":
      return handleSubscriptionPaymentSuccess(admin, payload);
    case "subscription_payment_failed":
      return handleSubscriptionPaymentFailed(admin, payload);
    default:
      console.warn("[ls/webhook] unknown event", event_name);
  }
}

// ---------------------------------------------------------------------------
// order_created — Lifetime 或 Single Template 一次性付款
// ---------------------------------------------------------------------------

async function handleOrderCreated(
  admin: AdminClient,
  payload: LemonWebhookPayload,
): Promise<void> {
  const order = payload.data.attributes;
  const orderId = payload.data.id;
  const userEmail = order.user_email as string | undefined;
  const totalCents = order.total as number; // LS 用 cents

  // custom_data 在 meta（webhook 層）跟 first_order_item 內都可能有，先 meta 為主
  const custom = payload.meta.custom_data ?? {};
  const userId = custom.user_id;
  if (!userId) {
    throw new Error(`order_created: missing user_id in custom_data (order ${orderId})`);
  }

  // 從 first_order_item.variant_id 反查 variant kind
  const firstItem = (order.first_order_item ?? {}) as {
    variant_id?: number;
  };
  const variantId = firstItem.variant_id;
  if (!variantId) {
    throw new Error(`order_created: missing variant_id (order ${orderId})`);
  }
  const variant = lookupVariant(variantId);
  if (!variant) {
    throw new Error(`order_created: unknown variant ${variantId} (order ${orderId})`);
  }

  // 1. 寫 payments
  await mustOk(
    admin.from("payments").insert({
      user_id: userId,
      amount: Math.round(totalCents / 100), // 內部用整數塊（USD）
      status: "success",
      payment_provider: "lemonsqueezy",
      lemonsqueezy_order_id: orderId,
    }),
    "order_created.payments.insert",
  );

  // 2. 按 variant 種類開權限
  if (variant.kind === "lifetime") {
    // Lifetime → users.plan = 'lifetime'（或視 schema 改 subscriptions row）
    await mustOk(
      admin.from("users").update({ plan: "lifetime" }).eq("id", userId),
      "order_created.users.update.lifetime",
    );
  } else if (variant.kind === "single-template") {
    const templateId = custom.template_id;
    if (!templateId) {
      throw new Error(`single-template order missing template_id (order ${orderId})`);
    }
    // 判斷是 furniture 還是 tool
    if (isSellableFurniture(templateId)) {
      await mustOk(
        admin.from("template_unlocks").insert({
          user_id: userId,
          category: templateId,
          paid_amount: Math.round(totalCents / 100),
          payment_provider: "lemonsqueezy",
          lemonsqueezy_order_id: orderId,
        }),
        "order_created.template_unlocks.insert",
      );
    } else if (isSellableTool(templateId)) {
      await mustOk(
        admin.from("tool_unlocks").insert({
          user_id: userId,
          tool: templateId,
          paid_amount: Math.round(totalCents / 100),
          payment_provider: "lemonsqueezy",
          lemonsqueezy_order_id: orderId,
        }),
        "order_created.tool_unlocks.insert",
      );
    } else {
      throw new Error(`single-template order: unknown template_id "${templateId}"`);
    }
  } else if (variant.kind === "subscription") {
    // 訂閱透過 subscription_created 事件處理，這條 order 只記 payment
    console.log(`[ls/webhook] subscription order ${orderId} — wait for subscription_created`);
  }
}

// ---------------------------------------------------------------------------
// subscription_created — 新訂閱開通
// ---------------------------------------------------------------------------

async function handleSubscriptionCreated(
  admin: AdminClient,
  payload: LemonWebhookPayload,
): Promise<void> {
  const sub = payload.data.attributes;
  const subId = payload.data.id;
  const custom = payload.meta.custom_data ?? {};
  const userId = custom.user_id;
  if (!userId) {
    throw new Error(`subscription_created: missing user_id (sub ${subId})`);
  }

  const variantId = sub.variant_id as number;
  const variant = lookupVariant(variantId);
  if (!variant || variant.kind !== "subscription") {
    throw new Error(`subscription_created: variant ${variantId} not a subscription`);
  }

  const renewsAt = sub.renews_at as string; // ISO
  const startedAt = (sub.created_at as string) ?? new Date().toISOString();
  const orderId = sub.order_id as number | undefined;

  // ⚠️ subscriptions.started_at 是 NOT NULL 沒 default，漏給會 silent fail。
  await mustOk(
    admin.from("subscriptions").insert({
      user_id: userId,
      plan: variant.plan, // 'pro'
      period: variant.period === "yearly" ? "yearly" : "monthly",
      status: "active",
      started_at: startedAt,
      expires_at: renewsAt,
      payment_provider: "lemonsqueezy",
      lemonsqueezy_subscription_id: subId,
      lemonsqueezy_order_id: orderId ? String(orderId) : null,
    }),
    "subscription_created.subscriptions.insert",
  );

  // 同步 users.plan
  await mustOk(
    admin.from("users").update({ plan: variant.plan }).eq("id", userId),
    "subscription_created.users.update",
  );
}

// ---------------------------------------------------------------------------
// subscription_updated — 方案變更（如月→年）
// ---------------------------------------------------------------------------

async function handleSubscriptionUpdated(
  admin: AdminClient,
  payload: LemonWebhookPayload,
): Promise<void> {
  const sub = payload.data.attributes;
  const subId = payload.data.id;
  const variantId = sub.variant_id as number;
  const variant = lookupVariant(variantId);
  if (!variant || variant.kind !== "subscription") return;

  await mustOk(
    admin
      .from("subscriptions")
      .update({
        plan: variant.plan,
        period: variant.period === "yearly" ? "yearly" : "monthly",
        expires_at: sub.renews_at as string,
        status: sub.status as string, // active / paused / cancelled / expired
      })
      .eq("lemonsqueezy_subscription_id", subId),
    "subscription_updated.subscriptions.update",
  );
}

// ---------------------------------------------------------------------------
// subscription_cancelled — 取消（end-of-period）
// ---------------------------------------------------------------------------

async function handleSubscriptionCancelled(
  admin: AdminClient,
  payload: LemonWebhookPayload,
): Promise<void> {
  const subId = payload.data.id;
  const sub = payload.data.attributes;
  await mustOk(
    admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        // expires_at 保留：使用者付到 end of period 仍能用
        expires_at: sub.ends_at as string,
      })
      .eq("lemonsqueezy_subscription_id", subId),
    "subscription_cancelled.subscriptions.update",
  );
}

// ---------------------------------------------------------------------------
// subscription_payment_success — 續扣成功
// ---------------------------------------------------------------------------

async function handleSubscriptionPaymentSuccess(
  admin: AdminClient,
  payload: LemonWebhookPayload,
): Promise<void> {
  const invoice = payload.data.attributes;
  const subId = invoice.subscription_id as number;
  const userEmail = invoice.user_email as string | undefined;
  const totalCents = invoice.total as number;

  // 從 subscription 查回 user_id（webhook payload 沒帶）
  const { data: subRow } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("lemonsqueezy_subscription_id", String(subId))
    .single();

  if (!subRow) {
    throw new Error(`payment_success: subscription ${subId} not found in DB`);
  }

  await mustOk(
    admin.from("payments").insert({
      user_id: subRow.user_id,
      amount: Math.round(totalCents / 100),
      status: "success",
      payment_provider: "lemonsqueezy",
      lemonsqueezy_order_id: String(payload.data.id),
    }),
    "payment_success.payments.insert",
  );

  // 續扣後 renews_at 會在另一個 subscription_updated 事件帶來，這裡不主動延 expires_at
}

// ---------------------------------------------------------------------------
// subscription_payment_failed — 續扣失敗（卡片過期等）
// ---------------------------------------------------------------------------

async function handleSubscriptionPaymentFailed(
  admin: AdminClient,
  payload: LemonWebhookPayload,
): Promise<void> {
  const invoice = payload.data.attributes;
  const subId = invoice.subscription_id as number;

  const { data: subRow } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("lemonsqueezy_subscription_id", String(subId))
    .single();

  if (!subRow) return;

  await mustOk(
    admin.from("payments").insert({
      user_id: subRow.user_id,
      amount: Math.round((invoice.total as number) / 100),
      status: "failed",
      payment_provider: "lemonsqueezy",
      lemonsqueezy_order_id: String(payload.data.id),
    }),
    "payment_failed.payments.insert",
  );
  // TODO: 寄信通知使用者更新卡片
}
