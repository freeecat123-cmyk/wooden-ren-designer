import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

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
          "/my-designs",
          "/design/*/print",
          "/design/*/quote",
          "/design/*/quote/print",
          "/design/*/cut-plan",
          // Phase 1：英文版 i18n 骨架完成但所有頁面內容仍是中文（Phase 2 才翻譯）。
          // 暫時 disallow /en 整段，避免 Google 把 /en/* 收錄成中文版重複內容。
          // Phase 2 行銷頁完成英譯後，移除這條並更新 sitemap.ts 加 /en URLs + hreflang。
          "/en",
          "/en/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
