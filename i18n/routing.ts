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
  // next-intl 內建 detection 關閉；我們改在 middleware.ts 手動實作
  // 智慧版（shouldRedirectToEn）：只對「沒選過語言 + Accept-Language 非 zh-*」的訪客
  // 從 `/` 跳到 `/en`，其他情況都保持 zh-TW（爬蟲、中文使用者、已選過語言的人）。
  // 2026-06-02 改：原本完全關掉（user「我要進 localhost:3000/ 不要 en」）造成
  // 英文行銷流量落到中文首頁秒跳走，所以開白名單式 detection。
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
