/**
 * Per-page metadata helpers for next-intl pages.
 *
 * Why: Next.js metadata uses shallow merge for `alternates` — once a page
 * defines `alternates: { canonical }`, the layout's `alternates.languages`
 * gets clobbered, so Google sees no hreflang for that URL.
 *
 * Usage:
 *   alternates: bilingualAlternates("/about", locale)
 */

import { routing } from "./routing";

/** Returns canonical + languages for hreflang. `path` should be locale-stripped
 *  ("/about", "/templates/stool"). Uses zh-TW as x-default. */
export function bilingualAlternates(path: string, locale: string) {
  const zhPath = path;
  const enPath = path === "/" ? "/en" : `/en${path}`;
  const canonical = locale === routing.defaultLocale ? zhPath : enPath;
  return {
    canonical,
    languages: {
      "zh-TW": zhPath,
      en: enPath,
      "x-default": zhPath,
    },
  };
}

/**
 * 組出「給瀏覽器實際導覽用」的路徑 —— 預設語系**不加前綴**。
 *
 * ⛔ 表單的 action 以前寫死 `/${locale}/...`,但 `i18n/routing.ts` 設的是
 *    `localePrefix: "as-needed"`(zh-TW 不帶前綴)→ 台灣使用者拿到的是 `/zh-TW/design/stool`,
 *    而 DesignFormShell 每次 debounce 都 `router.replace(action + "?" + params)`,
 *    等於**每動一次參數就多吃一次 307 轉址**。桌面拖滑桿時每一格都多一趟往返。
 *    (2026-08-21 稽核發現。)
 *
 * ⚠️ 這支是給 **action / router.replace** 用的;`<Link>` 走 next-intl 的 navigation
 *    已經自己處理前綴,不要重複套。
 */
export function localePath(path: string, locale: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === routing.defaultLocale ? clean : `/${locale}${clean}`;
}
