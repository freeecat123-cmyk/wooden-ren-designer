/**
 * Currency conversion (FX).
 *
 * One fixed rate, baked into the codebase. NOT a live API.
 * Update manually when the underlying spot rate drifts enough to matter
 * (subscription pricing 390/890 TWD ≈ $12.19 / $27.81 USD at 32:1).
 *
 * Exposed as a `const` rather than a function so that SSR + Edge runtime
 * code paths can read it without any `await` ceremony — every consumer
 * (server JSON-LD, client formatters, server quote rendering) uses the
 * exact same number.
 */

import type { CurrencyPref } from "@/lib/geo-defaults";

export const TWD_PER_USD = 32; // fixed FX, manual update when material

export function convertTwdToUsd(twd: number): number {
  return twd / TWD_PER_USD;
}

/**
 * Universal price formatter.
 *
 *  - TWD: integer NT$ (no fractional cents — woodworking quotes round to dollar)
 *  - USD: 2-decimal $ (Intl USD currency style)
 *
 * Use this anywhere a user-visible price is rendered. Subscription CTA,
 * quote totals, JSON-LD Offer.price are all the same code path.
 */
export function formatPrice(twd: number, currency: CurrencyPref): string {
  if (currency === "USD") {
    const usd = convertTwdToUsd(twd);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(usd);
  }
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(twd));
}

/**
 * Returns the raw numeric value (no currency symbol) in the target currency.
 * For JSON-LD Offer.price which wants `"12.19"` separate from priceCurrency.
 */
export function priceAmount(twd: number, currency: CurrencyPref): string {
  if (currency === "USD") {
    return convertTwdToUsd(twd).toFixed(2);
  }
  return String(Math.round(twd));
}
