/**
 * Per-request locale + messages provider for next-intl.
 *
 * Called by next-intl's plugin (next.config.ts) on every server request.
 * Loads the correct messages JSON based on the resolved locale from the URL.
 */
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
