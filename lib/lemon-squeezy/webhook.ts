/**
 * Lemon Squeezy webhook 簽章驗證 + event payload types
 *
 * LS 用 HMAC-SHA256(signing_secret, raw_body) 算簽章，放在 header `X-Signature`。
 * 必須在 parse JSON 前用 raw body 算簽章，否則 \n 跟空白被 JSON.parse 吃掉會驗失敗。
 *
 * 6 種我們會收到的 events：
 *   order_created            一次性付款（lifetime / single-template）成立
 *   subscription_created     訂閱開通
 *   subscription_updated     訂閱方案變更（升降級）
 *   subscription_cancelled   訂閱被取消（end of period 仍可用到 expires_at）
 *   subscription_payment_success  每期扣款成功
 *   subscription_payment_failed   每期扣款失敗（卡片過期等）
 */

import { createHmac, timingSafeEqual } from "crypto";
import { LEMONSQUEEZY_WEBHOOK_SECRET } from "./config";

export type LemonEventName =
  | "order_created"
  | "subscription_created"
  | "subscription_updated"
  | "subscription_cancelled"
  | "subscription_payment_success"
  | "subscription_payment_failed";

/** webhook header meta（LS 放在 `meta` 區塊） */
export interface LemonWebhookMeta {
  event_name: LemonEventName;
  custom_data?: Record<string, string>;
}

export interface LemonWebhookPayload {
  meta: LemonWebhookMeta;
  data: {
    type: string;
    id: string;
    attributes: Record<string, unknown>;
  };
}

/**
 * 驗證 webhook 簽章。回 true 才能信任 body。
 * @param rawBody 原始 request body string（不能先 parse JSON）
 * @param signature header 裡的 `X-Signature` 值
 */
export function verifyLemonWebhook(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature || !LEMONSQUEEZY_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", LEMONSQUEEZY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

/** 抽出 LS event 在 webhook log 表用的 unique key（idempotency） */
export function extractEventId(payload: LemonWebhookPayload): string {
  // LS payload 沒有獨立的 event_id；用 event_name + resource.id + (renew_at | created_at)
  // 組合當 idempotency key
  const a = payload.data.attributes as Record<string, unknown>;
  const stamp =
    (a.updated_at as string) ?? (a.created_at as string) ?? Date.now();
  return `${payload.meta.event_name}:${payload.data.id}:${stamp}`;
}
