import type { MetadataRoute } from "next";
import { FURNITURE_CATALOG } from "@/lib/templates";

const BASE = "https://wooden-ren-designer.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/calc/apron-tilt`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
  const designRoutes: MetadataRoute.Sitemap = FURNITURE_CATALOG.map((e) => ({
    url: `${BASE}/design/${e.category}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  return [...staticRoutes, ...designRoutes];
}
