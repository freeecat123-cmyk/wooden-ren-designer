import type { MetadataRoute } from "next";
import { FURNITURE_CATALOG } from "@/lib/templates";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/app`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/calc/apron-tilt`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
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
  return [...staticRoutes, ...designRoutes];
}
