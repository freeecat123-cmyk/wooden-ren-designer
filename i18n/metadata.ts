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
