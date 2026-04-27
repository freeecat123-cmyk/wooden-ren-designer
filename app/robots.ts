import type { MetadataRoute } from "next";

const BASE = "https://wooden-ren-designer.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/my-subscription",
          "/design/*/print",
          "/design/*/quote",
          "/design/*/quote/print",
          "/design/*/cut-plan",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
