/**
 * Lemon Squeezy variant ID → 內部 plan / tier 對應表
 *
 * Variant IDs 來自 LS dashboard，KYC 通過後在 Live mode 重建，2026-05-31 反查取得：
 *   1726958 = Pro Monthly $9/mo
 *   1726982 = Pro Annual  $79/yr
 *   1726882 = Lifetime    $129
 *   1726939 = Single Template - Basic    $4.99
 *   1726943 = Single Template - Pro      $9.99
 *   1726949 = Single Template - Studio   $14.99
 *
 * 改 LS 商品時要同步更新這份 map，否則 webhook 收到 unknown variant 會 reject。
 *
 * 註：single payment 的 Default variant LS 預設 status=pending，checkout 不擋，屬正常行為。
 * Test mode 舊 variant IDs（供 reference，不會再用）：
 *   1711162 / 1711129 = Pro Monthly / Annual (test)
 *   1711186 = Lifetime (test)
 *   1711234 / 1711230 / 1711235 = Single Template Basic/Pro/Studio (test)
 *   1711170 = test mode orphan variant，Live mode 沒有
 */

import type { TemplateTier } from "./tier-map";

export type LemonProduct =
  | { kind: "subscription"; plan: "pro"; period: "monthly" | "yearly" }
  | { kind: "lifetime" }
  | { kind: "single-template"; tier: TemplateTier };

/** LS variant ID (string) → 內部 product 表示 */
const VARIANT_MAP: Record<string, LemonProduct> = {
  "1726958": { kind: "subscription", plan: "pro", period: "monthly" },
  "1726982": { kind: "subscription", plan: "pro", period: "yearly" },
  "1726882": { kind: "lifetime" },
  "1726939": { kind: "single-template", tier: "basic" },
  "1726943": { kind: "single-template", tier: "pro" },
  "1726949": { kind: "single-template", tier: "studio" },
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
