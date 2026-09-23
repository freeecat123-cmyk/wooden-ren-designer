/**
 * Lemon Squeezy Checkout URL builder
 *
 * 兩種寫法：
 *   1. Hosted checkout URL（簡單，用 variant 的 buy_now_url + custom_data 帶參數）
 *   2. Checkout API（建立 checkout session 拿 unique URL，可預填 email/name + 完整 custom_data）
 *
 * 走 API 模式（#2），因為要：
 *   - 預填 Supabase user email（顧客 checkout 時不用再打字）
 *   - 帶 user_id / template_id / tier 進 custom_data（webhook 對帳用）
 *   - 設 success/cancel URL 回到 /[locale]/account
 */

import { lemonSqueezy } from "./client";
import { LEMONSQUEEZY_STORE_ID } from "./config";
import {
  variantIdForLifetime,
  variantIdForSubscription,
  variantIdForTier,
} from "./variant-map";
import type { TemplateTier } from "./tier-map";

/** webhook 對帳時會從 order.attributes.first_order_item.custom_data 拿到 */
export interface CheckoutCustomData {
  /** Supabase auth.users.id — 一定要帶，webhook 用這個對人 */
  user_id: string;
  /** 單模板買斷時填 furniture category 或 tool id */
  template_id?: string;
  /** 內部 tier 標記，跟 variant 對驗用 */
  tier?: TemplateTier;
  /** 訂閱方案，'pro' 等 */
  plan?: string;
  /** locale 來源，方便 webhook 寄信時挑語言 */
  locale?: string;
}

interface CreateCheckoutOptions {
  variantId: string;
  /** 預填 LS checkout 表單的 email（顧客可改） */
  customerEmail?: string;
  /** 預填顧客名字 */
  customerName?: string;
  /** 付款後跳回的 success URL（user app 端）；不填走 LS 預設 thank-you */
  successUrl?: string;
  customData: CheckoutCustomData;
}

/**
 * 建 LS Checkout session，回傳 checkout URL（顧客導向去刷卡）。
 * Doc: https://docs.lemonsqueezy.com/api/checkouts/create-checkout
 */
export async function createLemonCheckout(
  opts: CreateCheckoutOptions,
): Promise<string> {
  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: opts.customerEmail,
          name: opts.customerName,
          custom: opts.customData,
        },
        product_options: opts.successUrl
          ? { redirect_url: opts.successUrl }
          : undefined,
        checkout_options: {
          embed: false,
          media: false,
          logo: true,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: LEMONSQUEEZY_STORE_ID } },
        variant: { data: { type: "variants", id: opts.variantId } },
      },
    },
  };

  const res = await lemonSqueezy.post<{
    data: { attributes: { url: string } };
  }>("/checkouts", payload);

  return res.data.attributes.url;
}

/** 訂閱方案 checkout（pro monthly / yearly） */
export async function createSubscriptionCheckout(
  period: "monthly" | "yearly",
  opts: Omit<CreateCheckoutOptions, "variantId">,
): Promise<string> {
  const variantId = variantIdForSubscription("pro", period);
  if (!variantId) {
    throw new Error(`LS variant for pro ${period} not configured in variant-map.ts`);
  }
  return createLemonCheckout({
    ...opts,
    variantId,
    customData: { ...opts.customData, plan: "pro" },
  });
}

/** Lifetime 買斷 checkout */
export async function createLifetimeCheckout(
  opts: Omit<CreateCheckoutOptions, "variantId">,
): Promise<string> {
  const variantId = variantIdForLifetime();
  if (!variantId) {
    throw new Error(`LS variant for lifetime not configured in variant-map.ts`);
  }
  return createLemonCheckout({ ...opts, variantId });
}

/** 單模板買斷 checkout（按 tier 找 variant） */
export async function createSingleTemplateCheckout(
  tier: TemplateTier,
  templateId: string,
  opts: Omit<CreateCheckoutOptions, "variantId">,
): Promise<string> {
  const variantId = variantIdForTier(tier);
  if (!variantId) {
    throw new Error(`LS variant for tier ${tier} not configured in variant-map.ts`);
  }
  return createLemonCheckout({
    ...opts,
    variantId,
    customData: { ...opts.customData, template_id: templateId, tier },
  });
}
