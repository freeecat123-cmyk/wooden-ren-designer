/**
 * Per-request locale + messages provider for next-intl.
 *
 * Called by next-intl's plugin (next.config.ts) on every server request.
 * Loads the correct messages JSON based on the resolved locale from the URL.
 *
 * 中性品牌網域（lib/brand-hosts.ts 的 NEUTRAL_HOSTS）：整包 messages 深層跑一次
 * neutralizeMessages，把 Wooden Ren / woodenren.com 等字樣換成 Furniture Blueprints。
 * 主站完全不經過這段（原樣回傳 JSON）。
 */
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { routing } from "./routing";
import { brandFromHeaders, neutralOrigin, normalizeHost } from "@/lib/brand-hosts";
import { neutralizeMessages } from "@/lib/brand-text";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  // headers() 在少數非請求情境（build 時的靜態產生）會丟錯 → 一律當主站
  let neutral = false;
  let host: string | null = null;
  try {
    const h = await headers();
    neutral = brandFromHeaders(h) === "neutral";
    host = h.get("host");
  } catch {
    neutral = false;
  }

  return {
    locale,
    messages: neutral ? neutralizeMessages(messages, neutralOrigin(normalizeHost(host))) : messages,
  };
});
