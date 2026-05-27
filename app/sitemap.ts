import type { MetadataRoute } from "next";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { FEATURED_TEMPLATE_CATEGORIES } from "@/lib/templates/marketing";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

// Phase 1：sitemap 只列 zh-TW URLs。/en/* URL 在 Phase 2 行銷頁完成英譯後才加上
// hreflang alternates 並一起 emit，避免目前 Google 看到重複中文內容。

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/app`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/templates`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/calc/apron-tilt`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // 裝潢工具(訪客可看銷售頁,登入有權限直進工具)— SEO 入口頁優先級對齊家具介紹頁
    { url: `${BASE}/ceiling`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/floor`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/raised-floor`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
  ];
  // 開發中家具不收錄到 sitemap（避免 Google 收錄到不能用的頁）
  const DEV_CATEGORIES = new Set(["chinese-cabinet", "bed", "coat-rack"]);
  const designRoutes: MetadataRoute.Sitemap = FURNITURE_CATALOG
    .filter((e) => !DEV_CATEGORIES.has(e.category))
    .map((e) => ({
      url: `${BASE}/design/${e.category}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    }));
  // /templates/[type] 介紹頁（主力 10 模板）— SEO 入口頁，優先級拉高
  const templateRoutes: MetadataRoute.Sitemap = FEATURED_TEMPLATE_CATEGORIES
    .map((c) => ({
      url: `${BASE}/templates/${c}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    }));
  return [...staticRoutes, ...templateRoutes, ...designRoutes];
}
