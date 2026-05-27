import type { MetadataRoute } from "next";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { FEATURED_TEMPLATE_CATEGORIES, FEATURED_TEMPLATE_CATEGORIES_EN } from "@/lib/templates/marketing";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

/**
 * Sitemap with hreflang alternates for zh-TW (default, no prefix) and /en/*.
 *
 * Routes available on both locales: /, /app, /templates, /about, /pricing, /help,
 * /contact, /design/[type] for non-dev categories. Listed with `alternates.languages`
 * so Google knows they're translated equivalents.
 *
 * zh-only routes (still emitted; not listed under /en):
 *  - /templates/[type]/* — marketing.ts not yet translated; /en notFound()s
 *  - /pricing/student — TW academy plan
 *  - /ceiling /floor /raised-floor — TW construction tools
 *  - /calc/apron-tilt — not localized
 *  - /changelog
 */

const TW_ONLY_ROUTES = ["calc/apron-tilt", "ceiling", "floor", "raised-floor", "changelog"];

function biLocaleEntry(
  path: string,
  changeFrequency: "weekly" | "monthly" = "monthly",
  priority = 0.8,
  lastModified: Date = new Date(),
): MetadataRoute.Sitemap[number] {
  const zhUrl = `${BASE}${path}`;
  const enUrl = `${BASE}/en${path}`;
  return {
    url: zhUrl,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: {
        "zh-TW": zhUrl,
        en: enUrl,
        "x-default": zhUrl,
      },
    },
  };
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
  const staticRoutes: MetadataRoute.Sitemap = [
    biLocaleEntry("/", "weekly", 1, now),
    biLocaleEntry("/app", "weekly", 0.95, now),
    biLocaleEntry("/templates", "weekly", 0.95, now),
    biLocaleEntry("/about", "monthly", 0.9, now),
    biLocaleEntry("/pricing", "monthly", 0.9, now),
    biLocaleEntry("/help", "monthly", 0.5, now),
    biLocaleEntry("/contact", "monthly", 0.5, now),
  ];

  const twOnlyRoutes: MetadataRoute.Sitemap = TW_ONLY_ROUTES.map((path) =>
    twOnlyEntry(`/${path}`, "monthly", path === "changelog" ? 0.4 : 0.85, now),
  );

  // 開發中家具不收錄
  const DEV_CATEGORIES = new Set(["chinese-cabinet", "bed", "coat-rack"]);
  const designRoutes: MetadataRoute.Sitemap = FURNITURE_CATALOG
    .filter((e) => !DEV_CATEGORIES.has(e.category))
    .map((e) => biLocaleEntry(`/design/${e.category}`, "monthly", 0.8, now));

  // /templates/[type]/* — bilingual when EN marketing exists; otherwise zh-only
  const enTemplateSet = new Set(FEATURED_TEMPLATE_CATEGORIES_EN as string[]);
  const templateRoutes: MetadataRoute.Sitemap = FEATURED_TEMPLATE_CATEGORIES.map((c) =>
    enTemplateSet.has(c as string)
      ? biLocaleEntry(`/templates/${c}`, "monthly", 0.85, now)
      : twOnlyEntry(`/templates/${c}`, "monthly", 0.85, now),
  );

  return [...staticRoutes, ...twOnlyRoutes, ...templateRoutes, ...designRoutes];
}
