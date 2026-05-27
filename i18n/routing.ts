/**
 * next-intl routing config — single source of truth for locales.
 *
 * localePrefix: 'as-needed' = default locale (zh-TW) URL has NO prefix
 *   (stays at `/...`), non-default locale gets prefix (`/en/...`).
 *
 * This keeps zh-TW SEO权重不被分散到 /zh-TW/* 路徑，並向後相容所有
 * 既有的 `/about`、`/pricing`、`/design/...` URL。
 */
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-TW", "en"] as const,
  defaultLocale: "zh-TW",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
