import type { MetadataRoute } from "next";
import { FURNITURE_CATALOG , isDevCategory } from "@/lib/templates";
import { FEATURED_TEMPLATE_CATEGORIES, FEATURED_TEMPLATE_CATEGORIES_EN } from "@/lib/templates/marketing";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

/**
 * Sitemap with hreflang alternates for zh-TW (default, no prefix) and /en/*.
 *
 * Routes available on both locales: /, /app, /templates, /about, /pricing, /help,
 * /contact, /ceiling, /floor, /raised-floor, /design/[type] for non-dev categories.
 * Listed with `alternates.languages` so Google knows they're translated equivalents.
 *
 * zh-only routes (still emitted; not listed under /en):
 *  - /templates/[type]/* — marketing.ts not yet translated; /en notFound()s
 *  - /pricing/student — TW academy plan
 *  - /calc/apron-tilt — not localized
 *  - /changelog
 */

const TW_ONLY_ROUTES = ["calc/apron-tilt", "changelog"];

/**
 * 雙語頁面 → **回傳兩筆**(中文一筆、英文一筆),共用同一份 languages 對照。
 *
 * ⛔ 原本只回一筆(url 固定是中文版),英文版只出現在 `<xhtml:link rel="alternate">` 裡、
 *    **沒有自己的 `<loc>`**。實測正式站:sitemap 共 62 個 `<loc>`,`/en` 開頭的是 **0 個**
 *    —— 整個英文站從來沒有一個網址被提交給 Google。
 *    (Pinterest 主打的就是 designer.woodenren.com/en,搜尋那條腿等於沒接上。)
 *
 * ⚠️ 首頁的英文版是 `/en` 不是 `/en/`:實測 `/en/` 會 **308 轉址**到 `/en`,
 *    sitemap 若寫成有尾斜線的版本,hreflang 的回鏈就對不起來
 *    (layout.tsx 宣告的是沒有尾斜線的)。這裡跟 i18n/metadata.ts 的
 *    bilingualAlternates 用同一個判斷,避免兩邊各寫一份而漂移。
 */
function biLocaleEntry(
  path: string,
  changeFrequency: "weekly" | "monthly" = "monthly",
  priority = 0.8,
  lastModified: Date = new Date(),
): MetadataRoute.Sitemap {
  const zhUrl = `${BASE}${path}`;
  const enUrl = path === "/" ? `${BASE}/en` : `${BASE}/en${path}`;
  const languages = {
    "zh-TW": zhUrl,
    en: enUrl,
    "x-default": zhUrl,
  };
  return [
    { url: zhUrl, lastModified, changeFrequency, priority, alternates: { languages } },
    { url: enUrl, lastModified, changeFrequency, priority, alternates: { languages } },
  ];
}

function twOnlyEntry(
  path: string,
  changeFrequency: "weekly" | "monthly" = "monthly",
  priority = 0.6,
  lastModified: Date = new Date(),
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // ⚠️ biLocaleEntry 現在回傳「兩筆」(中/英各一),所以這裡要 flat() 攤平
  const staticRoutes: MetadataRoute.Sitemap = [
    biLocaleEntry("/", "weekly", 1, now),
    biLocaleEntry("/app", "weekly", 0.95, now),
    biLocaleEntry("/templates", "weekly", 0.95, now),
    biLocaleEntry("/about", "monthly", 0.9, now),
    biLocaleEntry("/pricing", "monthly", 0.9, now),
    biLocaleEntry("/ceiling", "monthly", 0.85, now),
    biLocaleEntry("/floor", "monthly", 0.85, now),
    biLocaleEntry("/raised-floor", "monthly", 0.85, now),
    biLocaleEntry("/cnc", "monthly", 0.85, now),
    biLocaleEntry("/install", "monthly", 0.6, now),
    biLocaleEntry("/help", "monthly", 0.5, now),
    biLocaleEntry("/contact", "monthly", 0.5, now),
  ].flat();

  const twOnlyRoutes: MetadataRoute.Sitemap = TW_ONLY_ROUTES.map((path) =>
    twOnlyEntry(`/${path}`, "monthly", path === "changelog" ? 0.4 : 0.85, now),
  );

  // 開發中家具不收錄(名單見 lib/templates 的 DEV_CATEGORIES,單一真相來源)
  const designRoutes: MetadataRoute.Sitemap = FURNITURE_CATALOG
    .filter((e) => !isDevCategory(e.category))
    .flatMap((e) => biLocaleEntry(`/design/${e.category}`, "monthly", 0.8, now));

  // /templates/[type]/* — bilingual when EN marketing exists; otherwise zh-only
  const enTemplateSet = new Set(FEATURED_TEMPLATE_CATEGORIES_EN as string[]);
  const templateRoutes: MetadataRoute.Sitemap = FEATURED_TEMPLATE_CATEGORIES.flatMap((c) =>
    enTemplateSet.has(c as string)
      ? biLocaleEntry(`/templates/${c}`, "monthly", 0.85, now)
      : [twOnlyEntry(`/templates/${c}`, "monthly", 0.85, now)],
  );

  return [...staticRoutes, ...twOnlyRoutes, ...templateRoutes, ...designRoutes];
}
