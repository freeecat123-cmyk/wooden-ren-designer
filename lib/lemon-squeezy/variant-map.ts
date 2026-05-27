/**
 * Lemon Squeezy variant ID → 內部 plan / tier 對應表
 *
 * Variant IDs 來自 LS dashboard（用 API 反查取得，2026-05-27 建立）：
 *   1711162 = Pro Monthly $9/mo
 *   1711129 = Pro Annual  $79/yr
 *   1711186 = Lifetime    $129
 *   1711234 = Single Template - Basic    $4.99
 *   1711230 = Single Template - Pro      $9.99
 *   1711235 = Single Template - Studio   $14.99
 *   1711170 = ⚠️ orphan，subscription product 上多出一個 $9.99 single payment，建議 dashboard 清掉
 *
 * 改 LS 商品時要同步更新這份 map，否則 webhook 收到 unknown variant 會 reject。
 */

import type { TemplateTier } from "./tier-map";

export type LemonProduct =
  | { kind: "subscription"; plan: "pro"; period: "monthly" | "yearly" }
  | { kind: "lifetime" }
  | { kind: "single-template"; tier: TemplateTier };

/** LS variant ID (string) → 內部 product 表示 */
const VARIANT_MAP: Record<string, LemonProduct> = {
  "1711162": { kind: "subscription", plan: "pro", period: "monthly" },
  "1711129": { kind: "subscription", plan: "pro", period: "yearly" },
  "1711186": { kind: "lifetime" },
  "1711234": { kind: "single-template", tier: "basic" },
  "1711230": { kind: "single-template", tier: "pro" },
  "1711235": { kind: "single-template", tier: "studio" },
};

/** 反向查：給定 product 表示 → 找對應 LS variant ID（checkout URL builder 用） */
const REVERSE_MAP = new Map<string, string>(
  Object.entries(VARIANT_MAP).map(([id, p]) => [productKey(p), id]),
);

function productKey(p: LemonProduct): string {
  if (p.kind === "subscription") return `sub:${p.plan}:${p.period}`;
  if (p.kind === "lifetime") return "lifetime";
  return `tier:${p.tier}`;
}

export function lookupVariant(variantId: string | number): LemonProduct | null {
  return VARIANT_MAP[String(variantId)] ?? null;
}

export function variantIdForSubscription(
  plan: "pro",
  period: "monthly" | "yearly",
): string | null {
  return REVERSE_MAP.get(`sub:${plan}:${period}`) ?? null;
}

export function variantIdForLifetime(): string | null {
  return REVERSE_MAP.get("lifetime") ?? null;
}

export function variantIdForTier(tier: TemplateTier): string | null {
  return REVERSE_MAP.get(`tier:${tier}`) ?? null;
}
