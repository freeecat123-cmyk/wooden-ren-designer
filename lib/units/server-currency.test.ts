import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ locale: "zh-TW", currency: "USD" }));
vi.mock("next-intl/server", () => ({ getLocale: async () => state.locale }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => key === "wr-currency" ? { value: state.currency } : undefined }) }));
import { getCurrencyFromCookies } from "./server-currency";
afterEach(() => { state.locale = "zh-TW"; state.currency = "USD"; });
it("keeps Chinese server quotes in TWD even with a stale USD cookie", async () => {
  expect(await getCurrencyFromCookies()).toBe("TWD");
});
it("keeps English server quotes in USD even with a stale TWD cookie", async () => {
  state.locale = "en"; state.currency = "TWD";
  expect(await getCurrencyFromCookies()).toBe("USD");
});
it("retains cookie fallback for future locales without a fixed currency", async () => {
  state.locale = "ja";
  expect(await getCurrencyFromCookies()).toBe("USD");
});
